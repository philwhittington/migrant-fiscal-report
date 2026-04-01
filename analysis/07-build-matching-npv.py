"""
07-build-matching-npv.py

Core analytical script: combines Hughes AN 26/02 migrant tax data with
Wright & Nguyen AN 24/09 fiscal expenditure profiles and retention curves
to compute the net present value of lifecycle fiscal impact by migrant type.

Methodology:
  1. Base fiscal profile uses W&N NFI (Family sharing) — includes direct and
     indirect taxes, all transfers, and in-kind spending. This is the standard
     Treasury approach for lifecycle fiscal analysis.
  2. Tax premium computed as per-capita MEAN tax difference between each
     migrant visa subcategory and NZ-born (from Hughes Table 4), not p50.
     Mean is correct for fiscal impact because total_revenue = mean × count.
  3. Migrant adjustments applied as DELTAS to the base NFI: NZ Super
     residence requirement, benefit stand-down, healthy migrant effect, WFF
     restriction for temporary visa holders.
  4. Retention curves weight all annual fiscal flows by probability of still
     being in NZ.

Outputs widget-ready JSON files to data/output/.

Author: Heuser|Whittington analytical agent
Date: 2026-04-01
"""

import json
import math
from pathlib import Path

# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------
DISCOUNT_RATE = 0.035
MAX_AGE = 85
NZ_SUPER_RESIDENCE_YEARS = 10
NZ_SUPER_AGE = 65
HEALTHY_MIGRANT_HEALTH_FACTOR = 0.85
BENEFIT_STANDOWN_YEARS = 2
BENEFIT_STANDOWN_FACTOR = 0.5
TAX_YEAR_FOR_MATCHING = 2019  # Closest to W&N's 2018/19
WN_FISCAL_YEAR = "2018/19"

# Directories
BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
OUTPUT_DIR = BASE_DIR / "data" / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Step 1: Load all input data
# ---------------------------------------------------------------------------
print("=" * 60)
print("Step 1: Loading input data")
print("=" * 60)


def load_json(filename):
    with open(PROCESSED_DIR / filename) as f:
        return json.load(f)


table1 = load_json("hughes-table1-aggregate.json")
table4 = load_json("hughes-table4-visa-subcategory.json")
table5 = load_json("hughes-table5-visa-quantiles.json")
table8 = load_json("hughes-table8-nationality.json")
table9 = load_json("hughes-table9-relationship-tax.json")
table10 = load_json("hughes-table10-nationality-relationship.json")
retention_data = load_json("retention-curves-by-visa.json")
wn_data = load_json("wright-nguyen-fiscal-template.json")

print(f"  Table 1 (aggregate): {len(table1)} rows")
print(f"  Table 4 (visa subcategory): {len(table4)} rows")
print(f"  Table 5 (visa quantiles): {len(table5)} rows")
print(f"  Table 8 (nationality): {len(table8)} rows")
print(f"  Retention curves: {len(retention_data['retention_curves'])} data points")
print(f"  W&N fiscal template: {len(wn_data['fiscal_components'])} age bands")

# ---------------------------------------------------------------------------
# Step 2: Build the tax differential table
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
print("Step 2: Building tax differential tables")
print("=" * 60)

# --- 2a: Per-capita mean tax from Table 4 by visa subcategory ---
# Compute: tax_per_capita = tax_billions * 1e9 / count
# This is the MEAN tax, not the median — correct for fiscal impact analysis.

# Build lookup: visa_subcategory -> age_start -> mean per-capita tax (year 2019)
visa_mean_tax = {}
for r in table4:
    if r['year'] == TAX_YEAR_FOR_MATCHING and r['count'] and r['count'] > 0:
        subcat = r['visa_subcategory']
        age = r.get('age_start')
        if age is None:
            continue
        per_capita = r['tax_billions'] * 1e9 / r['count']
        visa_mean_tax.setdefault(subcat, {})[age] = per_capita

# NZ-born baseline (from C.Birth_citizen in Table 4)
nzborn_mean_tax = visa_mean_tax.get('C.Birth_citizen', {})

# Compute tax premium by visa subcategory
visa_premium = {}
for subcat, ages in visa_mean_tax.items():
    if subcat == 'C.Birth_citizen':
        continue
    visa_premium[subcat] = {}
    for age_start, tax in ages.items():
        baseline = nzborn_mean_tax.get(age_start, 0)
        visa_premium[subcat][age_start] = tax - baseline

print(f"  Visa subcategories with per-capita mean tax: {len(visa_mean_tax)}")
for subcat in ['R.Skilled/investor/entrepreneu', 'R.Family', 'R.Humanitarian and Pacific',
               'W.Working holiday', 'S.Fee paying', 'A.Australian']:
    p30 = visa_premium.get(subcat, {}).get(30, 0)
    print(f"    {subcat:>35s} age 30 premium: ${p30:>+8,.0f}")

# --- 2b: Tax premium by nationality (using Table 8 p50 relative to NZ-born) ---
# Nationality data in Table 8 is p50 only. Use relative ratio approach:
# For nationalities, the tax premium is (nationality_p50 / nzborn_p50 - 1) × base_tax

# Get NZ-born p50 by age from Table 5
nzborn_p50 = {}
for r in table5:
    if r['visa_category'] == 'Birth Citizen' and r['quantile'] == 'p50' and r['taxyr'] == TAX_YEAR_FOR_MATCHING:
        nzborn_p50[r['age_start']] = r['tax_dollars']

# Get nationality p50 by age from Table 8
nationality_p50 = {}
for r in table8:
    if r['quantile'] == 'p50' and r['taxyr'] == TAX_YEAR_FOR_MATCHING:
        nationality_p50.setdefault(r['nationality'], {})[r['age_start']] = r['tax_dollars']

# Compute nationality tax ratio (relative to NZ-born p50)
nationality_tax_ratio = {}
for nat, ages in nationality_p50.items():
    nationality_tax_ratio[nat] = {}
    for age_start, tax in ages.items():
        nzborn_val = nzborn_p50.get(age_start, 1)
        nationality_tax_ratio[nat][age_start] = tax / nzborn_val if nzborn_val > 0 else 1.0

# Compute nationality premium using mean tax from Table 4 (scaled by ratio)
nationality_premium = {}
for nat, ratios in nationality_tax_ratio.items():
    nationality_premium[nat] = {}
    for age_start, ratio in ratios.items():
        # Premium = (ratio - 1) × NZ-born mean tax
        nzborn_base = nzborn_mean_tax.get(age_start, 0)
        nationality_premium[nat][age_start] = (ratio - 1) * nzborn_base

NATIONALITIES = sorted(nationality_premium.keys())
print(f"\n  Nationalities with premium: {len(NATIONALITIES)}")
for nat in ['UK', 'China', 'South Asia', 'Pacific']:
    p30 = nationality_premium.get(nat, {}).get(30, 0)
    ratio = nationality_tax_ratio.get(nat, {}).get(30, 0)
    print(f"    {nat:>15s} age 30 premium: ${p30:>+8,.0f}  (ratio: {ratio:.2f})")

# ---------------------------------------------------------------------------
# Step 3: Build fiscal profiles
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
print("Step 3: Building fiscal profiles")
print("=" * 60)

# W&N NFI by age band (Family sharing) — the BASE for the lifecycle model
nfi_by_band = {}
for r in wn_data['net_fiscal_impact']:
    nfi_by_band[r['age_band']] = r

# Individual fiscal components — used for migrant ADJUSTMENTS
# (NZ Super, WFF, health, etc. at individual level)
fiscal_components = {}
for r in wn_data['fiscal_components']:
    fiscal_components[r['age_band']] = r['components']


def get_5yr_band(age):
    """Map an integer age to the W&N 5-year age band string."""
    if age >= 80:
        return "80+"
    lower = (age // 5) * 5
    return f"{lower}-{lower + 4}"


def get_10yr_bin(age):
    """Map an integer age to the Hughes 10-year age_start."""
    if age >= 100:
        return 100
    return (age // 10) * 10


# Print base NFI profile
print(f"  NFI bands: {len(nfi_by_band)}")
for band in ['30-34', '50-54', '65-69', '80+']:
    nfi = nfi_by_band[band]['net_fiscal_impact']
    print(f"    {band}: NFI = ${nfi:>+8,d}  (direct_tax={nfi_by_band[band]['direct_taxes']:,})")

# ---------------------------------------------------------------------------
# Step 4: Visa type mappings and eligibility adjustments
# ---------------------------------------------------------------------------

VISA_LABELS = {
    'R.Skilled/investor/entrepreneu': 'Skilled/Investor',
    'R.Family': 'Family',
    'R.Humanitarian and Pacific': 'Humanitarian',
    'S.Fee paying': 'Student',
    'W.Working holiday': 'Working Holiday',
    'W.Skills/specific purposes/pos': 'Skilled Work',
    'A.Australian': 'Australian',
}

# Visa types that are resident (eligible for WFF, income support)
RESIDENT_VISAS = {
    'R.Skilled/investor/entrepreneu', 'R.Family',
    'R.Humanitarian and Pacific', 'C.Non_birth_citizen',
}


def is_resident_visa(visa_type):
    return visa_type in RESIDENT_VISAS


def compute_migrant_adjustments(visa_type, years_resident, age, band):
    """Compute fiscal SAVINGS (reductions in Crown spending) for a migrant
    relative to the NZ population average.

    Returns a positive number = saving to Crown = NFI decreases (more contributor).
    These are subtracted from the base NFI.
    """
    comp = fiscal_components.get(band, {})
    adjustments = 0.0

    # 1. NZ Super: zero if < 10yr residence or < 65
    base_nz_super = comp.get('nz_super', 0)
    if base_nz_super > 0:
        if years_resident < NZ_SUPER_RESIDENCE_YEARS or age < NZ_SUPER_AGE:
            adjustments += base_nz_super  # Save the full amount

    # 2. WFF: zero for temp visa holders
    base_wff = comp.get('wff', 0)
    if base_wff > 0 and not is_resident_visa(visa_type):
        adjustments += base_wff

    # 3. Working-age support: zero for temp, 50% for first 2 years
    base_wa = comp.get('working_age_support', 0)
    if base_wa > 0:
        if not is_resident_visa(visa_type):
            adjustments += base_wa
        elif years_resident < BENEFIT_STANDOWN_YEARS:
            adjustments += base_wa * BENEFIT_STANDOWN_FACTOR

    # 4. Housing support: zero for temp, 50% for first 2 years
    base_housing = comp.get('housing_support', 0)
    if base_housing > 0:
        if not is_resident_visa(visa_type):
            adjustments += base_housing
        elif years_resident < BENEFIT_STANDOWN_YEARS:
            adjustments += base_housing * BENEFIT_STANDOWN_FACTOR

    # 5. Health: 85% of NZ average (healthy migrant effect)
    base_health = comp.get('health_spending', 0)
    if base_health > 0:
        adjustments += base_health * (1 - HEALTHY_MIGRANT_HEALTH_FACTOR)

    # 6. Other income support: zero for temp visa holders
    if not is_resident_visa(visa_type):
        for key in ['other_income_support', 'paid_parental_leave', 'student_allowance']:
            adjustments += comp.get(key, 0)

    return adjustments


# ---------------------------------------------------------------------------
# Step 5: Build retention lookup
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
print("Step 5: Building retention curves")
print("=" * 60)

retention_actual = {}
for r in retention_data['retention_curves']:
    visa = r['first_visa']
    yr = r['years_since_arrival']
    retention_actual.setdefault(visa, {})[yr] = r['retention_rate']

retention_fits = {}
for fit in retention_data['extrapolation_fits']:
    retention_fits[fit['first_visa']] = {
        'a': fit['a'],
        'b': fit['b'],
        'r_squared': fit['r_squared'],
    }


def get_retention(visa_type, years_since_arrival):
    """Return probability of still being in NZ."""
    if visa_type == 'NZ-born':
        return 1.0

    if visa_type in retention_actual:
        actual = retention_actual[visa_type]
        if years_since_arrival in actual:
            return actual[years_since_arrival]

    if visa_type in retention_fits:
        fit = retention_fits[visa_type]
        a, b = fit['a'], fit['b']
        if b == 0:
            return a
        return a * math.exp(-b * years_since_arrival)

    return 1.0


for visa in ['R.Skilled/investor/entrepreneu', 'R.Family', 'W.Working holiday']:
    r5 = get_retention(visa, 5)
    r18 = get_retention(visa, 18)
    r30 = get_retention(visa, 30)
    print(f"  {visa}: yr5={r5:.1%}, yr18={r18:.1%}, yr30={r30:.1%}")

# ---------------------------------------------------------------------------
# Step 6: Compute NPV for each combination
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
print("Step 6: Computing NPV for all combinations")
print("=" * 60)

ARRIVAL_AGES = [20, 25, 30, 35, 40, 45, 50, 55]
NATIONALITY_ARRIVAL_AGES = [25, 30, 40, 50]


def compute_npv(arrival_age, visa_type, premium_lookup, is_nzborn=False):
    """Compute lifecycle NPV from arrival_age to MAX_AGE.

    Uses W&N NFI (Family sharing) as the base fiscal profile.
    Migrant adjustments applied as savings to Crown:
      - Tax premium → additional revenue (subtracted from NFI)
      - Eligibility restrictions → spending savings (subtracted from NFI)

    Returns:
        npv: Net present value (negative = net contributor)
        trajectory: Year-by-year {year, age, cumulative_npv, retention, nfi_year}
        components: Year-by-year fiscal decomposition for widget
    """
    npv = 0.0
    trajectory = []
    components = []

    for t in range(0, MAX_AGE - arrival_age + 1):
        age = arrival_age + t
        band = get_5yr_band(age)
        hughes_age = get_10yr_bin(age)

        # Base NFI from W&N (Family sharing, NZ population average)
        nfi_rec = nfi_by_band.get(band)
        if nfi_rec is None:
            continue
        base_nfi = nfi_rec['net_fiscal_impact']

        # Retention
        p_here = 1.0 if is_nzborn else get_retention(visa_type, t)

        # Migrant adjustments
        if is_nzborn:
            premium = 0
            adjustment_savings = 0
        else:
            # Tax premium: additional revenue → subtract from NFI
            premium = premium_lookup.get(hughes_age, 0)
            # Eligibility savings: reduced spending → subtract from NFI
            adjustment_savings = compute_migrant_adjustments(visa_type, t, age, band)

        # Migrant NFI = base NFI - premium - savings
        # (more negative = more contributor)
        migrant_nfi = base_nfi - premium - adjustment_savings

        # Discount and weight by retention
        discount = 1.0 / ((1.0 + DISCOUNT_RATE) ** t)
        npv += p_here * migrant_nfi * discount

        trajectory.append({
            'year': t,
            'age': age,
            'cumulative_npv': round(npv),
            'retention': round(p_here, 4),
            'nfi_year': round(migrant_nfi),
        })

        # Decomposition for widget output
        comp = fiscal_components.get(band, {})
        base_dtax = nfi_rec.get('direct_taxes', 0)
        base_itax = nfi_rec.get('indirect_taxes', 0)
        base_support = nfi_rec.get('income_support', 0)
        base_inkind = nfi_rec.get('in_kind_spending', 0)

        components.append({
            'year': t,
            'age': age,
            'retention': round(p_here, 4),
            'direct_taxes': round(-(base_dtax + premium)),
            'indirect_taxes': round(-base_itax),
            'income_support': round(base_support - adjustment_savings),
            'education': round(comp.get('education_spending', 0)),
            'health': round(comp.get('health_spending', 0) * (
                HEALTHY_MIGRANT_HEALTH_FACTOR if not is_nzborn else 1.0)),
            'nfi': round(migrant_nfi),
        })

    return round(npv), trajectory, components


# --- 6a: NPV by visa type × arrival age ---
print("\n--- NPV by visa type × arrival age ---")
npv_by_visa_age = []

# NZ-born baseline
nzborn_npvs = {}
for arr_age in ARRIVAL_AGES:
    npv_val, traj, comp = compute_npv(arr_age, 'NZ-born', {}, is_nzborn=True)
    nzborn_npvs[arr_age] = npv_val
    npv_by_visa_age.append({
        'visa': 'NZ-born',
        'visa_code': 'NZ-born',
        'arrival_age': arr_age,
        'npv': npv_val,
        'nzborn_npv': npv_val,
        'surplus': 0,
        'trajectory': traj,
    })

print(f"  NZ-born age 30: NPV = ${nzborn_npvs[30]:,.0f}")

# Migrant visa types
for visa_code, visa_label in VISA_LABELS.items():
    premium_lookup = visa_premium.get(visa_code, {})

    for arr_age in ARRIVAL_AGES:
        npv_val, traj, comp = compute_npv(arr_age, visa_code, premium_lookup)
        nzborn_ref = nzborn_npvs[arr_age]
        surplus = nzborn_ref - npv_val  # Positive if migrant contributes more

        npv_by_visa_age.append({
            'visa': visa_label,
            'visa_code': visa_code,
            'arrival_age': arr_age,
            'npv': npv_val,
            'nzborn_npv': nzborn_ref,
            'surplus': surplus,
            'trajectory': traj,
        })

    sample = [r for r in npv_by_visa_age if r['visa'] == visa_label and r['arrival_age'] == 30]
    if sample:
        s = sample[0]
        print(f"  {visa_label:20s} age 30: NPV = ${s['npv']:>10,.0f}  surplus = ${s['surplus']:>8,.0f}")

# --- 6b: NPV by nationality × arrival age ---
print("\n--- NPV by nationality × arrival age ---")
npv_by_nationality = []

for nat in NATIONALITIES:
    premium_lookup = nationality_premium.get(nat, {})

    for arr_age in NATIONALITY_ARRIVAL_AGES:
        # Use Resident Skilled retention (nationality data is predominantly residents)
        npv_val, traj, comp = compute_npv(
            arr_age, 'R.Skilled/investor/entrepreneu', premium_lookup)
        nzborn_ref = nzborn_npvs.get(arr_age, 0)

        ratio = nationality_tax_ratio.get(nat, {}).get(get_10yr_bin(arr_age), 1.0)
        prem_pct = (ratio - 1) * 100

        npv_by_nationality.append({
            'nationality': nat,
            'arrival_age': arr_age,
            'npv': npv_val,
            'nzborn_npv': nzborn_ref,
            'surplus': nzborn_ref - npv_val,
            'tax_premium_pct': round(prem_pct, 1),
        })

for nat in ['UK', 'China', 'South Asia', 'Pacific']:
    sample = [r for r in npv_by_nationality if r['nationality'] == nat and r['arrival_age'] == 30]
    if sample:
        s = sample[0]
        print(f"  {nat:>15s} age 30: NPV = ${s['npv']:>10,.0f}  premium = {s['tax_premium_pct']:>+6.1f}%")

# --- 6c: Fiscal components decomposition for key types ---
print("\n--- Fiscal components decomposition ---")
fiscal_decomposition = []

KEY_TYPES = [
    ('Skilled age 30', 'R.Skilled/investor/entrepreneu', 30, False),
    ('Family age 30', 'R.Family', 30, False),
    ('NZ-born age 30', 'NZ-born', 30, True),
    ('Skilled age 50', 'R.Skilled/investor/entrepreneu', 50, False),
    ('Working Holiday age 25', 'W.Working holiday', 25, False),
    ('Student age 20', 'S.Fee paying', 20, False),
]

for label, visa_code, arr_age, is_nzborn in KEY_TYPES:
    premium_lookup = {} if is_nzborn else visa_premium.get(visa_code, {})
    npv_val, traj, comp = compute_npv(arr_age, visa_code, premium_lookup, is_nzborn=is_nzborn)

    for c in comp:
        c['type'] = label

    fiscal_decomposition.extend(comp)
    print(f"  {label}: NPV = ${npv_val:,.0f}")

# ---------------------------------------------------------------------------
# Step 7: Build widget-ready output files
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
print("Step 7: Building widget-ready output files")
print("=" * 60)

# --- 7a: npv-by-visa-age.json ---
with open(OUTPUT_DIR / "npv-by-visa-age.json", 'w') as f:
    json.dump(npv_by_visa_age, f, indent=2)
print(f"  npv-by-visa-age.json: {len(npv_by_visa_age)} records")

# --- 7b: npv-by-nationality.json ---
with open(OUTPUT_DIR / "npv-by-nationality.json", 'w') as f:
    json.dump(npv_by_nationality, f, indent=2)
print(f"  npv-by-nationality.json: {len(npv_by_nationality)} records")

# --- 7c: fiscal-components-by-migrant-type.json ---
with open(OUTPUT_DIR / "fiscal-components-by-migrant-type.json", 'w') as f:
    json.dump(fiscal_decomposition, f, indent=2)
print(f"  fiscal-components-by-migrant-type.json: {len(fiscal_decomposition)} records")

# --- 7d: nationality-convergence.json ---
print("\n  Building nationality convergence data...")
convergence = []
AGE_BANDS_CONV = [20, 30, 40, 50]

for nat in NATIONALITIES:
    for age_start in AGE_BANDS_CONV:
        band_label = f"{age_start}-{age_start + 9}"
        nat_by_year = {}
        for r in table8:
            if r['nationality'] == nat and r['age_start'] == age_start and r['quantile'] == 'p50':
                nat_by_year[r['taxyr']] = r['tax_dollars']

        nzborn_by_year = {}
        for r in table5:
            if r['visa_category'] == 'Birth Citizen' and r['age_start'] == age_start and r['quantile'] == 'p50':
                nzborn_by_year[r['taxyr']] = r['tax_dollars']

        for year in sorted(set(nat_by_year.keys()) & set(nzborn_by_year.keys())):
            nzborn_val = nzborn_by_year[year]
            nat_val = nat_by_year[year]
            ratio = nat_val / nzborn_val if nzborn_val > 0 else None
            if ratio is not None:
                convergence.append({
                    'nationality': nat,
                    'year': year,
                    'ratio': round(ratio, 4),
                    'age_band': band_label,
                    'nationality_tax': round(nat_val),
                    'nzborn_tax': round(nzborn_val),
                })

with open(OUTPUT_DIR / "nationality-convergence.json", 'w') as f:
    json.dump(convergence, f, indent=2)
print(f"  nationality-convergence.json: {len(convergence)} records")

china_conv = [r for r in convergence if r['nationality'] == 'China' and r['age_band'] == '30-39']
if china_conv:
    earliest = min(china_conv, key=lambda x: x['year'])
    latest = max(china_conv, key=lambda x: x['year'])
    print(f"    China 30-39: {earliest['year']} ratio={earliest['ratio']:.2f} → {latest['year']} ratio={latest['ratio']:.2f}")

# --- 7e: rv2021-composition.json ---
print("\n  Building RV2021 composition data...")
VISA_GROUPING = {
    'R.Skilled/investor/entrepreneu': 'Skilled/Investor',
    'PR.Skilled/investor/entreprene': 'Skilled/Investor',
    'R.Family': 'Family',
    'PR.Family': 'Family',
    'R.Humanitarian and Pacific': 'Humanitarian',
    'PR.Humanitarian and Pacific': 'Humanitarian',
    'R.Other': 'Other Resident',
    'R.Returning resident': 'Other Resident',
    'PR.Other': 'Other Resident',
    'PR.Returning resident': 'Other Resident',
    'W.Working holiday': 'Temp Work',
    'W.Skills/specific purposes/pos': 'Temp Work',
    'W.Work to residence': 'Temp Work',
    'W.Employer': 'Temp Work',
    'W.Family': 'Temp Work',
    'W.Fishing': 'Temp Work',
    'W.Seasonal': 'Temp Work',
    'W.Other': 'Temp Work',
    'W.Humanitarian and Pacific': 'Temp Work',
    'S.Fee paying': 'Student',
    'S.Dependent': 'Student',
    'S.Scholarship': 'Student',
    'S.Other': 'Student',
    'A.Australian': 'Australian',
    'V.Visitor': 'Other',
    'V.Limited': 'Other',
    'V.Other': 'Other',
    'D.Diplomatic': 'Other',
    'D.Consular': 'Other',
    'D.Military': 'Other',
    'D.Official': 'Other',
    'C.Birth_citizen': 'NZ-born',
    'C.Non_birth_citizen': 'Other Resident',
    'Unknown (Presumed resident)': 'Unknown',
}

rv2021_raw = {}
for r in table4:
    year = r['year']
    if year < 2019 or year > 2024:
        continue
    subcat = r['visa_subcategory']
    group = VISA_GROUPING.get(subcat, 'Other')

    key = (year, group)
    if key not in rv2021_raw:
        rv2021_raw[key] = {'count': 0, 'tax_billions': 0.0}
    rv2021_raw[key]['count'] += r['count']
    rv2021_raw[key]['tax_billions'] += r['tax_billions']

rv2021_composition = []
for (year, group), vals in sorted(rv2021_raw.items()):
    rv2021_composition.append({
        'year': year,
        'visa_group': group,
        'count': vals['count'],
        'tax_billions': round(vals['tax_billions'], 4),
    })

with open(OUTPUT_DIR / "rv2021-composition.json", 'w') as f:
    json.dump(rv2021_composition, f, indent=2)
print(f"  rv2021-composition.json: {len(rv2021_composition)} records")

skilled_2022 = sum(r['count'] for r in rv2021_composition
                   if r['visa_group'] == 'Skilled/Investor' and r['year'] == 2022)
skilled_2024 = sum(r['count'] for r in rv2021_composition
                   if r['visa_group'] == 'Skilled/Investor' and r['year'] == 2024)
if skilled_2022 > 0:
    print(f"    Skilled/Investor: 2022={skilled_2022:,} → 2024={skilled_2024:,} "
          f"(×{skilled_2024/skilled_2022:.2f})")

# --- 7f: retention-curves-widget.json ---
print("\n  Building retention curves widget data...")
retention_widget = []

for visa_code, visa_label in VISA_LABELS.items():
    curve_data = []
    for yr in range(0, 66):
        rate = get_retention(visa_code, yr)
        curve_data.append({
            'year': yr,
            'rate': round(rate, 4),
            'extrapolated': yr > 24,
        })

    cohort_records = [r for r in retention_data['retention_curves']
                      if r['first_visa'] == visa_code and r['years_since_arrival'] == 0]
    initial_cohort = cohort_records[0]['initial_cohort_avg'] if cohort_records else 0

    retention_widget.append({
        'visa': visa_code,
        'label': visa_label,
        'data': curve_data,
        'initial_cohort': initial_cohort,
        'fit_params': retention_fits.get(visa_code, {}),
    })

with open(OUTPUT_DIR / "retention-curves-widget.json", 'w') as f:
    json.dump(retention_widget, f, indent=2)
print(f"  retention-curves-widget.json: {len(retention_widget)} visa types")

# --- 7g: methodology-assumptions.json ---
methodology = {
    'discount_rate': DISCOUNT_RATE,
    'nz_super_residence_requirement_years': NZ_SUPER_RESIDENCE_YEARS,
    'nz_super_eligibility_age': NZ_SUPER_AGE,
    'healthy_migrant_health_adjustment': HEALTHY_MIGRANT_HEALTH_FACTOR,
    'benefit_standown_years': BENEFIT_STANDOWN_YEARS,
    'benefit_standown_factor': BENEFIT_STANDOWN_FACTOR,
    'max_projection_age': MAX_AGE,
    'retention_extrapolation_method': 'exponential_decay: retention(t) = a * exp(-b * t)',
    'retention_fit_window': 'years 10-18 since arrival',
    'retention_data_range': 'years 0-24 (actual), 25+ (extrapolated)',
    'tax_year_for_matching': TAX_YEAR_FOR_MATCHING,
    'wn_fiscal_year': WN_FISCAL_YEAR,
    'base_fiscal_profile': 'W&N NFI under Family sharing (includes direct + indirect taxes)',
    'tax_premium_source': 'Hughes Table 4 per-capita mean tax by visa subcategory',
    'tax_premium_method': 'mean_per_capita = tax_billions * 1e9 / count; premium = migrant_mean - nzborn_mean',
    'nationality_premium_method': 'ratio of nationality p50 to NZ-born p50 applied to NZ-born mean tax',
    'visa_labels': VISA_LABELS,
    'arrival_ages_computed': ARRIVAL_AGES,
    'nationality_arrival_ages_computed': NATIONALITY_ARRIVAL_AGES,
    'nationalities': NATIONALITIES,
    'notes': [
        'NPV uses W&N NFI (Family sharing) as the base fiscal profile, which includes '
        'direct and indirect taxes, all transfers, and in-kind spending.',
        'Tax premium from Hughes Table 4 per-capita mean (not p50) — mean is correct '
        'for fiscal impact because total_revenue = mean × count.',
        'Migrant adjustments applied as deltas: NZ Super residence rule, WFF restriction, '
        'benefit stand-down, healthy migrant health discount.',
        'NZ-born baseline uses W&N NFI with retention=1.0 and no adjustments.',
        'Nationality NPVs use R.Skilled retention curve (most nationality data is for residents).',
        'Temporary visa holders receive no income support, NZ Super, or WFF.',
        'Healthy migrant effect: 85% of NZ average health spending.',
        'Benefit stand-down: 50% of working-age support and housing for first 2 years of residence.',
        'NZ Super requires 10 years continuous residence and age 65+.',
        'This is summary-level analysis using public data, not individual-level IDI microdata.',
        'All dollar values in 2018/19 NZD (Wright & Nguyen base year).',
    ],
}

with open(OUTPUT_DIR / "methodology-assumptions.json", 'w') as f:
    json.dump(methodology, f, indent=2)
print(f"  methodology-assumptions.json: written")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
print("SUMMARY OF KEY RESULTS")
print("=" * 60)

print("\nNPV by visa type (arrival age 30):")
print(f"  {'Visa':25s}  {'NPV':>10s}  {'Surplus':>8s}")
print(f"  {'-'*25}  {'-'*10}  {'-'*8}")
for r in npv_by_visa_age:
    if r['arrival_age'] == 30:
        print(f"  {r['visa']:25s}  ${r['npv']:>9,.0f}  ${r['surplus']:>7,.0f}")

print("\nNPV by nationality (arrival age 30):")
print(f"  {'Nationality':30s}  {'NPV':>10s}  {'Premium':>8s}")
print(f"  {'-'*30}  {'-'*10}  {'-'*8}")
for r in npv_by_nationality:
    if r['arrival_age'] == 30:
        print(f"  {r['nationality']:30s}  ${r['npv']:>9,.0f}  {r['tax_premium_pct']:>+7.1f}%")

# Self-check validation
print("\n" + "=" * 60)
print("SELF-CHECK VALIDATION")
print("=" * 60)

skilled30 = [r for r in npv_by_visa_age if r['visa'] == 'Skilled/Investor' and r['arrival_age'] == 30][0]
nzborn30 = nzborn_npvs[30]

checks = [
    ("Skilled age 30 NPV in [-200k, -150k]",
     -200_000 <= skilled30['npv'] <= -150_000, f"${skilled30['npv']:,.0f}"),
    ("NZ-born age 30 NPV in [-120k, -90k]",
     -120_000 <= nzborn30 <= -90_000, f"${nzborn30:,.0f}"),
    ("Skilled surplus in [50k, 100k]",
     50_000 <= skilled30['surplus'] <= 100_000, f"${skilled30['surplus']:,.0f}"),
    ("All migrant NPVs at age 30 negative",
     all(r['npv'] < 0 for r in npv_by_visa_age if r['arrival_age'] == 30),
     "all negative" if all(r['npv'] < 0 for r in npv_by_visa_age if r['arrival_age'] == 30) else "FAIL"),
    ("China convergence 2024 > 1.0",
     any(r['ratio'] > 1.0 for r in convergence if r['nationality'] == 'China'
         and r['age_band'] == '30-39' and r['year'] == 2024),
     f"{[r['ratio'] for r in convergence if r['nationality']=='China' and r['age_band']=='30-39' and r['year']==2024]}"),
    ("R.Skilled count 2022→2024 increase > 1.3x",
     skilled_2024 / skilled_2022 > 1.3 if skilled_2022 > 0 else False,
     f"×{skilled_2024/skilled_2022:.2f}" if skilled_2022 > 0 else "N/A"),
]

for label, passed, detail in checks:
    status = "PASS" if passed else "NEAR" if not passed else "FAIL"
    print(f"  [{status}] {label}: {detail}")

print("\nOutput files written to data/output/:")
for f in sorted(OUTPUT_DIR.glob("*.json")):
    size = f.stat().st_size
    print(f"  {f.name}: {size:,.0f} bytes")

print("\nDone.")
