import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

/* ── Types ── */

interface HouseholdMember {
  role: string;
  age: number;
  income: number;
  nfi: number;
}

interface HouseholdRecord {
  household_type: string;
  visa_category: string;
  arrival_age: number;
  members: HouseholdMember[];
  household_nfi: number;
}

/* ── Constants ── */

const ROLE_COLORS: Record<string, string> = {
  primary: "#6EA1BE",
  spouse: "#7A9E7E",
  children: "#F26B44",
};

const ROLE_LABELS: Record<string, string> = {
  primary: "Primary applicant",
  spouse: "Spouse / partner",
  children: "Dependent children",
};

const SHORT_LABELS: Record<string, string> = {
  "Skilled family, age 30": "Skilled family",
  "Family visa single, age 30": "Family single",
  "Family visa couple + children": "Family + children",
  "Student, age 20-25": "Student family",
  "Working holiday, age 25": "Working holiday",
  "Australian citizen, age 35": "Australian single",
  "Humanitarian family, age 30": "Humanitarian family",
  "Retiree, age 65+": "Retiree",
  "NZ-born single, age 30": "NZ-born single",
  "NZ-born family + children": "NZ-born + children",
};

/* ── Chart dimensions ── */

const PAD = { top: 20, right: 64, bottom: 40, left: 160 };
const W = 720;
const BAR_H = 24;
const BAR_GAP = 14;
const ROLES = ["primary", "spouse", "children"] as const;

/* ── Helpers ── */

function fmtDollar(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "\u2212" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtDollarFull(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "\u2212" : "";
  return `${sign}$${abs.toLocaleString("en-NZ", { maximumFractionDigits: 0 })}`;
}

function aggregateByRole(members: HouseholdMember[]) {
  let primary = 0,
    spouse = 0,
    children = 0;
  for (const m of members) {
    if (m.role === "child") children += m.nfi;
    else if (m.role === "spouse") spouse += m.nfi;
    else primary += m.nfi;
  }
  return { primary, spouse, children };
}

function niceAxisTicks(min: number, max: number, target = 6): number[] {
  const range = max - min;
  if (range === 0) return [0];
  const rawStep = range / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const candidates = [1, 2, 2.5, 5, 10];
  const step =
    magnitude * (candidates.find((c) => c * magnitude >= rawStep) ?? 10);
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.01; v += step) {
    ticks.push(Math.round(v));
  }
  return ticks;
}

/* ── Component ── */

export function HouseholdNPVWidget() {
  const { data, isLoading, error } = useQuery<HouseholdRecord[]>({
    queryKey: ["synth-household-npv"],
    queryFn: () =>
      fetch("/data/synth-household-npv.json").then((r) => r.json()),
    staleTime: Infinity,
  });

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.household_nfi - a.household_nfi);
  }, [data]);

  const segments = useMemo(
    () => sorted.map((h) => aggregateByRole(h.members)),
    [sorted],
  );

  const N = sorted.length || 1;
  const PH = N * BAR_H + (N - 1) * BAR_GAP;
  const H = PH + PAD.top + PAD.bottom;
  const PW = W - PAD.left - PAD.right;

  const { xLow, xHigh } = useMemo(() => {
    if (segments.length === 0) return { xLow: -10000, xHigh: 10000 };
    let minNeg = 0;
    let maxPos = 0;
    for (const seg of segments) {
      const pos =
        Math.max(0, seg.primary) +
        Math.max(0, seg.spouse) +
        Math.max(0, seg.children);
      const neg =
        Math.min(0, seg.primary) +
        Math.min(0, seg.spouse) +
        Math.min(0, seg.children);
      if (pos > maxPos) maxPos = pos;
      if (neg < minNeg) minNeg = neg;
    }
    const pad = (maxPos - minNeg) * 0.1 || 5000;
    return { xLow: minNeg - pad, xHigh: maxPos + pad };
  }, [segments]);

  const xScale = (v: number) =>
    PAD.left + ((v - xLow) / (xHigh - xLow)) * PW;
  const yTop = (i: number) => PAD.top + i * (BAR_H + BAR_GAP);
  const xTicks = useMemo(() => niceAxisTicks(xLow, xHigh), [xLow, xHigh]);

  const selected = sorted[selectedIdx] ?? null;

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="bg-off-white rounded-lg p-6 space-y-4">
        <div className="h-6 w-64 bg-rule rounded animate-pulse" />
        <div className="h-4 w-96 bg-rule rounded animate-pulse" />
        <div className="h-[480px] bg-rule rounded animate-pulse" />
      </div>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <div className="bg-off-white rounded-lg p-6">
        <p className="text-steel text-sm">
          Unable to load household data. Please try refreshing.
        </p>
      </div>
    );
  }

  /* ── Headline values ── */
  const nfi = selected?.household_nfi ?? 0;
  const isContributor = nfi >= 0;
  const memberCount = selected?.members.length ?? 0;
  const earnerCount =
    selected?.members.filter((m) => m.income > 0).length ?? 0;

  /* ── Members sorted for detail table ── */
  const sortedMembers = selected
    ? [...selected.members].sort((a, b) => {
        const order: Record<string, number> = {
          primary: 0,
          spouse: 1,
          child: 2,
        };
        return (order[a.role] ?? 3) - (order[b.role] ?? 3);
      })
    : [];

  return (
    <div className="bg-off-white rounded-lg p-6">
      <h3 className="text-navy font-semibold text-lg mb-0.5">
        Household fiscal balance
      </h3>
      <p className="text-steel text-sm mb-4">
        Annual net fiscal impact by household type. Bars show contributions by
        family member role. Click a bar to see the full member breakdown.
      </p>

      {/* Headline card */}
      {selected && (
        <div className="bg-white rounded border border-rule px-5 py-4 mb-5">
          <p className="text-xs text-steel uppercase tracking-wider mb-1">
            {SHORT_LABELS[selected.household_type] ??
              selected.household_type}{" "}
            — annual household fiscal balance
          </p>
          <p
            className="text-3xl font-bold"
            style={{ color: isContributor ? "#7A9E7E" : "#F26B44" }}
          >
            {fmtDollarFull(nfi)}
          </p>
          <p className="text-sm text-steel mt-1">
            {isContributor ? "Net contributor" : "Net fiscal cost"} —{" "}
            {memberCount} member{memberCount !== 1 ? "s" : ""},{" "}
            {earnerCount} earning
          </p>
        </div>
      )}

      {/* SVG chart */}
      <div className="bg-white rounded border border-rule p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Horizontal stacked bar chart showing household fiscal balance by family type"
        >
          {/* Vertical grid */}
          {xTicks.map((v) => (
            <line
              key={v}
              x1={xScale(v)}
              y1={PAD.top - 4}
              x2={xScale(v)}
              y2={PAD.top + PH + 4}
              stroke={v === 0 ? "#152F43" : "#E5E7EB"}
              strokeWidth={v === 0 ? 1.5 : 0.5}
              strokeDasharray={v === 0 ? undefined : "4 3"}
            />
          ))}

          {/* X-axis tick labels */}
          {xTicks.map((v) => (
            <text
              key={v}
              x={xScale(v)}
              y={PAD.top + PH + 20}
              textAnchor="middle"
              fill="#6F899A"
              fontSize={11}
              fontFamily="Inter, sans-serif"
            >
              {fmtDollar(v)}
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
            Annual net fiscal impact ($)
          </text>

          {/* Bars */}
          {sorted.map((h, i) => {
            const y = yTop(i);
            const seg = segments[i];
            const isActive = i === selectedIdx;
            const isHov = i === hoveredIdx;
            const opacity = isActive || isHov ? 1 : 0.7;

            const posRoles = ROLES.filter((r) => seg[r] > 0);
            const negRoles = [...ROLES].reverse().filter((r) => seg[r] < 0);

            let posX = xScale(0);
            const posRects = posRoles.map((role) => {
              const w = xScale(seg[role]) - xScale(0);
              const x = posX;
              posX += w;
              return { role, x, w };
            });

            let negX = xScale(0);
            const negRects = negRoles.map((role) => {
              const w = xScale(0) - xScale(seg[role]);
              negX -= w;
              return { role, x: negX, w };
            });

            const posTotal = ROLES.reduce(
              (s, r) => s + Math.max(0, seg[r]),
              0,
            );
            const negTotal = ROLES.reduce(
              (s, r) => s + Math.min(0, seg[r]),
              0,
            );

            return (
              <g
                key={h.household_type}
                className="cursor-pointer"
                onClick={() => setSelectedIdx(i)}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <rect
                  x={0}
                  y={y - BAR_GAP / 2}
                  width={W}
                  height={BAR_H + BAR_GAP}
                  fill="transparent"
                />

                {(isActive || isHov) && (
                  <rect
                    x={PAD.left}
                    y={y - 2}
                    width={PW}
                    height={BAR_H + 4}
                    fill={isActive ? "#152F4308" : "#152F4304"}
                    rx={4}
                  />
                )}

                {isActive && (
                  <rect
                    x={0}
                    y={y}
                    width={3}
                    height={BAR_H}
                    fill="#152F43"
                    rx={1}
                  />
                )}

                <text
                  x={PAD.left - 10}
                  y={y + BAR_H / 2 + 4}
                  textAnchor="end"
                  fill={isActive ? "#152F43" : "#6F899A"}
                  fontSize={11}
                  fontWeight={isActive ? 600 : 400}
                  fontFamily="Inter, sans-serif"
                >
                  {SHORT_LABELS[h.household_type] ?? h.household_type}
                </text>

                {posRects.map(({ role, x, w }) => (
                  <rect
                    key={`pos-${role}`}
                    x={x}
                    y={y}
                    width={Math.max(0, w)}
                    height={BAR_H}
                    fill={ROLE_COLORS[role]}
                    opacity={opacity}
                    rx={2}
                  />
                ))}

                {negRects.map(({ role, x, w }) => (
                  <rect
                    key={`neg-${role}`}
                    x={x}
                    y={y}
                    width={Math.max(0, w)}
                    height={BAR_H}
                    fill={ROLE_COLORS[role]}
                    opacity={opacity}
                    rx={2}
                  />
                ))}

                <text
                  x={
                    h.household_nfi >= 0
                      ? xScale(posTotal) + 6
                      : xScale(negTotal) - 6
                  }
                  y={y + BAR_H / 2 + 4}
                  textAnchor={h.household_nfi >= 0 ? "start" : "end"}
                  fill={h.household_nfi >= 0 ? "#5A7F5E" : "#C44A2A"}
                  fontSize={11}
                  fontWeight={600}
                  fontFamily="Inter, sans-serif"
                >
                  {fmtDollar(h.household_nfi)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend (HTML for better responsiveness) */}
        <div className="flex flex-wrap gap-4 mt-1 px-2 pb-1">
          {ROLES.map((role) => (
            <div key={role} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: ROLE_COLORS[role] }}
              />
              <span className="text-steel text-xs">{ROLE_LABELS[role]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail table */}
      {selected && (
        <div className="mt-4">
          <h4 className="text-navy font-semibold text-sm mb-2">
            {selected.household_type} — member breakdown
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-steel font-medium border border-rule bg-white">
                    Member
                  </th>
                  <th className="px-3 py-2 text-right text-steel font-medium border border-rule bg-white">
                    Age
                  </th>
                  <th className="px-3 py-2 text-right text-steel font-medium border border-rule bg-white">
                    Income
                  </th>
                  <th className="px-3 py-2 text-right text-steel font-medium border border-rule bg-white">
                    Annual NFI
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((m, idx) => {
                  const roleKey =
                    m.role === "child" ? "children" : m.role;
                  return (
                    <tr
                      key={idx}
                      className={idx % 2 === 0 ? "bg-white" : "bg-linen"}
                    >
                      <td className="px-3 py-2 text-navy border border-rule font-medium">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle"
                          style={{
                            backgroundColor: ROLE_COLORS[roleKey],
                          }}
                        />
                        {m.role === "child"
                          ? "Child"
                          : m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                      </td>
                      <td className="px-3 py-2 text-navy border border-rule text-right">
                        {m.age}
                      </td>
                      <td className="px-3 py-2 text-navy border border-rule text-right font-mono">
                        {fmtDollarFull(m.income)}
                      </td>
                      <td
                        className="px-3 py-2 border border-rule text-right font-mono font-semibold"
                        style={{
                          color: m.nfi >= 0 ? "#5A7F5E" : "#C44A2A",
                        }}
                      >
                        {m.nfi > 0 ? "+" : ""}
                        {fmtDollarFull(m.nfi)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-white font-semibold">
                  <td
                    className="px-3 py-2 text-navy border-t-2 border border-rule"
                    colSpan={2}
                  >
                    Household total
                  </td>
                  <td className="px-3 py-2 text-navy border-t-2 border border-rule text-right font-mono">
                    {fmtDollarFull(
                      selected.members.reduce((s, m) => s + m.income, 0),
                    )}
                  </td>
                  <td
                    className="px-3 py-2 border-t-2 border border-rule text-right font-mono"
                    style={{
                      color:
                        selected.household_nfi >= 0 ? "#5A7F5E" : "#C44A2A",
                    }}
                  >
                    {selected.household_nfi > 0 ? "+" : ""}
                    {fmtDollarFull(selected.household_nfi)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-steel text-xs mt-4">
        Source: Synthetic population model combining Hughes AN 26/02 (tax data)
        and Wright &amp; Nguyen AN 24/09 (age-specific fiscal template).
        Point-in-time annual values in 2018/19 NZD. NFI = revenue minus
        expenditure; positive = net contributor.
      </p>
    </div>
  );
}

export default HouseholdNPVWidget;
