"""
Shared utilities for synthetic population pipeline.

Provides reusable functions imported by P8.1–P8.8:
- NZ PAYE tax calculator (2024 brackets)
- Zero-inflated log-normal distribution fitter and sampler
- Wright & Nguyen fiscal template lookup
- Migrant eligibility adjustments
- Retention curve lookup with exponential extrapolation
- Individual lifecycle NPV computation

Author: Heuser|Whittington analytical agent
Date: 2026-04-08
"""

import json
import math
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from scipy.stats import norm, lognorm

from synth_pop.config import (
    PAYE_BRACKETS, ACC_LEVY_RATE,
    DISCOUNT_RATE, MAX_AGE,
    NZ_SUPER_RESIDENCE_YEARS, NZ_SUPER_AGE,
    HEALTHY_MIGRANT_HEALTH_FACTOR,
    BENEFIT_STANDOWN_YEARS, BENEFIT_STANDOWN_FACTOR,
    RESIDENT_VISA_CODES,
)

# ---------------------------------------------------------------------------
# Directory constants
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
OUTPUT_DIR = BASE_DIR / "data" / "output"


def load_json(filename: str) -> dict:
    """Load a JSON file from data/processed/."""
    with open(PROCESSED_DIR / filename) as f:
        return json.load(f)


# ===================================================================
# 1. NZ PAYE tax calculator
# ===================================================================

def compute_paye(gross_income: float) -> float:
    """Compute NZ PAYE income tax for a given gross annual income.

    Uses 2024 NZ tax brackets (progressive marginal rates).
    Returns 0 for zero or negative income.
    """
    if gross_income <= 0:
        return 0.0

    tax = 0.0
    prev_threshold = 0.0
    for threshold, rate in PAYE_BRACKETS:
        if gross_income <= threshold:
            tax += (gross_income - prev_threshold) * rate
            break
        else:
            tax += (threshold - prev_threshold) * rate
            prev_threshold = threshold
    return tax


def compute_acc_levy(gross_income: float) -> float:
    """Compute ACC earners' levy (flat rate on earnings)."""
    if gross_income <= 0:
        return 0.0
    return gross_income * ACC_LEVY_RATE


def compute_total_tax(gross_income: float) -> float:
    """Compute PAYE + ACC levy for a given gross income."""
    return compute_paye(gross_income) + compute_acc_levy(gross_income)


# ===================================================================
# 2. Zero-inflated log-normal distribution fitting
# ===================================================================

# Standard quantile probabilities
_QUANTILE_PROBS = {'p10': 0.10, 'p25': 0.25, 'p50': 0.50, 'p75': 0.75, 'p90': 0.90}


def fit_zero_inflated_lognormal(quantiles: dict, target_mean: float = None) -> dict:
    """Fit a zero-inflated log-normal distribution to 5 quantile points.

    Model: X = 0 with probability p_zero
           X ~ LogNormal(mu, sigma) with probability (1 - p_zero)

    The quantile function for probability p (where p > p_zero):
        Q(p) = exp(mu + sigma * Phi_inv((p - p_zero) / (1 - p_zero)))

    Args:
        quantiles: dict with keys 'p10','p25','p50','p75','p90' (dollar values)
        target_mean: if provided, calibrate mu so that
            E[X] = (1 - p_zero) * exp(mu + sigma^2/2) = target_mean

    Returns:
        dict with keys:
            'p_zero': probability of zero income
            'mu': log-normal location parameter
            'sigma': log-normal scale parameter
            'fit_quality': RMSE of quantile fit (dollars)
            'calibrated_mean': expected value of the distribution
    """
    vals = {k: quantiles[k] for k in ['p10', 'p25', 'p50', 'p75', 'p90']}

    # Handle all-zero case
    if all(v == 0 for v in vals.values()):
        return {
            'p_zero': 1.0, 'mu': 0.0, 'sigma': 1.0,
            'fit_quality': 0.0, 'calibrated_mean': 0.0,
        }

    # Determine p_zero bounds from zero quantiles
    # If p10=0 but p25>0, then p_zero is in [0.10, 0.25)
    ordered = ['p10', 'p25', 'p50', 'p75', 'p90']
    p_zero_lower = 0.0
    for q_name in ordered:
        if vals[q_name] <= 0:
            p_zero_lower = _QUANTILE_PROBS[q_name]
        else:
            break

    # Identify positive quantiles for fitting
    pos_quantiles = {k: v for k, v in vals.items() if v > 0}
    if len(pos_quantiles) < 2:
        # Only one positive quantile — not enough for reliable fit
        # Use p90 to anchor a rough distribution
        p90 = vals.get('p90', 1000)
        return {
            'p_zero': 0.90, 'mu': math.log(max(p90, 1)), 'sigma': 1.0,
            'fit_quality': float('inf'), 'calibrated_mean': 0.1 * p90,
        }

    # Initial estimates from positive quantiles
    # For a log-normal: ln(p50_adj) ≈ mu, (ln(p90_adj) - ln(p10_adj)) / 2.56 ≈ sigma
    p_zero_init = max(p_zero_lower, 0.0)
    log_vals = [math.log(v) for v in pos_quantiles.values()]
    mu_init = np.mean(log_vals)
    sigma_init = max(np.std(log_vals), 0.3)

    def _predicted_quantile(p, p_zero, mu, sigma):
        """Predicted quantile for the zero-inflated log-normal."""
        if p <= p_zero:
            return 0.0
        adj_p = (p - p_zero) / (1.0 - p_zero)
        adj_p = max(min(adj_p, 0.9999), 0.0001)
        return math.exp(mu + sigma * norm.ppf(adj_p))

    def _objective(params):
        p_zero, mu, sigma = params
        if p_zero < 0 or p_zero >= 1 or sigma <= 0:
            return 1e12
        sse = 0.0
        for q_name, q_val in vals.items():
            p = _QUANTILE_PROBS[q_name]
            pred = _predicted_quantile(p, p_zero, mu, sigma)
            # Use relative squared error for positive values, absolute for zeros
            if q_val > 0:
                sse += ((pred - q_val) / q_val) ** 2
            else:
                sse += (pred / max(vals['p90'], 1)) ** 2
        return sse

    # Optimise
    result = minimize(
        _objective,
        x0=[p_zero_init, mu_init, sigma_init],
        method='Nelder-Mead',
        options={'maxiter': 5000, 'xatol': 1e-6, 'fatol': 1e-10},
    )
    p_zero_fit, mu_fit, sigma_fit = result.x
    p_zero_fit = max(0.0, min(p_zero_fit, 0.999))
    sigma_fit = max(sigma_fit, 0.01)

    # If target_mean provided, adjust mu to match
    # E[X] = (1 - p_zero) * exp(mu + sigma^2/2)
    if target_mean is not None and target_mean > 0 and p_zero_fit < 1.0:
        required_exp = target_mean / (1.0 - p_zero_fit)
        mu_fit = math.log(required_exp) - (sigma_fit ** 2) / 2.0

    # Compute fit quality (RMSE in dollars)
    errors = []
    for q_name, q_val in vals.items():
        p = _QUANTILE_PROBS[q_name]
        pred = _predicted_quantile(p, p_zero_fit, mu_fit, sigma_fit)
        errors.append((pred - q_val) ** 2)
    rmse = math.sqrt(sum(errors) / len(errors))

    calibrated_mean = (1.0 - p_zero_fit) * math.exp(mu_fit + sigma_fit ** 2 / 2.0)

    return {
        'p_zero': round(p_zero_fit, 6),
        'mu': round(mu_fit, 6),
        'sigma': round(sigma_fit, 6),
        'fit_quality': round(rmse, 2),
        'calibrated_mean': round(calibrated_mean, 2),
    }


def sample_income(params: dict, n: int, rng: np.random.Generator) -> np.ndarray:
    """Draw n income samples from a fitted zero-inflated log-normal.

    Args:
        params: dict with 'p_zero', 'mu', 'sigma' (from fit_zero_inflated_lognormal)
        n: number of samples
        rng: numpy random Generator for reproducibility

    Returns:
        Array of n income values (floats, >= 0)
    """
    p_zero = params['p_zero']
    mu = params['mu']
    sigma = params['sigma']

    if p_zero >= 1.0 or n == 0:
        return np.zeros(n)

    # Determine which individuals have zero income
    is_zero = rng.random(n) < p_zero

    # Draw log-normal for non-zero individuals
    incomes = np.zeros(n)
    n_positive = int(np.sum(~is_zero))
    if n_positive > 0:
        incomes[~is_zero] = rng.lognormal(mean=mu, sigma=sigma, size=n_positive)

    return incomes


# ===================================================================
# 3. Age band mapping
# ===================================================================

def get_5yr_band(age: int) -> str:
    """Map an integer age to the Wright & Nguyen 5-year age band string."""
    if age >= 80:
        return "80+"
    lower = (age // 5) * 5
    return f"{lower}-{lower + 4}"


def get_10yr_bin(age: int) -> int:
    """Map an integer age to the Hughes 10-year age_start bin."""
    if age >= 100:
        return 100
    return (age // 10) * 10


# ===================================================================
# 4. Wright & Nguyen fiscal template lookup
# ===================================================================

def load_wn_template() -> tuple[dict, dict]:
    """Load Wright & Nguyen fiscal template and return (components, nfi) dicts.

    Returns:
        fiscal_components: {age_band: {component_name: value, ...}, ...}
        nfi_by_band: {age_band: {net_fiscal_impact, direct_taxes, ...}, ...}
    """
    wn_data = load_json("wright-nguyen-fiscal-template.json")
    fiscal_components = {}
    for r in wn_data['fiscal_components']:
        fiscal_components[r['age_band']] = r['components']
    nfi_by_band = {}
    for r in wn_data['net_fiscal_impact']:
        nfi_by_band[r['age_band']] = r
    return fiscal_components, nfi_by_band


def get_wn_components(age: int, fiscal_components: dict) -> dict:
    """Look up Wright & Nguyen fiscal components for a given integer age.

    Args:
        age: integer age (0-85+)
        fiscal_components: dict from load_wn_template()

    Returns:
        dict of fiscal component values for the matching 5-year band,
        or empty dict if band not found.
    """
    band = get_5yr_band(age)
    return fiscal_components.get(band, {})


def get_wn_nfi(age: int, nfi_by_band: dict) -> float:
    """Look up base net fiscal impact for a given age."""
    band = get_5yr_band(age)
    rec = nfi_by_band.get(band)
    return rec['net_fiscal_impact'] if rec else 0.0


# ===================================================================
# 5. Migrant eligibility adjustments
# ===================================================================

def is_resident_visa(visa_code: str) -> bool:
    """Check if a visa subcategory code is a resident visa."""
    return visa_code in RESIDENT_VISA_CODES


def apply_migrant_adjustments(
    components: dict,
    visa_code: str,
    years_resident: int,
    age: int,
) -> float:
    """Compute fiscal SAVINGS for a migrant relative to NZ population average.

    Replicates the logic from Phase 1 (07-build-matching-npv.py).
    Returns a positive number = saving to Crown = amount subtracted from NFI.

    Adjustments:
        1. NZ Super: zero if < 10yr residence or < age 65
        2. WFF: zero for temp visa holders
        3. Working-age support: zero for temp, 50% for first 2 years
        4. Housing support: zero for temp, 50% for first 2 years
        5. Health: 85% of NZ average (healthy migrant effect)
        6. Other income support: zero for temp visa holders
    """
    resident = is_resident_visa(visa_code)
    adjustments = 0.0

    # 1. NZ Super
    base_nz_super = components.get('nz_super', 0)
    if base_nz_super > 0:
        if years_resident < NZ_SUPER_RESIDENCE_YEARS or age < NZ_SUPER_AGE:
            adjustments += base_nz_super

    # 2. WFF
    base_wff = components.get('wff', 0)
    if base_wff > 0 and not resident:
        adjustments += base_wff

    # 3. Working-age support
    base_wa = components.get('working_age_support', 0)
    if base_wa > 0:
        if not resident:
            adjustments += base_wa
        elif years_resident < BENEFIT_STANDOWN_YEARS:
            adjustments += base_wa * BENEFIT_STANDOWN_FACTOR

    # 4. Housing support
    base_housing = components.get('housing_support', 0)
    if base_housing > 0:
        if not resident:
            adjustments += base_housing
        elif years_resident < BENEFIT_STANDOWN_YEARS:
            adjustments += base_housing * BENEFIT_STANDOWN_FACTOR

    # 5. Health: 85% of NZ average
    base_health = components.get('health_spending', 0)
    if base_health > 0:
        adjustments += base_health * (1.0 - HEALTHY_MIGRANT_HEALTH_FACTOR)

    # 6. Other income support (temp visa only)
    if not resident:
        for key in ['other_income_support', 'paid_parental_leave', 'student_allowance']:
            adjustments += components.get(key, 0)

    return adjustments


# ===================================================================
# 6. Retention curves
# ===================================================================

def load_retention_data() -> tuple[dict, dict]:
    """Load retention curves and extrapolation fits.

    Returns:
        retention_actual: {visa_code: {years: rate, ...}, ...}
        retention_fits: {visa_code: {'a': float, 'b': float}, ...}
    """
    data = load_json("retention-curves-by-visa.json")
    actual = {}
    for r in data['retention_curves']:
        visa = r['first_visa']
        yr = r['years_since_arrival']
        actual.setdefault(visa, {})[yr] = r['retention_rate']
    fits = {}
    for fit in data['extrapolation_fits']:
        fits[fit['first_visa']] = {'a': fit['a'], 'b': fit['b']}
    return actual, fits


def get_retention(
    visa_code: str,
    years_since_arrival: int,
    retention_actual: dict,
    retention_fits: dict,
) -> float:
    """Get probability of still being in NZ after given years.

    Uses actual data where available, exponential decay extrapolation beyond.
    NZ-born always returns 1.0.
    """
    if visa_code == 'NZ-born':
        return 1.0

    # Try actual data first
    if visa_code in retention_actual:
        actual = retention_actual[visa_code]
        if years_since_arrival in actual:
            return actual[years_since_arrival]

    # Extrapolate using exponential decay fit: retention = a * exp(-b * t)
    if visa_code in retention_fits:
        fit = retention_fits[visa_code]
        a, b = fit['a'], fit['b']
        if b == 0:
            return a
        return max(a * math.exp(-b * years_since_arrival), 0.0)

    # Fallback: assume stays (conservative for fiscal impact)
    return 1.0


# ===================================================================
# 7. Individual lifecycle NPV computation
# ===================================================================

def compute_individual_npv(
    arrival_age: int,
    visa_code: str,
    gross_income: float,
    retention_actual: dict,
    retention_fits: dict,
    fiscal_components: dict,
    nfi_by_band: dict,
    nzborn_mean_tax: dict,
    discount_rate: float = DISCOUNT_RATE,
    max_age: int = MAX_AGE,
) -> float:
    """Compute lifecycle NPV for a single synthetic individual.

    This is the individual-level analogue of Phase 1's compute_npv().
    Key difference: instead of applying a group-level tax premium,
    we compute the individual's actual PAYE tax and compare to the
    NZ-born mean to get their personal tax premium.

    Args:
        arrival_age: age at arrival in NZ
        visa_code: Hughes visa subcategory code
        gross_income: annual gross income at arrival (from fitted distribution)
        retention_actual: actual retention data (from load_retention_data)
        retention_fits: extrapolation fits (from load_retention_data)
        fiscal_components: W&N components (from load_wn_template)
        nfi_by_band: W&N NFI by band (from load_wn_template)
        nzborn_mean_tax: {age_start: mean_per_capita_tax} for NZ-born
        discount_rate: annual discount rate (default 3.5%)
        max_age: maximum age for projection (default 85)

    Returns:
        NPV in dollars (negative = net contributor to Crown)
    """
    npv = 0.0

    for t in range(0, max_age - arrival_age + 1):
        age = arrival_age + t
        band = get_5yr_band(age)
        hughes_age = get_10yr_bin(age)

        # Base NFI from W&N
        nfi_rec = nfi_by_band.get(band)
        if nfi_rec is None:
            continue
        base_nfi = nfi_rec['net_fiscal_impact']

        # Retention probability
        p_here = get_retention(visa_code, t, retention_actual, retention_fits)

        # Individual tax premium: their PAYE+ACC vs NZ-born mean
        individual_tax = compute_total_tax(gross_income)
        nzborn_tax = nzborn_mean_tax.get(hughes_age, 0)
        premium = individual_tax - nzborn_tax

        # Eligibility savings
        comp = fiscal_components.get(band, {})
        adjustment_savings = apply_migrant_adjustments(comp, visa_code, t, age)

        # Migrant NFI = base - premium - savings
        migrant_nfi = base_nfi - premium - adjustment_savings

        # Discount and weight by retention
        discount = 1.0 / ((1.0 + discount_rate) ** t)
        npv += p_here * migrant_nfi * discount

    return round(npv)


# ===================================================================
# Self-test
# ===================================================================

if __name__ == '__main__':
    print("=" * 60)
    print("synth-pop/utils.py — self-test")
    print("=" * 60)

    # --- Test 1: PAYE calculator ---
    print("\n--- Test 1: PAYE calculator ---")
    test_cases = [
        (0, 0.0),
        (14_000, 1_470.0),      # 14000 × 10.5%
        (48_000, 7_420.0),      # 1470 + 34000 × 17.5%
        (50_000, 8_020.0),      # 7420 + 2000 × 30%
        (70_000, 14_020.0),     # 7420 + 22000 × 30%
        (100_000, 23_920.0),    # 14020 + 30000 × 33%
        (180_000, 50_320.0),    # 14020 + 110000 × 33%
        (200_000, 58_120.0),    # 50320 + 20000 × 39%
    ]
    all_pass = True
    for income, expected in test_cases:
        actual = compute_paye(income)
        ok = abs(actual - expected) < 1.0
        status = "✓" if ok else "✗"
        print(f"  {status} PAYE(${income:>9,}) = ${actual:>10,.2f}  (expected ${expected:,.2f})")
        if not ok:
            all_pass = False
    assert all_pass, "PAYE calculator tests failed"

    # --- Test 2: ACC levy ---
    print("\n--- Test 2: ACC levy ---")
    assert abs(compute_acc_levy(50_000) - 800.0) < 0.01
    assert compute_acc_levy(0) == 0.0
    print("  ✓ ACC levy tests passed")

    # --- Test 3: Age band mappers ---
    print("\n--- Test 3: Age band mappers ---")
    assert get_5yr_band(0) == '0-4'
    assert get_5yr_band(32) == '30-34'
    assert get_5yr_band(79) == '75-79'
    assert get_5yr_band(80) == '80+'
    assert get_5yr_band(95) == '80+'
    assert get_10yr_bin(0) == 0
    assert get_10yr_bin(35) == 30
    assert get_10yr_bin(99) == 90
    assert get_10yr_bin(100) == 100
    print("  ✓ Age band mapper tests passed")

    # --- Test 4: Log-normal fitter ---
    print("\n--- Test 4: Zero-inflated log-normal fitter ---")

    # 4a: All positive quantiles (typical working-age migrant)
    test_q = {'p10': 5000, 'p25': 12000, 'p50': 18000, 'p75': 28000, 'p90': 40000}
    params = fit_zero_inflated_lognormal(test_q)
    print(f"  Fit (no zeros): p_zero={params['p_zero']:.4f}, mu={params['mu']:.3f}, "
          f"sigma={params['sigma']:.3f}, RMSE=${params['fit_quality']:,.0f}")
    assert params['p_zero'] < 0.10, f"p_zero should be < 0.10, got {params['p_zero']}"
    assert params['fit_quality'] < 5000, f"RMSE too high: {params['fit_quality']}"

    # 4b: With zero p10 (some non-earners)
    test_q2 = {'p10': 0, 'p25': 3000, 'p50': 12000, 'p75': 22000, 'p90': 35000}
    params2 = fit_zero_inflated_lognormal(test_q2)
    print(f"  Fit (p10=0):    p_zero={params2['p_zero']:.4f}, mu={params2['mu']:.3f}, "
          f"sigma={params2['sigma']:.3f}, RMSE=${params2['fit_quality']:,.0f}")
    assert 0.05 <= params2['p_zero'] <= 0.30, f"p_zero should be ~0.10-0.25, got {params2['p_zero']}"

    # 4c: All zeros
    test_q3 = {'p10': 0, 'p25': 0, 'p50': 0, 'p75': 0, 'p90': 0}
    params3 = fit_zero_inflated_lognormal(test_q3)
    print(f"  Fit (all zero): p_zero={params3['p_zero']:.4f}")
    assert params3['p_zero'] == 1.0

    # 4d: With target mean calibration
    test_q4 = {'p10': 8000, 'p25': 15000, 'p50': 25000, 'p75': 40000, 'p90': 60000}
    target = 30000
    params4 = fit_zero_inflated_lognormal(test_q4, target_mean=target)
    print(f"  Fit (mean cal):  p_zero={params4['p_zero']:.4f}, mu={params4['mu']:.3f}, "
          f"sigma={params4['sigma']:.3f}, cal_mean=${params4['calibrated_mean']:,.0f} (target=${target:,})")
    assert abs(params4['calibrated_mean'] - target) < target * 0.05, \
        f"Calibrated mean {params4['calibrated_mean']} too far from target {target}"

    # --- Test 5: Sampler ---
    print("\n--- Test 5: Income sampler ---")
    rng = np.random.default_rng(42)
    samples = sample_income(params, 10_000, rng)
    sample_mean = np.mean(samples)
    sample_p50 = np.median(samples)
    print(f"  10k samples: mean=${sample_mean:,.0f}, median=${sample_p50:,.0f}, "
          f"zeros={np.sum(samples == 0)}")
    # Sample mean should be in the right ballpark
    assert sample_mean > 5000, f"Sample mean too low: {sample_mean}"
    assert sample_mean < 100000, f"Sample mean too high: {sample_mean}"

    # Sampling from all-zero distribution
    zero_samples = sample_income(params3, 100, rng)
    assert np.all(zero_samples == 0), "All-zero distribution should produce all zeros"
    print("  ✓ Sampler tests passed")

    # --- Test 6: Migrant adjustments ---
    print("\n--- Test 6: Migrant adjustments ---")
    # Mock components (roughly like age 65-69 W&N band)
    mock_comp = {
        'nz_super': 15000, 'wff': 0, 'working_age_support': 500,
        'housing_support': 200, 'health_spending': 6000,
        'other_income_support': 100, 'paid_parental_leave': 0, 'student_allowance': 0,
    }
    # Resident, year 0, age 30: no super (age < 65), benefit standown, health adj
    adj1 = apply_migrant_adjustments(mock_comp, 'R.Family', 0, 30)
    expected_adj1 = 15000 + 500 * 0.5 + 200 * 0.5 + 6000 * 0.15  # super + standown + health
    assert abs(adj1 - expected_adj1) < 1.0, f"Adj1: expected {expected_adj1}, got {adj1}"
    print(f"  ✓ Resident yr0 age 30: savings = ${adj1:,.0f}")

    # Temp visa, year 5, age 70: no super (< 10yr), no WFF, no benefits, health adj
    adj2 = apply_migrant_adjustments(mock_comp, 'W.Working holiday', 5, 70)
    expected_adj2 = 15000 + 500 + 200 + 6000 * 0.15 + 100  # super + all support + health + other
    assert abs(adj2 - expected_adj2) < 1.0, f"Adj2: expected {expected_adj2}, got {adj2}"
    print(f"  ✓ Temp visa yr5 age 70: savings = ${adj2:,.0f}")

    # Resident, year 15, age 70: HAS super (> 10yr, > 65), health adj only
    adj3 = apply_migrant_adjustments(mock_comp, 'R.Family', 15, 70)
    expected_adj3 = 6000 * 0.15  # health only (super eligibility met)
    assert abs(adj3 - expected_adj3) < 1.0, f"Adj3: expected {expected_adj3}, got {adj3}"
    print(f"  ✓ Resident yr15 age 70: savings = ${adj3:,.0f}")

    print("\n" + "=" * 60)
    print("All tests passed.")
    print("=" * 60)
