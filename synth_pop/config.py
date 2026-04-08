"""
Shared constants for synthetic population pipeline.

All parameter values trace to documented sources:
- Discount rate: NZ Treasury standard
- PAYE brackets: Inland Revenue 2024 rates
- Migrant adjustments: Phase 1 methodology (07-build-matching-npv.py)
- Wright & Nguyen age bands: AN 24/09
"""

# ---------------------------------------------------------------------------
# Lifecycle NPV parameters
# ---------------------------------------------------------------------------
DISCOUNT_RATE = 0.035
MAX_AGE = 85

# ---------------------------------------------------------------------------
# Migrant eligibility adjustments
# ---------------------------------------------------------------------------
NZ_SUPER_RESIDENCE_YEARS = 10
NZ_SUPER_AGE = 65
HEALTHY_MIGRANT_HEALTH_FACTOR = 0.85
BENEFIT_STANDOWN_YEARS = 2
BENEFIT_STANDOWN_FACTOR = 0.5

# ---------------------------------------------------------------------------
# Data parameters
# ---------------------------------------------------------------------------
TAX_YEAR = 2019
POPULATION_TARGET = 500_000

# ---------------------------------------------------------------------------
# 2024 NZ PAYE tax brackets (annual thresholds, cumulative)
# Each tuple: (upper bound of bracket, marginal rate)
# ---------------------------------------------------------------------------
PAYE_BRACKETS = [
    (14_000, 0.105),
    (48_000, 0.175),
    (70_000, 0.30),
    (180_000, 0.33),
    (float('inf'), 0.39),
]
ACC_LEVY_RATE = 0.016  # 1.6% of earnings

# ---------------------------------------------------------------------------
# Visa category classifications
# ---------------------------------------------------------------------------
# Visa subcategories considered temporary (no WFF, no income support)
TEMP_VISA_CATEGORIES = [
    'Non-residential work', 'Student', 'Visitor', 'Australian', 'Diplomatic etc'
]

# Visa subcategory codes that are resident (eligible for WFF, income support)
RESIDENT_VISA_CODES = {
    'R.Skilled/investor/entrepreneu', 'R.Family',
    'R.Humanitarian and Pacific', 'C.Non_birth_citizen',
}

# Map Hughes Table 5 visa_category to Table 4 visa_subcategory prefixes
# (Table 5 uses broad categories; Table 4 uses detailed subcategories)
VISA_CATEGORY_TO_SUBCATEGORY_PREFIX = {
    'Skilled Migrant': 'R.Skilled',
    'Family': 'R.Family',
    'Humanitarian': 'R.Humanitarian',
    'Student': 'S.',
    'Working Holiday': 'W.Working holiday',
    'Skilled Work': 'W.Skills',
    'Australian': 'A.Australian',
    'Non-residential work': 'W.',
    'Birth Citizen': 'C.Birth_citizen',
    'Non-birth Citizen': 'C.Non_birth_citizen',
}

# ---------------------------------------------------------------------------
# Age band mappings
# ---------------------------------------------------------------------------
# Hughes uses 10-year age_start bins (0, 10, 20, ..., 100)
# Wright & Nguyen uses 5-year bands ("0-4", "5-9", ..., "80+")

# Map Hughes 10-year age_start → list of W&N 5-year bands
AGE_BAND_MAP_10_TO_5 = {
    0: ['0-4', '5-9'],
    10: ['10-14', '15-19'],
    20: ['20-24', '25-29'],
    30: ['30-34', '35-39'],
    40: ['40-44', '45-49'],
    50: ['50-54', '55-59'],
    60: ['60-64', '65-69'],
    70: ['70-74', '75-79'],
    80: ['80+'],
    90: ['80+'],
    100: ['80+'],
}

# W&N 5-year band labels (in order)
WN_AGE_BANDS = [
    '0-4', '5-9', '10-14', '15-19', '20-24', '25-29',
    '30-34', '35-39', '40-44', '45-49', '50-54', '55-59',
    '60-64', '65-69', '70-74', '75-79', '80+',
]
