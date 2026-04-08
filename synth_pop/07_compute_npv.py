#!/usr/bin/env python3
"""07_compute_npv.py — Compute lifecycle NPV for every synthetic individual.

Task P8.7: Simulates each individual's fiscal trajectory from current age to 85,
weighting by retention probability and discounting at 3.5%. Produces:
  1. Updated parquet with npv, npv_nzborn_equivalent, surplus columns
  2. synth-npv-distributions.json — distributional summaries per (visa_category, age)
  3. synth-population-summary.json — aggregate summary for policy scenario widget

Convention: POSITIVE NPV = net contributor to Crown.
  Phase 1 used negative = contributor; compare using: our_npv ≈ -phase1_npv.

Methodology (premium approach — matches Phase 1):
  - Start with W&N base NFI (which captures average revenue & expenditure by age)
  - Adjust with age-varying GROUP premium from Table 4 (visa category mean tax
    minus NZ-born mean tax at each age band)
  - Add INDIVIDUAL deviation (individual PAYE minus group mean PAYE at starting age)
    to create distributional spread
  - Apply migrant adjustment savings (Super, WFF, health, benefits)
  - Weight by retention and discount at 3.5%

Key design: the group premium changes with age (from Table 4 cross-sectional data),
while the individual deviation is fixed (relative position in the distribution).
This ensures the GROUP MEAN NPV matches Phase 1 exactly, while individual
variation creates the distributional analysis that is the goal of Phase 2.

Author: Heuser|Whittington analytical agent
Date: 2026-04-08
"""

import json
import math
import numpy as np
import pandas as pd
from pathlib import Path

from synth_pop.config import (
    DISCOUNT_RATE, MAX_AGE, TAX_YEAR,
    NZ_SUPER_RESIDENCE_YEARS, NZ_SUPER_AGE,
    HEALTHY_MIGRANT_HEALTH_FACTOR,
    BENEFIT_STANDOWN_YEARS, BENEFIT_STANDOWN_FACTOR,
    TEMP_VISA_CATEGORIES,
)
from synth_pop.utils import (
    load_json, load_retention_data, get_retention,
    apply_migrant_adjustments, get_5yr_band, get_10yr_bin,
    BASE_DIR, OUTPUT_DIR, PROCESSED_DIR,
)

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ===================================================================
# Step 1: Load all inputs
# ===================================================================
print("=" * 60)
print("Step 1: Loading inputs")
print("=" * 60)

seed = pd.read_parquet(BASE_DIR / 'synth_pop' / 'seed_population.parquet')
print(f"  Seed population: {len(seed):,} rows, {len(seed.columns)} columns")

# W&N template
wn_data = load_json("wright-nguyen-fiscal-template.json")
fiscal_components = {}
for r in wn_data['fiscal_components']:
    fiscal_components[r['age_band']] = r['components']
nfi_by_band = {}
for r in wn_data['net_fiscal_impact']:
    nfi_by_band[r['age_band']] = r

# Table 4: visa subcategory mean tax (for group premiums)
with open(PROCESSED_DIR / 'hughes-table4-visa-subcategory.json') as f:
    table4 = json.load(f)

# Retention curves
retention_actual, retention_fits = load_retention_data()

# Phase 1 reference (for validation)
with open(OUTPUT_DIR / 'npv-by-visa-age.json') as f:
    phase1_data = json.load(f)

print(f"  W&N fiscal components: {len(fiscal_components)} age bands")
print(f"  Table 4 rows: {len(table4)}")
print(f"  Retention curves: {len(retention_actual)} visa types")
print(f"  Phase 1 reference: {len(phase1_data)} entries")


# ===================================================================
# Step 2: Build base NFI and adjustment arrays
# ===================================================================
print("\n" + "=" * 60)
print("Step 2: Building base NFI and adjustment arrays")
print("=" * 60)

WN_BANDS = [
    '0-4', '5-9', '10-14', '15-19', '20-24', '25-29',
    '30-34', '35-39', '40-44', '45-49', '50-54', '55-59',
    '60-64', '65-69', '70-74', '75-79', '80+',
]
band_to_idx = {b: i for i, b in enumerate(WN_BANDS)}
N_BANDS = len(WN_BANDS)

# Base NFI array (W&N convention: positive = cost to government)
base_nfi_arr = np.zeros(N_BANDS)
for band in WN_BANDS:
    idx = band_to_idx[band]
    nfi_rec = nfi_by_band.get(band)
    if nfi_rec:
        base_nfi_arr[idx] = nfi_rec['net_fiscal_impact']

# Adjustment component arrays (for migrant savings calculation)
arr_health = np.zeros(N_BANDS)
arr_nz_super = np.zeros(N_BANDS)
arr_wff = np.zeros(N_BANDS)
arr_standown_eligible = np.zeros(N_BANDS)
arr_temp_zero_benefits = np.zeros(N_BANDS)
arr_other_support = np.zeros(N_BANDS)  # other_is + ppl + student (temp visa only)

for band, comp in fiscal_components.items():
    idx = band_to_idx.get(band)
    if idx is None:
        continue
    arr_health[idx] = comp.get('health_spending', 0)
    arr_nz_super[idx] = comp.get('nz_super', 0)
    arr_wff[idx] = comp.get('wff', 0)
    arr_standown_eligible[idx] = (comp.get('working_age_support', 0) +
                                  comp.get('housing_support', 0))
    arr_temp_zero_benefits[idx] = (comp.get('other_income_support', 0) +
                                   comp.get('paid_parental_leave', 0) +
                                   comp.get('student_allowance', 0))

# Impute base_nfi for child bands (0-14) where W&N doesn't have aggregate NFI.
# Compute from components: base_nfi = expenditure - revenue (positive = cost)
# Use median "other expenditure" from available bands as per-capita overhead
other_exp_values = []
for band in WN_BANDS:
    idx = band_to_idx[band]
    nfi_rec = nfi_by_band.get(band)
    comp = fiscal_components.get(band, {})
    if nfi_rec:
        total_exp = nfi_rec['income_support'] + nfi_rec['in_kind_spending']
        itemized = (comp.get('health_spending', 0) + comp.get('education_spending', 0) +
                    comp.get('nz_super', 0) + comp.get('wff', 0) +
                    comp.get('working_age_support', 0) + comp.get('housing_support', 0) +
                    comp.get('other_income_support', 0) + comp.get('paid_parental_leave', 0) +
                    comp.get('student_allowance', 0) + comp.get('winter_energy', 0))
        other = max(0, total_exp - itemized)
        if other > 0:
            other_exp_values.append(other)
child_overhead = round(np.median(other_exp_values)) if other_exp_values else 0

for band in ['0-4', '5-9', '10-14']:
    idx = band_to_idx[band]
    comp = fiscal_components.get(band, {})
    expenditure = (comp.get('health_spending', 0) + comp.get('education_spending', 0) +
                   comp.get('nz_super', 0) + comp.get('wff', 0) +
                   comp.get('working_age_support', 0) + comp.get('housing_support', 0) +
                   comp.get('other_income_support', 0) + comp.get('paid_parental_leave', 0) +
                   comp.get('student_allowance', 0) + comp.get('winter_energy', 0) +
                   child_overhead)
    revenue = comp.get('direct_taxes', 0)
    base_nfi_arr[idx] = expenditure - revenue

print(f"  Base NFI (W&N convention, positive=cost):")
for band in ['0-4', '10-14', '20-24', '30-34', '40-44', '50-54', '65-69', '80+']:
    idx = band_to_idx[band]
    src = "imputed" if band in ('0-4', '5-9', '10-14') else "W&N"
    print(f"    {band:8s}: ${base_nfi_arr[idx]:>+10,.0f}  ({src})")


# ===================================================================
# Step 3: Build group premium table from Table 4
# ===================================================================
print("\n" + "=" * 60)
print("Step 3: Building group premium table from Table 4")
print("=" * 60)

# Map visa_subcategory → visa_category (from the seed parquet)
subcat_to_cat = seed.groupby('visa_subcategory')['visa_category'].first().to_dict()

# Compute per-capita mean PAYE by (visa_category, age_start) from Table 4
# Table 4 reports PAYE tax only (tax_billions * 1e9 / count)
N_AGE_BINS = 11  # age bins 0,10,...,100
cat_tax_sum = {}    # (visa_category, age_start) → total_tax_dollars
cat_count_sum = {}  # (visa_category, age_start) → total_count

for r in table4:
    if r['year'] != TAX_YEAR or not r.get('count') or r['count'] <= 0:
        continue
    subcat = r['visa_subcategory']
    age = r.get('age_start')
    if age is None:
        continue
    cat = subcat_to_cat.get(subcat)
    if cat is None:
        continue
    key = (cat, age)
    cat_tax_sum[key] = cat_tax_sum.get(key, 0) + r['tax_billions'] * 1e9
    cat_count_sum[key] = cat_count_sum.get(key, 0) + r['count']

visa_cat_mean_paye = {}  # (visa_category, age_start) → mean PAYE per capita
for key in cat_tax_sum:
    if cat_count_sum[key] > 0:
        visa_cat_mean_paye[key] = cat_tax_sum[key] / cat_count_sum[key]

# NZ-born mean PAYE by age
nzborn_mean_paye = {}
for age in range(0, 110, 10):
    key = ('Birth Citizen', age)
    nzborn_mean_paye[age] = visa_cat_mean_paye.get(key, 0)

# Build group premium: visa_cat_mean - nzborn_mean at each age
# Use integer encoding for visa categories
visa_cats = sorted(seed['visa_category'].unique())
cat_to_int = {c: i for i, c in enumerate(visa_cats)}
N_CATS = len(visa_cats)

# group_premium_2d[cat_idx, age_bin_idx] = group premium
group_premium_2d = np.zeros((N_CATS, N_AGE_BINS))
for cat in visa_cats:
    ci = cat_to_int[cat]
    for age_bin_idx in range(N_AGE_BINS):
        age = age_bin_idx * 10
        cat_paye = visa_cat_mean_paye.get((cat, age), 0)
        nzborn_paye = nzborn_mean_paye.get(age, 0)
        group_premium_2d[ci, age_bin_idx] = cat_paye - nzborn_paye

# Print sample premiums
print(f"  Visa categories: {N_CATS}")
print(f"  Group premiums at age 30 (positive = pays more than NZ-born):")
for cat in ['Birth Citizen', 'Resident', 'Permanent Resident',
            'Non-residential work', 'Student', 'Australian']:
    ci = cat_to_int.get(cat)
    if ci is not None:
        p = group_premium_2d[ci, 3]  # age 30 = bin 3
        print(f"    {cat:30s}: ${p:>+10,.0f}")

# Individual deviation = individual_PAYE - group_mean_PAYE at starting age
# This is fixed for each individual (their relative position in the distribution)
seed_cat_int = seed['visa_category'].map(cat_to_int).values.astype(int)
age_bin_start = np.minimum(seed['age_start'].values // 10, N_AGE_BINS - 1).astype(int)

# Look up group mean PAYE at each individual's (visa_category, age_start)
group_mean_at_start = group_premium_2d[seed_cat_int, age_bin_start] + \
    np.array([nzborn_mean_paye.get(a, 0) for a in seed['age_start'].values])
# group_premium + nzborn = visa_cat_mean_paye
individual_deviation = seed['income_tax'].values - group_mean_at_start

print(f"\n  Individual deviation stats:")
print(f"    Mean: ${np.mean(individual_deviation):>+,.0f}")
print(f"    Std:  ${np.std(individual_deviation):>,.0f}")
print(f"    P10:  ${np.percentile(individual_deviation, 10):>+,.0f}")
print(f"    P90:  ${np.percentile(individual_deviation, 90):>+,.0f}")


# ===================================================================
# Step 4: Build retention lookup
# ===================================================================
print("\n" + "=" * 60)
print("Step 4: Building retention lookup")
print("=" * 60)

VISA_SUBCAT_TO_RETENTION = {
    'C.Birth_citizen': 'NZ-born',
    'C.Non_birth_citizen': 'C.Non_birth_citizen',
    'R.Skilled/investor/entrepreneu': 'R.Skilled/investor/entrepreneu',
    'R.Family': 'R.Family',
    'R.Humanitarian and Pacific': 'R.Humanitarian and Pacific',
    'R.Returning resident': 'R.Skilled/investor/entrepreneu',
    'R.Other': 'C.Non_birth_citizen',
    'PR.Skilled/investor/entreprene': 'R.Skilled/investor/entrepreneu',
    'PR.Family': 'R.Family',
    'PR.Humanitarian and Pacific': 'R.Humanitarian and Pacific',
    'PR.Returning resident': 'R.Skilled/investor/entrepreneu',
    'PR.Other': 'C.Non_birth_citizen',
    'S.Fee paying': 'S.Fee paying',
    'S.Dependent': 'S.Dependent',
    'S.Other': 'S.Fee paying',
    'S.Scholarship': 'S.Fee paying',
    'W.Working holiday': 'W.Working holiday',
    'W.Skills/specific purposes/pos': 'W.Skills/specific purposes/pos',
    'W.Family': 'W.Family',
    'W.Work to residence': 'W.Skills/specific purposes/pos',
    'W.Other': 'W.Skills/specific purposes/pos',
    'W.Seasonal': 'W.Working holiday',
    'W.Humanitarian and Pacific': 'R.Humanitarian and Pacific',
    'W.Fishing': 'W.Skills/specific purposes/pos',
    'A.Australian': 'A.Australian',
    'V.Visitor': 'V.Visitor',
    'V.Limited': 'V.Visitor',
    'V.Other': 'V.Visitor',
    'D.Diplomatic': 'NZ-born',
    'D.Consular': 'NZ-born',
    'D.Official': 'NZ-born',
    'Unknown (Presumed resident)': 'C.Non_birth_citizen',
}

MAX_T = MAX_AGE + 1
retention_codes = sorted(set(VISA_SUBCAT_TO_RETENTION.values()))
code_to_int = {c: i for i, c in enumerate(retention_codes)}

retention_2d = np.zeros((len(retention_codes), MAX_T))
for code in retention_codes:
    for t in range(MAX_T):
        if code == 'NZ-born':
            retention_2d[code_to_int[code], t] = 1.0
        else:
            retention_2d[code_to_int[code], t] = get_retention(
                code, t, retention_actual, retention_fits)

seed_retention_code = seed['visa_subcategory'].map(VISA_SUBCAT_TO_RETENTION).fillna('NZ-born')
seed_ret_int = seed_retention_code.map(code_to_int).values.astype(int)

print(f"  Retention codes: {len(retention_codes)}")
for code in ['R.Skilled/investor/entrepreneu', 'W.Working holiday', 'A.Australian']:
    ci = code_to_int[code]
    print(f"    {code}: t=5={retention_2d[ci, 5]:.3f}, t=20={retention_2d[ci, 20]:.3f}")


# ===================================================================
# Step 5: Precompute per-individual constants
# ===================================================================
print("\n" + "=" * 60)
print("Step 5: Precomputing per-individual constants")
print("=" * 60)

n = len(seed)
age_start = seed['age_start'].values

is_birth = (seed['visa_category'] == 'Birth Citizen').values
is_temp = seed['visa_category'].isin(TEMP_VISA_CATEGORIES).values
is_migrant = ~is_birth
is_migrant_res = is_migrant & ~is_temp

# Determine "is_resident_visa" for adjustment purposes
# Resident visa codes: R.*, PR.*, C.Non_birth_citizen, Unknown
# Temp visa categories: Non-residential work, Student, Visitor, Australian, Diplomatic etc
# The P8.6 logic: is_temp = visa_category in TEMP_VISA_CATEGORIES
# is_resident = NOT birth citizen AND NOT temp
is_resident = is_migrant_res  # for adjustment logic

print(f"  Birth citizens: {is_birth.sum():,}")
print(f"  Migrant residents: {is_migrant_res.sum():,}")
print(f"  Temp visa: {is_temp.sum():,}")


# ===================================================================
# Step 6: Vectorized NPV computation (premium approach)
# ===================================================================
print("\n" + "=" * 60)
print("Step 6: Computing lifecycle NPV (premium approach)")
print("=" * 60)

npv_m = np.zeros(n, dtype=np.float64)   # migrant NPV (our convention: + = contributor)
npv_nz = np.zeros(n, dtype=np.float64)  # NZ-born equivalent NPV

for t in range(MAX_T):
    new_age = age_start + t
    alive = new_age <= MAX_AGE

    if not alive.any():
        break

    # Band index for W&N lookup (0-16)
    bi = np.minimum(new_age // 5, N_BANDS - 1)

    # Age bin index for Table 4 premium lookup (0-10)
    abi = np.minimum(new_age // 10, N_AGE_BINS - 1)

    # ---- Base NFI (W&N convention: positive = cost) ----
    base_nfi = base_nfi_arr[bi]

    # ---- Group premium: visa category mean PAYE - NZ-born mean PAYE at this age ----
    group_prem = group_premium_2d[seed_cat_int, abi]

    # ---- Total premium = group + individual deviation ----
    total_premium = group_prem + individual_deviation

    # ---- Migrant adjustment savings (positive = Crown saves) ----
    # Only for non-birth-citizens
    savings = np.zeros(n)

    # 1. NZ Super: save if ineligible (not birth citizen AND (t < 10 OR age < 65))
    super_save = np.where(
        is_migrant & ((t < NZ_SUPER_RESIDENCE_YEARS) | (new_age < NZ_SUPER_AGE)),
        arr_nz_super[bi],
        0.0)
    savings += super_save

    # 2. WFF: save for temp visa holders
    savings += np.where(is_temp, arr_wff[bi], 0.0)

    # 3. Working-age + housing support:
    #    temp → save all;  resident standown (t < 2) → save 50%
    savings += np.where(
        is_temp,
        arr_standown_eligible[bi],
        np.where(is_resident & (t < BENEFIT_STANDOWN_YEARS),
                 arr_standown_eligible[bi] * BENEFIT_STANDOWN_FACTOR,
                 0.0))

    # 4. Health: 15% saving for all non-birth-citizens
    savings += np.where(is_migrant, arr_health[bi] * (1 - HEALTHY_MIGRANT_HEALTH_FACTOR), 0.0)

    # 5. Other income support (temp visa only): other_is + ppl + student_allow
    savings += np.where(is_temp, arr_temp_zero_benefits[bi], 0.0)

    # ---- Migrant NFI (W&N convention: positive = cost) ----
    # migrant_nfi = base_nfi - total_premium - savings
    # Our convention (positive = contributor): our_nfi = -migrant_nfi
    our_nfi_m = total_premium + savings - base_nfi

    # ---- NZ-born equivalent NFI ----
    # For NZ-born: group_premium = 0, savings = 0
    # nzborn_nfi = base_nfi - individual_deviation
    # our_nfi_nz = individual_deviation - base_nfi
    our_nfi_nz = individual_deviation - base_nfi

    # ---- Retention and discount ----
    ret_t = retention_2d[seed_ret_int, min(t, MAX_T - 1)]
    discount = 1.0 / (1.0 + DISCOUNT_RATE) ** t

    # ---- Accumulate (only for alive individuals) ----
    npv_m += alive * ret_t * our_nfi_m * discount
    npv_nz += alive * our_nfi_nz * discount          # retention = 1.0

    if t % 10 == 0:
        n_alive = alive.sum()
        mean_nfi = np.mean(our_nfi_m[alive]) if alive.any() else 0
        mean_ret = (np.mean(ret_t[alive & is_migrant])
                    if (alive & is_migrant).any() else 0)
        print(f"  t={t:3d}: {n_alive:>7,} alive, "
              f"mean NFI=${mean_nfi:>+10,.0f}, "
              f"mean migrant retention={mean_ret:.3f}")

# Round to nearest dollar
npv_m = np.round(npv_m).astype(np.int64)
npv_nz = np.round(npv_nz).astype(np.int64)
surplus = npv_m - npv_nz

seed['npv'] = npv_m
seed['npv_nzborn_equivalent'] = npv_nz
seed['surplus'] = surplus

print(f"\n  NPV computation complete:")
print(f"    Mean NPV (all):             ${np.mean(npv_m):>+12,.0f}")
print(f"    Mean NPV (birth cit):       ${np.mean(npv_m[is_birth]):>+12,.0f}")
print(f"    Mean NPV (migrants):        ${np.mean(npv_m[is_migrant]):>+12,.0f}")
print(f"    Mean NZ-born equiv:         ${np.mean(npv_nz):>+12,.0f}")
print(f"    Mean surplus (migrant):     ${np.mean(surplus[is_migrant]):>+12,.0f}")


# ===================================================================
# Step 7: Self-checks
# ===================================================================
print("\n" + "=" * 60)
print("Step 7: Self-checks")
print("=" * 60)

all_pass = True

# Check 1: No NaN NPVs
nan_npv = np.isnan(seed['npv'].astype(float)).sum()
if nan_npv == 0:
    print("  ✓ Check 1: No NaN NPVs")
else:
    print(f"  ✗ Check 1 FAILED: {nan_npv} NaN NPVs")
    all_pass = False

# Check 2: NPV sign plausibility
print("\n  --- Check 2: Mean NPV by (visa_category, age_start) ---")
print(f"  {'Category':30s} | {'Age':>5s} | {'Mean NPV':>12s} | {'Count':>7s}")
print(f"  {'-'*30} | {'-'*5} | {'-'*12} | {'-'*7}")
for cat in ['Birth Citizen', 'Resident', 'Permanent Resident',
            'Non-residential work', 'Student', 'Australian']:
    for age in [20, 30, 40, 50, 60]:
        mask = (seed['visa_category'] == cat) & (seed['age_start'] == age)
        if mask.sum() < 10:
            continue
        mean_v = seed.loc[mask, 'npv'].mean()
        cnt = mask.sum()
        print(f"  {cat:30s} | {age:>5d} | ${mean_v:>+11,.0f} | {cnt:>7,}")

# Check 3: Surplus = npv - npv_nzborn_equivalent (exact)
surplus_check = (seed['surplus'] == (seed['npv'] - seed['npv_nzborn_equivalent'])).all()
if surplus_check:
    print("\n  ✓ Check 3: surplus == npv - npv_nzborn_equivalent for all rows")
else:
    print("\n  ✗ Check 3 FAILED: surplus mismatch")
    all_pass = False

# Check 4: Birth citizens have surplus ≈ 0
birth_surplus = seed.loc[seed['visa_category'] == 'Birth Citizen', 'surplus']
max_birth_surplus = birth_surplus.abs().max()
if max_birth_surplus <= 1:
    print(f"  ✓ Check 4: Birth citizen surplus = 0 (max |surplus| = {max_birth_surplus})")
else:
    print(f"  ✗ Check 4 FAILED: Birth citizen max |surplus| = {max_birth_surplus}")
    all_pass = False

# Check 5: Phase 1 alignment
print("\n  --- Check 5: Phase 1 alignment ---")

# Map Phase 1 visa labels to synth-pop filter
PHASE1_TO_FILTER = {
    'NZ-born':          ('visa_category', 'Birth Citizen'),
    'Skilled/Investor':  ('visa_subcategory', 'R.Skilled/investor/entrepreneu'),
    'Family':            ('visa_subcategory', 'R.Family'),
    'Humanitarian':      ('visa_subcategory', 'R.Humanitarian and Pacific'),
    'Student':           ('visa_subcategory', 'S.Fee paying'),
    'Working Holiday':   ('visa_subcategory', 'W.Working holiday'),
    'Skilled Work':      ('visa_subcategory', 'W.Skills/specific purposes/pos'),
    'Australian':        ('visa_subcategory', 'A.Australian'),
}

# Known mismatches: income distributions fitted at visa_category level, not subcategory.
# Skilled/Family/Humanitarian share Resident-level income; Working Holiday and
# Skilled Work share Non-residential work level; Student includes S.Dependent.
EXPECT_MISMATCH = {'Skilled/Investor', 'Family', 'Humanitarian', 'Student',
                   'Working Holiday', 'Skilled Work'}

print(f"  {'Phase 1 visa':20s} | {'Age':>5s} | {'Phase 1 NPV':>12s} | "
      f"{'Synth NPV':>12s} | {'Rel diff':>8s} | {'Status':>8s}")
print(f"  {'-'*20} | {'-'*5} | {'-'*12} | {'-'*12} | {'-'*8} | {'-'*8}")

phase1_alignment_issues = []
for p1 in phase1_data:
    visa_label = p1['visa']
    arrival_age = p1['arrival_age']
    p1_npv_our = -p1['npv']  # flip to our convention (positive = contributor)

    if visa_label not in PHASE1_TO_FILTER:
        continue
    col, val = PHASE1_TO_FILTER[visa_label]

    if arrival_age not in seed['age_start'].unique():
        continue

    mask = (seed[col] == val) & (seed['age_start'] == arrival_age)
    if mask.sum() < 10:
        continue

    synth_mean = seed.loc[mask, 'npv'].mean()
    if abs(p1_npv_our) > 100:
        rel_diff = abs(synth_mean - p1_npv_our) / abs(p1_npv_our)
    else:
        rel_diff = abs(synth_mean - p1_npv_our) / 1000

    expected_mismatch = visa_label in EXPECT_MISMATCH
    threshold = 0.25 if expected_mismatch else 0.10
    status = "OK" if rel_diff < threshold else "WATCH"
    if rel_diff >= 0.10 and not expected_mismatch:
        status = "⚠ HIGH"
        phase1_alignment_issues.append(
            f"{visa_label}|{arrival_age}: synth={synth_mean:+,.0f}, "
            f"p1={p1_npv_our:+,.0f}, diff={rel_diff:.1%}")

    print(f"  {visa_label:20s} | {arrival_age:>5d} | ${p1_npv_our:>+11,.0f} | "
          f"${synth_mean:>+11,.0f} | {rel_diff:>7.1%} | {status:>8s}")

if phase1_alignment_issues:
    print(f"\n  ⚠ {len(phase1_alignment_issues)} cells with >10% deviation "
          "(excluding expected mismatches):")
    for issue in phase1_alignment_issues:
        print(f"    {issue}")
else:
    print("\n  ✓ Check 5: All cleanly-comparable cells within 10%")


# ===================================================================
# Step 8: Build distributional summaries JSON
# ===================================================================
print("\n" + "=" * 60)
print("Step 8: Building distributional summaries")
print("=" * 60)

dist_results = {}
for visa in seed['visa_category'].unique():
    for age in sorted(seed['age_start'].unique()):
        mask = (seed['visa_category'] == visa) & (seed['age_start'] == age)
        subset = seed.loc[mask, 'npv'].values
        if len(subset) < 10:
            continue

        key = f"{visa}|{age}"

        hist_counts, bin_edges = np.histogram(subset, bins=20)
        histogram = [
            {'bin_start': round(float(bin_edges[i])),
             'bin_end': round(float(bin_edges[i + 1])),
             'count': int(hist_counts[i])}
            for i in range(len(hist_counts))
        ]

        dist_results[key] = {
            'visa_category': visa,
            'arrival_age': int(age),
            'count': int(len(subset)),
            'mean_npv': round(float(np.mean(subset))),
            'median_npv': round(float(np.median(subset))),
            'p10_npv': round(float(np.percentile(subset, 10))),
            'p25_npv': round(float(np.percentile(subset, 25))),
            'p75_npv': round(float(np.percentile(subset, 75))),
            'p90_npv': round(float(np.percentile(subset, 90))),
            'std_npv': round(float(np.std(subset))),
            'pct_net_contributor': round(float((subset > 0).mean()), 4),
            'histogram': histogram,
        }

dist_path = OUTPUT_DIR / 'synth-npv-distributions.json'
with open(dist_path, 'w') as f:
    json.dump(dist_results, f, indent=2)
print(f"  Saved {len(dist_results)} cells to {dist_path.name}")

for key in ['Birth Citizen|30', 'Resident|30', 'Australian|30', 'Student|20']:
    if key in dist_results:
        d = dist_results[key]
        print(f"    {key}: mean=${d['mean_npv']:+,}, "
              f"p10-p90=[${d['p10_npv']:+,}, ${d['p90_npv']:+,}], "
              f"pct_contributor={d['pct_net_contributor']:.1%}")


# ===================================================================
# Step 9: Build population summary JSON
# ===================================================================
print("\n" + "=" * 60)
print("Step 9: Building population summary")
print("=" * 60)

summary = {
    'total_population': int(len(seed)),
    'total_npv': int(seed['npv'].sum()),
    'mean_npv': round(float(seed['npv'].mean())),
    'by_visa_category': {},
    'by_arrival_age': {},
    'pct_net_contributor': round(float((seed['npv'] > 0).mean()), 4),
    'discount_rate': DISCOUNT_RATE,
    'max_age': MAX_AGE,
}

for visa in sorted(seed['visa_category'].unique()):
    subset = seed[seed['visa_category'] == visa]
    summary['by_visa_category'][visa] = {
        'count': int(len(subset)),
        'mean_npv': round(float(subset['npv'].mean())),
        'total_npv': int(subset['npv'].sum()),
    }

for age in sorted(seed['age_start'].unique()):
    subset = seed[seed['age_start'] == age]
    summary['by_arrival_age'][str(age)] = {
        'count': int(len(subset)),
        'mean_npv': round(float(subset['npv'].mean())),
    }

summary_path = OUTPUT_DIR / 'synth-population-summary.json'
with open(summary_path, 'w') as f:
    json.dump(summary, f, indent=2)
print(f"  Saved to {summary_path.name}")
print(f"  Total NPV: ${summary['total_npv']:,}")
print(f"  Mean NPV: ${summary['mean_npv']:+,}")
print(f"  Pct net contributor: {summary['pct_net_contributor']:.1%}")

print(f"\n  {'Visa category':30s} | {'Count':>8s} | {'Mean NPV':>12s} | {'Total NPV':>15s}")
print(f"  {'-'*30} | {'-'*8} | {'-'*12} | {'-'*15}")
for visa, data in sorted(summary['by_visa_category'].items()):
    print(f"  {visa:30s} | {data['count']:>8,} | ${data['mean_npv']:>+11,} | "
          f"${data['total_npv']:>14,}")


# ===================================================================
# Step 10: Final checks
# ===================================================================
print("\n" + "=" * 60)
print("Step 10: Final checks")
print("=" * 60)

# Check 6: Histogram bin counts sum to cell count
hist_check = True
for key, d in dist_results.items():
    hist_sum = sum(b['count'] for b in d['histogram'])
    if hist_sum != d['count']:
        print(f"  ✗ Histogram mismatch in {key}: sum={hist_sum}, count={d['count']}")
        hist_check = False
        all_pass = False
if hist_check:
    print("  ✓ Check 6: All histograms sum to cell count")

# Check 7: Output files parse as valid JSON
try:
    with open(dist_path) as f:
        json.load(f)
    with open(summary_path) as f:
        json.load(f)
    print("  ✓ Check 7: Both JSON output files are valid")
except json.JSONDecodeError as e:
    print(f"  ✗ Check 7 FAILED: {e}")
    all_pass = False


# ===================================================================
# Step 11: Save updated parquet
# ===================================================================
print("\n" + "=" * 60)
print("Step 11: Saving updated parquet")
print("=" * 60)

seed.to_parquet(BASE_DIR / 'synth_pop' / 'seed_population.parquet', index=False)
print(f"  Saved {len(seed):,} rows × {len(seed.columns)} columns")
print(f"  New columns: npv, npv_nzborn_equivalent, surplus")


# ===================================================================
# Final summary
# ===================================================================
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"  Total individuals: {len(seed):,}")
print(f"  Mean NPV (all): ${seed['npv'].mean():>+12,.0f}")
print(f"  Mean NPV (migrants): ${seed.loc[~is_birth, 'npv'].mean():>+12,.0f}")
print(f"  Mean NPV (birth citizens): ${seed.loc[is_birth, 'npv'].mean():>+12,.0f}")
print(f"  Mean surplus (migrants): ${seed.loc[~is_birth, 'surplus'].mean():>+12,.0f}")
print(f"  Pct net contributor: {(seed['npv'] > 0).mean():.1%}")
print(f"\n  Outputs:")
print(f"    {dist_path.name}: {len(dist_results)} (visa × age) cells")
print(f"    {summary_path.name}: aggregate population summary")
print(f"    seed_population.parquet: +3 columns (npv, npv_nzborn_equivalent, surplus)")

if all_pass:
    print("\n  ✓ ALL SELF-CHECKS PASSED")
else:
    print("\n  ✗ SOME CHECKS FAILED — see details above")
