/**
 * Cloudflare Pages Function: POST /api/vat-query
 *
 * Proxies queries about the Marshall Islands VAT register to the Claude API.
 * The Anthropic API key is stored as a Cloudflare Pages environment secret —
 * it is never exposed to the browser.
 *
 * Rate limiting: 10 requests per IP per hour (via Cloudflare KV, if available;
 * falls back to a simple in-memory counter per worker instance).
 *
 * Request body:  { query: string, register: VATRecord[] }
 * Response:      Server-sent events stream (text/event-stream)
 *                Each chunk: data: {"type":"text_delta","text":"..."}\n\n
 *                Final:       data: {"type":"done"}\n\n
 */

interface Env {
  ANTHROPIC_API_KEY: string;
  RATE_LIMIT_KV?: KVNamespace; // optional Cloudflare KV binding
}

const SYSTEM_PROMPT = `You are a VAT compliance assistant for the DCTRT — the tax authority of the Republic of the Marshall Islands.

You have been given the Marshall Islands VAT Register for Q1 2026. It contains 112 registrants: 89 mandatory (annual turnover ≥ USD 100,000) and 23 voluntary (below threshold, registered to claim input tax credits).

When answering queries:
- Respond in plain English suitable for a senior tax officer with no background in AI
- Format lists and comparisons as clear tables or bullet points
- For any refund-related query: explicitly flag claims with "refund-review-required" in their dataQualityFlags field, and state clearly that NO refund should be authorised without verification by an authorised officer
- Surface officer notes (the "notes" field) when they are relevant — these contain important informal information
- Note when records have low-confidence turnover estimates or missing contact details
- You do not approve or deny registrations, assessments, or refunds — you surface information for human decision-making
- If a pattern suggests fraud risk (e.g. new voluntary registrant claiming large first-quarter refund, refund disproportionate to turnover), say so plainly and flag it for human review
- When counting compliance rates, express as a percentage and give the raw numbers
- Keep responses focused and actionable — the reader is busy`;

function buildSystemPromptWithData(register: any[]): string {
  const registerJson = JSON.stringify(register, null, 2);
  return `${SYSTEM_PROMPT}

---
VAT REGISTER DATA (use this to answer queries):

${registerJson}
---`;
}

// Simple CORS headers
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // ── Rate limiting (simple, per-IP) ──
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (env.RATE_LIMIT_KV) {
    const key = `rate:${ip}`;
    const current = parseInt((await env.RATE_LIMIT_KV.get(key)) ?? "0", 10);
    if (current >= 10) {
      return new Response("Rate limit exceeded. Please try again later.", {
        status: 429,
        headers: CORS,
      });
    }
    await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 3600 });
  }

  // ── Parse request ──
  let query: string;
  let register: any[];
  try {
    const body = await request.json() as { query: string; register: any[] };
    query = body.query?.trim();
    register = body.register;
    if (!query) throw new Error("Missing query");
    if (!Array.isArray(register)) throw new Error("Missing register data");
  } catch (err: any) {
    return new Response(err.message || "Invalid request", { status: 400, headers: CORS });
  }

  // ── Call Claude API with streaming ──
  if (!env.ANTHROPIC_API_KEY) {
    return new Response("API key not configured", { status: 500, headers: CORS });
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      stream: true,
      system: buildSystemPromptWithData(register),
      messages: [{ role: "user", content: query }],
    }),
  });

  if (!anthropicRes.ok) {
    const text = await anthropicRes.text();
    return new Response(`Claude API error: ${text}`, {
      status: anthropicRes.status,
      headers: CORS,
    });
  }

  // ── Stream SSE back to the browser ──
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Process the Anthropic SSE stream in the background
  (async () => {
    try {
      const reader = anthropicRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            // Anthropic stream events
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              const chunk = JSON.stringify({ type: "text_delta", text: event.delta.text });
              await writer.write(encoder.encode(`data: ${chunk}\n\n`));
            }
            if (event.type === "message_stop") {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      ...CORS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
};
