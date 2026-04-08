import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

/* ── Types ── */

interface HistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

interface DistributionEntry {
  visa_category: string;
  arrival_age: number;
  count: number;
  mean_npv: number;
  median_npv: number;
  p10_npv: number;
  p25_npv: number;
  p75_npv: number;
  p90_npv: number;
  std_npv: number;
  pct_net_contributor: number;
  histogram: HistogramBin[];
}

type DistributionData = Record<string, DistributionEntry>;

/* ── Constants ── */

const MIGRANT_VISA_TYPES = [
  "Resident",
  "Permanent Resident",
  "Australian",
  "Non-residential work",
  "Student",
  "Visitor",
  "Non-birth Citizen",
] as const;

const WORKING_AGES = [20, 30, 40, 50, 60] as const;

/* ── Chart dimensions ── */

const PAD = { top: 28, right: 24, bottom: 52, left: 64 };
const W = 700;
const H = 340;
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

/* ── Helpers ── */

function fmtDollar(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "\u2212" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtDollarFull(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "\u2212" : "";
  return `${sign}$${abs.toLocaleString("en-NZ", { maximumFractionDigits: 0 })}`;
}

/** Compute nice x-axis tick positions */
function niceXTicks(min: number, max: number, target = 6): number[] {
  const range = max - min;
  if (range === 0) return [0];
  const rawStep = range / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step =
    magnitude *
    ([1, 2, 2.5, 5, 10].find((c) => c * magnitude >= rawStep) ?? 10);
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.01; v += step) {
    ticks.push(Math.round(v));
  }
  return ticks;
}

/* ── Component ── */

export function NPVDistributionWidget() {
  /* Data fetching */
  const { data, isLoading, error } = useQuery<DistributionData>({
    queryKey: ["synth-npv-distributions"],
    queryFn: () =>
      fetch("/data/synth-npv-distributions.json").then((r) => r.json()),
    staleTime: Infinity,
  });

  /* Controls state */
  const [selectedVisa, setSelectedVisa] = useState<string>("Resident");
  const [arrivalAge, setArrivalAge] = useState<number>(30);
  const [showNZBorn, setShowNZBorn] = useState(false);

  /* Available ages for the selected visa type */
  const availableAges = useMemo(() => {
    if (!data) return [...WORKING_AGES];
    return WORKING_AGES.filter((age) => data[`${selectedVisa}|${age}`]);
  }, [data, selectedVisa]);

  /* Selected distribution */
  const selected = useMemo(
    () => data?.[`${selectedVisa}|${arrivalAge}`] ?? null,
    [data, selectedVisa, arrivalAge],
  );

  /* NZ-born (Birth Citizen) distribution at same age */
  const nzBorn = useMemo(
    () => data?.[`Birth Citizen|${arrivalAge}`] ?? null,
    [data, arrivalAge],
  );

  /* Chart computation */
  const chartData = useMemo(() => {
    if (!selected) return null;

    const migrantBins = selected.histogram;
    const nzBornBins =
      showNZBorn && nzBorn ? nzBorn.histogram : [];

    const migrantTotal = migrantBins.reduce((s, b) => s + b.count, 0);
    const nzBornTotal = nzBornBins.reduce((s, b) => s + b.count, 0);

    /* Density = proportion of group in each bin */
    const migrantDensity = migrantBins.map((b) => ({
      ...b,
      density: migrantTotal > 0 ? b.count / migrantTotal : 0,
    }));
    const nzBornDensity = nzBornBins.map((b) => ({
      ...b,
      density: nzBornTotal > 0 ? b.count / nzBornTotal : 0,
    }));

    /* X range: union of both distributions */
    let xMin = Math.min(...migrantBins.map((b) => b.bin_start));
    let xMax = Math.max(...migrantBins.map((b) => b.bin_end));
    if (nzBornBins.length > 0) {
      xMin = Math.min(xMin, ...nzBornBins.map((b) => b.bin_start));
      xMax = Math.max(xMax, ...nzBornBins.map((b) => b.bin_end));
    }
    const xPad = (xMax - xMin) * 0.03;
    xMin -= xPad;
    xMax += xPad;

    /* Y range */
    const maxDensity = Math.max(
      ...migrantDensity.map((b) => b.density),
      ...(nzBornDensity.length > 0
        ? nzBornDensity.map((b) => b.density)
        : [0]),
      0.01,
    );
    const yMax = maxDensity * 1.12;

    return {
      migrantDensity,
      nzBornDensity,
      xMin,
      xMax,
      yMax,
      nzBornMean: nzBorn?.mean_npv,
    };
  }, [selected, nzBorn, showNZBorn]);

  /* Pct contributing over $100k (computed from histogram) */
  const pctOver100k = useMemo(() => {
    if (!selected) return 0;
    const total = selected.histogram.reduce((s, b) => s + b.count, 0);
    if (total === 0) return 0;
    const over = selected.histogram
      .filter((b) => b.bin_start >= 100_000)
      .reduce((s, b) => s + b.count, 0);
    return over / total;
  }, [selected]);

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="bg-off-white rounded-lg p-6 space-y-4">
        <div className="h-6 w-64 bg-rule rounded animate-pulse" />
        <div className="h-4 w-96 bg-rule rounded animate-pulse" />
        <div className="flex gap-4">
          <div className="h-10 w-48 bg-rule rounded animate-pulse" />
          <div className="h-10 w-32 bg-rule rounded animate-pulse" />
          <div className="h-10 w-40 bg-rule rounded animate-pulse" />
        </div>
        <div className="h-8 w-72 bg-rule rounded animate-pulse" />
        <div className="h-[340px] bg-rule rounded animate-pulse" />
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 flex-1 bg-rule rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-off-white rounded-lg p-6">
        <p className="text-steel text-sm">
          Unable to load distribution data. Please try refreshing.
        </p>
      </div>
    );
  }

  if (!selected || !chartData) {
    return (
      <div className="bg-off-white rounded-lg p-6">
        <p className="text-steel text-sm">
          No distribution data for {selectedVisa} at arrival age {arrivalAge}.
        </p>
      </div>
    );
  }

  /* ── Scales ── */
  const xScale = (v: number) =>
    PAD.left +
    ((v - chartData.xMin) / (chartData.xMax - chartData.xMin)) * PW;
  const yScale = (v: number) =>
    PAD.top + PH - (v / chartData.yMax) * PH;

  const xTicks = niceXTicks(chartData.xMin, chartData.xMax);

  /* Y-axis: 4 tick marks */
  const yTickStep = chartData.yMax / 4;
  const yTicks = [0, yTickStep, yTickStep * 2, yTickStep * 3, yTickStep * 4];

  /* Callout styling */
  const pctContributor = selected.pct_net_contributor;
  const calloutColor = pctContributor >= 0.5 ? "#7A9E7E" : "#F26B44";

  /* Zero line position (only shown if zero is within x range) */
  const showZeroLine =
    chartData.xMin < 0 && chartData.xMax > 0;
  const zeroX = xScale(0);

  return (
    <div className="bg-off-white rounded-lg p-6">
      {/* Title */}
      <h3 className="text-navy font-semibold text-lg mb-0.5">
        NPV distribution by visa type
      </h3>
      <p className="text-steel text-sm mb-4">
        Distribution of individual lifetime net fiscal contributions from the
        synthetic population. Positive NPV = net contributor to government.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-5 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-steel uppercase tracking-wider">
            Visa type
          </label>
          <select
            value={selectedVisa}
            onChange={(e) => {
              const visa = e.target.value;
              setSelectedVisa(visa);
              if (!data[`${visa}|${arrivalAge}`]) {
                const fallback = WORKING_AGES.find(
                  (a) => data[`${visa}|${a}`],
                );
                if (fallback !== undefined) setArrivalAge(fallback);
              }
            }}
            className="bg-white border border-rule rounded px-3 py-2 text-sm text-navy font-medium focus:outline-none focus:ring-2 focus:ring-teal/40 cursor-pointer"
          >
            {MIGRANT_VISA_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-steel uppercase tracking-wider">
            Arrival age
          </label>
          <select
            value={arrivalAge}
            onChange={(e) => setArrivalAge(Number(e.target.value))}
            className="bg-white border border-rule rounded px-3 py-2 text-sm text-navy font-medium focus:outline-none focus:ring-2 focus:ring-teal/40 cursor-pointer"
          >
            {availableAges.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer pb-2">
          <input
            type="checkbox"
            checked={showNZBorn}
            onChange={(e) => setShowNZBorn(e.target.checked)}
            className="accent-[#6F899A] h-4 w-4"
          />
          <span className="text-sm text-navy">Compare with NZ-born</span>
        </label>
      </div>

      {/* Callout */}
      <div className="mb-5">
        <p className="text-2xl font-bold" style={{ color: calloutColor }}>
          {(pctContributor * 100).toFixed(0)}% are net fiscal contributors
        </p>
        {pctOver100k >= 0.05 && (
          <p className="text-steel text-sm mt-0.5">
            {(pctOver100k * 100).toFixed(0)}% contribute over $100k in lifetime
            NPV
          </p>
        )}
        <p className="text-steel text-sm mt-0.5">
          Mean: {fmtDollarFull(selected.mean_npv)} | Median:{" "}
          {fmtDollarFull(selected.median_npv)} | n ={" "}
          {selected.count.toLocaleString()}
        </p>
      </div>

      {/* Histogram */}
      <div className="bg-white rounded border border-rule p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`NPV distribution histogram for ${selectedVisa} at arrival age ${arrivalAge}`}
        >
          {/* Horizontal grid lines */}
          {yTicks.map((v, i) => (
            <line
              key={i}
              x1={PAD.left}
              y1={yScale(v)}
              x2={W - PAD.right}
              y2={yScale(v)}
              stroke="#E5E7EB"
              strokeWidth={0.5}
              strokeDasharray="4 3"
            />
          ))}

          {/* Zero vertical line (NPV = 0 boundary) */}
          {showZeroLine && (
            <>
              <line
                x1={zeroX}
                y1={PAD.top}
                x2={zeroX}
                y2={PAD.top + PH}
                stroke="#152F43"
                strokeWidth={1}
                opacity={0.6}
              />
              <text
                x={zeroX + 4}
                y={PAD.top + 12}
                fill="#152F43"
                fontSize={9}
                fontFamily="Inter, sans-serif"
                opacity={0.6}
              >
                $0
              </text>
            </>
          )}

          {/* NZ-born histogram bars (drawn first, behind migrant bars) */}
          {showNZBorn &&
            chartData.nzBornDensity.map((b, i) => (
              <rect
                key={`nz-${i}`}
                x={xScale(b.bin_start)}
                y={yScale(b.density)}
                width={Math.max(
                  0,
                  xScale(b.bin_end) - xScale(b.bin_start) - 1,
                )}
                height={Math.max(0, yScale(0) - yScale(b.density))}
                fill="#6F899A"
                opacity={0.3}
                stroke="#6F899A"
                strokeWidth={0.5}
                strokeDasharray="3 2"
              />
            ))}

          {/* Migrant histogram bars */}
          {chartData.migrantDensity.map((b, i) => (
            <rect
              key={`m-${i}`}
              x={xScale(b.bin_start)}
              y={yScale(b.density)}
              width={Math.max(
                0,
                xScale(b.bin_end) - xScale(b.bin_start) - 1,
              )}
              height={Math.max(0, yScale(0) - yScale(b.density))}
              fill="#6EA1BE"
              opacity={0.8}
            />
          ))}

          {/* NZ-born mean reference line */}
          {showNZBorn &&
            chartData.nzBornMean !== undefined &&
            xScale(chartData.nzBornMean) >= PAD.left &&
            xScale(chartData.nzBornMean) <= W - PAD.right && (
              <>
                <line
                  x1={xScale(chartData.nzBornMean)}
                  y1={PAD.top}
                  x2={xScale(chartData.nzBornMean)}
                  y2={PAD.top + PH}
                  stroke="#6F899A"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                />
                <text
                  x={xScale(chartData.nzBornMean)}
                  y={PAD.top - 8}
                  textAnchor="middle"
                  fill="#6F899A"
                  fontSize={10}
                  fontFamily="Inter, sans-serif"
                >
                  NZ-born mean: {fmtDollar(chartData.nzBornMean)}
                </text>
              </>
            )}

          {/* Y-axis labels */}
          {yTicks
            .filter((v) => v > 0)
            .map((v, i) => (
              <text
                key={i}
                x={PAD.left - 6}
                y={yScale(v) + 4}
                textAnchor="end"
                fill="#6F899A"
                fontSize={10}
                fontFamily="Inter, sans-serif"
              >
                {(v * 100).toFixed(0)}%
              </text>
            ))}

          {/* X-axis labels */}
          {xTicks.map((v) => (
            <text
              key={v}
              x={xScale(v)}
              y={H - PAD.bottom + 18}
              textAnchor="middle"
              fill="#6F899A"
              fontSize={11}
              fontFamily="Inter, sans-serif"
            >
              {fmtDollar(v)}
            </text>
          ))}

          {/* Axis titles */}
          <text
            x={PAD.left + PW / 2}
            y={H - 4}
            textAnchor="middle"
            fill="#6F899A"
            fontSize={11}
            fontFamily="Inter, sans-serif"
          >
            Lifetime net fiscal contribution (NZD)
          </text>
          <text
            x={12}
            y={PAD.top + PH / 2}
            textAnchor="middle"
            fill="#6F899A"
            fontSize={11}
            fontFamily="Inter, sans-serif"
            transform={`rotate(-90, 12, ${PAD.top + PH / 2})`}
          >
            Share of group
          </text>

          {/* Legend */}
          <g
            transform={`translate(${W - PAD.right - 170}, ${PAD.top + 8})`}
          >
            <rect
              x={0}
              y={0}
              width={12}
              height={12}
              fill="#6EA1BE"
              opacity={0.8}
            />
            <text
              x={16}
              y={10}
              fill="#152F43"
              fontSize={10}
              fontFamily="Inter, sans-serif"
            >
              {selectedVisa}
            </text>
            {showNZBorn && (
              <>
                <rect
                  x={0}
                  y={20}
                  width={12}
                  height={12}
                  fill="#6F899A"
                  opacity={0.3}
                  stroke="#6F899A"
                  strokeWidth={0.5}
                  strokeDasharray="3 2"
                />
                <text
                  x={16}
                  y={30}
                  fill="#6F899A"
                  fontSize={10}
                  fontFamily="Inter, sans-serif"
                >
                  NZ-born (Birth Citizen)
                </text>
              </>
            )}
          </g>
        </svg>
      </div>

      {/* Percentile stat cards */}
      <div className="flex flex-wrap gap-3 mt-4">
        {(
          [
            { label: "P10", value: selected.p10_npv },
            { label: "P25", value: selected.p25_npv },
            { label: "Median", value: selected.median_npv },
            { label: "P75", value: selected.p75_npv },
            { label: "P90", value: selected.p90_npv },
          ] as const
        ).map(({ label, value }) => (
          <div
            key={label}
            className="flex-1 min-w-[100px] bg-white rounded border border-rule px-3 py-3 text-center"
          >
            <p className="text-xs font-medium text-steel uppercase tracking-wider mb-1">
              {label}
            </p>
            <p
              className="text-lg font-bold"
              style={{ color: value >= 0 ? "#7A9E7E" : "#F26B44" }}
            >
              {fmtDollar(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Source note */}
      <p className="text-steel text-xs mt-4">
        Source: Synthetic population (n&nbsp;=&nbsp;500,004) built from Hughes
        AN&nbsp;26/02 tax data with Wright&nbsp;&amp;&nbsp;Nguyen AN&nbsp;24/09
        fiscal template. NPV at 3.5% discount rate. All values in 2018/19 NZD.
        Positive&nbsp;=&nbsp;net contributor to Crown.
      </p>
    </div>
  );
}

export default NPVDistributionWidget;
