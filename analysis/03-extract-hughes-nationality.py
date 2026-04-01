"""
Extract Hughes AN 26/02 Table 8: tax by nationality group, age band, and quantile.

Table 8 contains individual-level tax payment quantiles (p10–p90) broken down by
nationality group (11 groups), 10-year age bands, and tax year (2000–2025).

Unlike aggregate tables where measure2 is in billions, Table 8's measure2 is
already in dollars (individual quantile values).

Rows where measure1 == "S" are suppressed by Stats NZ and are excluded,
though in practice Table 8 has no suppressed rows.

Output: data/processed/hughes-table8-nationality.json
"""

import json
import openpyxl

INPUT = "data/raw/hughes-an2602.xlsx"
OUTPUT = "data/processed/hughes-table8-nationality.json"

wb = openpyxl.load_workbook(INPUT, read_only=True)
ws = wb["Data"]

records = []
skipped = 0

for row in ws.iter_rows(min_row=2, values_only=True):
    if row[0] != 8:
        continue

    # Skip suppressed rows
    if row[10] == "S":
        skipped += 1
        continue

    records.append({
        "taxyr": int(row[2]),
        "age_start": int(row[4]),
        "nationality": row[6],
        "quantile": row[8],
        "count": int(row[10]),
        "tax_dollars": float(row[12]),
    })

wb.close()

with open(OUTPUT, "w") as f:
    json.dump(records, f, indent=2)

# Summary
nationalities = sorted(set(r["nationality"] for r in records))
years = sorted(set(r["taxyr"] for r in records))

print(f"Rows written: {len(records):,}")
print(f"Rows skipped (suppressed): {skipped}")
print(f"Distinct nationalities ({len(nationalities)}): {', '.join(nationalities)}")
print(f"Year range: {years[0]}–{years[-1]}")
