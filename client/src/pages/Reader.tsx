import { useQuery } from "@tanstack/react-query";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ReadingProgress } from "@/components/ReadingProgress";
import { FloatingHeader } from "@/components/FloatingHeader";
import { TableOfContents } from "@/components/TableOfContents";
import { fetchReport } from "@/lib/queryClient";

export default function Reader() {
  const { data: report, isLoading, error } = useQuery({
    queryKey: ["report"],
    queryFn: fetchReport,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="font-sans text-sm text-steel animate-pulse">Loading…</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="font-sans text-sm text-steel">Report not found.</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ReadingProgress />
      <FloatingHeader title={report.title} />

      {/*
       * Two-column layout on large screens:
       *   Left  — sticky TOC sidebar (220 px)
       *   Right — article content capped at 44 rem
       *
       * On small screens the TOC hides and content is full-width.
       */}
      <div className="max-w-[76rem] mx-auto px-5 sm:px-8 py-16">
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-14">

          {/* ── TOC sidebar ─────────────────────────────────────────── */}
          <aside className="hidden lg:block">
            <TableOfContents content={report.content} />
          </aside>

          {/* ── Article + footer ────────────────────────────────────── */}
          <div className="min-w-0">
            <article className="max-w-[44rem]">
              <MarkdownRenderer content={report.content} />
            </article>

            <footer className="max-w-[44rem] mt-24 pt-8 border-t border-rule">
              <p className="font-sans text-[0.75rem] text-steel leading-relaxed">
                © {new Date().getFullYear()} Heuser | Whittington. This paper may be shared freely
                with attribution. For enquiries:{" "}
                <a
                  href="mailto:phil@heuserwhittington.com"
                  className="underline decoration-steel/40 hover:text-deep-blue transition-colors"
                >
                  phil@heuserwhittington.com
                </a>
              </p>
            </footer>
          </div>

        </div>
      </div>
    </div>
  );
}
