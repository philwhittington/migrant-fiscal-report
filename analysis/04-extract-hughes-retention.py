"""
Extract Tables 14, 142, and 16 from Hughes AN 26/02: cohort tracking data
for building migrant retention/survival curves.

Source: data/raw/hughes-an2602.xlsx, sheet "Data"
  - Table 14:  cohort tracking by aggregated first visa type (~69k rows)
  - Table 142: cohort tracking by arrival age 10-year bands (~65k rows)
  - Table 16:  cohort tracking by detailed first visa type (~151k rows)

Outputs:
  - data/processed/hughes-table14-cohort-visa.json         Raw Table 14
  - data/processed/hughes-table142-cohort-age.json         Raw Table 142
  - data/processed/hughes-table16-cohort-visa-detail.json  Raw Table 16
  - data/processed/retention-curves-by-visa.json           Derived retention by detailed visa
  - data/processed/retention-curves-by-age.json            Derived retention by arrival age

Key design decisions:
  - Table 14 has AGGREGATED visa types (Resident, Student, etc.). Table 16
    has DETAILED visa types (R.Skilled/investor/entrepreneu, R.Family, etc.).
    Retention curves are computed from Table 16 (detailed) since the NPV model
    needs visa-level differentiation.
  - Table 14 is still extracted for completeness and cross-checking.
  - Suppressed rows (measure1 == "S") are excluded.
  - "Resident" status is determined by transcat values starting with "Resident".
  - Retention = (still resident in obs_year) / (initial cohort in arrival_year).
  - Cohorts 2000-2019 are averaged for stable estimates (5+ years of follow-up).
  - Exponential decay fit on years 10-18 for extrapolation beyond observed data.

Assumptions:
  - A migrant's "initial cohort" includes ALL transcat categories in the
    arrival year (including non-resident, visitor, etc.) because the person
    has arrived and been assigned a first visa.
  - "Still resident" means transcat starts with "Resident" — captures all
    resident subcategories (Resident Australian, Resident Permanent Resident,
    Resident Student etc, Resident Temporary Worker, etc.).
  - Retention rates are averaged across arrival cohorts 2000-2019 to smooth
    year-to-year variation. Earlier cohorts contribute more years of follow-up.
"""

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import curve_fit

# Paths
RAW_FILE = Path("data/raw/hughes-an2602.xlsx")
OUT_DIR = Path("data/processed")

# Tables to extract
TABLES = {14, 142, 16}

# Cohort range for averaging retention curves
COHORT_MIN = 2000
COHORT_MAX = 2019  # cohorts with at least 5 years of follow-up (data goes to 2024)

# Key visa types for retention output (Table 16 detailed codes)
KEY_VISA_TYPES = [
    "R.Skilled/investor/entrepreneu",
    "R.Family",
    "R.Humanitarian and Pacific",
    "W.Skills/specific purposes/pos",
    "W.Working holiday",
    "S.Fee paying",
    "S.Dependent",
    "A.Australian",
    "C.Non_birth_citizen",
    "V.Visitor",
    "W.Family",
]

# Transcat values that indicate the person is currently resident in NZ
RESIDENT_PREFIXES = ("Resident",)


def is_resident(transcat: str) -> bool:
    """Check if a transnational category indicates NZ residence."""
    return isinstance(transcat, str) and transcat.startswith(RESIDENT_PREFIXES)


def load_tables(filepath: Path) -> pd.DataFrame:
    """Load the Data sheet and filter to tables 14, 142, 16."""
    print(f"Loading {filepath}...")
    df = pd.read_excel(filepath, sheet_name="Data")
    df = df[df["table_nbr"].isin(TABLES)].copy()
    print(f"  Loaded {len(df):,} rows across tables {sorted(df['table_nbr'].unique())}")
    return df


def extract_table14(df: pd.DataFrame) -> list[dict]:
    """Extract Table 14: cohort tracking by aggregated first visa type."""
    t = df[df["table_nbr"] == 14].copy()

    # Filter suppressed
    suppressed = (t["measure1"] == "S").sum()
    t = t[t["measure1"] != "S"].copy()

    records = []
    for _, row in t.iterrows():
        records.append({
            "obs_year": int(row["var1_value"]),
            "arrival_year": int(row["var2_value"]),
            "transcat": str(row["var3_value"]),
            "first_visa": str(row["var4_value"]) if pd.notna(row["var4_value"]) else "Unknown",
            "count": int(row["measure1"]),
        })

    print(f"\nTable 14: {len(records):,} records extracted, {suppressed:,} suppressed rows skipped")
    return records


def extract_table142(df: pd.DataFrame) -> list[dict]:
    """Extract Table 142: cohort tracking by arrival age band."""
    t = df[df["table_nbr"] == 142].copy()

    suppressed = (t["measure1"] == "S").sum()
    t = t[t["measure1"] != "S"].copy()

    records = []
    for _, row in t.iterrows():
        records.append({
            "obs_year": int(row["var1_value"]),
            "arrival_year": int(row["var2_value"]),
            "transcat": str(row["var3_value"]),
            "arrival_age_band": str(row["var4_value"]),
            "count": int(row["measure1"]),
        })

    print(f"Table 142: {len(records):,} records extracted, {suppressed:,} suppressed rows skipped")
    return records


def extract_table16(df: pd.DataFrame) -> list[dict]:
    """Extract Table 16: cohort tracking by detailed first visa type."""
    t = df[df["table_nbr"] == 16].copy()

    suppressed = (t["measure1"] == "S").sum()
    t = t[t["measure1"] != "S"].copy()

    records = []
    for _, row in t.iterrows():
        records.append({
            "obs_year": int(row["var1_value"]),
            "arrival_year": int(row["var2_value"]),
            "transcat": str(row["var3_value"]),
            "first_visa": str(row["var4_value"]) if pd.notna(row["var4_value"]) else "Unknown",
            "count": int(row["measure1"]),
        })

    print(f"Table 16: {len(records):,} records extracted, {suppressed:,} suppressed rows skipped")
    return records


def compute_retention_by_visa(records: list[dict]) -> list[dict]:
    """
    Compute retention curves by detailed first visa type (from Table 16).

    For each visa type and arrival cohort:
    1. Initial cohort size = sum of all counts where obs_year == arrival_year
    2. Still resident = sum of counts where transcat starts with "Resident"
    3. Retention rate = still_resident / initial_cohort

    Average across cohorts 2000-2019 for each years_since_arrival.
    """
    df = pd.DataFrame(records)
    df["years_since_arrival"] = df["obs_year"] - df["arrival_year"]
    df["is_resident"] = df["transcat"].apply(is_resident)

    # Filter to key visa types, cohort range, and valid years (>= 0)
    df = df[
        (df["first_visa"].isin(KEY_VISA_TYPES))
        & (df["arrival_year"] >= COHORT_MIN)
        & (df["arrival_year"] <= COHORT_MAX)
        & (df["years_since_arrival"] >= 0)
    ]

    # Initial cohort: total count in arrival year (year 0), all transcat categories
    initial = (
        df[df["years_since_arrival"] == 0]
        .groupby(["first_visa", "arrival_year"])["count"]
        .sum()
        .rename("initial_cohort")
    )

    # Still resident: count where transcat is resident, by year (from year 1 onwards)
    # Year 0 retention is set to 1.0 by definition (everyone present at arrival).
    # Year 1+ uses actual observed resident counts.
    resident = (
        df[(df["is_resident"]) & (df["years_since_arrival"] >= 1)]
        .groupby(["first_visa", "arrival_year", "years_since_arrival"])["count"]
        .sum()
        .rename("still_resident")
    )

    # Merge and compute retention rate per cohort (year 1+)
    merged = resident.reset_index().merge(
        initial.reset_index(), on=["first_visa", "arrival_year"]
    )
    merged["retention_rate"] = merged["still_resident"] / merged["initial_cohort"]

    # Average across cohorts for each visa × years_since_arrival
    avg = (
        merged.groupby(["first_visa", "years_since_arrival"])
        .agg(
            retention_rate=("retention_rate", "mean"),
            cohorts_averaged=("arrival_year", "count"),
            initial_cohort_avg=("initial_cohort", "mean"),
        )
        .reset_index()
    )

    # Add year 0 = 1.0 for each visa type (by definition, everyone present at arrival)
    year0_rows = []
    for visa in avg["first_visa"].unique():
        visa_data = avg[avg["first_visa"] == visa]
        year0_rows.append({
            "first_visa": visa,
            "years_since_arrival": 0,
            "retention_rate": 1.0,
            "cohorts_averaged": visa_data["cohorts_averaged"].max(),
            "initial_cohort_avg": visa_data["initial_cohort_avg"].iloc[0],
        })
    avg = pd.concat([pd.DataFrame(year0_rows), avg], ignore_index=True)
    avg = avg.sort_values(["first_visa", "years_since_arrival"]).reset_index(drop=True)

    # Round for readability
    avg["retention_rate"] = avg["retention_rate"].round(4)
    avg["initial_cohort_avg"] = avg["initial_cohort_avg"].round(0).astype(int)

    results = avg.to_dict(orient="records")
    print(f"\nRetention by visa: {len(results)} data points across {avg['first_visa'].nunique()} visa types")
    return results


def compute_retention_by_age(records: list[dict]) -> list[dict]:
    """Compute retention curves by arrival age band (from Table 142)."""
    df = pd.DataFrame(records)
    df["years_since_arrival"] = df["obs_year"] - df["arrival_year"]
    df["is_resident"] = df["transcat"].apply(is_resident)

    # Filter to cohort range and valid years (>= 0)
    df = df[
        (df["arrival_year"] >= COHORT_MIN)
        & (df["arrival_year"] <= COHORT_MAX)
        & (df["years_since_arrival"] >= 0)
    ]

    # Initial cohort: total count at year 0
    initial = (
        df[df["years_since_arrival"] == 0]
        .groupby(["arrival_age_band", "arrival_year"])["count"]
        .sum()
        .rename("initial_cohort")
    )

    # Still resident (from year 1 onwards; year 0 = 1.0 by definition)
    resident = (
        df[(df["is_resident"]) & (df["years_since_arrival"] >= 1)]
        .groupby(["arrival_age_band", "arrival_year", "years_since_arrival"])["count"]
        .sum()
        .rename("still_resident")
    )

    merged = resident.reset_index().merge(
        initial.reset_index(), on=["arrival_age_band", "arrival_year"]
    )
    merged["retention_rate"] = merged["still_resident"] / merged["initial_cohort"]

    # Average across cohorts
    avg = (
        merged.groupby(["arrival_age_band", "years_since_arrival"])
        .agg(
            retention_rate=("retention_rate", "mean"),
            cohorts_averaged=("arrival_year", "count"),
            initial_cohort_avg=("initial_cohort", "mean"),
        )
        .reset_index()
    )

    # Add year 0 = 1.0 for each age band
    year0_rows = []
    for age_band in avg["arrival_age_band"].unique():
        band_data = avg[avg["arrival_age_band"] == age_band]
        year0_rows.append({
            "arrival_age_band": age_band,
            "years_since_arrival": 0,
            "retention_rate": 1.0,
            "cohorts_averaged": band_data["cohorts_averaged"].max(),
            "initial_cohort_avg": band_data["initial_cohort_avg"].iloc[0],
        })
    avg = pd.concat([pd.DataFrame(year0_rows), avg], ignore_index=True)
    avg = avg.sort_values(["arrival_age_band", "years_since_arrival"]).reset_index(drop=True)

    avg["retention_rate"] = avg["retention_rate"].round(4)
    avg["initial_cohort_avg"] = avg["initial_cohort_avg"].round(0).astype(int)

    results = avg.to_dict(orient="records")
    print(f"Retention by age: {len(results)} data points across {avg['arrival_age_band'].nunique()} age bands")
    return results


def exp_decay(t, a, b):
    """Exponential decay: retention(t) = a * exp(-b * t)."""
    return a * np.exp(-b * t)


def fit_extrapolation(retention_records: list[dict], group_col: str) -> list[dict]:
    """
    Fit exponential decay parameters to retention curves (years 10-18)
    for extrapolation beyond the observed data window.

    Returns fitted parameters {group_col, a, b, r_squared, fit_years} for each group.
    """
    df = pd.DataFrame(retention_records)
    results = []

    for group_val, gdf in df.groupby(group_col):
        # Filter to years 10-18 for fitting (stable long-run behaviour)
        fit_data = gdf[
            (gdf["years_since_arrival"] >= 10)
            & (gdf["years_since_arrival"] <= 18)
        ].sort_values("years_since_arrival")

        if len(fit_data) < 3:
            # Not enough data points for a meaningful fit
            continue

        t = fit_data["years_since_arrival"].values.astype(float)
        y = fit_data["retention_rate"].values.astype(float)

        # Skip if retention is zero or negative (shouldn't happen but be safe)
        if (y <= 0).any():
            continue

        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                popt, _ = curve_fit(
                    exp_decay, t, y,
                    p0=[1.0, 0.02],
                    bounds=([0.0, 0.0], [2.0, 1.0]),
                    maxfev=5000,
                )
            a, b = popt

            # R-squared
            y_pred = exp_decay(t, a, b)
            ss_res = np.sum((y - y_pred) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r_sq = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

            results.append({
                group_col: group_val,
                "a": round(float(a), 6),
                "b": round(float(b), 6),
                "r_squared": round(float(r_sq), 4),
                "fit_years_min": int(t.min()),
                "fit_years_max": int(t.max()),
                "fit_points": len(t),
            })
        except (RuntimeError, ValueError):
            # curve_fit failed — skip this group
            print(f"  Warning: could not fit decay curve for {group_col}={group_val}")

    print(f"Extrapolation fits: {len(results)} groups fitted from {group_col}")
    return results


def write_json(data, filepath: Path, label: str):
    """Write data to JSON file."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  {label}: {len(data):,} records → {filepath}")


def print_retention_spot_checks(retention_visa, retention_age):
    """Print spot checks for retention curves."""
    visa_df = pd.DataFrame(retention_visa)
    age_df = pd.DataFrame(retention_age)

    print("\n--- Spot checks: retention by visa at year+5 ---")
    for visa in KEY_VISA_TYPES:
        row = visa_df[(visa_df["first_visa"] == visa) & (visa_df["years_since_arrival"] == 5)]
        if not row.empty:
            r = row.iloc[0]
            print(f"  {visa:40s}  {r['retention_rate']:.1%}  (avg of {r['cohorts_averaged']} cohorts, ~{r['initial_cohort_avg']:,} initial)")

    print("\n--- Spot checks: retention by age at year+5 ---")
    for _, row in age_df[age_df["years_since_arrival"] == 5].sort_values("arrival_age_band").iterrows():
        print(f"  {row['arrival_age_band']:10s}  {row['retention_rate']:.1%}  (avg of {row['cohorts_averaged']} cohorts)")

    print("\n--- Spot checks: retention by visa at year+10, +15, +18 ---")
    for years in [10, 15, 18]:
        skilled = visa_df[
            (visa_df["first_visa"] == "R.Skilled/investor/entrepreneu")
            & (visa_df["years_since_arrival"] == years)
        ]
        if not skilled.empty:
            print(f"  R.Skilled at year+{years}: {skilled.iloc[0]['retention_rate']:.1%}")


def main():
    # Load data
    df = load_tables(RAW_FILE)

    # Part A: Extract raw tables
    print("\n=== Part A: Extract raw tables ===")
    t14_records = extract_table14(df)
    t142_records = extract_table142(df)
    t16_records = extract_table16(df)

    write_json(t14_records, OUT_DIR / "hughes-table14-cohort-visa.json", "Table 14")
    write_json(t142_records, OUT_DIR / "hughes-table142-cohort-age.json", "Table 142")
    write_json(t16_records, OUT_DIR / "hughes-table16-cohort-visa-detail.json", "Table 16")

    # Part B: Compute retention curves
    print("\n=== Part B: Compute retention curves ===")
    retention_visa = compute_retention_by_visa(t16_records)
    retention_age = compute_retention_by_age(t142_records)

    # Part C: Fit extrapolation parameters
    print("\n=== Part C: Fit extrapolation parameters ===")
    visa_fits = fit_extrapolation(retention_visa, "first_visa")
    age_fits = fit_extrapolation(retention_age, "arrival_age_band")

    # Attach fit parameters to retention output
    visa_output = {
        "retention_curves": retention_visa,
        "extrapolation_fits": visa_fits,
        "metadata": {
            "source_table": 16,
            "cohort_range": f"{COHORT_MIN}-{COHORT_MAX}",
            "fit_method": "exponential_decay: retention(t) = a * exp(-b * t)",
            "fit_window": "years 10-18 since arrival",
            "note": "Retention curves from Table 16 (detailed visa types). "
                    "Table 14 has aggregated visa types only.",
        },
    }

    age_output = {
        "retention_curves": retention_age,
        "extrapolation_fits": age_fits,
        "metadata": {
            "source_table": 142,
            "cohort_range": f"{COHORT_MIN}-{COHORT_MAX}",
            "fit_method": "exponential_decay: retention(t) = a * exp(-b * t)",
            "fit_window": "years 10-18 since arrival",
        },
    }

    write_json(visa_output, OUT_DIR / "retention-curves-by-visa.json", "Retention by visa")
    write_json(age_output, OUT_DIR / "retention-curves-by-age.json", "Retention by age")

    # Spot checks
    print_retention_spot_checks(retention_visa, retention_age)

    # Print extrapolation fit quality
    print("\n--- Extrapolation fit quality (visa) ---")
    for f in visa_fits:
        print(f"  {f['first_visa']:40s}  a={f['a']:.4f}  b={f['b']:.4f}  R²={f['r_squared']:.4f}")

    print("\n--- Extrapolation fit quality (age) ---")
    for f in age_fits:
        print(f"  {f['arrival_age_band']:10s}  a={f['a']:.4f}  b={f['b']:.4f}  R²={f['r_squared']:.4f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
