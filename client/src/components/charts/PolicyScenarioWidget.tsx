import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/* ── Types ── */

interface CategorySummary {
  count: number;
  mean_npv: number;
  total_npv: number;
}

interface PopulationSummary {
  total_population: number;
  total_npv: number;
  mean_npv: number;
  by_visa_category: Record<string, CategorySummary>;
  pct_net_contributor: number;
  discount_rate: number;
  max_age: number;
}

interface DistributionCell {
  visa_category: string;
  arrival_age: number;
  count: number;
  mean_npv: number;
  pct_net_contributor: number;
}

/* ── Constants ── */

/** Migrant visa categories for scenario analysis (excludes Birth Citizen, Diplomatic) */
const MIGRANT_CATS = [
  "Resident",
  "Permanent Resident",
  "Non-residential work",
  "Australian",
  "Student",
  "Visitor",
  "Non-birth Citizen",
  "Unknown (Presumed resident)",
];

/** Settlement visa categories (NZ residence class) — the policy-controllable lever */
const RESIDENCE_CLASS = new Set(["Resident", "Permanent Resident"]);

/**
 * Approximate year-10 retention rate by category.
 * Used to scale NPV when the retention slider moves.
 * null = effectively permanent (retention change doesn't apply).
 */
const CAT_RETENTION: Record<string, number | null> = {
  "Resident": 0.90,
  "Permanent Resident": 0.88,
  "Non-birth Citizen": null,
  "Unknown (Presumed resident)": null,
  "Australian": 0.45,
  "Non-residential work": 0.30,
  "Student": 0.25,
  "Visitor": 0.10,
};

/**
 * NZ Super threshold sensitivity: NPV adjustment per migrant per year of
 * threshold change. Higher for categories more likely to reach pension age
 * while resident. These are approximations accounting for age distribution
 * and probability of exceeding the residence threshold.
 */
const SUPER_SENSITIVITY: Record<string, number> = {
  "Resident": 800,
  "Permanent Resident": 800,
  "Non-birth Citizen": 2500,
  "Unknown (Presumed resident)": 2000,
  "Australian": 1200,
  "Non-residential work": 200,
  "Student": 100,
  "Visitor": 100,
};

/** Per-1pp retention change → pct_net_contributor adjustment */
const RETENTION_PCT_SENS = 0.004;
/** Per-year Super threshold change → pct_net_contributor adjustment */
const SUPER_PCT_SENS = 0.006;

/* ── Helpers ── */

function fmtDollar(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "\u2212" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}b`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}m`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtDelta(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? "+" : "\u2212";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}b`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}m`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPctDelta(v: number): string {
  const sign = v >= 0 ? "+" : "\u2212";
  return `${sign}${(Math.abs(v) * 100).toFixed(1)} pp`;
}

/* ── Component ── */

export function PolicyScenarioWidget() {
  /* Data fetching */
  const {
    data: summary,
    isLoading: sLoad,
    error: sErr,
  } = useQuery<PopulationSummary>({
    queryKey: ["synth-population-summary"],
    queryFn: () =>
      fetch("/data/synth-population-summary.json").then((r) => r.json()),
    staleTime: Infinity,
  });

  const {
    data: distributions,
    isLoading: dLoad,
    error: dErr,
  } = useQuery<Record<string, DistributionCell>>({
    queryKey: ["synth-npv-distributions"],
    queryFn: () =>
      fetch("/data/synth-npv-distributions.json").then((r) => r.json()),
    staleTime: Infinity,
  });

  /* Slider state — null composition means "use exact baseline" */
  const [compositionPct, setCompositionPct] = useState<number | null>(null);
  const [retentionDelta, setRetentionDelta] = useState(0);
  const [superThreshold, setSuperThreshold] = useState(10);

  /* ── Baseline computation ── */
  const baseline = useMemo(() => {
    if (!summary || !distributions) return null;

    const cats: Record<
      string,
      { count: number; meanNpv: number; pctContrib: number }
    > = {};
    let totalMigrants = 0;

    for (const cat of MIGRANT_CATS) {
      const sd = summary.by_visa_category[cat];
      if (!sd) continue;

      // Weighted pct_net_contributor from distribution cells
      let wContrib = 0;
      let wCount = 0;
      for (const cell of Object.values(distributions)) {
        if (cell.visa_category === cat) {
          wContrib += cell.count * cell.pct_net_contributor;
          wCount += cell.count;
        }
      }

      cats[cat] = {
        count: sd.count,
        meanNpv: sd.mean_npv,
        pctContrib: wCount > 0 ? wContrib / wCount : 0,
      };
      totalMigrants += sd.count;
    }

    // Residence class baseline share
    let resCount = 0;
    for (const cat of MIGRANT_CATS) {
      if (RESIDENCE_CLASS.has(cat) && cats[cat]) resCount += cats[cat].count;
    }
    const resShare = totalMigrants > 0 ? resCount / totalMigrants : 0.52;

    // Weighted aggregates
    let wNpv = 0;
    let wPct = 0;
    for (const cat of MIGRANT_CATS) {
      if (!cats[cat]) continue;
      const w = cats[cat].count / totalMigrants;
      wNpv += w * cats[cat].meanNpv;
      wPct += w * cats[cat].pctContrib;
    }

    return {
      cats,
      totalMigrants,
      resShare,
      meanNpv: wNpv,
      pctContrib: wPct,
      per1000: wNpv * 1000,
      totalNpv: wNpv * totalMigrants,
    };
  }, [summary, distributions]);

  /* Effective slider value for display */
  const sliderComposition =
    compositionPct ?? (baseline ? Math.round(baseline.resShare * 100) : 52);

  /* ── Scenario computation ── */
  const scenario = useMemo(() => {
    if (!baseline) return null;

    // Use exact baseline share when slider untouched
    const newResShare =
      compositionPct !== null ? compositionPct / 100 : baseline.resShare;

    const resScale =
      baseline.resShare > 0 ? newResShare / baseline.resShare : 1;
    const otherBase = 1 - baseline.resShare;
    const otherScale = otherBase > 0 ? (1 - newResShare) / otherBase : 1;

    let wNpv = 0;
    let wPct = 0;
    let totalW = 0;

    for (const cat of MIGRANT_CATS) {
      const cd = baseline.cats[cat];
      if (!cd) continue;

      // Composition reweighting
      const scale = RESIDENCE_CLASS.has(cat) ? resScale : otherScale;
      const weight = cd.count * scale;

      // Retention adjustment (capped to prevent extreme values at low baselines)
      const retBase = CAT_RETENTION[cat];
      let retFactor = 1;
      if (retBase !== null && retBase > 0 && retentionDelta !== 0) {
        retFactor = 1 + retentionDelta / 100 / retBase;
        retFactor = Math.max(0.5, Math.min(2.0, retFactor));
      }

      // Super threshold adjustment (positive = fiscal saving = higher NPV)
      const superAdj = (superThreshold - 10) * (SUPER_SENSITIVITY[cat] ?? 0);

      const adjNpv = cd.meanNpv * retFactor + superAdj;
      wNpv += weight * adjNpv;
      wPct += weight * cd.pctContrib;
      totalW += weight;
    }

    const meanNpv = totalW > 0 ? wNpv / totalW : 0;
    let pctContrib = totalW > 0 ? wPct / totalW : 0;

    // Marginal pct_net_contributor adjustments for retention and Super
    pctContrib += retentionDelta * RETENTION_PCT_SENS;
    pctContrib += (superThreshold - 10) * SUPER_PCT_SENS;
    pctContrib = Math.max(0, Math.min(1, pctContrib));

    return {
      meanNpv,
      pctContrib,
      per1000: meanNpv * 1000,
      totalNpv: meanNpv * baseline.totalMigrants,
    };
  }, [baseline, compositionPct, retentionDelta, superThreshold]);

  const isModified =
    compositionPct !== null || retentionDelta !== 0 || superThreshold !== 10;

  function resetSliders() {
    setCompositionPct(null);
    setRetentionDelta(0);
    setSuperThreshold(10);
  }

  /* ── Loading skeleton ── */
  if (sLoad || dLoad) {
    return (
      <div className="bg-off-white rounded-lg p-6 space-y-4">
        <div className="h-6 w-64 bg-rule rounded animate-pulse" />
        <div className="h-4 w-96 bg-rule rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-rule rounded animate-pulse" />
          ))}
        </div>
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 flex-1 bg-rule rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (sErr || dErr || !summary || !distributions) {
    return (
      <div className="bg-off-white rounded-lg p-6">
        <p className="text-steel text-sm">
          Unable to load scenario data. Please try refreshing.
        </p>
      </div>
    );
  }

  if (!baseline || !scenario) {
    return (
      <div className="bg-off-white rounded-lg p-6">
        <p className="text-steel text-sm">
          Insufficient data for scenario analysis.
        </p>
      </div>
    );
  }

  /* ── Metric card definitions ── */
  const metrics: Array<{
    label: string;
    baseline: number;
    current: number;
    fmt: (v: number) => string;
    deltaFmt: (v: number) => string;
    threshold: number;
  }> = [
    {
      label: "Fiscal impact per 1,000 migrants",
      baseline: baseline.per1000,
      current: scenario.per1000,
      fmt: fmtDollar,
      deltaFmt: fmtDelta,
      threshold: 1000,
    },
    {
      label: "Net contributors",
      baseline: baseline.pctContrib,
      current: scenario.pctContrib,
      fmt: (v) => `${(v * 100).toFixed(1)}%`,
      deltaFmt: fmtPctDelta,
      threshold: 0.001,
    },
    {
      label: "Total migrant NPV",
      baseline: baseline.totalNpv,
      current: scenario.totalNpv,
      fmt: fmtDollar,
      deltaFmt: fmtDelta,
      threshold: 1000,
    },
  ];

  return (
    <div className="bg-off-white rounded-lg p-6">
      {/* Title */}
      <h3 className="text-navy font-semibold text-lg mb-0.5">
        Policy scenario explorer
      </h3>
      <p className="text-steel text-sm mb-4">
        Adjust migration policy settings to explore their effect on aggregate
        fiscal outcomes. All values in 2018/19 NZD.
      </p>

      {/* Scenario indicator */}
      <div className="flex items-center gap-3 mb-5">
        <span
          className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full",
            isModified
              ? "bg-teal/15 text-teal"
              : "bg-steel/10 text-steel",
          )}
        >
          {isModified ? "Modified scenario" : "Current settings"}
        </span>
        {isModified && (
          <button
            onClick={resetSliders}
            className="text-teal text-xs underline underline-offset-2 hover:text-navy transition-colors"
          >
            Reset to baseline
          </button>
        )}
      </div>

      {/* ── Sliders ── */}
      <div className="space-y-4 mb-6">
        {/* Slider 1: Settlement visa share */}
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <label className="text-xs font-medium text-steel uppercase tracking-wider">
              Settlement visa share
            </label>
            <span className="text-sm font-semibold text-navy">
              {sliderComposition}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-steel w-8 text-right">10%</span>
            <input
              type="range"
              min={10}
              max={80}
              step={1}
              value={sliderComposition}
              onChange={(e) => setCompositionPct(Number(e.target.value))}
              className="flex-1 h-2 accent-teal cursor-pointer"
            />
            <span className="text-xs text-steel w-8">80%</span>
          </div>
          <p className="text-xs text-steel mt-0.5">
            Resident + Permanent Resident as share of all migrants (baseline{" "}
            {Math.round(baseline.resShare * 100)}%)
          </p>
        </div>

        {/* Slider 2: Retention change */}
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <label className="text-xs font-medium text-steel uppercase tracking-wider">
              Retention change (year 10)
            </label>
            <span className="text-sm font-semibold text-navy">
              {retentionDelta >= 0 ? "+" : "\u2212"}
              {Math.abs(retentionDelta)} pp
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-steel w-8 text-right">
              {"\u2212"}10
            </span>
            <input
              type="range"
              min={-10}
              max={10}
              step={1}
              value={retentionDelta}
              onChange={(e) => setRetentionDelta(Number(e.target.value))}
              className="flex-1 h-2 accent-teal cursor-pointer"
            />
            <span className="text-xs text-steel w-8">+10</span>
          </div>
          <p className="text-xs text-steel mt-0.5">
            Shift in year-10 retention rate across visa types
          </p>
        </div>

        {/* Slider 3: NZ Super residence threshold */}
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <label className="text-xs font-medium text-steel uppercase tracking-wider">
              NZ Super residence threshold
            </label>
            <span className="text-sm font-semibold text-navy">
              {superThreshold} years
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-steel w-8 text-right">5 yr</span>
            <input
              type="range"
              min={5}
              max={20}
              step={5}
              value={superThreshold}
              onChange={(e) => setSuperThreshold(Number(e.target.value))}
              className="flex-1 h-2 accent-teal cursor-pointer"
            />
            <span className="text-xs text-steel w-8">20 yr</span>
          </div>
          <p className="text-xs text-steel mt-0.5">
            Years of NZ residence required for NZ Super eligibility (current
            law: 10)
          </p>
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {metrics.map((m, i) => {
          const delta = m.current - m.baseline;
          const isPositive = delta > 0;
          const isNeutral = Math.abs(delta) < m.threshold;

          return (
            <div
              key={i}
              className="bg-white rounded border border-steel/20 px-4 py-3"
            >
              <p className="text-xs text-steel uppercase tracking-wider mb-2">
                {m.label}
              </p>
              <p className="text-2xl font-bold text-navy mb-1">
                {m.fmt(m.current)}
              </p>
              {!isNeutral && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                    isPositive
                      ? "bg-sage/10 text-sage"
                      : "bg-coral/10 text-coral",
                  )}
                >
                  {isPositive ? "\u25B2" : "\u25BC"} {m.deltaFmt(delta)}
                </span>
              )}
              <p className="text-xs text-steel mt-1.5">
                Baseline: {m.fmt(m.baseline)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Source note */}
      <p className="text-steel text-xs leading-relaxed">
        Source: Synthetic population model (500,004 individuals) combining
        Hughes AN 26/02 and Wright &amp; Nguyen AN 24/09. Settlement visas =
        Resident + Permanent Resident. Retention and NZ Super adjustments use
        linear approximations — actual effects depend on age composition and
        individual circumstances. Discount rate 3.5%. Positive = net
        contribution to Crown.
      </p>
    </div>
  );
}

export default PolicyScenarioWidget;
