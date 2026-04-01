"""
Extract Hughes AN 26/02 Tables 9, 10, 11: family composition and relationship tax.

Table 9:  Tax quantiles by relationship to primary applicant, age band, and tax year.
          Shows how tax payments differ between Self (primary), Presumed Spouse,
          Presumed Child, and Presumed Parent. ~2,275 rows.

Table 10: Population counts by nationality group and relationship to primary applicant.
          No tax measure — just headcounts. Enables family unit size calculation
          (total / Self ≈ 2.07 in 2024). ~1,205 rows.

Table 11: Tax quantiles by relationship, age band, and years since first residence.
          Cross-section (not time series) — enables tenure-based analysis of how
          family members' tax contributions evolve with time in NZ. ~375 rows.

All three tables use per-person dollar amounts (measure_type2 = 'tax'), not billions.
Rows where measure1 == "S" are Stats NZ confidentialised and are excluded.

Outputs:
  data/processed/hughes-table9-relationship-tax.json
  data/processed/hughes-table10-nationality-relationship.json
  data/processed/hughes-table11-tenure-tax.json
"""

import json
import openpyxl

INPUT = "data/raw/hughes-an2602.xlsx"
OUTPUT_T9 = "data/processed/hughes-table9-relationship-tax.json"
OUTPUT_T10 = "data/processed/hughes-table10-nationality-relationship.json"
OUTPUT_T11 = "data/processed/hughes-table11-tenure-tax.json"

wb = openpyxl.load_workbook(INPUT, read_only=True)
ws = wb["Data"]

t9_records = []
t10_records = []
t11_records = []
skipped = {"t9": 0, "t10": 0, "t11": 0}

for row in ws.iter_rows(min_row=2, values_only=True):
    table = row[0]

    if table == 9:
        # Skip suppressed rows
        if row[10] == "S":
            skipped["t9"] += 1
            continue
        t9_records.append({
            "taxyr": int(row[2]),
            "age_start": int(row[4]),
            "relationship": row[6],
            "quantile": row[8],
            "count": int(row[10]),
            "tax_dollars": float(row[12]),
        })

    elif table == 10:
        # Skip suppressed rows
        if row[10] == "S":
            skipped["t10"] += 1
            continue
        nationality = row[6]
        relationship = row[8]
        # Exclude NULL nationality and Presumed Parent (very small numbers)
        if nationality == "NULL":
            continue
        if relationship == "Presumed Parent":
            continue
        t10_records.append({
            "taxyr": int(row[2]),
            "nationality": nationality,
            "relationship": relationship,
            "count": int(row[10]),
        })

    elif table == 11:
        # Skip suppressed rows
        if row[10] == "S":
            skipped["t11"] += 1
            continue
        t11_records.append({
            "relationship": row[2],
            "age_start": int(row[4]),
            "residence_years_start": int(row[6]),
            "quantile": row[8],
            "count": int(row[10]),
            "tax_dollars": float(row[12]),
        })

wb.close()

# Write outputs
for path, records in [
    (OUTPUT_T9, t9_records),
    (OUTPUT_T10, t10_records),
    (OUTPUT_T11, t11_records),
]:
    with open(path, "w") as f:
        json.dump(records, f, indent=2)

# --- Summaries ---

print("=" * 60)
print("TABLE 9: Tax quantiles by relationship")
print(f"  Rows written: {len(t9_records):,}")
print(f"  Rows skipped (suppressed): {skipped['t9']}")
relationships_t9 = sorted(set(r["relationship"] for r in t9_records))
years_t9 = sorted(set(r["taxyr"] for r in t9_records))
print(f"  Relationships: {', '.join(relationships_t9)}")
print(f"  Year range: {years_t9[0]}–{years_t9[-1]}")
# Self-check: Self at age 30, p50, 2024
check = [r for r in t9_records if r["taxyr"] == 2024 and r["age_start"] == 30
         and r["relationship"] == "Self" and r["quantile"] == "p50"]
if check:
    print(f"  CHECK Self age30 p50 2024: ${check[0]['tax_dollars']:,.0f} (expect ~$18,214)")
check_sp = [r for r in t9_records if r["taxyr"] == 2024 and r["age_start"] == 30
            and r["relationship"] == "Presumed Spouse" and r["quantile"] == "p50"]
if check_sp:
    print(f"  CHECK Spouse age30 p50 2024: ${check_sp[0]['tax_dollars']:,.0f} (expect ~$10,140)")

print()
print("=" * 60)
print("TABLE 10: Population by nationality and relationship")
print(f"  Rows written: {len(t10_records):,}")
print(f"  Rows skipped (suppressed): {skipped['t10']}")
nationalities = sorted(set(r["nationality"] for r in t10_records))
print(f"  Nationalities ({len(nationalities)}): {', '.join(nationalities)}")
# Self-check: South Asia Self 2024 ~ 65,274; South Africa Self ~ 23,598
for nat in ("South Asia", "South Africa"):
    check = [r for r in t10_records if r["taxyr"] == 2024
             and r["nationality"] == nat and r["relationship"] == "Self"]
    if check:
        print(f"  CHECK {nat} Self 2024: {check[0]['count']:,} (expect ~{65274 if nat == 'South Asia' else 23598:,})")
# Family unit check
self_2024 = sum(r["count"] for r in t10_records if r["taxyr"] == 2024 and r["relationship"] == "Self")
all_2024 = sum(r["count"] for r in t10_records if r["taxyr"] == 2024)
if self_2024 > 0:
    print(f"  CHECK Avg family unit 2024: {all_2024 / self_2024:.2f} (expect ~2.07)")

print()
print("=" * 60)
print("TABLE 11: Tax quantiles by relationship, age, and tenure")
print(f"  Rows written: {len(t11_records):,}")
print(f"  Rows skipped (suppressed): {skipped['t11']}")
relationships_t11 = sorted(set(r["relationship"] for r in t11_records))
tenure_bins = sorted(set(r["residence_years_start"] for r in t11_records))
age_bins = sorted(set(r["age_start"] for r in t11_records))
print(f"  Relationships: {', '.join(relationships_t11)}")
print(f"  Age bins: {age_bins}")
print(f"  Tenure bins: {tenure_bins}")
print(f"  CHECK row count: {len(t11_records)} (expect ~375)")
