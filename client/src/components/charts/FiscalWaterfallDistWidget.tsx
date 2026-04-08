import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

/* ── Types ── */

interface DistComponent {
  mean: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  type: "revenue" | "expenditure" | "net";
}

interface VisaDist extends Record<string, DistComponent | number> {
  count: number;
}

interface DistData {
  visaTypes: string[];
  components: string[];
  distributions: Record<string, VisaDist>;
}

interface WaterfallDistStep {
  label: string;
  shortLabels: string[];
  /** Mean component value, signed for waterfall direction (+ = up, − = down) */
  value: number;
  start: number;
  end: number;
  isTotal: boolean;
  color: string;
  /** Distributional band positions in absolute Y space */
  bandTop: number;
  bandBottom: number;
  whiskerTop: number;
  whiskerBottom: number;
}

/* ── Constants ── */

const TEAL = "#6EA1BE";
const CORAL = "#F26B44";
const SAGE = "#7A9E7E";
const NAVY = "#152F43";
const STEEL = "#6F899A";
const CONNECTOR = "#D1D5DB";

const PAD = { top: 28, right: 16, bottom: 68, left: 64 };
const W = 720;
const H = 400;
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

/** Ordered component labels matching the JSON structure. */
const COMPONENT_META: {
  label: string;
  shortLabels: string[];
  type: "revenue" | "expenditure";
  color: string;
}[] = [
  { label: "Direct taxes", shortLabels: ["Direct", "taxes"], type: "revenue", color: TEAL },
  { label: "Indirect taxes", shortLabels: ["Indirect", "taxes"], type: "revenue", color: TEAL },
  { label: "Income support", shortLabels: ["Income", "support"], type: "expenditure", color: CORAL },
  { label: "Education", shortLabels: ["Education"], type: "expenditure", color: CORAL },
  { label: "Health", shortLabels: ["Health"], type: "expenditure", color: CORAL },
  { label: "NZ Super", shortLabels: ["NZ Super"], type: "expenditure", color: SAGE },
  { label: "Other spending", shortLabels: ["Other", "spending"], type: "expenditure", color: CORAL },
];

/** Friendly display names for visa types. */
const VISA_ORDER = [
  "Resident",
  "Permanent Resident",
  "Australian",
  "Non-residential work",
  "Student",
  "Non-birth Citizen",
  "Visitor",
];

/* ── Helpers ── */

function fmt(n: number): string {
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? "\u2212" : "") + "$" + abs.toLocaleString("en-NZ");
}

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
 * Build waterfall steps from distributional component data.
 *
 * Revenue components flow UP (positive), expenditure flows DOWN (negative).
 * Distributional bands are positioned in absolute Y space using the mean
 * running total as anchor and component-level percentiles for spread.
 *
 * Important caveat: bands show MARGINAL distributions per component —
 * they are not correlated across bars.
 */
function computeDistSteps(
  dist: VisaDist,
): WaterfallDistStep[] {
  const steps: WaterfallDistStep[] = [];
  let running = 0;

  for (const meta of COMPONENT_META) {
    const raw = dist[meta.label];
    if (!raw || typeof raw === "number") continue;
    const comp = raw as DistComponent;

    const start = running;

    if (meta.type === "revenue") {
      const value = comp.mean;
      const end = start + value;
      steps.push({
        label: meta.label,
        shortLabels: meta.shortLabels,
        value,
        start,
        end,
        isTotal: false,
        color: meta.color,
        bandTop: start + comp.p75,
        bandBottom: start + comp.p25,
        whiskerTop: start + comp.p90,
        whiskerBottom: start + comp.p10,
      });
      running = end;
    } else {
      // Expenditure: bar goes DOWN, so value is negative
      const value = -comp.mean;
      const end = start + value;
      steps.push({
        label: meta.label,
        shortLabels: meta.shortLabels,
        value,
        start,
        end,
        isTotal: false,
        color: meta.color,
        // p90 expenditure = most spending = lowest point
        bandTop: start - comp.p25,
        bandBottom: start - comp.p75,
        whiskerTop: start - comp.p10,
        whiskerBottom: start - comp.p90,
      });
      running = end;
    }
  }

  // Net impact bar (from 0)
  const rawNet = dist["Net impact"];
  const net = typeof rawNet === "number" ? undefined : (rawNet as DistComponent | undefined);
  if (net) {
    steps.push({
      label: "Net impact",
      shortLabels: ["Net", "impact"],
      value: net.mean,
      start: 0,
      end: net.mean,
      isTotal: true,
      color: NAVY,
      bandTop: net.p75,
      bandBottom: net.p25,
      whiskerTop: net.p90,
      whiskerBottom: net.p10,
    });
  }

  return steps;
}

/* ── Component ── */

export function FiscalWaterfallDistWidget() {
  const { data, isLoading, error } = useQuery<DistData>({
    queryKey: ["fiscal-distributions"],
    queryFn: () =>
      fetch("/data/synth-fiscal-distributions.json").then((r) => r.json()),
  });

  const visaTypes = useMemo(() => {
    if (!data) return [];
    return data.visaTypes.sort((a, b) => {
      const ai = VISA_ORDER.indexOf(a);
      const bi = VISA_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [data]);

  const [selectedType, setSelectedType] = useState("");

  const activeType = useMemo(() => {
    if (selectedType && visaTypes.includes(selectedType)) return selectedType;
    return visaTypes[0] ?? "";
  }, [selectedType, visaTypes]);

  const steps = useMemo(() => {
    if (!data || !activeType) return [];
    const dist = data.distributions[activeType];
    return dist ? computeDistSteps(dist) : [];
  }, [data, activeType]);

  /* Dynamic Y scale including whisker extremes */
  const { yScale, yTicks } = useMemo(() => {
    if (steps.length === 0) {
      return {
        yScale: () => PAD.top + PH / 2,
        yTicks: [] as number[],
      };
    }

    let min = 0;
    let max = 0;
    for (const s of steps) {
      min = Math.min(min, s.start, s.end, s.whiskerBottom, s.bandBottom);
      max = Math.max(max, s.start, s.end, s.whiskerTop, s.bandTop);
    }

    const range = max - min || 1;
    const tickStep =
      range > 60000
        ? 10000
        : range > 30000
          ? 5000
          : range > 15000
            ? 2500
            : range > 5000
              ? 1000
              : 500;
    min = Math.floor((min - range * 0.06) / tickStep) * tickStep;
    max = Math.ceil((max + range * 0.06) / tickStep) * tickStep;

    const ticks: number[] = [];
    for (let v = min; v <= max; v += tickStep) ticks.push(v);

    const finalRange = max - min;
    const scale = (v: number) =>
      PAD.top + PH * (1 - (v - min) / finalRange);

    return { yScale: scale, yTicks: ticks };
  }, [steps]);

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="bg-off-white rounded-lg p-6 space-y-4">
        <div className="h-6 w-64 bg-muted rounded animate-pulse" />
        <div className="h-4 w-96 bg-muted rounded animate-pulse" />
        <div className="h-[400px] bg-muted rounded animate-pulse" />
      </div>
    );
  }

  /* ── Error state ── */
  if (error || !data) {
    return (
      <div className="bg-off-white rounded-lg p-6">
        <p className="text-steel text-sm">
          Unable to load fiscal distribution data.
        </p>
      </div>
    );
  }

  const numSteps = steps.length;
  const groupW = PW / numSteps;
  const barW = groupW * 0.45;
  const WHISKER_CAP = 6;

  const netStep = steps.find((s) => s.isTotal);
  const netValue = netStep?.end ?? 0;

  return (
    <div className="bg-off-white rounded-lg p-6">
      <h3 className="text-navy font-semibold text-lg mb-0.5">
        Fiscal decomposition with distributional range
      </h3>
      <p className="text-steel text-sm mb-4">
        Mean annual revenue and spending per person, with p25–p75 bands and
        p10/p90 whiskers (2018/19 NZD)
      </p>

      {/* ── Controls ── */}
      <div className="flex items-center gap-2 mb-4">
        <label
          className="text-sm text-steel font-medium"
          htmlFor="dist-type-select"
        >
          Visa category:
        </label>
        <select
          id="dist-type-select"
          value={activeType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="text-sm border border-rule rounded px-2 py-1.5 bg-white text-navy"
        >
          {visaTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* ── SVG waterfall chart ── */}
      <div className="bg-white rounded border border-rule p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Distributional fiscal waterfall chart for ${activeType}`}
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

          {/* ── Bars with distributional bands ── */}
          {steps.map((step, i) => {
            const cx = PAD.left + i * groupW + groupW / 2;
            const bx = cx - barW / 2;

            // Mean bar
            const barTop = yScale(Math.max(step.start, step.end));
            const barBot = yScale(Math.min(step.start, step.end));
            const bh = Math.max(barBot - barTop, 1);

            // Distributional band (p25–p75)
            const bandTopY = yScale(step.bandTop);
            const bandBotY = yScale(step.bandBottom);

            // Whiskers (p10–p90)
            const whiskerTopY = yScale(step.whiskerTop);
            const whiskerBotY = yScale(step.whiskerBottom);

            // Dollar label position
            const labelY = step.isTotal
              ? step.end >= 0
                ? barTop - 6
                : barBot + 14
              : step.value >= 0
                ? barTop - 6
                : barBot + 14;

            return (
              <g key={`s-${i}`}>
                {/* p25–p75 distributional band */}
                <rect
                  x={bx - 3}
                  y={bandTopY}
                  width={barW + 6}
                  height={Math.max(bandBotY - bandTopY, 0)}
                  fill={step.color}
                  opacity={0.18}
                  rx={2}
                />

                {/* p10 whisker (top) */}
                <line
                  x1={cx}
                  y1={whiskerTopY}
                  x2={cx}
                  y2={bandTopY}
                  stroke={step.color}
                  strokeWidth={1.5}
                  opacity={0.55}
                />
                <line
                  x1={cx - WHISKER_CAP}
                  y1={whiskerTopY}
                  x2={cx + WHISKER_CAP}
                  y2={whiskerTopY}
                  stroke={step.color}
                  strokeWidth={1.5}
                  opacity={0.55}
                />

                {/* p90 whisker (bottom) */}
                <line
                  x1={cx}
                  y1={bandBotY}
                  x2={cx}
                  y2={whiskerBotY}
                  stroke={step.color}
                  strokeWidth={1.5}
                  opacity={0.55}
                />
                <line
                  x1={cx - WHISKER_CAP}
                  y1={whiskerBotY}
                  x2={cx + WHISKER_CAP}
                  y2={whiskerBotY}
                  stroke={step.color}
                  strokeWidth={1.5}
                  opacity={0.55}
                />

                {/* Mean bar (solid) */}
                <rect
                  x={bx}
                  y={barTop}
                  width={barW}
                  height={bh}
                  fill={step.color}
                  rx={2}
                >
                  <title>
                    {step.label}: {fmt(step.isTotal ? step.end : Math.abs(step.value))}
                    {"\n"}p25–p75: {fmt(step.bandBottom)}–{fmt(step.bandTop)}
                    {"\n"}p10–p90: {fmt(step.whiskerBottom)}–{fmt(step.whiskerTop)}
                  </title>
                </rect>

                {/* Dollar label above/below bar */}
                <text
                  x={cx}
                  y={labelY}
                  textAnchor="middle"
                  fill={NAVY}
                  fontSize={10}
                  fontFamily="Inter, sans-serif"
                  fontWeight={step.isTotal ? 600 : 400}
                >
                  {fmt(step.isTotal ? step.end : Math.abs(step.value))}
                </text>

                {/* Connector line to next bar */}
                {!step.isTotal && i < numSteps - 1 && !steps[i + 1].isTotal && (
                  <line
                    x1={bx + barW + 4}
                    y1={yScale(step.end)}
                    x2={PAD.left + (i + 1) * groupW + groupW / 2 - barW / 2 - 4}
                    y2={yScale(step.end)}
                    stroke={CONNECTOR}
                    strokeWidth={1}
                    strokeDasharray="3 2"
                  />
                )}
              </g>
            );
          })}

          {/* X-axis labels */}
          {steps.map((step, i) => {
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
          <span className="text-steel">Revenue (taxes)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div
            className="w-3 h-2.5 rounded-sm"
            style={{ backgroundColor: CORAL }}
          />
          <span className="text-steel">Spending</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div
            className="w-3 h-2.5 rounded-sm"
            style={{ backgroundColor: SAGE }}
          />
          <span className="text-steel">NZ Super</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div
            className="w-3 h-2.5 rounded-sm"
            style={{ backgroundColor: NAVY }}
          />
          <span className="text-steel">Net fiscal impact</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div
            className="w-4 h-2.5 rounded-sm border"
            style={{ backgroundColor: STEEL, opacity: 0.18, borderColor: STEEL }}
          />
          <span className="text-steel">p25–p75 range</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <svg width="16" height="10" viewBox="0 0 16 10">
            <line x1="8" y1="1" x2="8" y2="9" stroke={STEEL} strokeWidth={1.5} opacity={0.55} />
            <line x1="4" y1="1" x2="12" y2="1" stroke={STEEL} strokeWidth={1.5} opacity={0.55} />
            <line x1="4" y1="9" x2="12" y2="9" stroke={STEEL} strokeWidth={1.5} opacity={0.55} />
          </svg>
          <span className="text-steel">p10/p90 whiskers</span>
        </div>
      </div>

      {/* ── Summary stat ── */}
      <div className="mt-4 text-center">
        <p
          className="text-xl font-bold"
          style={{ color: netValue >= 0 ? SAGE : CORAL }}
        >
          {netValue >= 0 ? "Mean net contribution" : "Mean net cost"}:{" "}
          {fmt(Math.abs(netValue))}/year
        </p>
        {netStep && (
          <p className="text-steel text-sm mt-1">
            Middle 50% range: {fmt(netStep.bandBottom)} to{" "}
            {fmt(netStep.bandTop)}/year
          </p>
        )}
      </div>

      {/* ── Source note ── */}
      <p className="text-steel text-xs mt-3">
        Source: Synthetic population of {activeType.toLowerCase()} visa holders
        (n={data.distributions[activeType]?.count?.toLocaleString("en-NZ") ?? "—"}).
        Wright &amp; Nguyen AN 24/09 fiscal template, Hughes AN 26/02 income
        distributions. Bands show marginal distributions per component
        (not correlated across bars). Values in 2018/19 NZD.
      </p>
    </div>
  );
}

export default FiscalWaterfallDistWidget;
