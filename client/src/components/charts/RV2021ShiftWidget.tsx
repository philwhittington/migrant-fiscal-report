import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface RV2021Record {
  year: number;
  visa_group: string;
  count: number;
  tax_billions: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Visa groups to display (excludes NZ-born and Other) */
const DISPLAY_GROUPS = [
  "Skilled/Investor",
  "Family",
  "Humanitarian",
  "Other Resident",
  "Temp Work",
  "Student",
  "Australian",
  "Unknown",
] as const;

const GROUP_COLORS: Record<string, string> = {
  "Skilled/Investor": "#6EA1BE",
  Family: "#7A9E7E",
  Humanitarian: "#C9A227",
  "Other Resident": "#6F899A",
  "Temp Work": "#163E5F",
  Student: "#F26B44",
  Australian: "#152F43",
  Unknown: "#D1D5DB",
};

const BEFORE_YEAR = 2021;
const AFTER_YEAR = 2024;

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtK(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("en-NZ");
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtChange(before: number, after: number): string {
  const diff = after - before;
  const pct = before > 0 ? ((diff / before) * 100).toFixed(0) : "—";
  const sign = diff > 0 ? "+" : "";
  return `${sign}${fmtK(diff)} (${sign}${pct}%)`;
}

// ── Component ──────────────────────────────────────────────────────────────

export function RV2021ShiftWidget() {
  const [hoveredSegment, setHoveredSegment] = useState<{
    group: string;
    year: number;
    count: number;
    pct: number;
    x: number;
    y: number;
  } | null>(null);

  const { data, isLoading, error } = useQuery<RV2021Record[]>({
    queryKey: ["rv2021-composition"],
    queryFn: () => fetch("/data/rv2021-composition.json").then((r) => r.json()),
  });

  // Derive before/after snapshots
  const snapshots = useMemo(() => {
    if (!data) return null;

    const byYear = (year: number) => {
      const rows = data.filter(
        (r) => r.year === year && r.visa_group !== "NZ-born" && r.visa_group !== "Other"
      );
      const total = rows.reduce((s, r) => s + r.count, 0);
      const counts: Record<string, number> = {};
      for (const g of DISPLAY_GROUPS) {
        const row = rows.find((r) => r.visa_group === g);
        counts[g] = row?.count ?? 0;
      }
      return { counts, total };
    };

    return {
      before: byYear(BEFORE_YEAR),
      after: byYear(AFTER_YEAR),
    };
  }, [data]);

  // Compute the biggest changes for the movement summary
  const changes = useMemo(() => {
    if (!snapshots) return [];
    return DISPLAY_GROUPS.map((g) => ({
      group: g,
      before: snapshots.before.counts[g],
      after: snapshots.after.counts[g],
      diff: snapshots.after.counts[g] - snapshots.before.counts[g],
    }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 5);
  }, [snapshots]);

  // ── Loading / error states ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-6 border border-rule">
        <div className="h-6 w-48 bg-muted rounded animate-pulse mb-4" />
        <div className="flex gap-8 justify-center">
          <div className="h-80 w-36 bg-muted rounded animate-pulse" />
          <div className="h-80 w-36 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !snapshots) {
    return (
      <div className="bg-white rounded-lg p-6 border border-rule">
        <p className="text-red-600 font-sans text-sm">
          Failed to load RV2021 composition data.
        </p>
      </div>
    );
  }

  // ── SVG stacked bar chart ──────────────────────────────────────────────

  const chartHeight = 360;
  const barWidth = 140;
  const gap = 60;
  const svgWidth = barWidth * 2 + gap + 40; // padding
  const leftX = 20;
  const rightX = leftX + barWidth + gap;
  const maxCount = Math.max(snapshots.before.total, snapshots.after.total);

  function renderBar(
    x: number,
    year: number,
    counts: Record<string, number>,
    total: number
  ) {
    let yOffset = 0;
    const segments: React.ReactNode[] = [];

    for (const group of DISPLAY_GROUPS) {
      const count = counts[group];
      if (count === 0) continue;
      const segHeight = (count / maxCount) * chartHeight;
      const pct = count / total;
      const segY = chartHeight - yOffset - segHeight;

      segments.push(
        <g key={`${year}-${group}`}>
          <rect
            x={x}
            y={segY}
            width={barWidth}
            height={Math.max(segHeight, 1)}
            fill={GROUP_COLORS[group]}
            className="transition-opacity duration-150 cursor-pointer"
            opacity={
              hoveredSegment && hoveredSegment.group !== group ? 0.4 : 1
            }
            onMouseEnter={(e) => {
              const rect = (e.target as SVGRectElement).getBoundingClientRect();
              setHoveredSegment({
                group,
                year,
                count,
                pct,
                x: rect.left + rect.width / 2,
                y: rect.top,
              });
            }}
            onMouseLeave={() => setHoveredSegment(null)}
          />
          {/* Label inside segment if tall enough */}
          {segHeight > 28 && (
            <>
              <text
                x={x + barWidth / 2}
                y={segY + segHeight / 2 - 5}
                textAnchor="middle"
                fill="white"
                fontSize={11}
                fontWeight={600}
                fontFamily="var(--font-sans)"
                className="pointer-events-none select-none"
              >
                {group === "Skilled/Investor" ? "Skilled/Inv." : group}
              </text>
              <text
                x={x + barWidth / 2}
                y={segY + segHeight / 2 + 9}
                textAnchor="middle"
                fill="rgba(255,255,255,0.8)"
                fontSize={10}
                fontFamily="var(--font-sans)"
                className="pointer-events-none select-none"
              >
                {fmtK(count)} ({fmtPct(pct)})
              </text>
            </>
          )}
        </g>
      );

      yOffset += segHeight;
    }

    // Year label below bar
    segments.push(
      <text
        key={`label-${year}`}
        x={x + barWidth / 2}
        y={chartHeight + 20}
        textAnchor="middle"
        fill="#152F43"
        fontSize={14}
        fontWeight={700}
        fontFamily="var(--font-sans)"
      >
        {year}
      </text>
    );

    // Total label above bar
    segments.push(
      <text
        key={`total-${year}`}
        x={x + barWidth / 2}
        y={chartHeight - (total / maxCount) * chartHeight - 8}
        textAnchor="middle"
        fill="#6F899A"
        fontSize={11}
        fontFamily="var(--font-sans)"
      >
        {fmtK(total)} total
      </text>
    );

    return segments;
  }

  return (
    <div className="bg-white rounded-lg p-6 border border-rule relative">
      {/* Title */}
      <h3 className="font-serif text-lg font-semibold text-navy mb-1">
        Migrant stock composition shift
      </h3>
      <p className="font-sans text-sm text-steel mb-5">
        Visa category composition before and after the 2021 Resident Visa
        (RV2021) one-off pathway
      </p>

      {/* Chart */}
      <div className="flex justify-center overflow-x-auto">
        <svg
          width={svgWidth}
          height={chartHeight + 36}
          viewBox={`0 0 ${svgWidth} ${chartHeight + 36}`}
          className="max-w-full"
        >
          {renderBar(
            leftX,
            BEFORE_YEAR,
            snapshots.before.counts,
            snapshots.before.total
          )}
          {renderBar(
            rightX,
            AFTER_YEAR,
            snapshots.after.counts,
            snapshots.after.total
          )}
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredSegment && (
        <div
          className="fixed z-50 bg-navy text-white px-3 py-2 rounded shadow-lg text-xs font-sans pointer-events-none"
          style={{
            left: hoveredSegment.x,
            top: hoveredSegment.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-semibold">{hoveredSegment.group}</div>
          <div>
            {hoveredSegment.count.toLocaleString("en-NZ")} people (
            {fmtPct(hoveredSegment.pct)})
          </div>
          <div className="text-white/70">{hoveredSegment.year}</div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-4 mb-5">
        {DISPLAY_GROUPS.map((g) => (
          <div
            key={g}
            className="flex items-center gap-1.5 text-xs font-sans text-navy"
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: GROUP_COLORS[g] }}
            />
            {g}
          </div>
        ))}
      </div>

      {/* Movement summary */}
      <div className="border-t border-rule pt-4 mt-2">
        <p className="font-sans text-xs font-semibold text-navy uppercase tracking-wide mb-3">
          Largest composition changes
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {changes.map((c) => (
            <div
              key={c.group}
              className="flex items-center gap-2 font-sans text-sm"
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: GROUP_COLORS[c.group] }}
              />
              <span className="text-navy font-medium">{c.group}</span>
              <span className="text-steel">
                {fmtK(c.before)} → {fmtK(c.after)}
              </span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  c.diff > 0 ? "text-sage" : "text-coral"
                )}
              >
                {fmtChange(c.before, c.after)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Key stat callout */}
      <div className="border-l-4 border-coral bg-[#F8F3EA]/50 p-4 mt-5 rounded-r">
        <p className="font-sans text-sm text-navy">
          <strong>The 2021 Resident Visa</strong> moved approximately 100,000
          people from temporary to resident visa status — the single largest
          reclassification event in New Zealand immigration history. The
          Skilled/Investor category grew by{" "}
          {fmtK(
            snapshots.after.counts["Skilled/Investor"] -
              snapshots.before.counts["Skilled/Investor"]
          )}{" "}
          while Temp Work fell by{" "}
          {fmtK(
            Math.abs(
              snapshots.after.counts["Temp Work"] -
                snapshots.before.counts["Temp Work"]
            )
          )}
          .
        </p>
      </div>

      {/* Source */}
      <p className="font-sans text-[0.6875rem] text-steel mt-4">
        Source: Hughes AN 26/02, Table 4 — visa subcategory population counts.
        Excludes NZ-born.
      </p>
    </div>
  );
}

export default RV2021ShiftWidget;
