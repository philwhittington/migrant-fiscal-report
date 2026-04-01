"""
Extract Table 1 from Hughes AN 26/02: aggregate population counts and tax paid
by year, 20-year age band, and transnational category.

Source: data/raw/hughes-an2602.xlsx, sheet "Data", rows where table_nbr == 1
Output: data/processed/hughes-table1-aggregate.json

Columns:
  A: table_nbr          H: var4 (= "transcat")
  B: var1 (= "yr")      I: var4_value (= transcat name)
  C: var1_value (year)   J: measure_type1 (= "underlying count")
  D: var2 (= "NULL")     K: measure1 (count, or "S" if suppressed)
  E: var2_value           L: measure_type2 (= "tax_b")
  F: var3 (age_20bins)    M: measure2 (tax in billions)
  G: var3_value (age band start: 0, 20, 40, 60, 80)

Assumptions:
  - Suppressed rows (measure1 == "S") are excluded.
  - Tax values are in billions of NZD (as labelled in measure_type2).
  - Age band start mapped: 0→"0-19", 20→"20-39", 40→"40-59", 60→"60-79", 80→"80+".
"""

import json
from pathlib import Path

import openpyxl

# Paths
RAW_FILE = Path("data/raw/hughes-an2602.xlsx")
OUT_FILE = Path("data/processed/hughes-table1-aggregate.json")

# Age band mapping
AGE_LABELS = {
    0: "0-19",
    20: "20-39",
    40: "40-59",
    60: "60-79",
    80: "80+",
}


def main():
    print(f"Opening {RAW_FILE} (read_only mode)...")
    wb = openpyxl.load_workbook(str(RAW_FILE), read_only=True, data_only=True)
    ws = wb["Data"]

    records = []
    suppressed = 0

    for row in ws.iter_rows(min_row=2, values_only=True):
        # Filter to Table 1
        if row[0] != 1:
            continue

        # Skip suppressed rows
        if row[10] == "S":
            suppressed += 1
            continue

        year = int(row[2])
        raw_age = row[6]
        if raw_age == "NULL" or raw_age is None:
            age_start = None
            age_band = "Unknown"
        else:
            age_start = int(raw_age)
            age_band = AGE_LABELS.get(age_start, f"{age_start}+")
        transcat = row[8]
        count = int(row[10])
        tax_billions = float(row[12])

        records.append({
            "year": year,
            "age_band": age_band,
            "age_start": age_start,
            "transcat": transcat,
            "count": count,
            "tax_billions": tax_billions,
        })

    wb.close()

    # Write JSON
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(records, f, indent=2)

    # Summary
    years = sorted(set(r["year"] for r in records))
    transcats = sorted(set(r["transcat"] for r in records))
    latest_year = max(years)
    latest_tax = sum(r["tax_billions"] for r in records if r["year"] == latest_year)

    print(f"\n--- Summary ---")
    print(f"Records extracted: {len(records)}")
    print(f"Suppressed rows skipped: {suppressed}")
    print(f"Year range: {min(years)}-{max(years)}")
    print(f"Distinct transcats ({len(transcats)}):")
    for t in transcats:
        print(f"  {t}")
    print(f"\nTotal tax in {latest_year}: ${latest_tax:.3f}B")

    # Spot check: Resident Birth Citizen, age 20-39, 1999
    spot = [
        r for r in records
        if r["transcat"] == "Resident Birth Citizen"
        and r["age_band"] == "20-39"
        and r["year"] == 1999
    ]
    if spot:
        print(f"\nSpot check — Resident Birth Citizen, 20-39, 1999:")
        print(f"  Count: {spot[0]['count']:,}")
        print(f"  Tax: ${spot[0]['tax_billions']:.5f}B")

    # Spot check: latest year same slice
    spot2 = [
        r for r in records
        if r["transcat"] == "Resident Birth Citizen"
        and r["age_band"] == "20-39"
        and r["year"] == latest_year
    ]
    if spot2:
        print(f"\nSpot check — Resident Birth Citizen, 20-39, {latest_year}:")
        print(f"  Count: {spot2[0]['count']:,}")
        print(f"  Tax: ${spot2[0]['tax_billions']:.5f}B")

    print(f"\nOutput written to {OUT_FILE}")


if __name__ == "__main__":
    main()
