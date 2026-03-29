import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface VATRecord {
  id: string;
  businessName: string;
  registrationType: "mandatory" | "voluntary";
  sector: string;
  grtNo: string;
  owner: string;
  contactEmail: string | null;
  contactPhone: string;
  officerAssigned: string;
  estimatedTurnover: number;
  turnoverConfidence: "high" | "medium" | "low";
  q1FilingStatus: string;
  q1PaymentStatus: string;
  refundClaimAmount: number | null;
  dataQualityFlags: string[];
  notes: string;
}

interface SourceFile {
  filename: string;
  description: string;
  schemaNote: string;
  columns: string[];
  rows: (string | null)[][];
}

type Panel = "before" | "workflow" | "after";

// ── Example queries ────────────────────────────────────────────────────────

const EXAMPLE_QUERIES = [
  { label: "Non-filers", query: "Which businesses haven't filed their Q1 return? List them with contact details." },
  { label: "Refund flags", query: "List all refund claims and flag any that warrant human review before payment is authorised." },
  { label: "Sector compliance", query: "What is the Q1 filing compliance rate by sector?" },
  { label: "Data gaps", query: "What data quality issues exist in this register? Summarise the key problems." },
  { label: "Voluntary registrants", query: "How many voluntary registrants are there, and what motivated most of them to register?" },
];

// ── System prompt (visible in workflow panel) ──────────────────────────────

const SYSTEM_PROMPT_DISPLAY = `You are a VAT compliance assistant for the DCTRT — the tax authority of the Republic of the Marshall Islands.

You have access to the Marshall Islands VAT Register for Q1 2027 (112 registrants: 89 mandatory, 23 voluntary).

When answering queries:
- Respond in plain English suitable for a senior tax officer
- Format lists as clear tables or bullet points
- For refund-related queries: always flag claims that warrant human review, and state clearly that no refund should be authorised without verification by an authorised officer
- Note when a query touches records with missing or low-confidence data
- You do not approve or deny registrations, assessments, or refunds
- If a pattern suggests fraud risk, say so plainly — but always route the decision to a human officer

The register includes officer notes that contain informal but valuable information about taxpayers. Surface these notes when they are relevant to the query.`;

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US");
}

function flagColor(flags: string[]) {
  if (flags.includes("refund-review-required")) return "text-red-600";
  if (flags.length > 0) return "text-amber-600";
  return "text-sage";
}

function filingBadge(status: string) {
  if (status.includes("Not filed")) return "bg-red-50 text-red-700 border-red-200";
  if (status.includes("pending")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (status.includes("late")) return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-green-50 text-green-700 border-green-200";
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatBar({ register }: { register: VATRecord[] }) {
  const mandatory = register.filter((r) => r.registrationType === "mandatory").length;
  const voluntary = register.filter((r) => r.registrationType === "voluntary").length;
  const notFiled = register.filter((r) => r.q1FilingStatus.includes("Not filed")).length;
  const refunds = register.filter((r) => r.refundClaimAmount !== null).length;
  const flags = register.filter((r) => r.dataQualityFlags.length > 0).length;

  const stat = (label: string, value: string | number, cls = "") => (
    <div className="flex flex-col">
      <span className={cn("font-sans text-lg font-semibold text-navy tabular-nums", cls)}>
        {value}
      </span>
      <span className="font-sans text-[0.6875rem] text-steel uppercase tracking-wide">{label}</span>
    </div>
  );

  return (
    <div className="flex flex-wrap gap-6 py-3 px-4 bg-white border border-rule mb-4">
      {stat("Total registrants", register.length)}
      {stat("Mandatory", mandatory)}
      {stat("Voluntary", voluntary, "text-teal")}
      {stat("Q1 non-filers", notFiled, notFiled > 0 ? "text-red-600" : "")}
      {stat("Refund claims", refunds)}
      {stat("Data flags", flags, flags > 0 ? "text-amber-600" : "")}
    </div>
  );
}

function RegisterTable({ register }: { register: VATRecord[] }) {
  const [showAll, setShowAll] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "mandatory" | "voluntary">("all");
  const [filterFiled, setFilterFiled] = useState<"all" | "filed" | "not-filed">("all");

  const filtered = register.filter((r) => {
    if (filterType !== "all" && r.registrationType !== filterType) return false;
    if (filterFiled === "filed" && r.q1FilingStatus.includes("Not filed")) return false;
    if (filterFiled === "not-filed" && !r.q1FilingStatus.includes("Not filed")) return false;
    return true;
  });

  const displayed = fullscreen ? filtered : (showAll ? filtered : filtered.slice(0, 12));

  const tableContent = (inFullscreen: boolean) => (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {(["all", "mandatory", "voluntary"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={cn(
              "font-sans text-[0.6875rem] uppercase tracking-wide px-3 py-1 border rounded-sm transition-colors",
              filterType === t
                ? "bg-deep-blue text-white border-deep-blue"
                : "bg-white text-steel border-rule hover:border-steel"
            )}
          >
            {t === "all" ? "All" : t}
          </button>
        ))}
        <span className="w-px bg-rule mx-1 self-stretch" />
        {(["all", "not-filed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterFiled(f)}
            className={cn(
              "font-sans text-[0.6875rem] uppercase tracking-wide px-3 py-1 border rounded-sm transition-colors",
              filterFiled === f
                ? "bg-deep-blue text-white border-deep-blue"
                : "bg-white text-steel border-rule hover:border-steel"
            )}
          >
            {f === "all" ? "All statuses" : "Non-filers only"}
          </button>
        ))}
        <span className="flex-1" />
        <button
          onClick={() => setFullscreen(!inFullscreen)}
          className="font-sans text-[0.6875rem] uppercase tracking-wide px-3 py-1 border border-rule rounded-sm text-steel hover:border-deep-blue hover:text-deep-blue transition-colors ml-auto"
          title={inFullscreen ? "Close full view" : "Expand to full screen"}
        >
          {inFullscreen ? "✕ Close" : "⊞ Expand table"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-rule">
        <table className="w-full text-[0.75rem] font-sans border-collapse">
          <thead>
            <tr className="bg-linen">
              <th className="text-left font-semibold text-steel uppercase tracking-wide text-[0.625rem] px-3 py-2 border-b border-rule whitespace-nowrap">ID</th>
              <th className="text-left font-semibold text-steel uppercase tracking-wide text-[0.625rem] px-3 py-2 border-b border-rule">Business</th>
              <th className="text-left font-semibold text-steel uppercase tracking-wide text-[0.625rem] px-3 py-2 border-b border-rule">Type</th>
              <th className="text-left font-semibold text-steel uppercase tracking-wide text-[0.625rem] px-3 py-2 border-b border-rule">Sector</th>
              <th className="text-right font-semibold text-steel uppercase tracking-wide text-[0.625rem] px-3 py-2 border-b border-rule whitespace-nowrap">Est. turnover</th>
              <th className="text-left font-semibold text-steel uppercase tracking-wide text-[0.625rem] px-3 py-2 border-b border-rule">Q1 filing</th>
              <th className="text-left font-semibold text-steel uppercase tracking-wide text-[0.625rem] px-3 py-2 border-b border-rule">Officer</th>
              <th className="text-left font-semibold text-steel uppercase tracking-wide text-[0.625rem] px-3 py-2 border-b border-rule">Flags</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((r) => (
              <tr
                key={r.id}
                className={cn(
                  "border-b border-rule/50 hover:bg-linen/50 transition-colors",
                  r.dataQualityFlags.includes("refund-review-required") && "bg-red-50/40"
                )}
              >
                <td className="px-3 py-2 font-mono text-[0.6875rem] text-steel whitespace-nowrap">{r.id}</td>
                <td className="px-3 py-2 text-navy font-medium max-w-[180px]">
                  <span className="block truncate" title={r.businessName}>{r.businessName}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={cn(
                    "inline-block px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide rounded-sm border",
                    r.registrationType === "mandatory"
                      ? "bg-deep-blue/10 text-deep-blue border-deep-blue/20"
                      : "bg-teal/10 text-teal border-teal/20"
                  )}>
                    {r.registrationType}
                  </span>
                </td>
                <td className="px-3 py-2 text-steel max-w-[120px]">
                  <span className="block truncate" title={r.sector}>{r.sector}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-navy whitespace-nowrap">
                  {r.estimatedTurnover > 0 ? fmt(r.estimatedTurnover) : "—"}
                  {r.turnoverConfidence !== "high" && (
                    <span className="ml-1 text-[0.625rem] text-amber-500" title={`Confidence: ${r.turnoverConfidence}`}>
                      {r.turnoverConfidence === "low" ? "⚠" : "~"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={cn("inline-block px-1.5 py-0.5 text-[0.625rem] border rounded-sm", filingBadge(r.q1FilingStatus))}>
                    {r.q1FilingStatus.length > 28 ? r.q1FilingStatus.slice(0, 26) + "…" : r.q1FilingStatus}
                  </span>
                </td>
                <td className="px-3 py-2 text-steel whitespace-nowrap">{r.officerAssigned}</td>
                <td className="px-3 py-2">
                  {r.dataQualityFlags.length > 0 ? (
                    <span className={cn("text-[0.6875rem] font-medium", flagColor(r.dataQualityFlags))}>
                      {r.dataQualityFlags.includes("refund-review-required")
                        ? "⚠ Refund review"
                        : `${r.dataQualityFlags.length} flag${r.dataQualityFlags.length > 1 ? "s" : ""}`}
                    </span>
                  ) : (
                    <span className="text-[0.6875rem] text-sage">✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!inFullscreen && filtered.length > 12 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 font-sans text-[0.75rem] text-teal hover:text-deep-blue underline decoration-teal/40"
        >
          {showAll ? `Show fewer` : `Show all ${filtered.length} records`}
        </button>
      )}

      <p className="mt-3 font-sans text-[0.6875rem] text-steel italic">
        Turnover figures: GRT returns FY2025. ⚠ = low confidence estimate. ~ = medium confidence.
        All figures in USD.
      </p>
    </>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-auto">
        <div className="max-w-[1200px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif text-[1.0625rem] font-semibold text-navy">
                Marshall Islands VAT Register — Q1 2027
              </h2>
              <p className="font-sans text-[0.75rem] text-steel mt-0.5">
                {filtered.length} records shown · {register.length} total registrants
              </p>
            </div>
          </div>
          {tableContent(true)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {tableContent(false)}
    </div>
  );
}

function SourceFilePreview({ source }: { source: SourceFile }) {
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const rows = expanded ? source.rows : source.rows.slice(0, 5);

  const tableBody = (allRows: (string | null)[][]) => (
    <table className="w-full text-[0.6875rem] font-mono border-collapse">
      <thead>
        <tr className="bg-white">
          {source.columns.map((col) => (
            <th key={col} className="text-left text-steel font-semibold px-2 py-1.5 border-b border-rule/60 whitespace-nowrap">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {allRows.map((row, i) => (
          <tr key={i} className="border-b border-rule/40 hover:bg-linen/30">
            {row.map((cell, j) => (
              <td
                key={j}
                className={cn(
                  "px-2 py-1.5 align-top max-w-[200px] truncate",
                  !cell ? "text-rule italic" : "text-navy",
                  j === row.length - 1 && cell && cell.length > 5 ? "text-amber-700 italic" : ""
                )}
                title={cell || ""}
              >
                {cell || "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-auto">
        <div className="max-w-[1200px] mx-auto px-6 py-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-serif text-[1.0625rem] font-semibold text-navy">{source.filename}</h2>
              <p className="font-sans text-[0.75rem] text-steel mt-0.5">{source.description}</p>
            </div>
            <button
              onClick={() => setFullscreen(false)}
              className="font-sans text-[0.6875rem] uppercase tracking-wide px-3 py-1 border border-rule rounded-sm text-steel hover:border-deep-blue hover:text-deep-blue transition-colors ml-6 shrink-0"
            >
              ✕ Close
            </button>
          </div>
          <div className="px-3 py-2 bg-amber-50/40 border border-rule border-b-0 mb-0">
            <p className="font-sans text-[0.6875rem] text-amber-700 italic">{source.schemaNote}</p>
          </div>
          <div className="overflow-x-auto border border-rule">
            {tableBody(source.rows)}
          </div>
          <p className="mt-3 font-sans text-[0.6875rem] text-steel italic">
            {source.rows.length} rows · All data fictional and illustrative.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-rule mb-4">
      <div className="flex items-center justify-between px-3 py-2 bg-linen border-b border-rule">
        <div
          className="flex items-center gap-3 cursor-pointer flex-1"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="font-mono text-[0.6875rem] text-navy font-semibold">{source.filename}</span>
          <span className="font-sans text-[0.6875rem] text-steel">{source.rows.length} rows</span>
          <span className="font-sans text-[0.6875rem] text-teal">{expanded ? "▲ collapse" : "▼ expand"}</span>
        </div>
        <button
          onClick={() => setFullscreen(true)}
          className="font-sans text-[0.6875rem] uppercase tracking-wide px-2.5 py-1 border border-rule rounded-sm text-steel hover:border-deep-blue hover:text-deep-blue transition-colors ml-3 shrink-0"
          title="Expand to full screen"
        >
          ⊞ Expand table
        </button>
      </div>
      <div className="px-3 py-2 bg-amber-50/40 border-b border-rule">
        <p className="font-sans text-[0.6875rem] text-amber-700 italic">{source.schemaNote}</p>
      </div>
      <div className="overflow-x-auto">
        {tableBody(rows)}
      </div>
      {!expanded && source.rows.length > 5 && (
        <div
          className="px-3 py-1.5 bg-white border-t border-rule text-center cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          <span className="font-sans text-[0.6875rem] text-teal">
            + {source.rows.length - 5} more rows
          </span>
        </div>
      )}
    </div>
  );
}

function QueryInterface({ register }: { register: VATRecord[] }) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const responseRef = useRef<HTMLDivElement>(null);

  async function runQuery(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError("");
    setResponse("");

    try {
      const res = await fetch("/api/vat-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, register }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      // Streaming response
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // SSE format: data: {...}\n\n
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text_delta") {
                accumulated += data.text;
                setResponse(accumulated);
              }
            } catch {
              // non-JSON line, skip
            }
          }
        }
        responseRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch (err: any) {
      setError(err.message || "Query failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Example buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {EXAMPLE_QUERIES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => { setQuery(ex.query); runQuery(ex.query); }}
            className="font-sans text-[0.6875rem] px-2.5 py-1 border border-rule bg-white text-deep-blue hover:border-teal hover:text-teal rounded-sm transition-colors"
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Text input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runQuery(query)}
          placeholder="Ask a question about this register…"
          className="flex-1 font-sans text-sm px-3 py-2 border border-rule bg-white text-navy placeholder-steel/60 focus:outline-none focus:border-teal rounded-sm"
        />
        <button
          onClick={() => runQuery(query)}
          disabled={loading || !query.trim()}
          className="font-sans text-sm px-4 py-2 bg-deep-blue text-white rounded-sm hover:bg-navy disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {loading ? "Running…" : "Ask"}
        </button>
      </div>

      {/* Response */}
      {(response || loading || error) && (
        <div className="mt-4" ref={responseRef}>
          <div className="border border-rule bg-white">
            {/* Header */}
            <div className="px-4 py-2 bg-linen border-b border-rule flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", loading ? "bg-gold animate-pulse" : error ? "bg-red-500" : "bg-sage")} />
              <span className="font-sans text-[0.6875rem] text-steel uppercase tracking-wide">
                {loading ? "Generating response…" : error ? "Error" : "Response"}
              </span>
            </div>

            {/* Content */}
            <div className="px-4 py-3">
              {error ? (
                <p className="font-sans text-sm text-red-600">{error}</p>
              ) : (
                <ResponseRenderer text={response} loading={loading} />
              )}
            </div>

            {/* Human review notice */}
            {!loading && response && (
              <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 flex items-start gap-2">
                <span className="text-amber-600 mt-0.5 flex-shrink-0">⚠</span>
                <p className="font-sans text-[0.6875rem] text-amber-700 leading-relaxed">
                  All outputs require human review before administrative action. This tool does not
                  approve or deny registrations, assessments, or refunds.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Render the streaming markdown-like response as formatted HTML */
function ResponseRenderer({ text, loading }: { text: string; loading: boolean }) {
  // Simple line-by-line render — handles bullet points, headers, bold
  const lines = text.split("\n");
  return (
    <div className="font-sans text-sm text-navy leading-relaxed space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;

        // Markdown-style bold
        const renderBold = (s: string) => {
          const parts = s.split(/\*\*(.+?)\*\*/g);
          return parts.map((p, j) =>
            j % 2 === 1 ? <strong key={j} className="font-semibold text-navy">{p}</strong> : p
          );
        };

        // Headers
        if (line.startsWith("## ")) return <h3 key={i} className="font-semibold text-navy mt-3 mb-1 text-[0.875rem] uppercase tracking-wide">{renderBold(line.slice(3))}</h3>;
        if (line.startsWith("# "))  return <h2 key={i} className="font-semibold text-navy mt-4 mb-2">{renderBold(line.slice(2))}</h2>;

        // Warning / flag lines
        if (line.includes("⚠") || line.toLowerCase().includes("flagged") || line.toLowerCase().includes("human review")) {
          return (
            <div key={i} className="flex items-start gap-2 pl-2 border-l-2 border-red-400 my-2">
              <p className="text-red-700">{renderBold(line)}</p>
            </div>
          );
        }

        // Bullet points
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-steel mt-0.5 flex-shrink-0">—</span>
              <p>{renderBold(line.slice(2))}</p>
            </div>
          );
        }

        // Numbered list
        if (/^\d+\.\s/.test(line)) {
          const [num, ...rest] = line.split(/\.\s/);
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-steel flex-shrink-0 w-4">{num}.</span>
              <p>{renderBold(rest.join(". "))}</p>
            </div>
          );
        }

        // Table row (pipe-separated)
        if (line.includes("|")) {
          const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
          const isSeparator = cells.every((c) => /^[-:]+$/.test(c));
          if (isSeparator) return null;
          return (
            <div key={i} className="grid gap-2 border-b border-rule/40 py-1" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
              {cells.map((c, j) => (
                <span key={j} className={cn("text-[0.75rem]", j === 0 ? "font-medium text-navy" : "text-foreground/80")}>
                  {renderBold(c)}
                </span>
              ))}
            </div>
          );
        }

        return <p key={i}>{renderBold(line)}</p>;
      })}
      {loading && <span className="inline-block w-2 h-4 bg-steel/60 animate-pulse ml-0.5 align-middle" />}
    </div>
  );
}

// ── Main Widget ────────────────────────────────────────────────────────────

export function VATDemoWidget() {
  const [panel, setPanel] = useState<Panel>("before");
  const widgetRef = useRef<HTMLDivElement>(null);

  function goToPanel(next: Panel) {
    setPanel(next);
    requestAnimationFrame(() => {
      widgetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const { data: register } = useQuery<VATRecord[]>({
    queryKey: ["vat-register"],
    queryFn: () => fetch("/data/vat-register.json").then((r) => r.json()),
    staleTime: Infinity,
  });

  const { data: sourceA } = useQuery<SourceFile>({
    queryKey: ["source-a"],
    queryFn: () => fetch("/data/source-a.json").then((r) => r.json()),
    staleTime: Infinity,
  });

  const { data: sourceB } = useQuery<SourceFile>({
    queryKey: ["source-b"],
    queryFn: () => fetch("/data/source-b.json").then((r) => r.json()),
    staleTime: Infinity,
  });

  const { data: sourceC } = useQuery<SourceFile>({
    queryKey: ["source-c"],
    queryFn: () => fetch("/data/source-c.json").then((r) => r.json()),
    staleTime: Infinity,
  });

  const tabs: { id: Panel; label: string; sublabel: string }[] = [
    { id: "before",   label: "Before",   sublabel: "Three source files, inconsistent schemas" },
    { id: "workflow", label: "Workflow",  sublabel: "The structured prompt that cleans the data" },
    { id: "after",    label: "After",     sublabel: "VAT-ready register — queryable in plain English" },
  ];

  return (
    <div id="vat-demo" ref={widgetRef} className="my-10 border border-rule bg-white">
      {/* Widget header */}
      <div className="px-5 py-4 bg-navy border-b border-navy/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-white/50 mb-1">
              Live demonstration
            </div>
            <h3 className="font-serif text-[1.0625rem] font-semibold text-white leading-snug">
              Marshall Islands VAT Register — Q1 2027
            </h3>
            <p className="font-sans text-[0.75rem] text-white/60 mt-1">
              112 illustrative registrants · Claude API · All data fictional
            </p>
          </div>
          <div className="font-sans text-[0.6875rem] text-white/50 text-right hidden sm:block leading-relaxed">
            All outputs generated with<br />commercially available<br />large language models
          </div>
        </div>
      </div>

      {/* Panel tabs */}
      <div className="flex border-b border-rule">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => goToPanel(tab.id)}
            className={cn(
              "flex-1 px-4 py-3 font-sans text-sm text-left transition-colors border-r last:border-r-0 border-rule",
              panel === tab.id
                ? "bg-white text-navy border-b-2 border-b-coral -mb-px"
                : "bg-linen text-steel hover:bg-white hover:text-navy"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-steel/20 flex items-center justify-center text-[0.625rem] font-bold text-steel flex-shrink-0">
                {i + 1}
              </span>
              <div>
                <div className="font-semibold">{tab.label}</div>
                <div className="text-[0.6875rem] text-steel hidden sm:block">{tab.sublabel}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="p-5">

        {/* ── Panel 1: Before ── */}
        {panel === "before" && (
          <div>
            <p className="font-sans text-sm text-steel mb-4 leading-relaxed">
              This demonstration assumes that Marshall Islands VAT registration data exists across three
              source files — a plausible starting point for a small administration with no unified taxpayer
              database. Each source uses different column names, inconsistent business-name spelling, and
              free-form officer notes that contain useful information but are structurally invisible to any
              reporting system.
            </p>
            {sourceA && <SourceFilePreview source={sourceA} />}
            {sourceB && <SourceFilePreview source={sourceB} />}
            {sourceC && <SourceFilePreview source={sourceC} />}
            <div className="mt-4 pt-4 border-t border-rule">
              <p className="font-sans text-[0.75rem] text-steel italic">
                The notes columns in Source A and Source C contain officer observations about understated
                turnover, potential duplicate registrations, and voluntary registration motivation. A
                conventional database migration treats these as unstructured text and typically discards
                them. The prompt workflow in Panel 2 preserves them as structured fields.
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => goToPanel("workflow")}
                className="font-sans text-sm px-4 py-2 bg-deep-blue text-white rounded-sm hover:bg-navy transition-colors"
              >
                See the workflow →
              </button>
            </div>
          </div>
        )}

        {/* ── Panel 2: Workflow ── */}
        {panel === "workflow" && (
          <div>
            <p className="font-sans text-sm text-steel mb-5 leading-relaxed">
              The prompt below was used to transform the three source files in Panel 1 into the structured
              register shown in Panel 3. It encodes which fields matter, what the risk indicators are, and
              which information in officer notes should be preserved rather than discarded.
            </p>

            <div className="mb-6">
              <div className="font-sans text-[0.6875rem] font-semibold uppercase tracking-wide text-steel mb-2">
                Data transformation prompt
              </div>
              <pre className="bg-navy text-off-white font-mono text-[0.75rem] leading-relaxed p-4 overflow-x-auto rounded-sm whitespace-pre-wrap">
{`System: You are a data integration assistant for the DCTRT,
the tax authority of the Republic of the Marshall Islands.

You will receive three source files:
  Source A: GRT Register export (primary taxpayer database)
  Source B: Business Licence Register (Ministry of Resources)
  Source C: VAT Interest Log (officer notes on enquiries)

Task: Produce a unified VAT-ready register with these fields:
  - Provisional VAT ID (format: MIVA-M### or MIVA-V###)
  - Legal business name (reconcile spelling variations across sources)
  - Owner / contact name
  - Sector (classify from available description)
  - Best turnover estimate (note source and confidence: high/medium/low)
  - Registration type: mandatory (≥$100k) / voluntary-likely / below-threshold
  - Contact email and phone (best available; flag if missing)
  - Data quality flags: missing, inconsistent, or unverified fields
  - Officer notes: preserve any note that may affect compliance risk

Rules:
  - Never discard a note. If a note suggests understated income, flag it.
  - Flag potential duplicate registrations; do not merge without human review.
  - Flag any business in Source C whose notes suggest voluntary registration
    motivation (especially input credit / refund recovery intent).
  - Flag businesses whose licence has expired but whose GRT registration
    is still active — potential compliance gap.
  - You are producing a draft for human review, not a final register.
  - If a business appears in Source C but not in Sources A or B,
    create a provisional entry and flag for verification.`}
              </pre>
            </div>

            <div className="mb-6">
              <div className="font-sans text-[0.6875rem] font-semibold uppercase tracking-wide text-steel mb-2">
                Query system prompt
              </div>
              <pre className="bg-navy text-off-white font-mono text-[0.75rem] leading-relaxed p-4 overflow-x-auto rounded-sm whitespace-pre-wrap">
{SYSTEM_PROMPT_DISPLAY}
              </pre>
            </div>

            <div className="bg-linen border border-rule p-4 mb-4">
              <p className="font-sans text-[0.8125rem] text-deep-blue leading-relaxed">
                <strong className="font-semibold">What this illustrates.</strong> The tools shown here — Claude, a
                spreadsheet, a text editor — are commercially available for approximately US$20 per month.
                The expertise lies in knowing which fields matter, what the risk indicators are, where
                human judgment must be preserved, and how to structure that knowledge so an LLM can apply
                it consistently. The prompt above is one example of what that structured knowledge looks like.
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => goToPanel("after")}
                className="font-sans text-sm px-4 py-2 bg-deep-blue text-white rounded-sm hover:bg-navy transition-colors"
              >
                See the result →
              </button>
            </div>
          </div>
        )}

        {/* ── Panel 3: After ── */}
        {panel === "after" && register && (
          <div>
            <p className="font-sans text-sm text-steel mb-4 leading-relaxed">
              The three source files have been reconciled into a single structured register. Data quality
              flags are visible inline. The register can be queried in plain English using the interface
              below — select an example or type your own.
            </p>

            <StatBar register={register} />
            <RegisterTable register={register} />

            <div className="mt-8 pt-6 border-t border-rule">
              <div className="font-sans text-[0.6875rem] font-semibold uppercase tracking-wide text-steel mb-3">
                Query the register in plain English
              </div>
              <QueryInterface register={register} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
