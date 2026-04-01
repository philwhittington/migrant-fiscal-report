import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

/* ── Types ── */

interface TrajectoryPoint {
  year: number;
  age: number;
  cumulative_npv: number;
  retention: number;
  nfi_year: number;
}

interface NPVRecord {
  visa: string;
  visa_code: string;
  arrival_age: number;
  npv: number;
  nzborn_npv: number;
  surplus: number;
  trajectory: TrajectoryPoint[];
}

interface FiscalComponent {
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

/* ── Constants ── */

const VISA_OPTIONS = [
  "Skilled/Investor",
  "Family",
  "Humanitarian",
  "Student",
  "Working Holiday",
  "Skilled Work",
  "Australian",
] as const;

const ARRIVAL_AGES = [20, 25, 30, 35, 40, 45, 50, 55] as const;

const VISA_COLORS: Record<string, string> = {
  "Skilled/Investor": "#6EA1BE",
  Family: "#7A9E7E",
  Humanitarian: "#C9A227",
  Australian: "#F26B44",
  "Skilled Work": "#163E5F",
  Student: "#6F899A",
  "Working Holiday": "#B85C38",
};

/** Map visa+age to fiscal-components type key (only 6 combos available) */
const FISCAL_TYPE_MAP: Record<string, Record<number, string>> = {
  "Skilled/Investor": { 30: "Skilled age 30", 50: "Skilled age 50" },
  Family: { 30: "Family age 30" },
  "NZ-born": { 30: "NZ-born age 30" },
  Student: { 20: "Student age 20" },
  "Working Holiday": { 25: "Working Holiday age 25" },
};

/* ── Chart dimensions ── */

const PAD = { top: 24, right: 80, bottom: 48, left: 72 };
const W = 700;
const H = 380;
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

/* ── Helpers ── */

function fmtDollar(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtDollarFull(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  return `${sign}$${abs.toLocaleString("en-NZ", { maximumFractionDigits: 0 })}`;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

/** Compute nice y-axis tick values spanning [min, max] */
function niceYTicks(min: number, max: number): number[] {
  const range = max - min;
  if (range === 0) return [0];
  const rawStep = range / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const candidates = [1, 2, 2.5, 5, 10];
  const step =
    magnitude *
    (candidates.find((c) => c * magnitude >= rawStep) ?? 10);
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.01; v += step) {
    ticks.push(Math.round(v));
  }
  return ticks;
}

/* ── Component ── */

export function NPVCalculatorWidget() {
  /* Data fetching */
  const {
    data: npvData,
    isLoading: npvLoading,
    error: npvError,
  } = useQuery<NPVRecord[]>({
    queryKey: ["npv-by-visa-age"],
    queryFn: () =>
      fetch("/data/npv-by-visa-age.json").then((r) => r.json()),
    staleTime: Infinity,
  });

  const {
    data: fiscalData,
    isLoading: fiscalLoading,
    error: fiscalError,
  } = useQuery<FiscalComponent[]>({
    queryKey: ["fiscal-components"],
    queryFn: () =>
      fetch("/data/fiscal-components-by-migrant-type.json").then((r) =>
        r.json(),
      ),
    staleTime: Infinity,
  });

  /* Controls state */
  const [selectedVisa, setSelectedVisa] = useState<string>("Skilled/Investor");
  const [arrivalAge, setArrivalAge] = useState<number>(30);
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  /* Derived: selected and baseline records */
  const selected = useMemo(
    () =>
      npvData?.find(
        (r) => r.visa === selectedVisa && r.arrival_age === arrivalAge,
      ) ?? null,
    [npvData, selectedVisa, arrivalAge],
  );

  const baseline = useMemo(
    () =>
      npvData?.find(
        (r) => r.visa === "NZ-born" && r.arrival_age === arrivalAge,
      ) ?? null,
    [npvData, arrivalAge],
  );

  /* Derived: fiscal breakdown (if available for this visa+age combo) */
  const fiscalBreakdown = useMemo(() => {
    if (!fiscalData) return null;
    const typeKey = FISCAL_TYPE_MAP[selectedVisa]?.[arrivalAge];
    if (!typeKey) return null;
    const records = fiscalData.filter((r) => r.type === typeKey);
    if (records.length === 0) return null;
    return records;
  }, [fiscalData, selectedVisa, arrivalAge]);

  const isLoading = npvLoading || fiscalLoading;
  const hasError = npvError || fiscalError;

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="bg-off-white rounded-lg p-6 space-y-4">
        <div className="h-6 w-64 bg-rule rounded animate-pulse" />
        <div className="h-4 w-96 bg-rule rounded animate-pulse" />
        <div className="flex gap-4">
          <div className="h-10 w-48 bg-rule rounded animate-pulse" />
          <div className="h-10 flex-1 bg-rule rounded animate-pulse" />
        </div>
        <div className="h-[380px] bg-rule rounded animate-pulse" />
      </div>
    );
  }

  if (hasError || !npvData) {
    return (
      <div className="bg-off-white rounded-lg p-6">
        <p className="text-steel text-sm">
          Unable to load NPV data. Please try refreshing.
        </p>
      </div>
    );
  }

  if (!selected || !baseline) {
    return (
      <div className="bg-off-white rounded-lg p-6">
        <p className="text-steel text-sm">
          No data available for {selectedVisa} arriving at age {arrivalAge}.
        </p>
      </div>
    );
  }

  /* ── Display values (flip sign: positive = contribution) ── */
  const displayNPV = -selected.npv;
  const displaySurplus = selected.surplus;
  const isContributor = displayNPV > 0;

  /* ── Chart scales ── */
  const maxYear = selected.trajectory.length - 1;

  // Flip sign for display: positive = contribution
  const selSeries = selected.trajectory.map((p) => -p.cumulative_npv);
  const baseSeries = baseline.trajectory.map((p) => -p.cumulative_npv);

  const allValues = [...selSeries, ...baseSeries];
  const yMin = Math.min(0, ...allValues);
  const yMax = Math.max(0, ...allValues);

  // Add 10% padding
  const yPadding = (yMax - yMin) * 0.1 || 5000;
  const yLow = yMin - yPadding;
  const yHigh = yMax + yPadding;

  const xScale = (year: number) => PAD.left + (year / maxYear) * PW;
  const yScale = (val: number) =>
    PAD.top + ((yHigh - val) / (yHigh - yLow)) * PH;

  const yTicks = niceYTicks(yLow, yHigh);
  const xTicks = Array.from(
    { length: Math.floor(maxYear / 10) + 1 },
    (_, i) => i * 10,
  );

  /* ── Path builders ── */
  function buildPath(series: number[]): string {
    return series
      .map(
        (v, i) =>
          `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`,
      )
      .join(" ");
  }

  /* ── Retention at key years ── */
  const retentionAt = (year: number) => {
    const pt = selected.trajectory[year];
    return pt ? pt.retention : null;
  };

  /* ── Hover data ── */
  const hoverData = hoveredYear !== null
    ? {
        year: hoveredYear,
        age: selected.trajectory[hoveredYear]?.age ?? arrivalAge + hoveredYear,
        selValue: selSeries[hoveredYear],
        baseValue: baseSeries[hoveredYear],
        retention: selected.trajectory[hoveredYear]?.retention,
      }
    : null;

  const visaColor = VISA_COLORS[selectedVisa] ?? "#6EA1BE";

  /* ── First-year fiscal summary ── */
  const firstYearFiscal = fiscalBreakdown?.[0] ?? null;

  return (
    <div className="bg-off-white rounded-lg p-6">
      {/* Title */}
      <h3 className="text-navy font-semibold text-lg mb-0.5">
        Lifecycle NPV calculator
      </h3>
      <p className="text-steel text-sm mb-4">
        Net present value of lifetime fiscal contributions by visa type and
        arrival age. Positive values = net contribution to government finances.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-5 items-end">
        {/* Visa type selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-steel uppercase tracking-wider">
            Visa type
          </label>
          <select
            value={selectedVisa}
            onChange={(e) => setSelectedVisa(e.target.value)}
            className="bg-white border border-rule rounded px-3 py-2 text-sm text-navy font-medium focus:outline-none focus:ring-2 focus:ring-teal/40 cursor-pointer"
          >
            {VISA_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Arrival age slider */}
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-steel uppercase tracking-wider">
            Arrival age:{" "}
            <span className="text-navy text-sm normal-case font-semibold">
              {arrivalAge}
            </span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-steel">20</span>
            <input
              type="range"
              min={20}
              max={55}
              step={5}
              value={arrivalAge}
              onChange={(e) => setArrivalAge(Number(e.target.value))}
              className="flex-1 h-2 accent-[#6EA1BE] cursor-pointer"
            />
            <span className="text-xs text-steel">55</span>
          </div>
        </div>
      </div>

      {/* Headline NPV */}
      <div className="flex flex-wrap gap-4 mb-5">
        <div className="bg-white rounded border border-rule px-5 py-4 flex-1 min-w-[200px]">
          <p className="text-xs text-steel uppercase tracking-wider mb-1">
            Lifetime net fiscal contribution
          </p>
          <p
            className="text-4xl font-bold"
            style={{ color: isContributor ? "#7A9E7E" : "#F26B44" }}
          >
            {fmtDollarFull(displayNPV)}
          </p>
          <p className="text-sm text-steel mt-1">
            {isContributor ? "Net contributor" : "Net fiscal cost"} —{" "}
            {selectedVisa} arriving age {arrivalAge}
          </p>
        </div>

        <div className="bg-white rounded border border-rule px-5 py-4 min-w-[180px]">
          <p className="text-xs text-steel uppercase tracking-wider mb-1">
            Surplus vs NZ-born
          </p>
          <p
            className="text-2xl font-bold"
            style={{ color: displaySurplus > 0 ? "#7A9E7E" : "#F26B44" }}
          >
            {displaySurplus > 0 ? "+" : ""}
            {fmtDollarFull(displaySurplus)}
          </p>
          <p className="text-sm text-steel mt-1">
            {displaySurplus > 0
              ? "More than NZ-born baseline"
              : "Less than NZ-born baseline"}
          </p>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="bg-white rounded border border-rule p-2 relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Cumulative fiscal contribution over time for ${selectedVisa} arriving at age ${arrivalAge}`}
          onMouseLeave={() => setHoveredYear(null)}
          onMouseMove={(e) => {
            const svg = e.currentTarget;
            const rect = svg.getBoundingClientRect();
            const svgX =
              ((e.clientX - rect.left) / rect.width) * W;
            const year = Math.round(
              ((svgX - PAD.left) / PW) * maxYear,
            );
            if (year >= 0 && year <= maxYear) {
              setHoveredYear(year);
            } else {
              setHoveredYear(null);
            }
          }}
        >
          {/* Horizontal grid lines */}
          {yTicks.map((v) => (
            <line
              key={v}
              x1={PAD.left}
              y1={yScale(v)}
              x2={W - PAD.right}
              y2={yScale(v)}
              stroke={v === 0 ? "#152F43" : "#E5E7EB"}
              strokeWidth={v === 0 ? 1 : 0.5}
              strokeDasharray={v === 0 ? undefined : "4 3"}
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((v) => (
            <text
              key={v}
              x={PAD.left - 8}
              y={yScale(v) + 4}
              textAnchor="end"
              fill="#6F899A"
              fontSize={11}
              fontFamily="Inter, sans-serif"
            >
              {fmtDollar(v)}
            </text>
          ))}

          {/* X-axis labels */}
          {xTicks.map((yr) => (
            <text
              key={yr}
              x={xScale(yr)}
              y={H - PAD.bottom + 18}
              textAnchor="middle"
              fill="#6F899A"
              fontSize={11}
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

          {/* Y-axis title */}
          <text
            x={14}
            y={PAD.top + PH / 2}
            textAnchor="middle"
            fill="#6F899A"
            fontSize={11}
            fontFamily="Inter, sans-serif"
            transform={`rotate(-90, 14, ${PAD.top + PH / 2})`}
          >
            Cumulative fiscal contribution ($)
          </text>

          {/* NZ-born baseline (dashed) — render first so primary sits on top */}
          <path
            d={buildPath(baseSeries)}
            stroke="#6F899A"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            fill="none"
            strokeLinejoin="round"
          />

          {/* Selected visa line */}
          <path
            d={buildPath(selSeries)}
            stroke={visaColor}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
          />

          {/* Endpoint labels */}
          <text
            x={xScale(maxYear) + 4}
            y={yScale(selSeries[selSeries.length - 1]) - 4}
            fill={visaColor}
            fontSize={11}
            fontWeight={600}
            fontFamily="Inter, sans-serif"
          >
            {fmtDollar(selSeries[selSeries.length - 1])}
          </text>
          <text
            x={xScale(maxYear) + 4}
            y={yScale(baseSeries[baseSeries.length - 1]) + 12}
            fill="#6F899A"
            fontSize={10}
            fontFamily="Inter, sans-serif"
          >
            {fmtDollar(baseSeries[baseSeries.length - 1])}
          </text>

          {/* Hover crosshair */}
          {hoverData && (
            <g>
              <line
                x1={xScale(hoverData.year)}
                y1={PAD.top}
                x2={xScale(hoverData.year)}
                y2={PAD.top + PH}
                stroke="#C5CDD3"
                strokeWidth={1}
              />
              <circle
                cx={xScale(hoverData.year)}
                cy={yScale(hoverData.selValue)}
                r={4}
                fill={visaColor}
                stroke="white"
                strokeWidth={2}
              />
              <circle
                cx={xScale(hoverData.year)}
                cy={yScale(hoverData.baseValue)}
                r={3}
                fill="#6F899A"
                stroke="white"
                strokeWidth={1.5}
              />
            </g>
          )}

          {/* Legend */}
          <g transform={`translate(${PAD.left + 8}, ${PAD.top + 8})`}>
            <line x1={0} y1={6} x2={16} y2={6} stroke={visaColor} strokeWidth={2.5} />
            <text x={20} y={10} fill="#152F43" fontSize={11} fontFamily="Inter, sans-serif">
              {selectedVisa}
            </text>
            <line x1={0} y1={24} x2={16} y2={24} stroke="#6F899A" strokeWidth={1.5} strokeDasharray="6 3" />
            <text x={20} y={28} fill="#6F899A" fontSize={11} fontFamily="Inter, sans-serif">
              NZ-born baseline
            </text>
          </g>
        </svg>

        {/* Hover tooltip (positioned outside SVG for better text rendering) */}
        {hoverData && (
          <div
            className="absolute bg-white border border-rule rounded shadow-sm px-3 py-2 text-xs pointer-events-none z-10"
            style={{
              left: `${(xScale(hoverData.year) / W) * 100}%`,
              top: `${(yScale(Math.max(hoverData.selValue, hoverData.baseValue)) / H) * 100 - 2}%`,
              transform: hoverData.year > maxYear * 0.7 ? "translate(-110%, -100%)" : "translate(8px, -100%)",
            }}
          >
            <p className="font-semibold text-navy mb-1">
              Year {hoverData.year} (age {hoverData.age})
            </p>
            <p style={{ color: visaColor }}>
              {selectedVisa}: {fmtDollarFull(hoverData.selValue)}
            </p>
            <p className="text-steel">
              NZ-born: {fmtDollarFull(hoverData.baseValue)}
            </p>
            {hoverData.retention !== undefined && hoverData.retention < 1 && (
              <p className="text-steel mt-0.5">
                Retention: {fmtPct(hoverData.retention)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Decomposition section */}
      <div className="mt-5">
        <h4 className="text-navy font-semibold text-sm mb-3">
          Key fiscal parameters
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {/* Retention rates */}
              <tr className="bg-white">
                <td className="px-3 py-2 text-steel font-medium border border-rule">
                  Retention yr+5
                </td>
                <td className="px-3 py-2 text-navy border border-rule font-semibold">
                  {retentionAt(5) !== null ? fmtPct(retentionAt(5)!) : "—"}
                </td>
                <td className="px-3 py-2 text-steel font-medium border border-rule">
                  Retention yr+10
                </td>
                <td className="px-3 py-2 text-navy border border-rule font-semibold">
                  {retentionAt(10) !== null ? fmtPct(retentionAt(10)!) : "—"}
                </td>
                <td className="px-3 py-2 text-steel font-medium border border-rule">
                  Retention yr+15
                </td>
                <td className="px-3 py-2 text-navy border border-rule font-semibold">
                  {retentionAt(15) !== null ? fmtPct(retentionAt(15)!) : "—"}
                </td>
              </tr>

              {/* NPV comparison */}
              <tr className="bg-linen">
                <td className="px-3 py-2 text-steel font-medium border border-rule">
                  Total NPV
                </td>
                <td
                  className="px-3 py-2 border border-rule font-semibold"
                  style={{ color: isContributor ? "#7A9E7E" : "#F26B44" }}
                >
                  {fmtDollarFull(displayNPV)}
                </td>
                <td className="px-3 py-2 text-steel font-medium border border-rule">
                  NZ-born NPV
                </td>
                <td className="px-3 py-2 text-navy border border-rule font-semibold">
                  {fmtDollarFull(-selected.nzborn_npv)}
                </td>
                <td className="px-3 py-2 text-steel font-medium border border-rule">
                  Fiscal surplus
                </td>
                <td
                  className="px-3 py-2 border border-rule font-semibold"
                  style={{
                    color: displaySurplus > 0 ? "#7A9E7E" : "#F26B44",
                  }}
                >
                  {displaySurplus > 0 ? "+" : ""}
                  {fmtDollarFull(displaySurplus)}
                </td>
              </tr>

              {/* Fiscal components (when available) */}
              {firstYearFiscal && (
                <tr className="bg-white">
                  <td className="px-3 py-2 text-steel font-medium border border-rule">
                    Direct taxes
                  </td>
                  <td className="px-3 py-2 text-navy border border-rule font-semibold">
                    {fmtDollarFull(-firstYearFiscal.direct_taxes)}/yr
                  </td>
                  <td className="px-3 py-2 text-steel font-medium border border-rule">
                    Indirect taxes
                  </td>
                  <td className="px-3 py-2 text-navy border border-rule font-semibold">
                    {fmtDollarFull(-firstYearFiscal.indirect_taxes)}/yr
                  </td>
                  <td className="px-3 py-2 text-steel font-medium border border-rule">
                    First-year NFI
                  </td>
                  <td
                    className="px-3 py-2 border border-rule font-semibold"
                    style={{
                      color: firstYearFiscal.nfi < 0 ? "#7A9E7E" : "#F26B44",
                    }}
                  >
                    {fmtDollarFull(-firstYearFiscal.nfi)}/yr
                  </td>
                </tr>
              )}
              {firstYearFiscal && (
                <tr className="bg-linen">
                  <td className="px-3 py-2 text-steel font-medium border border-rule">
                    Income support
                  </td>
                  <td className="px-3 py-2 text-navy border border-rule font-semibold">
                    {fmtDollarFull(firstYearFiscal.income_support)}/yr
                  </td>
                  <td className="px-3 py-2 text-steel font-medium border border-rule">
                    Education
                  </td>
                  <td className="px-3 py-2 text-navy border border-rule font-semibold">
                    {fmtDollarFull(firstYearFiscal.education)}/yr
                  </td>
                  <td className="px-3 py-2 text-steel font-medium border border-rule">
                    Health
                  </td>
                  <td className="px-3 py-2 text-navy border border-rule font-semibold">
                    {fmtDollarFull(firstYearFiscal.health)}/yr
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!firstYearFiscal && (
          <p className="text-steel text-xs mt-2 italic">
            Detailed fiscal breakdown available for Skilled/Investor (age 30,
            50), Family (30), Student (20), Working Holiday (25).
          </p>
        )}
      </div>

      {/* Source note */}
      <p className="text-steel text-xs mt-4">
        Source: NPV model combining Hughes AN 26/02 (tax data, retention curves)
        and Wright &amp; Nguyen AN 24/09 (age-specific fiscal template).
        Discount rate 3.5%. All values in 2018/19 NZD.
      </p>
    </div>
  );
}

export default NPVCalculatorWidget;
