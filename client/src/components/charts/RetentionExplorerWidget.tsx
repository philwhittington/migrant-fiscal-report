import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

/* ── Types ── */

interface DataPoint {
  year: number;
  rate: number;
  extrapolated: boolean;
}

interface VisaType {
  visa: string;
  label: string;
  initial_cohort: number;
  fit_params: { a: number; b: number; r_squared: number };
  data: DataPoint[];
}

/* ── Constants ── */

const VISA_COLORS: Record<string, string> = {
  "Skilled/Investor": "#6EA1BE",
  Family: "#7A9E7E",
  Humanitarian: "#C9A227",
  Australian: "#F26B44",
  "Skilled Work": "#163E5F",
  Student: "#6F899A",
  "Working Holiday": "#B85C38",
};

const DEFAULT_SELECTED = new Set([
  "Skilled/Investor",
  "Family",
  "Student",
  "Working Holiday",
]);

const MAX_YEAR = 18;
const PAD = { top: 20, right: 24, bottom: 44, left: 52 };
const W = 600;
const H = 340;
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

const X_TICKS = [0, 3, 6, 9, 12, 15, 18];
const Y_TICKS = [0, 25, 50, 75, 100];

/* ── Scale helpers ── */

const x = (year: number) => PAD.left + (year / MAX_YEAR) * PW;
const y = (rate: number) => PAD.top + (1 - rate) * PH;

/* ── Path builders ── */

function linePath(pts: DataPoint[]): string {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year).toFixed(1)},${y(p.rate).toFixed(1)}`)
    .join(" ");
}

function areaPath(pts: DataPoint[]): string {
  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year).toFixed(1)},${y(p.rate).toFixed(1)}`)
    .join(" ");
  return `${line} L${x(pts[pts.length - 1].year).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
}

/* ── Find where a curve crosses a threshold ── */

function findCrossover(pts: DataPoint[], threshold: number): number | null {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].rate < threshold && pts[i - 1].rate >= threshold) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const frac = (threshold - prev.rate) / (curr.rate - prev.rate);
      return prev.year + frac * (curr.year - prev.year);
    }
  }
  return null;
}

/* ── Component ── */

export function RetentionExplorerWidget() {
  const { data, isLoading, error } = useQuery<VisaType[]>({
    queryKey: ["retention-curves"],
    queryFn: () =>
      fetch("/data/retention-curves-widget.json").then((r) => r.json()),
  });

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(DEFAULT_SELECTED),
  );

  const toggle = (label: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  // Clip each visa type to years 0–18
  const clipped = useMemo(() => {
    if (!data) return [];
    return data.map((vt) => ({
      ...vt,
      data: vt.data.filter((d) => d.year <= MAX_YEAR),
    }));
  }, [data]);

  // Student 50% crossover point (for annotation)
  const studentCross = useMemo(() => {
    const student = clipped.find((v) => v.label === "Student");
    if (!student) return null;
    const yr = findCrossover(student.data, 0.5);
    if (yr === null) return null;
    return { year: yr, cx: x(yr), cy: y(0.5) };
  }, [clipped]);

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="bg-off-white rounded-lg p-6 space-y-4">
        <div className="h-6 w-56 bg-muted rounded animate-pulse" />
        <div className="h-4 w-80 bg-muted rounded animate-pulse" />
        <div className="h-[340px] bg-muted rounded animate-pulse" />
      </div>
    );
  }

  /* ── Error state ── */
  if (error || !data) {
    return (
      <div className="bg-off-white rounded-lg p-6">
        <p className="text-steel text-sm">
          Unable to load retention curve data.
        </p>
      </div>
    );
  }

  const visible = clipped.filter((vt) => selected.has(vt.label));

  return (
    <div className="bg-off-white rounded-lg p-6">
      {/* Title */}
      <h3 className="text-navy font-semibold text-lg mb-0.5">
        Retention curve explorer
      </h3>
      <p className="text-steel text-sm mb-4">
        Proportion of each arrival cohort still resident in New Zealand, by
        years since arrival (2005 cohort average)
      </p>

      {/* Visa type toggles */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4">
        {clipped.map((vt) => {
          const color = VISA_COLORS[vt.label] ?? "#888";
          return (
            <label
              key={vt.label}
              className="flex items-center gap-1.5 text-sm cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={selected.has(vt.label)}
                onChange={() => toggle(vt.label)}
                className="rounded"
                style={{ accentColor: color }}
              />
              <span className="font-medium" style={{ color }}>
                {vt.label}
              </span>
            </label>
          );
        })}
      </div>

      {/* SVG chart */}
      <div className="bg-white rounded border border-rule p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Retention curves showing migrant retention by visa type over 18 years"
        >
          {/* Horizontal grid lines */}
          {Y_TICKS.map((pct) => (
            <line
              key={pct}
              x1={PAD.left}
              y1={y(pct / 100)}
              x2={W - PAD.right}
              y2={y(pct / 100)}
              stroke="#E5E7EB"
              strokeDasharray="4 3"
              strokeWidth={0.5}
            />
          ))}

          {/* Y-axis labels */}
          {Y_TICKS.map((pct) => (
            <text
              key={pct}
              x={PAD.left - 8}
              y={y(pct / 100) + 4}
              textAnchor="end"
              fill="#6F899A"
              fontSize={12}
              fontFamily="Inter, sans-serif"
            >
              {pct}%
            </text>
          ))}

          {/* X-axis labels */}
          {X_TICKS.map((yr) => (
            <text
              key={yr}
              x={x(yr)}
              y={H - PAD.bottom + 18}
              textAnchor="middle"
              fill="#6F899A"
              fontSize={12}
              fontFamily="Inter, sans-serif"
            >
              {yr}
            </text>
          ))}

          {/* X-axis title */}
          <text
            x={PAD.left + PW / 2}
            y={H - 4}
            textAnchor="middle"
            fill="#6F899A"
            fontSize={11}
            fontFamily="Inter, sans-serif"
          >
            Years since arrival
          </text>

          {/* Shaded areas (render first so lines sit on top) */}
          {visible.map((vt) => (
            <path
              key={`area-${vt.label}`}
              d={areaPath(vt.data)}
              fill={VISA_COLORS[vt.label] ?? "#888"}
              opacity={0.1}
            />
          ))}

          {/* Lines */}
          {visible.map((vt) => (
            <path
              key={`line-${vt.label}`}
              d={linePath(vt.data)}
              stroke={VISA_COLORS[vt.label] ?? "#888"}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
            />
          ))}

          {/* Endpoint labels (visa name at year 18) */}
          {visible.map((vt) => {
            const last = vt.data[vt.data.length - 1];
            if (!last) return null;
            const baseY = y(last.rate);
            return (
              <text
                key={`lbl-${vt.label}`}
                x={x(last.year) + 4}
                y={baseY + 4}
                fill={VISA_COLORS[vt.label] ?? "#888"}
                fontSize={10}
                fontFamily="Inter, sans-serif"
                fontWeight={500}
              >
                {Math.round(last.rate * 100)}%
              </text>
            );
          })}

          {/* Student 50% annotation */}
          {selected.has("Student") && studentCross && (
            <g>
              <circle
                cx={studentCross.cx}
                cy={studentCross.cy}
                r={3.5}
                fill="#6F899A"
                stroke="white"
                strokeWidth={1.5}
              />
              <line
                x1={studentCross.cx}
                y1={studentCross.cy - 4}
                x2={studentCross.cx}
                y2={studentCross.cy - 16}
                stroke="#6F899A"
                strokeWidth={0.75}
              />
              <text
                x={studentCross.cx + 4}
                y={studentCross.cy - 18}
                fill="#152F43"
                fontSize={11}
                fontFamily="Inter, sans-serif"
              >
                {`50% of students leave within ~${Math.round(studentCross.year)} years`}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Cohort size cards */}
      <div className="flex flex-wrap gap-3 mt-4">
        {visible.map((vt) => (
          <div
            key={vt.label}
            className="bg-white rounded border border-rule px-3 py-2 text-sm"
            style={{
              borderLeftWidth: 3,
              borderLeftColor: VISA_COLORS[vt.label] ?? "#888",
            }}
          >
            <span className="font-medium text-navy">{vt.label}:</span>{" "}
            <span className="text-steel">
              {vt.initial_cohort.toLocaleString()} avg. initial cohort
            </span>
          </div>
        ))}
      </div>

      {/* Source note */}
      <p className="text-steel text-xs mt-3">
        Source: Hughes AN 26/02 Table 16, 2005 arrival cohort averaged across
        20 cohort years. Retention = population at year <em>t</em> ÷ initial
        cohort.
      </p>
    </div>
  );
}

export default RetentionExplorerWidget;
