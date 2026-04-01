"""
Extract Wright & Nguyen AN 24/09 fiscal incidence data into structured JSON.

Source: data/raw/wright-nguyen-an2409.csv
Output: data/processed/wright-nguyen-fiscal-template.json

Three datasets extracted:

1. fiscal_components — "No sharing" dollar values by individual age band (Age X-Y).
   Used to build per-person fiscal profiles for the migrant NPV model.

2. net_fiscal_impact — "Family" sharing by principal earner age (Principal Age X-Y).
   The headline NFI number that accounts for dependants within the family unit.

3. family_composition — Family type counts by principal earner age.
   Needed to weight family-level NFI back to individuals if required.

Assumptions:
  - Rows with empty or non-numeric Estimate are skipped.
  - Suppressed rows (Note contains "Suppressed" or Estimate blank) are skipped.
  - All dollar values are in 2018/19 NZD (as labelled in the source).
  - Student Allowance is included in fiscal_components where available;
    it is often suppressed for working-age bands (small amounts).
"""

import csv
import json
import re
from pathlib import Path
from typing import Optional

RAW_FILE = Path("data/raw/wright-nguyen-an2409.csv")
OUT_FILE = Path("data/processed/wright-nguyen-fiscal-template.json")

# Age bands we expect for "No sharing" individual data
INDIVIDUAL_AGE_BANDS = [
    "0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34",
    "35-39", "40-44", "45-49", "50-54", "55-59", "60-64",
    "65-69", "70-74", "75-79", "80+",
]

# Mapping from CSV statistic name to our JSON key for fiscal_components
COMPONENT_MAP = {
    "Average Market income": "market_income",
    "Average Direct taxes": "direct_taxes",
    "Average Income support": "income_support",
    "Average Working for Families": "wff",
    "Average NZ Super and Vets": "nz_super",
    "Average Working-age support": "working_age_support",
    "Average Housing support": "housing_support",
    "Average Paid Parental Leave": "paid_parental_leave",
    "Average Student Allowance": "student_allowance",
    "Average Education spending": "education_spending",
    "Average Health spending": "health_spending",
    "Average Disposable income": "disposable_income",
    "Average Independent Earner Tax Credit": "ietc",
    "Average Winter Energy Payment": "winter_energy",
    "Average Other Non-Taxable Benefits": "other_non_taxable",
    "Average Other income support": "other_income_support",
}

# Mapping for net fiscal impact (Family sharing, Principal Age)
NFI_MAP = {
    "Average Net Fiscal Impact": "net_fiscal_impact",
    "Average Final income": "final_income",
    "Average Market income": "market_income",
    "Average Direct taxes": "direct_taxes",
    "Average Income support": "income_support",
    "Average Indirect taxes": "indirect_taxes",
    "Average In-kind spending": "in_kind_spending",
}

# Family composition statistics
FAMILY_TYPE_MAP = {
    "Couple families": "couple",
    "Couple-with-children families": "couple_with_children",
    "Single-member families": "single_member",
    "Sole-parent families": "sole_parent",
}


def parse_estimate(value: str) -> Optional[int]:
    """Parse an estimate value, returning int or None if empty/non-numeric."""
    if not value or value.strip() == "":
        return None
    try:
        return int(round(float(value)))
    except (ValueError, TypeError):
        return None


def extract_age_band(group: str, prefix: str) -> Optional[str]:
    """Extract age band string from group like 'Age 30-34' or 'Principal Age 30-34'."""
    m = re.match(rf"^{prefix}\s+(\d+-\d+|\d+\+)$", group)
    return m.group(1) if m else None


def main():
    # Read all rows
    with open(RAW_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Read {len(rows)} rows from {RAW_FILE}")

    # --- 1. Fiscal components by age (No sharing) ---
    components: dict[str, dict] = {}
    for row in rows:
        if row["Sharing assumption"] != "No sharing":
            continue
        age_band = extract_age_band(row["Group or category"], "Age")
        if age_band is None or age_band not in INDIVIDUAL_AGE_BANDS:
            continue
        stat = row["Statistic"]
        if stat not in COMPONENT_MAP:
            continue
        est = parse_estimate(row["Estimate"])
        if est is None:
            continue

        if age_band not in components:
            components[age_band] = {}
        components[age_band][COMPONENT_MAP[stat]] = est

    fiscal_components = []
    for ab in INDIVIDUAL_AGE_BANDS:
        entry = {"age_band": ab, "components": components.get(ab, {})}
        fiscal_components.append(entry)

    # --- 2. Net fiscal impact by age (Family sharing) ---
    nfi_data: dict[str, dict] = {}
    nfi_errors: dict[str, dict] = {}
    for row in rows:
        if row["Sharing assumption"] != "Family":
            continue
        age_band = extract_age_band(row["Group or category"], "Principal Age")
        if age_band is None:
            continue
        stat = row["Statistic"]
        if stat not in NFI_MAP:
            continue
        est = parse_estimate(row["Estimate"])
        if est is None:
            continue

        if age_band not in nfi_data:
            nfi_data[age_band] = {}
            nfi_errors[age_band] = {}
        nfi_data[age_band][NFI_MAP[stat]] = est
        # Capture sampling error for NFI specifically
        if stat == "Average Net Fiscal Impact":
            err = parse_estimate(row["Sampling error"])
            if err is not None:
                nfi_errors[age_band]["nfi_error"] = err

    # Build ordered list matching Principal Age bands present in data
    principal_age_bands = [ab for ab in INDIVIDUAL_AGE_BANDS if ab in nfi_data]
    net_fiscal_impact = []
    for ab in principal_age_bands:
        entry = {"age_band": ab}
        entry.update(nfi_data[ab])
        entry.update(nfi_errors.get(ab, {}))
        net_fiscal_impact.append(entry)

    # --- 3. Family composition by age ---
    family_data: dict[str, dict] = {}
    for row in rows:
        stat = row["Statistic"]
        if stat not in FAMILY_TYPE_MAP:
            continue
        if row["Unit"] != "Families":
            continue
        age_band = extract_age_band(row["Group or category"], "Principal Age")
        if age_band is None:
            continue
        est = parse_estimate(row["Estimate"])
        # Keep None for suppressed/unavailable — we'll handle downstream
        if age_band not in family_data:
            family_data[age_band] = {}
        family_data[age_band][FAMILY_TYPE_MAP[stat]] = est

    family_composition = []
    for ab in principal_age_bands:
        entry = {"age_band": ab}
        entry.update(family_data.get(ab, {}))
        family_composition.append(entry)

    # --- Combine and write ---
    output = {
        "source": "Wright & Nguyen, Treasury AN 24/09",
        "unit": "NZD, tax year 2018/19",
        "notes": [
            "fiscal_components: No sharing assumption, individual age bands",
            "net_fiscal_impact: Family sharing assumption, principal earner age bands",
            "family_composition: Family counts by principal earner age (null = suppressed)",
        ],
        "fiscal_components": fiscal_components,
        "net_fiscal_impact": net_fiscal_impact,
        "family_composition": family_composition,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    # --- Summary and spot checks ---
    print(f"\n--- Summary ---")
    print(f"fiscal_components: {len(fiscal_components)} age bands")
    print(f"net_fiscal_impact: {len(net_fiscal_impact)} age bands")
    print(f"family_composition: {len(family_composition)} age bands")

    # Component counts per age band
    for entry in fiscal_components:
        n = len(entry["components"])
        print(f"  {entry['age_band']}: {n} components")

    # Spot checks against task self-check values
    print(f"\n--- Spot checks ---")
    checks = [
        ("net_fiscal_impact", "45-49", "net_fiscal_impact", -16590),
        ("net_fiscal_impact", "65-69", "net_fiscal_impact", 14670),
        ("fiscal_components", "5-9", "education_spending", 7590),
        ("fiscal_components", "30-34", "health_spending", 2650),
        ("fiscal_components", "65-69", "nz_super", 18420),
        ("family_composition", "30-34", "couple_with_children", 80000),
    ]
    all_ok = True
    for dataset_key, age, field, expected in checks:
        if dataset_key == "fiscal_components":
            match = [e for e in fiscal_components if e["age_band"] == age]
            actual = match[0]["components"].get(field) if match else None
        elif dataset_key == "net_fiscal_impact":
            match = [e for e in net_fiscal_impact if e["age_band"] == age]
            actual = match[0].get(field) if match else None
        elif dataset_key == "family_composition":
            match = [e for e in family_composition if e["age_band"] == age]
            actual = match[0].get(field) if match else None
        else:
            actual = None

        status = "OK" if actual == expected else f"MISMATCH (got {actual})"
        if actual != expected:
            all_ok = False
        print(f"  {dataset_key}[{age}].{field}: expected {expected}, {status}")

    if all_ok:
        print("\nAll spot checks passed.")
    else:
        print("\nWARNING: Some spot checks failed!")

    print(f"\nOutput written to {OUT_FILE}")


if __name__ == "__main__":
    main()
