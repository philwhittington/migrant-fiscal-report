"""
Extract Hughes AN 26/02 Tables 4, 5, 7 — tax distributions by visa type, age, sex.

Table 4: Tax by year, age band, visa subcategory (tax in billions)
Table 5: Tax quantiles by year, age band, visa category (tax in dollars)
Table 7: Tax quantiles by sex, age band, visa subcategory (tax in dollars)

Source: data/raw/hughes-an2602.xlsx, sheet "Data"
Output: data/processed/hughes-table4-visa-subcategory.json
        data/processed/hughes-table5-visa-quantiles.json
        data/processed/hughes-table7-sex-visa-quantiles.json

Assumptions:
- Rows where measure1 == 'S' are Stats NZ confidentialised and are excluded.
  (In practice, tables 4/5/7 have no 'S' rows, but we filter defensively.)
- Table 4 has 26 rows with NaN age (all "Unknown (Presumed resident)").
  These are preserved with age_start = null.
- Table 4 measure2 is in billions (measure_type2 = 'tax_b').
- Tables 5 and 7 measure2 is in dollars (measure_type2 = 'tax').
"""

import json
import pandas as pd
from pathlib import Path


def main():
    raw_path = Path("data/raw/hughes-an2602.xlsx")
    out_dir = Path("data/processed")
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Reading {raw_path} ...")
    df = pd.read_excel(raw_path, sheet_name="Data")
    print(f"  Total rows: {len(df):,}")

    # Filter to tables of interest in one pass
    mask = df["table_nbr"].isin([4, 5, 7])
    subset = df[mask].copy()
    print(f"  Tables 4+5+7 rows: {len(subset):,}")

    # Suppress confidentialised rows
    suppressed = subset["measure1"] == "S"
    if suppressed.any():
        print(f"  Dropping {suppressed.sum()} suppressed rows")
        subset = subset[~suppressed]

    # --- Table 4: Tax by year, age, visa subcategory ---
    t4 = subset[subset["table_nbr"] == 4].copy()
    records_4 = []
    for _, row in t4.iterrows():
        age_val = row["var2_value"]
        records_4.append({
            "year": int(row["var1_value"]),
            "age_start": int(age_val) if pd.notna(age_val) else None,
            "visa_subcategory": str(row["var3_value"]),
            "visa_category": str(row["var4_value"]),
            "count": int(row["measure1"]),
            "tax_billions": float(row["measure2"]),
        })
    print(f"\n  Table 4: {len(records_4):,} rows")
    print(f"    Year range: {min(r['year'] for r in records_4)}–{max(r['year'] for r in records_4)}")
    print(f"    Visa subcategories: {len(set(r['visa_subcategory'] for r in records_4))}")
    with open(out_dir / "hughes-table4-visa-subcategory.json", "w") as f:
        json.dump(records_4, f, indent=2)
    print(f"    Written to {out_dir / 'hughes-table4-visa-subcategory.json'}")

    # --- Table 5: Tax quantiles by visa category ---
    t5 = subset[subset["table_nbr"] == 5].copy()
    records_5 = []
    for _, row in t5.iterrows():
        records_5.append({
            "taxyr": int(row["var1_value"]),
            "age_start": int(row["var2_value"]),
            "visa_category": str(row["var3_value"]),
            "quantile": str(row["var4_value"]),
            "count": int(row["measure1"]),
            "tax_dollars": float(row["measure2"]),
        })
    print(f"\n  Table 5: {len(records_5):,} rows")
    print(f"    Tax year range: {min(r['taxyr'] for r in records_5)}–{max(r['taxyr'] for r in records_5)}")
    print(f"    Visa categories: {len(set(r['visa_category'] for r in records_5))}")
    # Validation: Birth Citizen, p50, age 30, taxyr 2024
    check = [r for r in records_5 if r["taxyr"] == 2024 and r["age_start"] == 30
             and r["visa_category"] == "Birth Citizen" and r["quantile"] == "p50"]
    if check:
        print(f"    Validation (Birth Citizen, age 30, p50, 2024): tax_dollars = {check[0]['tax_dollars']:,.0f}")
    with open(out_dir / "hughes-table5-visa-quantiles.json", "w") as f:
        json.dump(records_5, f, indent=2)
    print(f"    Written to {out_dir / 'hughes-table5-visa-quantiles.json'}")

    # --- Table 7: Tax quantiles by sex and visa subcategory ---
    t7 = subset[subset["table_nbr"] == 7].copy()
    records_7 = []
    for _, row in t7.iterrows():
        records_7.append({
            "sex": str(row["var1_value"]),
            "age_start": int(row["var2_value"]),
            "visa_subcategory": str(row["var3_value"]),
            "quantile": str(row["var4_value"]),
            "count": int(row["measure1"]),
            "tax_dollars": float(row["measure2"]),
        })
    print(f"\n  Table 7: {len(records_7):,} rows")
    print(f"    Sex values: {sorted(set(r['sex'] for r in records_7))}")
    print(f"    Visa subcategories: {len(set(r['visa_subcategory'] for r in records_7))}")
    with open(out_dir / "hughes-table7-sex-visa-quantiles.json", "w") as f:
        json.dump(records_7, f, indent=2)
    print(f"    Written to {out_dir / 'hughes-table7-sex-visa-quantiles.json'}")

    print("\nDone.")


if __name__ == "__main__":
    main()
