"""
P8.5 — Assign attributes (relationship, nationality, years since residence)

Adds three columns to the seed population:
  - nationality: one of 11 groups from Table 10 marginal
  - relationship: Self / Presumed Spouse / Presumed Child (conditional on nationality, with age overrides)
  - years_since_residence: drawn from Table 11 tenure distribution (migrants) or set to age (birth citizens)

Inputs:
  - synth_pop/seed_population.parquet (P8.4 output)
  - synth_pop/assignment_tables.json (P8.3 output)

Output:
  - synth_pop/seed_population.parquet (updated in place with 3 new columns)

Source data: Hughes AN 26/02, Tables 10 and 11.
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path

# ── Constants ──────────────────────────────────────────────────────────
RNG_SEED = 43
PROJECT = Path(__file__).resolve().parent.parent
SYNTH = PROJECT / 'synth_pop'

# ── Load inputs ────────────────────────────────────────────────────────
print("Loading inputs...")
seed = pd.read_parquet(SYNTH / 'seed_population.parquet')
print(f"  Seed population: {len(seed):,} rows, columns: {seed.columns.tolist()}")

with open(SYNTH / 'assignment_tables.json') as f:
    tables = json.load(f)

nat_marginal = tables['nationality_marginal']
rel_given_nat = tables['relationship_given_nationality']
tenure_dist = tables['tenure_distribution']

rng = np.random.default_rng(seed=RNG_SEED)

# ── Step 1: Assign nationality ─────────────────────────────────────────
# Unconditional draw from Table 10 marginal. This applies to all individuals
# including birth citizens — the nationality field is only used downstream
# for migrants (P8.6 routes by visa_category).
print("\nStep 1: Assigning nationality...")
nationalities = list(nat_marginal.keys())
nat_probs = np.array([nat_marginal[n] for n in nationalities])
nat_probs /= nat_probs.sum()

seed['nationality'] = rng.choice(nationalities, size=len(seed), p=nat_probs)

print("  Nationality distribution (synthetic vs source):")
for nat in nationalities:
    synth_pct = (seed['nationality'] == nat).mean()
    source_pct = nat_marginal[nat]
    print(f"    {nat:35s}  synth={synth_pct:.4f}  source={source_pct:.4f}  diff={synth_pct - source_pct:+.4f}")

# ── Step 2: Assign relationship ────────────────────────────────────────
# Conditional on nationality, with age overrides:
#   age_start <= 10  → forced "Presumed Child"
#   age_start >= 60  → forced "Self"
#   otherwise        → drawn from P(relationship | nationality)
print("\nStep 2: Assigning relationship...")
seed['relationship'] = ''

unique_ages = sorted(seed['age_start'].unique())
for nat in nationalities:
    for age in unique_ages:
        mask = (seed['nationality'] == nat) & (seed['age_start'] == age)
        n = mask.sum()
        if n == 0:
            continue

        if age <= 10:
            seed.loc[mask, 'relationship'] = 'Presumed Child'
        elif age >= 60:
            seed.loc[mask, 'relationship'] = 'Self'
        else:
            probs_dict = rel_given_nat.get(
                nat, {'Self': 0.5, 'Presumed Spouse': 0.3, 'Presumed Child': 0.2}
            )
            rels = list(probs_dict.keys())
            probs = np.array([probs_dict[r] for r in rels])
            probs /= probs.sum()
            seed.loc[mask, 'relationship'] = rng.choice(rels, size=n, p=probs)

print("  Relationship distribution:")
for rel, pct in seed['relationship'].value_counts(normalize=True).items():
    print(f"    {rel:25s}  {pct:.4f}")

# ── Step 3: Assign years since residence ───────────────────────────────
# Birth citizens: tenure = age_start (resident since birth).
# Migrants: draw from Table 11 tenure distribution conditioned on
# (relationship, age_start). Tenure bands are 0/5/10/15/20; we add
# uniform jitter within the 5-year band for continuity.
print("\nStep 3: Assigning years since residence...")
seed['years_since_residence'] = 0

birth_mask = seed['visa_category'] == 'Birth Citizen'
seed.loc[birth_mask, 'years_since_residence'] = seed.loc[birth_mask, 'age_start']
print(f"  Birth citizens (tenure = age): {birth_mask.sum():,}")

migrant_mask = ~birth_mask
fallback_log = []

for rel in ['Self', 'Presumed Spouse', 'Presumed Child']:
    for age in unique_ages:
        mask = migrant_mask & (seed['relationship'] == rel) & (seed['age_start'] == age)
        n = mask.sum()
        if n == 0:
            continue

        key = f"{rel}|{age}"
        if key not in tenure_dist:
            # Fallback to closest available age for this relationship type
            available_ages = sorted(
                int(k.split('|')[1]) for k in tenure_dist if k.startswith(f"{rel}|")
            )
            if available_ages:
                closest = min(available_ages, key=lambda a: abs(a - age))
                fallback_key = f"{rel}|{closest}"
                fallback_log.append(f"  {key} → {fallback_key} (n={n})")
                key = fallback_key
            else:
                seed.loc[mask, 'years_since_residence'] = 0
                fallback_log.append(f"  {key}: no tenure data, assigned 0 (n={n})")
                continue

        tenures = tenure_dist[key]
        bands = list(tenures.keys())
        probs = np.array([tenures[b] for b in bands])
        probs /= probs.sum()

        band_values = np.array([int(b) for b in bands])
        drawn_bands = rng.choice(band_values, size=n, p=probs)
        jitter = rng.integers(0, 5, size=n)
        seed.loc[mask, 'years_since_residence'] = drawn_bands + jitter

if fallback_log:
    print(f"  Tenure fallbacks ({len(fallback_log)}):")
    for msg in fallback_log:
        print(f"    {msg}")
else:
    print("  No tenure fallbacks needed.")

# Ensure integer type
seed['years_since_residence'] = seed['years_since_residence'].astype(int)

# ── Self-checks ────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("SELF-CHECKS")
print("=" * 60)

# Check 1: No missing values
check1 = seed[['relationship', 'nationality', 'years_since_residence']].isna().sum()
empty_rel = (seed['relationship'] == '').sum()
print(f"\n1. Missing values: {dict(check1)}, empty strings: {empty_rel}")
assert check1.sum() == 0, "FAIL: missing values found"
assert empty_rel == 0, "FAIL: empty relationship strings found"
print("   PASS")

# Check 2: Valid relationship values
valid_rels = {'Self', 'Presumed Spouse', 'Presumed Child'}
actual_rels = set(seed['relationship'].unique())
print(f"\n2. Relationship values: {sorted(actual_rels)}")
assert actual_rels == valid_rels, f"FAIL: unexpected {actual_rels - valid_rels}"
print("   PASS")

# Check 3: Valid nationality values
valid_nats = set(nationalities)
actual_nats = set(seed['nationality'].unique())
print(f"\n3. Nationality groups: {len(actual_nats)} (expected {len(valid_nats)})")
assert actual_nats == valid_nats, f"FAIL: mismatch {actual_nats.symmetric_difference(valid_nats)}"
print("   PASS")

# Check 4: Nationality proportions within 3pp of source
print(f"\n4. Nationality proportions (tolerance: 3pp):")
max_diff = 0
for nat in nationalities:
    synth_pct = (seed['nationality'] == nat).mean()
    source_pct = nat_marginal[nat]
    diff = abs(synth_pct - source_pct)
    max_diff = max(max_diff, diff)
    status = "OK" if diff < 0.03 else "WARN"
    print(f"   {status} {nat:35s}  diff={diff:.4f}")
assert max_diff < 0.03, f"FAIL: max diff {max_diff:.4f} >= 0.03"
print(f"   PASS (max diff: {max_diff:.4f})")

# Check 5: Age-relationship consistency (age <= 10 → Presumed Child)
young_mask = seed['age_start'] <= 10
violations = (seed.loc[young_mask, 'relationship'] != 'Presumed Child').sum()
print(f"\n5. Age ≤ 10 → Presumed Child: violations = {violations}")
assert violations == 0, "FAIL: age-relationship violation"
print("   PASS")

# Check 6: Tenure non-negative
neg_tenure = (seed['years_since_residence'] < 0).sum()
print(f"\n6. Negative tenure: {neg_tenure}")
assert neg_tenure == 0, "FAIL: negative tenure"
print("   PASS")

# Check 7: Tenure plausibility (migrants only — birth citizens can have tenure = age)
max_migrant_tenure = seed.loc[migrant_mask, 'years_since_residence'].max()
max_all_tenure = seed['years_since_residence'].max()
print(f"\n7. Max tenure — migrants: {max_migrant_tenure} (should be ≤ 25), all: {max_all_tenure}")
assert max_migrant_tenure <= 25, f"FAIL: max migrant tenure {max_migrant_tenure} > 25"
print("   PASS")

# ── Summary ────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"Total rows: {len(seed):,}")
print(f"Columns: {seed.columns.tolist()}")

print(f"\nNationality distribution:")
print(seed['nationality'].value_counts(normalize=True).round(3).to_string())

print(f"\nRelationship distribution:")
print(seed['relationship'].value_counts(normalize=True).round(3).to_string())

print(f"\nYears since residence:")
print(f"  Overall mean:      {seed['years_since_residence'].mean():.1f}")
print(f"  Migrants mean:     {seed.loc[migrant_mask, 'years_since_residence'].mean():.1f}")
print(f"  Birth citizens:    {seed.loc[birth_mask, 'years_since_residence'].mean():.1f} (= mean age)")
print(f"  Migrants median:   {seed.loc[migrant_mask, 'years_since_residence'].median():.0f}")
print(f"  Migrants P90:      {seed.loc[migrant_mask, 'years_since_residence'].quantile(0.9):.0f}")

# ── Save ───────────────────────────────────────────────────────────────
seed.to_parquet(SYNTH / 'seed_population.parquet', index=False)
print(f"\nSaved: synth_pop/seed_population.parquet ({len(seed):,} rows × {len(seed.columns)} cols)")
print("\nAll 7 self-checks PASSED.")
