import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Heading {
  id: string;
  text: string;
  level: number;
}

/**
 * Convert heading text to the same slug rehype-slug produces:
 * lowercase, spaces → hyphens, strip non-alphanumeric except hyphens.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/** Pull ##, ###, and #### headings out of raw markdown. */
function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  for (const line of markdown.split("\n")) {
    const m = line.match(/^(#{2,4})\s+(.+)$/);
    if (m) {
      const raw = m[2].replace(/\*\*/g, "").replace(/\*/g, "").trim();
      headings.push({ id: slugify(raw), text: raw, level: m[1].length });
    }
  }
  return headings;
}

interface Props {
  content: string;
}

export function TableOfContents({ content }: Props) {
  const [activeId, setActiveId] = useState<string>("");
  const headings = extractHeadings(content);

  /* Observe each heading element and track which is in view */
  useEffect(() => {
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!headings.length) return null;

  return (
    <nav aria-label="Table of contents" className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
      <p className="font-sans text-[0.5625rem] uppercase tracking-[0.12em] text-steel/70 mb-3 pl-0">
        Contents
      </p>
      <ul className="space-y-0.5">
        {headings.map(({ id, text, level }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(id);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className={cn(
                "block font-sans leading-snug py-0.5 pr-2 transition-colors border-l-[1.5px]",
                level === 4
                  ? "pl-5 text-[0.65rem]"
                  : level === 3
                  ? "pl-4 text-[0.7rem]"
                  : "pl-3 text-[0.7rem]",
                activeId === id
                  ? "text-coral border-coral"
                  : level === 4
                  ? "text-coral/60 border-coral/20 hover:text-coral hover:border-coral/40"
                  : "text-steel/80 border-transparent hover:text-deep-blue hover:border-rule"
              )}
            >
              {level === 4 ? (
                <span className="flex items-center gap-1">
                  <span className="text-coral/50 shrink-0">◆</span>
                  <span>{text.replace(/^Live demo:\s*/i, "")}</span>
                </span>
              ) : (
                text
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
