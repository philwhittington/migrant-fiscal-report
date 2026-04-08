"""
P8.1 — Build seed population from Hughes Table 4.

Reads Table 4 (visa subcategory × age band) for tax year 2019,
computes a stratified subsample of ~500,000 individuals, and saves
as Parquet. Each row is one synthetic person with an ID, age band,
visa subcategory, and visa category.

Source: data/processed/hughes-table4-visa-subcategory.json
Output: synth_pop/seed_population.parquet
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Ensure project root is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from synth_pop.config import POPULATION_TARGET, TAX_YEAR

# ── Step 1: Read and filter Table 4 ──────────────────────────────────────

with open("data/processed/hughes-table4-visa-subcategory.json") as f:
    table4 = json.load(f)

# Filter to 2019, exclude aggregate rows (null age_start) and zero-count cells
cells = [
    r for r in table4
    if r["year"] == TAX_YEAR
    and r["age_start"] is not None
    and r["count"] > 0
]

print(f"Table 4 cells for {TAX_YEAR}: {len(cells)}")

# ── Step 2: Compute sampling weights ─────────────────────────────────────

total_population = sum(c["count"] for c in cells)
sampling_fraction = POPULATION_TARGET / total_population

print(f"Total real population (with age bands): {total_population:,}")
print(f"Sampling fraction: {sampling_fraction:.6f}")

# Target count per cell — round, but ensure at least 1 per non-empty cell
for c in cells:
    c["target_count"] = max(1, round(c["count"] * sampling_fraction))

actual_target = sum(c["target_count"] for c in cells)
print(f"Actual target after rounding: {actual_target:,}")

# ── Step 3: Expand to individual rows ─────────────────────────────────────

rows = []
person_id = 0
for c in cells:
    for _ in range(c["target_count"]):
        rows.append(
            {
                "id": person_id,
                "age_start": c["age_start"],
                "visa_subcategory": c["visa_subcategory"],
                "visa_category": c["visa_category"],
            }
        )
        person_id += 1

seed = pd.DataFrame(rows)

# ── Step 4: Save as Parquet ───────────────────────────────────────────────

output_path = Path("synth_pop/seed_population.parquet")
seed.to_parquet(output_path, index=False)
print(f"\nSeed population saved: {len(seed):,} rows → {output_path}")

# ── Step 5: Self-checks ──────────────────────────────────────────────────

print("\n=== Self-checks ===")

# 1. Row count within 1% of target
count_ok = abs(len(seed) - POPULATION_TARGET) / POPULATION_TARGET < 0.01
print(f"1. Row count {len(seed):,} (target {POPULATION_TARGET:,}, "
      f"diff {len(seed) - POPULATION_TARGET:+,}): "
      f"{'PASS' if count_ok else 'FAIL'}")

# 2. Proportional fidelity — max absolute deviation < 0.001
# Aggregate source counts (multiple subcategories per visa_category × age_start)
from collections import defaultdict

source_counts = defaultdict(int)
for c in cells:
    source_counts[(c["visa_category"], c["age_start"])] += c["count"]
seed_counts = seed.groupby(["visa_category", "age_start"]).size().to_dict()

max_dev = 0.0
worst_cell = None
for key, src_count in source_counts.items():
    src_frac = src_count / total_population
    seed_frac = seed_counts.get(key, 0) / len(seed)
    dev = abs(seed_frac - src_frac)
    if dev > max_dev:
        max_dev = dev
        worst_cell = key

prop_ok = max_dev < 0.001
print(f"2. Proportional fidelity (max deviation {max_dev:.6f}, "
      f"worst cell {worst_cell}): {'PASS' if prop_ok else 'FAIL'}")

# 3. No null age_start
null_ok = seed["age_start"].isna().sum() == 0
print(f"3. No null age_start: {'PASS' if null_ok else 'FAIL'}")

# 4. All visa categories present
source_cats = {c["visa_category"] for c in cells}
seed_cats = set(seed["visa_category"].unique())
cats_ok = source_cats == seed_cats
if not cats_ok:
    print(f"   Missing: {source_cats - seed_cats}")
    print(f"   Extra: {seed_cats - source_cats}")
print(f"4. All visa categories present ({len(seed_cats)}): "
      f"{'PASS' if cats_ok else 'FAIL'}")

# 5. Unique IDs
ids_ok = seed["id"].nunique() == len(seed)
print(f"5. Unique IDs: {'PASS' if ids_ok else 'FAIL'}")

all_ok = all([count_ok, prop_ok, null_ok, cats_ok, ids_ok])
print(f"\nOverall: {'ALL CHECKS PASSED' if all_ok else 'SOME CHECKS FAILED'}")

if not all_ok:
    sys.exit(1)
