import React, { Component, Suspense, createContext, useContext, useMemo } from "react";

// ── Error boundary for lazy-loaded widgets ──────────────────────────────────
class WidgetErrorBoundary extends Component<
  { id: string; children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="my-8 p-4 border border-rule bg-linen text-steel text-sm font-sans">
          Widget "{this.props.id}" failed to load: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { visit, SKIP } from "unist-util-visit";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
import { getDemoComponent } from "./charts/chartRegistry";

// ── Context: reference section flag ─────────────────────────────────────────
const ReferenceSectionCtx = createContext(false);

// ── Context: pre-parsed footnote map (number → plain-text excerpt) ──────────
const FootnotesCtx = createContext<Map<string, string>>(new Map());

/**
 * Parse [^N]: text definitions from raw markdown.
 * Strips basic markdown formatting and joins continuation lines.
 */
function parseFootnotes(markdown: string): Map<string, string> {
  const map = new Map<string, string>();
  // Match [^key]: text until next footnote, horizontal rule, or heading
  const regex = /^\[\^([^\]]+)\]:\s*([\s\S]+?)(?=\n\[\^|\n---|\n#{1,6} |$)/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(markdown)) !== null) {
    const key = m[1];
    const raw = m[2]
      .replace(/\n\s{4,}/g, " ") // continuation lines
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();
    map.set(key, raw);
  }
  return map;
}

// ── Rehype plugin: tag footnote <sup> refs with fn-ref class ────────────────
function rehypeFootnoteClass() {
  return (tree: any) => {
    visit(tree, "element", (node: any, index: number | undefined, parent: any) => {
      if (node.tagName !== "sup" || index == null || !parent?.children) return;
      const supText = hastText(node).trim();
      if (!/^\d{1,3}$/.test(supText)) return;
      const prev = index > 0 ? parent.children[index - 1] : null;
      if (!prev) return;
      if (prev.type === "text") {
        const last = prev.value?.trimEnd().slice(-1) || "";
        if (/[.,;:!?)"'""''—–\]]/.test(last)) {
          node.properties = node.properties || {};
          node.properties.className = (node.properties.className || []).concat("fn-ref");
        }
      }
      return SKIP;
    });
  };
}

function hastText(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.value || "";
  if (node.children) return node.children.map(hastText).join("");
  return "";
}

// ── Demo embed: <div data-demo="id"> → lazy component ───────────────────────
function DemoEmbed({ id }: { id: string }) {
  const Component = getDemoComponent(id);
  if (!Component) {
    return (
      <div className="my-8 p-4 border border-rule bg-linen text-steel text-sm font-sans">
        Demo not found: {id}
      </div>
    );
  }
  return (
    <WidgetErrorBoundary id={id}>
      <Suspense
        fallback={
          <div className="my-8 py-12 flex items-center justify-center text-steel text-sm font-sans">
            Loading demo…
          </div>
        }
      >
        <Component />
      </Suspense>
    </WidgetErrorBoundary>
  );
}

// ── Footnote tooltip ─────────────────────────────────────────────────────────
function FootnoteTooltip({ num, text, children }: { num: string; text: string; children: React.ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="fn-trigger cursor-help">{children}</span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="center"
            sideOffset={4}
            className={cn(
              "z-50 max-w-[320px] rounded-sm px-3 py-2 shadow-lg",
              "bg-navy text-off-white font-sans text-[0.75rem] leading-relaxed",
              "animate-in fade-in-0 zoom-in-95"
            )}
          >
            <span className="text-steel/60 mr-1.5 font-mono text-[0.65rem]">[{num}]</span>
            {text}
            <Tooltip.Arrow className="fill-navy" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// ── Named component handlers ─────────────────────────────────────────────────

function MdParagraph({ node, children, ...props }: any) {
  const inRefs = useContext(ReferenceSectionCtx);

  const hasImage = node?.children?.some((c: any) => c.tagName === "img" || c.properties?.src);
  if (hasImage) return <>{children}</>;

  const firstText = node?.children?.[0]?.value || "";
  if (/^Footnote/.test(firstText)) {
    return (
      <p className="font-sans text-[0.8125rem] leading-[1.6] mb-2 text-steel" {...props}>
        {children}
      </p>
    );
  }

  if (inRefs) {
    return (
      <p
        className="font-sans text-[0.8125rem] leading-[1.55] mb-1.5 text-foreground/70 pl-6 -indent-6"
        {...props}
      >
        {children}
      </p>
    );
  }

  return (
    <p className="font-serif text-[1.0625rem] leading-[1.75] mb-5 text-foreground" {...props}>
      {children}
    </p>
  );
}

function MdH1({ children, ...props }: any) {
  return (
    <h1
      className="font-serif text-[1.875rem] font-bold text-navy leading-tight mb-3 mt-0"
      {...props}
    >
      {children}
    </h1>
  );
}

function MdH2({ children, id, ...props }: any) {
  return (
    <h2
      id={id}
      className="font-serif text-[1.375rem] font-semibold text-navy leading-snug mt-12 mb-4 pt-6 border-t border-rule/60"
      {...props}
    >
      {children}
    </h2>
  );
}

function MdH3({ children, id, ...props }: any) {
  return (
    <h3
      id={id}
      className="font-sans text-[0.9375rem] font-semibold text-deep-blue uppercase tracking-[0.06em] mt-8 mb-3"
      {...props}
    >
      {children}
    </h3>
  );
}

function MdH4({ children, id, ...props }: any) {
  return (
    <h4
      id={id}
      className="font-serif text-[1.0625rem] font-semibold text-navy mt-6 mb-2"
      {...props}
    >
      {children}
    </h4>
  );
}

function MdBlockquote({ children, ...props }: any) {
  return (
    <blockquote
      className="my-6 pl-5 border-l-[3px] border-steel/40 font-serif italic text-[1rem] leading-[1.7] text-deep-blue/80"
      {...props}
    >
      {children}
    </blockquote>
  );
}

function MdUl({ children, ...props }: any) {
  return (
    <ul className="my-4 ml-0 list-none space-y-1.5" {...props}>
      {children}
    </ul>
  );
}

function MdOl({ children, ...props }: any) {
  return (
    <ol className="my-4 ml-5 list-decimal space-y-1.5" {...props}>
      {children}
    </ol>
  );
}

function MdLi({ children, ...props }: any) {
  return (
    <li className="font-serif text-[1.0375rem] leading-[1.7] text-foreground pl-4 relative before:content-['—'] before:absolute before:left-0 before:text-steel/60 before:font-sans">
      {children}
    </li>
  );
}

function MdStrong({ children, ...props }: any) {
  return (
    <strong className="font-semibold text-navy" {...props}>
      {children}
    </strong>
  );
}

function MdEm({ children, ...props }: any) {
  return <em className="italic" {...props}>{children}</em>;
}

function MdCode({ inline, children, ...props }: any) {
  if (inline) {
    return (
      <code
        className="font-mono text-[0.875em] bg-muted px-1.5 py-0.5 rounded-sm text-deep-blue"
        {...props}
      >
        {children}
      </code>
    );
  }
  return (
    <pre className="my-6 p-4 bg-navy rounded-sm overflow-x-auto">
      <code className="font-mono text-[0.8125rem] leading-[1.6] text-off-white" {...props}>
        {children}
      </code>
    </pre>
  );
}

function MdHr() {
  return <hr className="my-10 border-0 border-t border-rule" />;
}

function MdTable({ children, ...props }: any) {
  return (
    <div className="my-8 overflow-x-auto">
      <table className="w-full border-collapse prose" {...props}>
        {children}
      </table>
    </div>
  );
}

function MdThead({ children, ...props }: any) {
  return <thead {...props}>{children}</thead>;
}

function MdTbody({ children, ...props }: any) {
  return <tbody {...props}>{children}</tbody>;
}

function MdTr({ children, ...props }: any) {
  return <tr {...props}>{children}</tr>;
}

function MdTh({ children, ...props }: any) {
  return (
    <th
      className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-steel border-b-[1.5px] border-deep-blue pb-2 pr-4 text-left"
      {...props}
    >
      {children}
    </th>
  );
}

function MdTd({ children, ...props }: any) {
  return (
    <td
      className="font-serif text-[0.875rem] leading-[1.5] border-b border-rule/60 py-2 pr-4 align-top text-foreground"
      {...props}
    >
      {children}
    </td>
  );
}

function MdSection({ node, children, ...props }: any) {
  const isRefs =
    node?.properties?.className?.includes?.("footnotes") ||
    node?.properties?.dataType === "footnotes" ||
    node?.properties?.dataFootnotes !== undefined;
  return (
    <ReferenceSectionCtx.Provider value={isRefs}>
      <section {...props}>{children}</section>
    </ReferenceSectionCtx.Provider>
  );
}

/**
 * MdA — handles all <a> elements.
 * Footnote back-references (#user-content-fn-N) get a hover tooltip.
 */
function MdA({ href, node, children, ...props }: any) {
  const footnotes = useContext(FootnotesCtx);

  // remark-gfm footnote pattern: href="#user-content-fn-1" or href="#fn-1"
  const fnMatch = href?.match(/^#(?:user-content-)?fn-(\d+)$/);
  if (fnMatch) {
    const num = fnMatch[1];
    const text = footnotes.get(num);
    if (text) {
      return (
        <FootnoteTooltip num={num} text={text}>
          <a
            href={href}
            {...props}
            onClick={(e: React.MouseEvent) => e.preventDefault()}
            className="font-sans text-[0.75em] text-teal hover:text-coral transition-colors no-underline"
          >
            {children}
          </a>
        </FootnoteTooltip>
      );
    }
  }

  // Footnote return arrow — suppress it (we don't navigate back)
  if (href?.match(/^#(?:user-content-)?fnref-/)) {
    return null;
  }

  // Normal link
  return (
    <a
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      className="text-teal underline decoration-teal/30 hover:decoration-teal transition-colors"
      {...props}
    >
      {children}
    </a>
  );
}

/**
 * MdDiv — renders raw HTML divs.
 * Detects the data-demo attribute in every location hast/react-markdown
 * might store it (property name varies by version and processing pipeline).
 */
function MdDiv({ node, children, ...props }: any) {
  // hast may normalise data-demo as: dataDemo (camelCase), datademo (lowercase),
  // or leave it as the prop key "data-demo" passed through to React.
  const demoId =
    props["data-demo"] ??
    node?.properties?.dataDemo ??
    node?.properties?.["datademo"] ??
    node?.properties?.["data-demo"];

  if (demoId) {
    return <DemoEmbed id={String(demoId)} />;
  }
  return <div {...props}>{children}</div>;
}

// ── Component map ────────────────────────────────────────────────────────────

const components = {
  p: MdParagraph,
  h1: MdH1,
  h2: MdH2,
  h3: MdH3,
  h4: MdH4,
  blockquote: MdBlockquote,
  ul: MdUl,
  ol: MdOl,
  li: MdLi,
  strong: MdStrong,
  em: MdEm,
  code: MdCode,
  hr: MdHr,
  table: MdTable,
  thead: MdThead,
  tbody: MdTbody,
  tr: MdTr,
  th: MdTh,
  td: MdTd,
  section: MdSection,
  div: MdDiv,
  a: MdA,
} as any;

// ── Public API ───────────────────────────────────────────────────────────────

interface Props {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: Props) {
  const footnotes = useMemo(() => parseFootnotes(content), [content]);

  return (
    <FootnotesCtx.Provider value={footnotes}>
      <div className={cn("prose-content", className)}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSlug, rehypeFootnoteClass]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
    </FootnotesCtx.Provider>
  );
}
