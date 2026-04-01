import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

/* ── Types ── */

interface RawRow {
  nationality: string;
  year: number;
  ratio: number;
  age_band: string;
  nationality_tax: number;
  nzborn_tax: number;
}

interface Shaped {
  ageBands: string[];
  years: number[];
  nationalities: string[];
  data: Record<string, Record<string, { year: number; ratio: number; tax: number; nzborn: number }[]>>;
}

/* ── Constants ── */

const NATIONALITY_COLORS: Record<string, string> = {
  China: "#E63946",
  "South Asia": "#457B9D",
  UK: "#2A9D8F",
  "South Africa": "#E9C46A",
  Phillipines: "#F4A261",
  Pacific: "#264653",
  "US/Canada": "#1D3557",
  "Europe (excl UK)": "#6A4C93",
  "Other Asia": "#B85C38",
  "Americas (excl US/Canada)": "#7A9E7E",
  "Africa/Middle East (excl RSA)": "#C9A227",
};

const DEFAULT_SELECTED = new Set([
  "China",
  "South Asia",
  "UK",
  "Pacific",
  "Phillipines",
  "South Africa",
]);

const AGE_BANDS = ["20-29", "30-39", "40-49", "50-59"];
const DEFAULT_AGE = "30-39";

const PAD = { top: 24, right: 80, bottom: 44, left: 52 };
const W = 640;
const H = 360;
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

/* ── Scale helpers ── */

const Y_MIN = 0;
const Y_MAX = 2.0;

function sx(year: number): number {
  return PAD.left + ((year - 2000) / (2024 - 2000)) * PW;
}

function sy(ratio: number): number {
  return PAD.top + (1 - (ratio - Y_MIN) / (Y_MAX - Y_MIN)) * PH;
}

/* ── Path builder ── */

function linePath(pts: { year: number; ratio: number }[]): string {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.year).toFixed(1)},${sy(p.ratio).toFixed(1)}`)
    .join(" ");
}

/* ── Find parity crossing ── */

function findParityCrossing(pts: { year: number; ratio: number }[]): { year: number; cx: number; cy: number } | null {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i - 1].ratio < 1.0 && pts[i].ratio >= 1.0) {
      const frac = (1.0 - pts[i - 1].ratio) / (pts[i].ratio - pts[i - 1].ratio);
      const crossYear = pts[i - 1].year + frac;
      return { year: crossYear, cx: sx(crossYear), cy: sy(1.0) };
    }
  }
  return null;
}

/* ── Reshape flat array into nested lookup ── */

function shapeData(rows: RawRow[]): Shaped {
  const ageBands = Array.from(new Set(rows.map((r) => r.age_band))).sort();
  const years = Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => a - b);
  const nationalities = Array.from(new Set(rows.map((r) => r.nationality))).sort();

  const data: Shaped["data"] = {};
  for (const band of ageBands) {
    data[band] = {};
    for (const nat of nationalities) {
      data[band][nat] = rows
        .filter((r) => r.age_band === band && r.nationality === nat)
        .sort((a, b) => a.year - b.year)
        .map((r) => ({ year: r.year, ratio: r.ratio, tax: r.nationality_tax, nzborn: r.nzborn_tax }));
    }
  }

  return { ageBands, years, nationalities, data };
}

/* ── Component ── */

export function NationalityConvergenceWidget() {
  const { data: raw, isLoading, error } = useQuery<RawRow[]>({
    queryKey: ["nationality-convergence"],
    queryFn: () => fetch("/data/nationality-convergence.json").then((r) => r.json()),
  });

  const [ageBand, setAgeBand] = useState(DEFAULT_AGE);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(DEFAULT_SELECTED));
  const [hover, setHover] = useState<{ nationality: string; year: number; ratio: number; tax: number; nzborn: number; px: number; py: number } | null>(null);

  const shaped = useMemo(() => (raw ? shapeData(raw) : null), [raw]);

  const toggle = useCallback((nat: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(nat)) next.delete(nat);
      else next.add(nat);
      return next;
    });
  }, []);

  const bandData = useMemo(() => {
    if (!shaped) return null;
    return shaped.data[ageBand] ?? null;
  }, [shaped, ageBand]);

  const visibleNats = useMemo(() => {
    if (!shaped) return [];
    return shaped.nationalities.filter((n) => selected.has(n));
  }, [shaped, selected]);

  /* ── China parity annotation (must be before early returns) ── */
  const chinaCross = useMemo(() => {
    if (!bandData || !selected.has("China") || !bandData["China"]) return null;
    return findParityCrossing(bandData["China"]);
  }, [bandData, selected]);

  /* ── Mouse handler for hover tooltip ── */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!bandData) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const scaleX = W / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * (H / rect.height);

      // Map mouse X to year
      const yearFrac = ((mouseX - PAD.left) / PW) * (2024 - 2000) + 2000;
      const nearestYear = Math.round(Math.max(2000, Math.min(2024, yearFrac)));

      // Find nearest visible nationality to mouse
      let best: typeof hover = null;
      let bestDist = Infinity;
      for (const nat of visibleNats) {
        const pts = bandData[nat];
        if (!pts) continue;
        const pt = pts.find((p) => p.year === nearestYear);
        if (!pt) continue;
        const px = sx(pt.year);
        const py = sy(pt.ratio);
        const dist = Math.hypot(px - mouseX, py - mouseY);
        if (dist < bestDist && dist < 60) {
          bestDist = dist;
          best = { nationality: nat, year: pt.year, ratio: pt.ratio, tax: pt.tax, nzborn: pt.nzborn, px, py };
        }
      }
      setHover(best);
    },
    [bandData, visibleNats],
  );

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="bg-[#F8F3EA] rounded-lg p-6 space-y-4">
        <div className="h-6 w-64 bg-[#6F899A]/20 rounded animate-pulse" />
        <div className="h-4 w-96 bg-[#6F899A]/20 rounded animate-pulse" />
        <div className="h-[360px] bg-[#6F899A]/20 rounded animate-pulse" />
      </div>
    );
  }

  /* ── Error state ── */
  if (error || !raw || !shaped || !bandData) {
    return (
      <div className="bg-[#F8F3EA] rounded-lg p-6">
        <p className="text-[#6F899A] text-sm">Unable to load nationality convergence data.</p>
      </div>
    );
  }

  /* ── X-axis ticks ── */
  const xTicks = [2000, 2004, 2008, 2012, 2016, 2020, 2024];
  const yTicks = [0, 0.5, 1.0, 1.5, 2.0];

  return (
    <div className="bg-[#F8F3EA] rounded-lg p-6">
      {/* Title */}
      <h3 className="text-[#152F43] font-semibold text-lg mb-0.5">
        Nationality convergence explorer
      </h3>
      <p className="text-[#6F899A] text-sm mb-4">
        Ratio of nationality group median income to NZ-born median, by age band and year
      </p>

      {/* Age band selector */}
      <div className="flex gap-2 mb-4">
        {AGE_BANDS.map((band) => (
          <button
            key={band}
            onClick={() => setAgeBand(band)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              ageBand === band
                ? "bg-[#F26B44] text-white"
                : "bg-gray-200 text-[#152F43] hover:bg-gray-300"
            }`}
          >
            Age {band}
          </button>
        ))}
      </div>

      {/* Nationality toggles */}
      <div className="flex flex-wrap gap-x-2 gap-y-2 mb-4">
        {shaped.nationalities.map((nat) => {
          const color = NATIONALITY_COLORS[nat] ?? "#888";
          const active = selected.has(nat);
          return (
            <button
              key={nat}
              onClick={() => toggle(nat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                active
                  ? "text-white border-transparent"
                  : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"
              }`}
              style={active ? { backgroundColor: color, borderColor: color } : undefined}
            >
              {nat}
            </button>
          );
        })}
      </div>

      {/* SVG chart */}
      <div className="bg-white rounded border border-[#E5E7EB] p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Nationality income convergence chart for age ${ageBand}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* Horizontal grid lines */}
          {yTicks.map((v) => (
            <line
              key={v}
              x1={PAD.left}
              y1={sy(v)}
              x2={W - PAD.right}
              y2={sy(v)}
              stroke="#E5E7EB"
              strokeDasharray="4 3"
              strokeWidth={0.5}
            />
          ))}

          {/* Parity reference line at 1.0 */}
          <line
            x1={PAD.left}
            y1={sy(1.0)}
            x2={W - PAD.right}
            y2={sy(1.0)}
            stroke="#6F899A"
            strokeDasharray="6 4"
            strokeWidth={1.5}
          />
          <text
            x={W - PAD.right + 4}
            y={sy(1.0) + 4}
            fill="#6F899A"
            fontSize={10}
            fontFamily="Inter, sans-serif"
            fontWeight={500}
          >
            NZ-born
          </text>
          <text
            x={W - PAD.right + 4}
            y={sy(1.0) + 14}
            fill="#6F899A"
            fontSize={10}
            fontFamily="Inter, sans-serif"
            fontWeight={500}
          >
            parity
          </text>

          {/* Y-axis labels */}
          {yTicks.map((v) => (
            <text
              key={v}
              x={PAD.left - 8}
              y={sy(v) + 4}
              textAnchor="end"
              fill="#6F899A"
              fontSize={12}
              fontFamily="Inter, sans-serif"
            >
              {v === 0 ? "0" : v.toFixed(1)}×
            </text>
          ))}

          {/* X-axis labels */}
          {xTicks.map((yr) => (
            <text
              key={yr}
              x={sx(yr)}
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
            Year
          </text>

          {/* Lines */}
          {visibleNats.map((nat) => {
            const pts = bandData[nat];
            if (!pts || pts.length === 0) return null;
            return (
              <path
                key={`line-${nat}`}
                d={linePath(pts)}
                stroke={NATIONALITY_COLORS[nat] ?? "#888"}
                strokeWidth={hover?.nationality === nat ? 3 : 1.8}
                fill="none"
                strokeLinejoin="round"
                opacity={hover && hover.nationality !== nat ? 0.3 : 1}
              />
            );
          })}

          {/* Endpoint labels */}
          {visibleNats.map((nat) => {
            const pts = bandData[nat];
            if (!pts || pts.length === 0) return null;
            const last = pts[pts.length - 1];
            return (
              <text
                key={`end-${nat}`}
                x={sx(last.year) + 4}
                y={sy(last.ratio) + 4}
                fill={NATIONALITY_COLORS[nat] ?? "#888"}
                fontSize={9}
                fontFamily="Inter, sans-serif"
                fontWeight={500}
                opacity={hover && hover.nationality !== nat ? 0.3 : 1}
              >
                {last.ratio.toFixed(2)}×
              </text>
            );
          })}

          {/* China parity crossing annotation */}
          {chinaCross && (
            <g>
              <circle
                cx={chinaCross.cx}
                cy={chinaCross.cy}
                r={4}
                fill="#E63946"
                stroke="white"
                strokeWidth={1.5}
              />
              <line
                x1={chinaCross.cx}
                y1={chinaCross.cy - 5}
                x2={chinaCross.cx}
                y2={chinaCross.cy - 20}
                stroke="#E63946"
                strokeWidth={0.75}
              />
              <text
                x={chinaCross.cx + 4}
                y={chinaCross.cy - 22}
                fill="#152F43"
                fontSize={10}
                fontFamily="Inter, sans-serif"
                fontWeight={500}
              >
                {`China crossed parity ~${Math.round(chinaCross.year)}`}
              </text>
            </g>
          )}

          {/* Hover dot and tooltip */}
          {hover && (
            <g>
              <circle
                cx={hover.px}
                cy={hover.py}
                r={4.5}
                fill={NATIONALITY_COLORS[hover.nationality] ?? "#888"}
                stroke="white"
                strokeWidth={2}
              />
              <rect
                x={hover.px + (hover.px > W / 2 ? -160 : 12)}
                y={hover.py - 50}
                width={148}
                height={44}
                rx={4}
                fill="#152F43"
                opacity={0.92}
              />
              <text
                x={hover.px + (hover.px > W / 2 ? -152 : 20)}
                y={hover.py - 33}
                fill="white"
                fontSize={11}
                fontFamily="Inter, sans-serif"
                fontWeight={600}
              >
                {hover.nationality} ({hover.year})
              </text>
              <text
                x={hover.px + (hover.px > W / 2 ? -152 : 20)}
                y={hover.py - 18}
                fill="#A0B8C8"
                fontSize={10}
                fontFamily="Inter, sans-serif"
              >
                {hover.ratio.toFixed(2)}× parity · ${hover.tax.toLocaleString()} vs ${hover.nzborn.toLocaleString()}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Key stat callout */}
      <div className="bg-white rounded border border-[#E5E7EB] px-4 py-3 mt-4">
        <p className="text-[#152F43] text-sm">
          <span className="font-semibold">Key insight:</span>{" "}
          {ageBand === "30-39" ? (
            <>
              Chinese migrants aged 30–39 went from <strong>6%</strong> of NZ-born median income in 2000 to{" "}
              <strong>117%</strong> by 2024 — one of the most dramatic convergence stories in the data.
            </>
          ) : ageBand === "20-29" ? (
            <>
              Among 20–29 year-olds, Chinese migrants crossed NZ-born parity around{" "}
              <strong>2013</strong> and now earn <strong>43% above</strong> the NZ-born median.
            </>
          ) : (
            <>
              Convergence patterns vary markedly by age. Younger migrants tend to converge faster, reflecting
              labour market integration over time.
            </>
          )}
        </p>
      </div>

      {/* Source note */}
      <p className="text-[#6F899A] text-xs mt-3">
        Source: Hughes AN 26/02 Table 8 (nationality p50 tax) and Table 5 (NZ-born p50 tax). Ratio = nationality
        group median ÷ NZ-born median for the same age band and year.
      </p>
    </div>
  );
}

export default NationalityConvergenceWidget;
