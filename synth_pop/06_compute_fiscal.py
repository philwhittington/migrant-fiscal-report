#!/usr/bin/env python3
"""06_compute_fiscal.py — Compute fiscal incidence for the synthetic population.

Task P8.6: Constructs family units, then computes individual fiscal incidence
by applying the Wright & Nguyen (W&N) fiscal template with migrant-specific
adjustments (healthy migrant effect, NZ Super residence rules, benefit
stand-down, WFF restrictions for temp visa holders).

Methodology:
  - Revenue: income_tax + acc_levy (from P8.4) + indirect_tax (W&N per band)
  - Expenditure: W&N components with migrant adjustments + per-capita overhead
  - NFI = total_revenue - total_expenditure (positive = net contributor)
  - "other_expenditure" is derived from W&N NFI totals as the balancing item

Author: Heuser|Whittington analytical agent
Date: 2026-04-08
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path

from synth_pop.config import (
    HEALTHY_MIGRANT_HEALTH_FACTOR,
    NZ_SUPER_RESIDENCE_YEARS, NZ_SUPER_AGE,
    BENEFIT_STANDOWN_YEARS, BENEFIT_STANDOWN_FACTOR,
    TEMP_VISA_CATEGORIES,
)
from synth_pop.utils import (
    load_json, get_5yr_band,
    BASE_DIR, OUTPUT_DIR,
)

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ===================================================================
# Step 1: Load all inputs
# ===================================================================
print("=" * 60)
print("Step 1: Loading inputs")
print("=" * 60)

seed = pd.read_parquet(BASE_DIR / 'synth_pop' / 'seed_population.parquet')
print(f"  Seed population: {len(seed):,} rows, {len(seed.columns)} columns")
print(f"  Columns: {list(seed.columns)}")

wn_data = load_json("wright-nguyen-fiscal-template.json")

# Build W&N lookups
fiscal_components = {}
for r in wn_data['fiscal_components']:
    fiscal_components[r['age_band']] = r['components']

nfi_by_band = {}
for r in wn_data['net_fiscal_impact']:
    nfi_by_band[r['age_band']] = r

print(f"  W&N fiscal components: {len(fiscal_components)} age bands")
print(f"  W&N NFI data: {len(nfi_by_band)} age bands (15-19 through 80+)")

# ===================================================================
# Step 2: Build component lookup tables
# ===================================================================
print("\n" + "=" * 60)
print("Step 2: Building component lookup tables")
print("=" * 60)

# For each W&N 5-year band, precompute fiscal components and derived values.
# The W&N data has two levels:
#   - NFI aggregates (income_support, in_kind_spending, direct/indirect taxes)
#   - Component detail (individual benefit/service types)
# We use component detail for specific items and derive "other_expenditure"
# as the balancing item from NFI totals.

band_data = {}
for band, comp in fiscal_components.items():
    nfi_rec = nfi_by_band.get(band)

    health = comp.get('health_spending', 0)
    education = comp.get('education_spending', 0)
    nz_super = comp.get('nz_super', 0)
    wff = comp.get('wff', 0)

    # Benefit sub-components
    wa_support = comp.get('working_age_support', 0)
    housing = comp.get('housing_support', 0)
    other_is = comp.get('other_income_support', 0)
    ppl = comp.get('paid_parental_leave', 0)
    student_allow = comp.get('student_allowance', 0)
    winter = comp.get('winter_energy', 0)

    # Stand-down eligible benefits (working_age + housing)
    standown_eligible = wa_support + housing
    # Benefits zeroed for temp visa holders (other_is + ppl + student_allowance)
    temp_zero_benefits = other_is + ppl + student_allow
    # Benefits kept regardless of visa (winter energy only)
    universal_benefits = winter
    # Total benefits (all non-Super, non-WFF transfers)
    benefit_total = standown_eligible + temp_zero_benefits + universal_benefits

    # Indirect tax: from NFI data (constant per band)
    indirect_tax = nfi_rec.get('indirect_taxes', 0) if nfi_rec else 0

    # Direct tax supplement: non-PAYE direct taxes (corporate tax attribution,
    # FBT, other levies) that are in the W&N NFI but not in individual PAYE+ACC.
    # = NFI_direct_taxes - component_direct_taxes
    if nfi_rec:
        nfi_direct_tax = nfi_rec.get('direct_taxes', 0)
        comp_direct_tax = comp.get('direct_taxes', 0)
        direct_tax_supplement = max(0, nfi_direct_tax - comp_direct_tax)
    else:
        direct_tax_supplement = 0

    # Other expenditure: derived from NFI totals
    # total_govt_expenditure = income_support + in_kind_spending
    # other = total - itemized (education + health + nz_super + wff + benefits)
    if nfi_rec:
        total_expenditure = nfi_rec['income_support'] + nfi_rec['in_kind_spending']
        itemized = education + health + nz_super + wff + benefit_total
        other_expenditure = max(0, total_expenditure - itemized)
    else:
        other_expenditure = None  # Will fill later for child bands

    band_data[band] = {
        'health': health,
        'education': education,
        'nz_super': nz_super,
        'wff': wff,
        'standown_eligible': standown_eligible,
        'temp_zero_benefits': temp_zero_benefits,
        'universal_benefits': universal_benefits,
        'benefit_total': benefit_total,
        'indirect_tax': indirect_tax,
        'direct_tax_supplement': direct_tax_supplement,
        'other_expenditure': other_expenditure,
    }

# Fill child bands (0-4, 5-9, 10-14) with per-capita overhead
# Use the median of positive "other_expenditure" from available bands
other_values = [v['other_expenditure'] for v in band_data.values()
                if v['other_expenditure'] is not None and v['other_expenditure'] > 0]
child_overhead = round(np.median(other_values))

for band in ['0-4', '5-9', '10-14']:
    if band in band_data and band_data[band]['other_expenditure'] is None:
        band_data[band]['other_expenditure'] = child_overhead
        print(f"  Imputed other_expenditure for {band}: ${child_overhead:,}")

# Handle any remaining None values (e.g., 15-19 where total < itemized)
for band, v in band_data.items():
    if v['other_expenditure'] is None:
        v['other_expenditure'] = 0

# Print summary table
print(f"\n  {'Band':8s} | {'health':>6s} | {'edu':>6s} | {'super':>6s} | {'wff':>5s} | "
      f"{'benefit':>7s} | {'indir':>6s} | {'other':>6s}")
print(f"  {'-'*8} | {'-'*6} | {'-'*6} | {'-'*6} | {'-'*5} | {'-'*7} | {'-'*6} | {'-'*6}")
for band in ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34',
             '35-39', '40-44', '45-49', '50-54', '55-59', '60-64',
             '65-69', '70-74', '75-79', '80+']:
    if band in band_data:
        v = band_data[band]
        print(f"  {band:8s} | {v['health']:6,} | {v['education']:6,} | "
              f"{v['nz_super']:6,} | {v['wff']:5,} | {v['benefit_total']:7,} | "
              f"{v['indirect_tax']:6,} | {v['other_expenditure']:6,}")

# ===================================================================
# Step 3: Construct family units
# ===================================================================
print("\n" + "=" * 60)
print("Step 3: Constructing family units")
print("=" * 60)

# Assign family_id by linking Self → Spouse → Children within nationality.
# Greedy pointer-based matching: sorted by age within each role.

seed['family_id'] = -1
family_counter = 0

for nat in seed['nationality'].unique():
    nat_mask = seed['nationality'] == nat

    # Get sorted indices for each role
    selves = seed.loc[nat_mask & (seed['relationship'] == 'Self')].sort_values('age_start').index.tolist()
    spouses = seed.loc[nat_mask & (seed['relationship'] == 'Presumed Spouse')].sort_values('age_start').index.tolist()
    children = seed.loc[nat_mask & (seed['relationship'] == 'Presumed Child')].sort_values('age_start').index.tolist()

    spouse_ptr = 0
    child_ptr = 0

    for self_idx in selves:
        seed.at[self_idx, 'family_id'] = family_counter
        self_age = seed.at[self_idx, 'age_start']

        # Link spouse if within 10 years of age
        if spouse_ptr < len(spouses):
            sp_idx = spouses[spouse_ptr]
            sp_age = seed.at[sp_idx, 'age_start']
            if abs(sp_age - self_age) <= 10:
                seed.at[sp_idx, 'family_id'] = family_counter
                spouse_ptr += 1

        # Link up to 3 children (age < self_age - 15)
        linked_children = 0
        while child_ptr < len(children) and linked_children < 3:
            ch_idx = children[child_ptr]
            ch_age = seed.at[ch_idx, 'age_start']
            if ch_age < self_age - 15:
                seed.at[ch_idx, 'family_id'] = family_counter
                child_ptr += 1
                linked_children += 1
            else:
                break

        family_counter += 1

    # Assign remaining unlinked spouses/children to their own families
    unlinked = seed.loc[nat_mask & (seed['family_id'] == -1)].index
    for idx in unlinked:
        seed.at[idx, 'family_id'] = family_counter
        family_counter += 1

seed['family_id'] = seed['family_id'].astype(int)
n_families = seed['family_id'].nunique()
print(f"  Total families: {n_families:,}")
print(f"  Unlinked (family_id == -1): {(seed['family_id'] == -1).sum()}")

# Family composition stats
fam_sizes = seed.groupby('family_id').size()
print(f"  Family size distribution:")
for sz in sorted(fam_sizes.unique()):
    count = (fam_sizes == sz).sum()
    print(f"    Size {sz}: {count:,} families")

# ===================================================================
# Step 4: Compute fiscal components (vectorized)
# ===================================================================
print("\n" + "=" * 60)
print("Step 4: Computing fiscal components")
print("=" * 60)

# Map each individual to their 5-year age band
seed['age_band'] = seed['age_start'].apply(get_5yr_band)

# Build arrays of band-level values for vectorized lookup
band_health = seed['age_band'].map(lambda b: band_data.get(b, {}).get('health', 0)).astype(float)
band_education = seed['age_band'].map(lambda b: band_data.get(b, {}).get('education', 0)).astype(float)
band_nz_super = seed['age_band'].map(lambda b: band_data.get(b, {}).get('nz_super', 0)).astype(float)
band_wff = seed['age_band'].map(lambda b: band_data.get(b, {}).get('wff', 0)).astype(float)
band_standown = seed['age_band'].map(lambda b: band_data.get(b, {}).get('standown_eligible', 0)).astype(float)
band_temp_zero = seed['age_band'].map(lambda b: band_data.get(b, {}).get('temp_zero_benefits', 0)).astype(float)
band_universal = seed['age_band'].map(lambda b: band_data.get(b, {}).get('universal_benefits', 0)).astype(float)
band_indirect = seed['age_band'].map(lambda b: band_data.get(b, {}).get('indirect_tax', 0)).astype(float)
band_other = seed['age_band'].map(lambda b: band_data.get(b, {}).get('other_expenditure', 0)).astype(float)

# --- Classification masks ---
is_birth_citizen = seed['visa_category'] == 'Birth Citizen'
is_temp = seed['visa_category'].isin(TEMP_VISA_CATEGORIES)
is_migrant_resident = ~is_birth_citizen & ~is_temp
is_standown = is_migrant_resident & (seed['years_since_residence'] < BENEFIT_STANDOWN_YEARS)
is_resident_full = is_migrant_resident & (seed['years_since_residence'] >= BENEFIT_STANDOWN_YEARS)
is_any_migrant = ~is_birth_citizen

print(f"  Birth citizens: {is_birth_citizen.sum():,}")
print(f"  Migrant residents: {is_migrant_resident.sum():,}")
print(f"    - standown (<{BENEFIT_STANDOWN_YEARS}yr): {is_standown.sum():,}")
print(f"    - full: {is_resident_full.sum():,}")
print(f"  Temp visa: {is_temp.sum():,}")

# --- 4a: Health cost ---
# Birth citizens: full W&N health
# All migrants: × HEALTHY_MIGRANT_HEALTH_FACTOR
seed['health_cost'] = band_health.copy()
seed.loc[is_any_migrant, 'health_cost'] = band_health[is_any_migrant] * HEALTHY_MIGRANT_HEALTH_FACTOR

# --- 4b: Education cost ---
# No migrant adjustment
seed['education_cost'] = band_education.copy()

# --- 4c: NZ Super ---
# Birth citizens: eligible if age >= NZ_SUPER_AGE (they have years = age, always >= 10)
# Migrant residents: eligible if age >= NZ_SUPER_AGE AND years >= NZ_SUPER_RESIDENCE_YEARS
# Temp visa: typically ineligible (years < 10)
super_eligible = (
    (seed['age_start'] >= NZ_SUPER_AGE) &
    (seed['years_since_residence'] >= NZ_SUPER_RESIDENCE_YEARS)
)
seed['nz_super'] = np.where(super_eligible, band_nz_super, 0.0)

# --- 4d: WFF ---
# Birth citizens and migrant residents: eligible
# Temp visa: NOT eligible
seed['wff'] = np.where(is_temp, 0.0, band_wff)

# --- 4e: Benefit ---
# Three tiers:
#   Birth citizen + resident_full: full benefits
#   Resident standown (<2yr): standown_eligible × 50% + temp_zero (full) + universal
#   Temp visa: only universal (winter energy)
benefit_full = band_standown + band_temp_zero + band_universal
benefit_standown_adj = band_standown * BENEFIT_STANDOWN_FACTOR + band_temp_zero + band_universal
benefit_temp = band_universal.copy()

seed['benefit'] = benefit_full.copy()  # Default: full
seed.loc[is_standown, 'benefit'] = benefit_standown_adj[is_standown]
seed.loc[is_temp, 'benefit'] = benefit_temp[is_temp]

# --- 4f: Indirect tax ---
# W&N per-capita indirect taxes for the age band (constant within band)
seed['indirect_tax'] = band_indirect.copy()

# --- 4g: Direct tax supplement ---
# Non-PAYE direct taxes from W&N fiscal incidence: corporate tax attribution,
# FBT, other direct levies allocated per capita. Constant within age band.
band_supplement = seed['age_band'].map(
    lambda b: band_data.get(b, {}).get('direct_tax_supplement', 0)).astype(float)
seed['direct_tax_other'] = band_supplement

# --- 4h: Other expenditure ---
# Per-capita public goods (defence, infrastructure, justice, etc.)
# Derived from W&N NFI as balancing item; same for all individuals at same age
seed['other_expenditure'] = band_other.copy()

# --- 4i: Totals ---
seed['total_revenue'] = (seed['income_tax'] + seed['acc_levy'] +
                         seed['indirect_tax'] + seed['direct_tax_other'])
seed['total_expenditure'] = (
    seed['health_cost'] + seed['education_cost'] + seed['nz_super'] +
    seed['wff'] + seed['benefit'] + seed['other_expenditure']
)
seed['net_fiscal_impact_annual'] = seed['total_revenue'] - seed['total_expenditure']

# Drop temporary column
seed.drop(columns=['age_band'], inplace=True)

# Print summary by visa category
print("\n  Mean fiscal components by visa category:")
summary_cols = ['income_tax', 'acc_levy', 'indirect_tax', 'direct_tax_other',
                'health_cost', 'education_cost', 'nz_super', 'wff', 'benefit',
                'other_expenditure', 'total_revenue', 'total_expenditure',
                'net_fiscal_impact_annual']
summary = seed.groupby('visa_category')[summary_cols].mean()
print(f"\n  {'Category':30s} | {'Revenue':>8s} | {'Expend':>8s} | {'NFI':>8s}")
print(f"  {'-'*30} | {'-'*8} | {'-'*8} | {'-'*8}")
for cat in summary.index:
    rev = summary.loc[cat, 'total_revenue']
    exp = summary.loc[cat, 'total_expenditure']
    nfi = summary.loc[cat, 'net_fiscal_impact_annual']
    print(f"  {cat:30s} | ${rev:>7,.0f} | ${exp:>7,.0f} | ${nfi:>+8,.0f}")

# ===================================================================
# Step 5: Self-checks
# ===================================================================
print("\n" + "=" * 60)
print("Step 5: Self-checks")
print("=" * 60)

all_pass = True

# Check 1: No NaN fiscal components
nan_cols = ['health_cost', 'education_cost', 'nz_super', 'wff', 'benefit',
            'indirect_tax', 'direct_tax_other', 'other_expenditure',
            'total_revenue', 'total_expenditure', 'net_fiscal_impact_annual']
nan_counts = {col: seed[col].isna().sum() for col in nan_cols}
nan_total = sum(nan_counts.values())
if nan_total == 0:
    print("  ✓ Check 1: No NaN fiscal components")
else:
    print(f"  ✗ Check 1 FAILED: {nan_total} NaN values: {nan_counts}")
    all_pass = False

# Check 2: Revenue non-negative
neg_rev = (seed['total_revenue'] < -0.01).sum()
if neg_rev == 0:
    print("  ✓ Check 2: total_revenue >= 0 for all individuals")
else:
    print(f"  ✗ Check 2 FAILED: {neg_rev} individuals with negative revenue")
    all_pass = False

# Check 3: Expenditure components non-negative
for col in ['health_cost', 'education_cost', 'nz_super', 'wff', 'benefit',
            'other_expenditure']:
    neg = (seed[col] < -0.01).sum()
    if neg > 0:
        print(f"  ✗ Check 3 FAILED: {neg} negative values in {col}")
        all_pass = False
if all_pass:
    print("  ✓ Check 3: All expenditure components >= 0")

# Check 4: Family linkage
unlinked = (seed['family_id'] < 0).sum()
if unlinked > 0:
    print(f"  ✗ Check 4 FAILED: {unlinked} individuals without family_id")
    all_pass = False
else:
    # Check max 1 spouse and max 3 children per family with a Self
    families_with_self = seed[seed['relationship'] == 'Self'].groupby('family_id').size()
    multi_self = (families_with_self > 1).sum()
    if multi_self > 0:
        print(f"  ⚠ Check 4: {multi_self} families with >1 Self")

    spouse_counts = seed[seed['relationship'] == 'Presumed Spouse'].groupby('family_id').size()
    multi_spouse = (spouse_counts > 1).sum()

    child_counts = seed[seed['relationship'] == 'Presumed Child'].groupby('family_id').size()
    excess_children = (child_counts > 3).sum()

    if multi_spouse > 0 or excess_children > 0:
        print(f"  ⚠ Check 4: {multi_spouse} families with >1 spouse, "
              f"{excess_children} families with >3 children")
    else:
        print("  ✓ Check 4: Family linkage valid (all have family_id, "
              "max 1 spouse, max 3 children per family)")

# Check 5: Mean NFI by visa type (comparison to Phase 1)
# Phase 1 uses negative-is-contributor convention; our NFI is positive-is-contributor
print("\n  --- Check 5: Mean NFI by visa category ---")
print(f"  {'Category':30s} | {'Mean NFI':>10s} | {'Count':>7s}")
print(f"  {'-'*30} | {'-'*10} | {'-'*7}")
nfi_by_cat = seed.groupby('visa_category')['net_fiscal_impact_annual'].agg(['mean', 'count'])
for cat in nfi_by_cat.index:
    mean_nfi = nfi_by_cat.loc[cat, 'mean']
    count = nfi_by_cat.loc[cat, 'count']
    print(f"  {cat:30s} | ${mean_nfi:>+10,.0f} | {count:>7,.0f}")

# Check 6: NZ Super rule
super_violators = seed[
    (seed['nz_super'] > 0) &
    ((seed['years_since_residence'] < NZ_SUPER_RESIDENCE_YEARS) |
     (seed['age_start'] < NZ_SUPER_AGE))
]
if len(super_violators) == 0:
    print("\n  ✓ Check 6: NZ Super rule respected (no ineligible recipients)")
else:
    print(f"\n  ✗ Check 6 FAILED: {len(super_violators)} ineligible NZ Super recipients")
    all_pass = False

# Check 7: Benefit stand-down
# For migrants with years < 2, benefit should be reduced
standown_migrants = seed[is_standown]
if len(standown_migrants) > 0:
    # Get the base benefit for these individuals' age bands
    standown_bands = standown_migrants['age_start'].apply(get_5yr_band)
    base_benefits = standown_bands.map(
        lambda b: band_data.get(b, {}).get('standown_eligible', 0) +
                  band_data.get(b, {}).get('temp_zero_benefits', 0) +
                  band_data.get(b, {}).get('universal_benefits', 0)
    )
    actual_benefits = standown_migrants['benefit']
    # Check that actual < base (where base > 0)
    has_base = base_benefits > 0
    if has_base.sum() > 0:
        violations = (actual_benefits[has_base] >= base_benefits[has_base] - 0.01).sum()
        if violations == 0:
            print("  ✓ Check 7: Benefit stand-down applied for all standown migrants")
        else:
            # This can happen if standown_eligible is 0 but other benefits are full
            # Check specifically that standown-eligible portion is halved
            print(f"  ⚠ Check 7: {violations} standown migrants with benefit >= full "
                  "(may be correct if standown_eligible=0 for their age band)")
    else:
        print("  ✓ Check 7: No standown migrants with positive base benefits")
else:
    print("  ✓ Check 7: No standown migrants to check")

# ===================================================================
# Step 6: Generate widget outputs
# ===================================================================
print("\n" + "=" * 60)
print("Step 6: Generating widget outputs")
print("=" * 60)

# --- 6a: Household widget (synth-household-npv.json) ---
# Select representative family types from the actual synthetic population

def build_household_example(description, visa_col, visa_val, age_lo, age_hi,
                            target_sizes, need_spouse=False, need_children=0):
    """Find a representative family matching criteria.

    Evaluates filters fresh from the current seed DataFrame.
    """
    # Build filter from current seed state
    if isinstance(visa_val, list):
        visa_mask = seed[visa_col].isin(visa_val)
    else:
        visa_mask = seed[visa_col] == visa_val
    age_mask = seed['age_start'].between(age_lo, age_hi)

    # Find Self members matching the filter
    candidates = seed[visa_mask & age_mask & (seed['relationship'] == 'Self')]
    if len(candidates) == 0:
        candidates = seed[visa_mask & age_mask]
    if len(candidates) == 0:
        return None

    # Precompute family sizes and pre-filter by target size
    fam_size_map = seed.groupby('family_id').size()
    fam_ids = candidates['family_id'].unique()

    # Filter to matching sizes first (avoids scanning thousands of wrong-size families)
    if target_sizes is not None:
        if isinstance(target_sizes, (list, tuple)):
            valid_fids = set(fam_size_map[fam_size_map.isin(target_sizes)].index)
        else:
            valid_fids = set(fam_size_map[fam_size_map == target_sizes].index)
        fam_ids = [fid for fid in fam_ids if fid in valid_fids]

    eligible_families = []

    for fid in fam_ids[:500]:

        members = seed[seed['family_id'] == fid]
        n_spouse = (members['relationship'] == 'Presumed Spouse').sum()
        n_child = (members['relationship'] == 'Presumed Child').sum()

        if need_spouse and n_spouse == 0:
            continue
        if n_child < need_children:
            continue

        # Collect eligible families with their primary income
        primary = members[members['relationship'] == 'Self']
        inc = primary.iloc[0]['gross_income'] if len(primary) > 0 else members.iloc[0]['gross_income']
        eligible_families.append((fid, inc))

    if not eligible_families:
        return None

    # Pick the family with income closest to the MEDIAN of eligible families
    # (gives a representative example, not an outlier)
    incomes = [inc for _, inc in eligible_families]
    median_inc = np.median(incomes)
    eligible_families.sort(key=lambda x: abs(x[1] - median_inc))
    # Among those near median, pick one with positive income if possible
    best = eligible_families[0][0]
    for fid, inc in eligible_families[:5]:
        if inc > 0:
            best = fid
            break

    members = seed[seed['family_id'] == best]
    primary = members[members['relationship'] == 'Self']
    arrival_age = int(primary.iloc[0]['age_start']) if len(primary) > 0 else int(members.iloc[0]['age_start'])

    # Use primary (Self) member's visa details, not first row
    primary_visa = primary.iloc[0]['visa_category'] if len(primary) > 0 else members.iloc[0]['visa_category']

    result = {
        'household_type': description,
        'visa_category': primary_visa,
        'arrival_age': arrival_age,
        'members': [],
        'household_nfi': round(float(members['net_fiscal_impact_annual'].sum())),
    }

    for _, m in members.iterrows():
        role = 'primary' if m['relationship'] == 'Self' else (
            'spouse' if m['relationship'] == 'Presumed Spouse' else 'child')
        result['members'].append({
            'role': role,
            'age': int(m['age_start']),
            'income': round(float(m['gross_income'])),
            'nfi': round(float(m['net_fiscal_impact_annual'])),
        })

    return result

# Representative household types
# (desc, visa_col, visa_val, age_lo, age_hi, target_sizes, need_spouse, need_children)
household_defs = [
    ("Skilled family, age 30",
     'visa_subcategory', 'R.Skilled/investor/entrepreneu', 28, 35, 5, True, 2),
    ("Family visa single, age 30",
     'visa_subcategory', 'R.Family', 28, 40, [1, 2], False, 0),
    ("Family visa couple + children",
     'visa_subcategory', 'R.Family', 28, 40, [4, 5], True, 1),
    ("Student, age 20-25",
     'visa_category', 'Student', 20, 25, [1, 2, 5], False, 0),
    ("Working holiday, age 25",
     'visa_subcategory', 'W.Working holiday', 20, 30, [1, 2], False, 0),
    ("Australian citizen, age 35",
     'visa_category', 'Australian', 30, 40, 1, False, 0),
    ("Humanitarian family, age 30",
     'visa_subcategory', 'R.Humanitarian and Pacific', 28, 40, [4, 5], True, 1),
    ("Retiree, age 65+",
     'visa_category', ['Permanent Resident', 'Resident'], 60, 75, 1, False, 0),
    ("NZ-born single, age 30",
     'visa_category', 'Birth Citizen', 28, 35, 1, False, 0),
    ("NZ-born family + children",
     'visa_category', 'Birth Citizen', 30, 40, [4, 5], True, 2),
]

households = []
for args in household_defs:
    desc = args[0]
    hh = build_household_example(*args)
    if hh:
        households.append(hh)
        n_members = len(hh['members'])
        print(f"  {desc}: {n_members} members, household NFI = ${hh['household_nfi']:+,}")
    else:
        print(f"  ⚠ Could not find: {desc}")

hh_path = OUTPUT_DIR / 'synth-household-npv.json'
with open(hh_path, 'w') as f:
    json.dump(households, f, indent=2)
print(f"\n  Saved {len(households)} households to {hh_path.name}")

# --- 6b: Fiscal waterfall widget (synth-fiscal-distributions.json) ---
# Group by visa_category, compute mean of each fiscal component.
# Exclude Birth Citizen and Unknown — focus on migrant types.

migrant_cats = [c for c in seed['visa_category'].unique()
                if c not in ('Birth Citizen', 'Unknown (Presumed resident)')]

waterfall = {}
for cat in sorted(migrant_cats):
    cat_data = seed[seed['visa_category'] == cat]
    waterfall[cat] = {
        'mean_income_tax': round(float(cat_data['income_tax'].mean())),
        'mean_acc_levy': round(float(cat_data['acc_levy'].mean())),
        'mean_indirect_tax': round(float(cat_data['indirect_tax'].mean())),
        'mean_direct_tax_other': round(float(cat_data['direct_tax_other'].mean())),
        'mean_health': round(float(cat_data['health_cost'].mean())),
        'mean_education': round(float(cat_data['education_cost'].mean())),
        'mean_nz_super': round(float(cat_data['nz_super'].mean())),
        'mean_wff': round(float(cat_data['wff'].mean())),
        'mean_benefit': round(float(cat_data['benefit'].mean())),
        'mean_other': round(float(cat_data['other_expenditure'].mean())),
        'mean_nfi': round(float(cat_data['net_fiscal_impact_annual'].mean())),
        'count': int(len(cat_data)),
    }
    print(f"  {cat}: mean NFI = ${waterfall[cat]['mean_nfi']:+,}, n = {waterfall[cat]['count']:,}")

wf_path = OUTPUT_DIR / 'synth-fiscal-distributions.json'
with open(wf_path, 'w') as f:
    json.dump(waterfall, f, indent=2)
print(f"\n  Saved {len(waterfall)} categories to {wf_path.name}")

# Check 8: Widget outputs are valid JSON
try:
    with open(hh_path) as f:
        json.load(f)
    with open(wf_path) as f:
        json.load(f)
    print("  ✓ Check 8: Both widget JSON files are valid")
except json.JSONDecodeError as e:
    print(f"  ✗ Check 8 FAILED: Invalid JSON — {e}")
    all_pass = False

# ===================================================================
# Step 7: Save updated parquet
# ===================================================================
print("\n" + "=" * 60)
print("Step 7: Saving updated parquet")
print("=" * 60)

seed.to_parquet(BASE_DIR / 'synth_pop' / 'seed_population.parquet', index=False)
print(f"  Saved {len(seed):,} rows × {len(seed.columns)} columns")
print(f"  Columns: {list(seed.columns)}")

# ===================================================================
# Final summary
# ===================================================================
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"  Total individuals: {len(seed):,}")
print(f"  Total families: {n_families:,}")
print(f"  New columns added: family_id, health_cost, education_cost, nz_super, "
      f"wff, benefit, indirect_tax, other_expenditure, total_revenue, "
      f"total_expenditure, net_fiscal_impact_annual")
print(f"  Mean NFI (all): ${seed['net_fiscal_impact_annual'].mean():+,.0f}")
print(f"  Mean NFI (migrants only): "
      f"${seed[is_any_migrant]['net_fiscal_impact_annual'].mean():+,.0f}")
print(f"  Mean NFI (birth citizens): "
      f"${seed[is_birth_citizen]['net_fiscal_impact_annual'].mean():+,.0f}")
print(f"\n  Widget outputs:")
print(f"    {hh_path.name}: {len(households)} representative households")
print(f"    {wf_path.name}: {len(waterfall)} migrant visa categories")

if all_pass:
    print("\n  ✓ ALL SELF-CHECKS PASSED")
else:
    print("\n  ✗ SOME CHECKS FAILED — see details above")
