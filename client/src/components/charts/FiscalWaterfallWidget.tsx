import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

/* ── Types ── */

interface FiscalRecord {
  year: number;
  age: number;
  retention: number;
  direct_taxes: number;
  indirect_taxes: number;
  income_support: number;
  education: number;
  health: number;
  nfi: number;
  type: string;
}

interface WaterfallStep {
  label: string;
  shortLabels: string[];
  value: number;
  start: number;
  end: number;
  isTotal: boolean;
}

/* ── Constants ── */

const TEAL = "#6EA1BE";
const CORAL = "#F26B44";
const SAGE = "#7A9E7E";
const NAVY = "#152F43";
const STEEL = "#6F899A";
const CONNECTOR = "#D1D5DB";

const PAD = { top: 24, right: 16, bottom: 64, left: 60 };
const W = 700;
const H = 380;
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

const TYPE_ORDER = [
  "Skilled age 30",
  "Family age 30",
  "Student age 20",
  "Working Holiday age 25",
  "Skilled age 50",
  "NZ-born age 30",
];

/* ── Helpers ── */

/** Format a dollar value with commas and Unicode minus for negatives. */
function fmt(n: number): string {
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? "\u2212" : "") + "$" + abs.toLocaleString("en-NZ");
}

/** Compact format for Y-axis labels (e.g. "$15k"). */
function fmtAxis(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = abs / 1000;
    return (
      (n < 0 ? "\u2212" : "") +
      "$" +
      (Number.isInteger(k) ? k.toString() : k.toFixed(1)) +
      "k"
    );
  }
  return fmt(n);
}

/**
 * Build waterfall steps from a fiscal record (year 0 snapshot).
 *
 * Government perspective: taxes = revenue (UP), spending = cost (DOWN).
 * "Other spending" is the balancing residual so the waterfall sums to NFI.
 */
function computeSteps(rec: FiscalRecord): WaterfallStep[] {
  const directTax = Math.abs(rec.direct_taxes);
  const indirectTax = Math.abs(rec.indirect_taxes);
  const otherSpending =
    rec.nfi -
    rec.direct_taxes -
    rec.indirect_taxes -
    rec.income_support -
    rec.education -
    rec.health;

  const steps: WaterfallStep[] = [];
  let running = 0;

  // Revenue: direct taxes
  steps.push({
    label: "Direct taxes",
    shortLabels: ["Direct", "taxes"],
    value: directTax,
    start: running,
    end: running + directTax,
    isTotal: false,
  });
  running += directTax;

  // Revenue: indirect taxes (GST, excise, etc.)
  steps.push({
    label: "Indirect taxes",
    shortLabels: ["Indirect", "taxes"],
    value: indirectTax,
    start: running,
    end: running + indirectTax,
    isTotal: false,
  });
  running += indirectTax;

  // Spending: income support (negate: positive in data = govt pays = running drops)
  const incDelta = -rec.income_support;
  steps.push({
    label: "Income support",
    shortLabels: ["Income", "support"],
    value: incDelta,
    start: running,
    end: running + incDelta,
    isTotal: false,
  });
  running += incDelta;

  // Spending: education
  const eduDelta = -rec.education;
  steps.push({
    label: "Education",
    shortLabels: ["Education"],
    value: eduDelta,
    start: running,
    end: running + eduDelta,
    isTotal: false,
  });
  running += eduDelta;

  // Spending: health
  const healthDelta = -rec.health;
  steps.push({
    label: "Health",
    shortLabels: ["Health"],
    value: healthDelta,
    start: running,
    end: running + healthDelta,
    isTotal: false,
  });
  running += healthDelta;

  // Spending: other government spending (residual)
  const otherDelta = -otherSpending;
  steps.push({
    label: "Other spending",
    shortLabels: ["Other", "spending"],
    value: otherDelta,
    start: running,
    end: running + otherDelta,
    isTotal: false,
  });
  running += otherDelta;

  // Total: net fiscal impact (bar from zero)
  steps.push({
    label: "Net impact",
    shortLabels: ["Net", "impact"],
    value: running,
    start: 0,
    end: running,
    isTotal: true,
  });

  return steps;
}

/* ── Component ── */

export function FiscalWaterfallWidget() {
  const { data, isLoading, error } = useQuery<FiscalRecord[]>({
    queryKey: ["fiscal-components"],
    queryFn: () =>
      fetch("/data/fiscal-components-by-migrant-type.json").then((r) =>
        r.json(),
      ),
  });

  /* Available migrant types (sorted by predefined order) */
  const types = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const raw: string[] = [];
    for (const r of data) {
      if (r.year === 0 && !seen.has(r.type)) {
        seen.add(r.type);
        raw.push(r.type);
      }
    }
    return raw.sort((a, b) => {
      const ai = TYPE_ORDER.indexOf(a);
      const bi = TYPE_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [data]);

  const [selectedType, setSelectedType] = useState("");
  const [showComparison, setShowComparison] = useState(true);

  /* Default to first non-NZ-born type */
  const activeType = useMemo(() => {
    if (selectedType && types.includes(selectedType)) return selectedType;
    return types.find((t) => !t.startsWith("NZ-born")) ?? types[0] ?? "";
  }, [selectedType, types]);

  const isNzBornSelected = activeType.startsWith("NZ-born");

  /* Find NZ-born type with matching arrival age for comparison */
  const nzBornType = useMemo(() => {
    if (!data || isNzBornSelected) return null;
    const m = activeType.match(/age (\d+)/);
    const age = m ? m[1] : "30";
    const candidate = `NZ-born age ${age}`;
    return data.some((r) => r.type === candidate && r.year === 0)
      ? candidate
      : null;
  }, [data, activeType, isNzBornSelected]);

  /* Compute waterfall steps */
  const primarySteps = useMemo(() => {
    if (!data) return [];
    const rec = data.find((r) => r.type === activeType && r.year === 0);
    return rec ? computeSteps(rec) : [];
  }, [data, activeType]);

  const comparisonSteps = useMemo(() => {
    if (!data || !showComparison || !nzBornType) return [];
    const rec = data.find((r) => r.type === nzBornType && r.year === 0);
    return rec ? computeSteps(rec) : [];
  }, [data, showComparison, nzBornType]);

  const hasComparison = showComparison && comparisonSteps.length > 0;

  /* Dynamic Y scale */
  const { yScale, yTicks } = useMemo(() => {
    const allSteps = [...primarySteps, ...comparisonSteps];
    if (allSteps.length === 0) {
      return {
        yScale: () => PAD.top + PH / 2,
        yTicks: [] as number[],
      };
    }

    let min = 0;
    let max = 0;
    for (const s of allSteps) {
      min = Math.min(min, s.start, s.end);
      max = Math.max(max, s.start, s.end);
    }

    const range = max - min || 1;
    const tickStep =
      range > 40000
        ? 10000
        : range > 20000
          ? 5000
          : range > 10000
            ? 2500
            : range > 5000
              ? 1000
              : 500;
    min = Math.floor((min - range * 0.05) / tickStep) * tickStep;
    max = Math.ceil((max + range * 0.08) / tickStep) * tickStep;

    const ticks: number[] = [];
    for (let v = min; v <= max; v += tickStep) ticks.push(v);

    const finalRange = max - min;
    const scale = (v: number) =>
      PAD.top + PH * (1 - (v - min) / finalRange);

    return { yScale: scale, yTicks: ticks };
  }, [primarySteps, comparisonSteps]);

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="bg-off-white rounded-lg p-6 space-y-4">
        <div className="h-6 w-56 bg-muted rounded animate-pulse" />
        <div className="h-4 w-80 bg-muted rounded animate-pulse" />
        <div className="h-[380px] bg-muted rounded animate-pulse" />
      </div>
    );
  }

  /* ── Error state ── */
  if (error || !data) {
    return (
      <div className="bg-off-white rounded-lg p-6">
        <p className="text-steel text-sm">
          Unable to load fiscal component data.
        </p>
      </div>
    );
  }

  const numSteps = primarySteps.length; // 7
  const groupW = PW / numSteps;
  const barW = hasComparison ? groupW * 0.36 : groupW * 0.55;
  const barGap = hasComparison ? groupW * 0.04 : 0;

  const netValue =
    primarySteps.length > 0
      ? primarySteps[primarySteps.length - 1].end
      : 0;
  const compNetValue =
    comparisonSteps.length > 0
      ? comparisonSteps[comparisonSteps.length - 1].end
      : null;

  /** X position of a primary bar's left edge in group i */
  const primaryBarX = (i: number) => {
    const gx = PAD.left + i * groupW;
    return hasComparison
      ? gx + (groupW - barW * 2 - barGap) / 2
      : gx + (groupW - barW) / 2;
  };

  /** X position of a comparison bar's left edge in group i */
  const compBarX = (i: number) => primaryBarX(i) + barW + barGap;

  return (
    <div className="bg-off-white rounded-lg p-6">
      <h3 className="text-navy font-semibold text-lg mb-0.5">
        Annual fiscal decomposition
      </h3>
      <p className="text-steel text-sm mb-4">
        Government revenue and spending per person at arrival, by visa type
        (2018/19 NZD)
      </p>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label
            className="text-sm text-steel font-medium"
            htmlFor="fiscal-type-select"
          >
            Migrant type:
          </label>
          <select
            id="fiscal-type-select"
            value={activeType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-sm border border-rule rounded px-2 py-1.5 bg-white text-navy"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {nzBornType && !isNzBornSelected && (
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showComparison}
              onChange={() => setShowComparison((p) => !p)}
              className="rounded"
            />
            <span className="text-steel font-medium">
              Show NZ-born comparison
            </span>
          </label>
        )}
      </div>

      {/* ── SVG waterfall chart ── */}
      <div className="bg-white rounded border border-rule p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Fiscal waterfall chart for ${activeType}`}
        >
          {/* Horizontal grid lines */}
          {yTicks.map((tick) => (
            <line
              key={tick}
              x1={PAD.left}
              y1={yScale(tick)}
              x2={W - PAD.right}
              y2={yScale(tick)}
              stroke={tick === 0 ? STEEL : "#E5E7EB"}
              strokeWidth={tick === 0 ? 1 : 0.5}
              strokeDasharray={tick === 0 ? undefined : "4 3"}
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick) => (
            <text
              key={tick}
              x={PAD.left - 8}
              y={yScale(tick) + 4}
              textAnchor="end"
              fill={STEEL}
              fontSize={11}
              fontFamily="Inter, sans-serif"
            >
              {fmtAxis(tick)}
            </text>
          ))}

          {/* ── Primary bars ── */}
          {primarySteps.map((step, i) => {
            const bx = primaryBarX(i);
            const topY = yScale(Math.max(step.start, step.end));
            const botY = yScale(Math.min(step.start, step.end));
            const bh = Math.max(botY - topY, 1);

            const color = step.isTotal
              ? NAVY
              : step.value >= 0
                ? TEAL
                : CORAL;

            /* Label above for up-bars, below for down-bars */
            const labelY = step.isTotal
              ? step.end >= 0
                ? topY - 5
                : botY + 13
              : step.value >= 0
                ? topY - 5
                : botY + 13;

            return (
              <g key={`p-${i}`}>
                <rect x={bx} y={topY} width={barW} height={bh} fill={color} rx={2}>
                  <title>
                    {step.label}:{" "}
                    {fmt(step.isTotal ? step.end : step.value)}
                  </title>
                </rect>

                {/* Dollar label */}
                <text
                  x={bx + barW / 2}
                  y={labelY}
                  textAnchor="middle"
                  fill={NAVY}
                  fontSize={10}
                  fontFamily="Inter, sans-serif"
                  fontWeight={step.isTotal ? 600 : 400}
                >
                  {fmt(
                    step.isTotal ? step.end : Math.abs(step.value),
                  )}
                </text>

                {/* Connector line to next bar */}
                {!step.isTotal && i < numSteps - 1 && (
                  <line
                    x1={bx + barW + 2}
                    y1={yScale(step.end)}
                    x2={primaryBarX(i + 1) - 2}
                    y2={yScale(step.end)}
                    stroke={CONNECTOR}
                    strokeWidth={1}
                    strokeDasharray="3 2"
                  />
                )}
              </g>
            );
          })}

          {/* ── Comparison bars (NZ-born, muted) ── */}
          {hasComparison &&
            comparisonSteps.map((step, i) => {
              const bx = compBarX(i);
              const topY = yScale(Math.max(step.start, step.end));
              const botY = yScale(Math.min(step.start, step.end));
              const bh = Math.max(botY - topY, 1);

              const color = step.isTotal
                ? NAVY
                : step.value >= 0
                  ? TEAL
                  : CORAL;

              return (
                <rect
                  key={`c-${i}`}
                  x={bx}
                  y={topY}
                  width={barW}
                  height={bh}
                  fill={color}
                  opacity={0.35}
                  rx={2}
                >
                  <title>
                    {nzBornType} — {step.label}:{" "}
                    {fmt(step.isTotal ? step.end : step.value)}
                  </title>
                </rect>
              );
            })}

          {/* X-axis labels (multi-line via tspan) */}
          {primarySteps.map((step, i) => {
            const cx = PAD.left + i * groupW + groupW / 2;
            const baseY = H - PAD.bottom + 16;
            return (
              <text
                key={`xl-${i}`}
                x={cx}
                y={baseY}
                textAnchor="middle"
                fill={NAVY}
                fontSize={10}
                fontFamily="Inter, sans-serif"
                fontWeight={step.isTotal ? 600 : 400}
              >
                {step.shortLabels.map((line, j) => (
                  <tspan key={j} x={cx} dy={j === 0 ? 0 : 13}>
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}
        </svg>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
        <div className="flex items-center gap-1.5 text-xs">
          <div
            className="w-3 h-2.5 rounded-sm"
            style={{ backgroundColor: TEAL }}
          />
          <span className="text-steel">Revenue (taxes collected)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div
            className="w-3 h-2.5 rounded-sm"
            style={{ backgroundColor: CORAL }}
          />
          <span className="text-steel">
            Spending (transfers &amp; services)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div
            className="w-3 h-2.5 rounded-sm"
            style={{ backgroundColor: NAVY }}
          />
          <span className="text-steel">Net fiscal impact</span>
        </div>
        {hasComparison && (
          <div className="flex items-center gap-1.5 text-xs">
            <div
              className="w-3 h-2.5 rounded-sm border border-rule"
              style={{ backgroundColor: TEAL, opacity: 0.35 }}
            />
            <span className="text-steel">{nzBornType} (comparison)</span>
          </div>
        )}
      </div>

      {/* ── Summary stat ── */}
      <div className="mt-4 text-center">
        <p
          className="text-xl font-bold"
          style={{ color: netValue >= 0 ? SAGE : CORAL }}
        >
          {netValue >= 0 ? "Net fiscal contribution" : "Net fiscal cost"}:{" "}
          {fmt(Math.abs(netValue))}/year
        </p>

        {hasComparison && compNetValue !== null && (
          <p className="text-steel text-sm mt-1">
            {nzBornType}: {fmt(Math.abs(compNetValue))}/year
            {!isNzBornSelected && (
              <>
                {" \u00B7 "}
                <span
                  className="font-semibold"
                  style={{
                    color: netValue - compNetValue >= 0 ? SAGE : CORAL,
                  }}
                >
                  Difference:{" "}
                  {netValue - compNetValue > 0 ? "+" : ""}
                  {fmt(netValue - compNetValue)}/year
                </span>
              </>
            )}
          </p>
        )}

        {!hasComparison && (
          <p className="text-steel text-xs mt-1">
            {netValue >= 0
              ? "This person pays more in tax than they receive in government spending"
              : "This person receives more in government spending than they pay in tax"}
          </p>
        )}
      </div>

      {/* ── Source note ── */}
      <p className="text-steel text-xs mt-3">
        Source: Wright &amp; Nguyen AN 24/09 fiscal template, Hughes AN 26/02
        Table 4 tax premiums. &ldquo;Other spending&rdquo; includes NZ Super,
        ACC, justice, defence, and general government expenditure. Values are
        annualised at year of arrival in 2018/19 NZD.
      </p>
    </div>
  );
}

export default FiscalWaterfallWidget;
