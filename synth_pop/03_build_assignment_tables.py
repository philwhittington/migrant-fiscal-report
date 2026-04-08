"""
P8.3 — Build assignment tables for synthetic population attribute sampling.

Reads Hughes Tables 10 and 11 to produce conditional probability tables:
  1. P(nationality) — marginal distribution over 11 nationality groups
  2. P(relationship | nationality) — Self / Presumed Spouse / Presumed Child
  3. P(tenure | relationship, age) — years-since-residence distribution

Source: Hughes AN 26/02, Tables 10 and 11.
Tax year filter: 2019 (from config.TAX_YEAR).
Table 11 is pooled across years (no taxyr field).

Output: synth_pop/assignment_tables.json
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from synth_pop.config import TAX_YEAR

# ---------------------------------------------------------------------------
# Step 1: Load and filter Table 10 (nationality × relationship, 2019)
# ---------------------------------------------------------------------------
with open(PROJECT_ROOT / 'data/processed/hughes-table10-nationality-relationship.json') as f:
    table10 = json.load(f)

t10_2019 = [r for r in table10 if r['taxyr'] == TAX_YEAR]
print(f"Table 10: {len(table10)} total rows, {len(t10_2019)} for taxyr={TAX_YEAR}")

# ---------------------------------------------------------------------------
# Step 2: Compute nationality marginal P(nationality)
# ---------------------------------------------------------------------------
nat_counts = defaultdict(int)
for r in t10_2019:
    nat_counts[r['nationality']] += r['count']

total = sum(nat_counts.values())
nationality_marginal = {k: v / total for k, v in nat_counts.items()}

print(f"\nNationality marginal ({len(nationality_marginal)} groups, total={total:,}):")
for nat, prob in sorted(nationality_marginal.items(), key=lambda x: -x[1]):
    print(f"  {nat:35s}  {prob:.4f}  (n={nat_counts[nat]:,})")

# ---------------------------------------------------------------------------
# Step 3: Compute P(relationship | nationality)
# ---------------------------------------------------------------------------
nat_rel_counts = defaultdict(lambda: defaultdict(int))
for r in t10_2019:
    nat_rel_counts[r['nationality']][r['relationship']] += r['count']

relationship_given_nationality = {}
for nat, rels in nat_rel_counts.items():
    total_nat = sum(rels.values())
    relationship_given_nationality[nat] = {
        rel: count / total_nat for rel, count in rels.items()
    }

print(f"\nRelationship | nationality ({len(relationship_given_nationality)} nationality groups):")
for nat in sorted(relationship_given_nationality):
    parts = ', '.join(f"{r}: {p:.3f}" for r, p in relationship_given_nationality[nat].items())
    print(f"  {nat:35s}  {parts}")

# ---------------------------------------------------------------------------
# Step 4: Build tenure distribution from Table 11
# ---------------------------------------------------------------------------
with open(PROJECT_ROOT / 'data/processed/hughes-table11-tenure-tax.json') as f:
    table11 = json.load(f)

print(f"\nTable 11: {len(table11)} total rows")

# Deduplicate: Table 11 has 5 rows per (rel, age, tenure) — one per quantile.
# Count should be the same across quantiles; take from first seen.
tenure_cells = {}
for r in table11:
    key = (r['relationship'], r['age_start'], r['residence_years_start'])
    if key not in tenure_cells:
        tenure_cells[key] = r['count']

print(f"Unique (relationship, age, tenure) cells: {len(tenure_cells)}")

# Group by (relationship, age_start) and normalise
tenure_groups = defaultdict(lambda: defaultdict(int))
for (rel, age, tenure), count in tenure_cells.items():
    group_key = f"{rel}|{age}"
    tenure_groups[group_key][str(tenure)] = count

tenure_distribution = {}
for group_key, tenures in tenure_groups.items():
    total_group = sum(tenures.values())
    if total_group > 0:
        tenure_distribution[group_key] = {
            t: c / total_group for t, c in tenures.items()
        }

print(f"Tenure distribution groups: {len(tenure_distribution)}")
for group_key in sorted(tenure_distribution):
    parts = ', '.join(f"{t}yr: {p:.3f}" for t, p in sorted(tenure_distribution[group_key].items(), key=lambda x: int(x[0])))
    total_n = sum(tenure_groups[group_key].values())
    print(f"  {group_key:25s}  n={total_n:>6,}  {parts}")

# ---------------------------------------------------------------------------
# Step 5: Assemble and save
# ---------------------------------------------------------------------------
assignment_tables = {
    'nationality_marginal': nationality_marginal,
    'relationship_given_nationality': relationship_given_nationality,
    'tenure_distribution': tenure_distribution,
}

output_path = PROJECT_ROOT / 'synth_pop' / 'assignment_tables.json'
with open(output_path, 'w') as f:
    json.dump(assignment_tables, f, indent=2)

print(f"\nSaved to {output_path}")

# ---------------------------------------------------------------------------
# Step 6: Self-checks
# ---------------------------------------------------------------------------
print("\n=== Self-checks ===")
errors = []

# Check 1: Nationality marginal sums to 1.0
marginal_sum = sum(nationality_marginal.values())
if abs(marginal_sum - 1.0) < 1e-6:
    print(f"[PASS] Nationality marginal sums to {marginal_sum:.10f}")
else:
    errors.append(f"Nationality marginal sums to {marginal_sum}")
    print(f"[FAIL] Nationality marginal sums to {marginal_sum}")

# Check 2: Exactly 11 nationality groups
if len(nationality_marginal) == 11:
    print(f"[PASS] {len(nationality_marginal)} nationality groups")
else:
    errors.append(f"Expected 11 nationality groups, got {len(nationality_marginal)}")
    print(f"[FAIL] Expected 11 nationality groups, got {len(nationality_marginal)}")

# Check 3: Each nationality has exactly 3 relationship types
expected_rels = {"Self", "Presumed Spouse", "Presumed Child"}
for nat, rels in relationship_given_nationality.items():
    if set(rels.keys()) != expected_rels:
        errors.append(f"{nat} has relationships {set(rels.keys())}, expected {expected_rels}")
        print(f"[FAIL] {nat} has relationships {set(rels.keys())}")
    rel_sum = sum(rels.values())
    if abs(rel_sum - 1.0) >= 1e-6:
        errors.append(f"Relationship probs for {nat} sum to {rel_sum}")
        print(f"[FAIL] Relationship probs for {nat} sum to {rel_sum}")

if all(set(rels.keys()) == expected_rels for rels in relationship_given_nationality.values()):
    print(f"[PASS] All {len(relationship_given_nationality)} nationalities have exactly 3 relationship types")

if all(abs(sum(rels.values()) - 1.0) < 1e-6 for rels in relationship_given_nationality.values()):
    print(f"[PASS] All relationship distributions sum to 1.0")

# Check 4: Tenure distributions sum to 1.0
tenure_ok = True
for group, tenures in tenure_distribution.items():
    t_sum = sum(tenures.values())
    if abs(t_sum - 1.0) >= 1e-6:
        errors.append(f"Tenure probs for {group} sum to {t_sum}")
        print(f"[FAIL] Tenure probs for {group} sum to {t_sum}")
        tenure_ok = False

if tenure_ok:
    print(f"[PASS] All {len(tenure_distribution)} tenure distributions sum to 1.0")

# Check 5: No zero denominators (already handled by total_group > 0 guard)
print(f"[PASS] No zero-denominator groups")

# Summary
if errors:
    print(f"\n{len(errors)} ERRORS found:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print(f"\nAll checks passed.")
