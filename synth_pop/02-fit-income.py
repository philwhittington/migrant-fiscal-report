#!/usr/bin/env python3
"""
P8.2 — Fit zero-inflated log-normal INCOME distributions.

Converts Hughes Table 5 tax quantiles (PAYE) to gross income quantiles
using inverse PAYE, fits zero-inflated log-normal distributions to the
income quantiles, then calibrates mu so that E[PAYE(sampled_income)]
matches Table 4 per-capita mean tax.

Key design decision: Table 5 provides TAX quantiles, but downstream P8.4
treats sample_income() output as gross_income and applies compute_paye().
We invert here so the distribution represents income, not tax.

Author: Heuser|Whittington analytical agent
Date: 2026-04-08
"""

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy.stats import norm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from synth_pop.config import TAX_YEAR, PAYE_BRACKETS, ACC_LEVY_RATE
from synth_pop.utils import (
    fit_zero_inflated_lognormal, sample_income, compute_paye,
)


# ------------------------------------------------------------------
# Inverse PAYE: given tax, return gross income
# ------------------------------------------------------------------
# Precompute cumulative PAYE at each bracket boundary
_INV_BRACKETS = []  # (income_lower, paye_rate, cumulative_paye_at_lower, cumulative_paye_at_upper)
_cum = 0.0
_prev = 0.0
for _thresh, _rate in PAYE_BRACKETS:
    _upper_paye = _cum + (_thresh - _prev) * _rate if _thresh < float('inf') else float('inf')
    _INV_BRACKETS.append((_prev, _rate, _cum, _upper_paye))
    if _thresh < float('inf'):
        _cum = _upper_paye
        _prev = _thresh


def inverse_paye(paye_tax):
    """Given PAYE income tax, return gross income. Exact closed-form inverse."""
    if paye_tax <= 0:
        return 0.0
    for inc_lower, rate, paye_at_lower, paye_at_upper in _INV_BRACKETS:
        if paye_tax <= paye_at_upper:
            return inc_lower + (paye_tax - paye_at_lower) / rate
    # Last bracket (should not normally reach here)
    last = _INV_BRACKETS[-1]
    return last[0] + (paye_tax - last[2]) / last[1]


def compute_paye_vectorized(incomes):
    """Vectorized PAYE for numpy array of incomes."""
    incomes = np.maximum(incomes, 0.0)
    tax = np.zeros_like(incomes, dtype=np.float64)
    prev = 0.0
    for threshold, rate in PAYE_BRACKETS:
        if threshold == float('inf'):
            bracket = np.maximum(incomes - prev, 0.0)
        else:
            bracket = np.clip(incomes, prev, threshold) - prev
        tax += bracket * rate
        prev = threshold
    return tax


# ------------------------------------------------------------------
# Constants and R² computation
# ------------------------------------------------------------------
_QPROBS = {'p10': 0.10, 'p25': 0.25, 'p50': 0.50, 'p75': 0.75, 'p90': 0.90}
_Q_ORDER = ['p10', 'p25', 'p50', 'p75', 'p90']

# De minimis: tax values below this are treated as zero.
# $100 in annual tax ≈ $950 annual income — effectively "not working".
DE_MINIMIS_TAX = 100

# Cap sigma to prevent extreme right tails that produce nonsensical means.
# sigma=2.5 → mean/median ratio of exp(3.125) ≈ 23x. Already very skewed.
SIGMA_CAP = 2.5

# Cap mu during calibration to prevent income distribution explosion.
MU_CAP = 14.0  # exp(14) ≈ $1.2M median — no migrant group is this high


def _predicted_quantile(p, p_zero, mu, sigma):
    """Predicted quantile for zero-inflated log-normal."""
    if p <= p_zero:
        return 0.0
    adj_p = (p - p_zero) / (1.0 - p_zero)
    adj_p = max(min(adj_p, 0.9999), 0.0001)
    return math.exp(mu + sigma * norm.ppf(adj_p))


def compute_r2_tax(p_zero, mu, sigma, tax_quantiles):
    """R² of predicted PAYE(income) vs actual tax quantiles.

    Evaluates fit quality in the original data space (tax),
    which is more robust than income space for edge cases.
    """
    actual = [tax_quantiles[q] for q in _Q_ORDER]
    predicted_inc = [_predicted_quantile(_QPROBS[q], p_zero, mu, sigma)
                     for q in _Q_ORDER]
    predicted_tax = [compute_paye(inc) for inc in predicted_inc]
    ss_res = sum((a - p) ** 2 for a, p in zip(actual, predicted_tax))
    mean_a = sum(actual) / len(actual)
    ss_tot = sum((a - mean_a) ** 2 for a in actual)
    if ss_tot == 0:
        return 1.0  # all-zero cell
    return max(0.0, 1.0 - ss_res / ss_tot)


# ------------------------------------------------------------------
# Mean PAYE calibration via binary search on mu
# ------------------------------------------------------------------
def calibrate_mu(p_zero, mu_init, sigma, target_mean_tax,
                 n_samples=20_000, max_iter=25, tol=0.005):
    """Adjust mu so E[PAYE(sample)] ≈ target_mean_tax via binary search.

    Uses fixed random draws for consistency across iterations.
    Caps mu at MU_CAP to prevent distribution explosion.
    """
    sigma = min(sigma, SIGMA_CAP)
    rng = np.random.default_rng(seed=99999)
    u_zero = rng.random(n_samples)
    z_norm = rng.standard_normal(n_samples)
    is_positive = u_zero >= p_zero
    z_pos = z_norm[is_positive]

    if len(z_pos) == 0:
        return mu_init  # all zero — nothing to calibrate

    def mean_paye(mu_test):
        incomes = np.zeros(n_samples)
        incomes[is_positive] = np.exp(mu_test + sigma * z_pos)
        return float(np.mean(compute_paye_vectorized(incomes)))

    # Set initial bracket, respecting MU_CAP
    mu_lo = max(mu_init - 4.0, 0.0)
    mu_hi = min(mu_init + 4.0, MU_CAP)

    paye_lo = mean_paye(mu_lo)
    paye_hi = mean_paye(mu_hi)

    # Expand bracket if needed (but respect caps)
    while paye_hi < target_mean_tax and mu_hi < MU_CAP:
        mu_hi = min(mu_hi + 1.0, MU_CAP)
        paye_hi = mean_paye(mu_hi)
        if mu_hi >= MU_CAP:
            break
    while paye_lo > target_mean_tax and mu_lo > 0:
        mu_lo = max(mu_lo - 1.0, 0.0)
        paye_lo = mean_paye(mu_lo)
        if mu_lo <= 0:
            break

    # Binary search
    for _ in range(max_iter):
        mu_mid = (mu_lo + mu_hi) / 2.0
        paye_mid = mean_paye(mu_mid)
        if target_mean_tax > 0:
            rel_err = (paye_mid - target_mean_tax) / target_mean_tax
        else:
            break
        if abs(rel_err) < tol:
            return mu_mid
        if paye_mid > target_mean_tax:
            mu_hi = mu_mid
        else:
            mu_lo = mu_mid

    return min((mu_lo + mu_hi) / 2.0, MU_CAP)


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
def main():
    print("=" * 60)
    print("P8.2 — Fit income distributions")
    print("=" * 60)

    # ---- Step 1: Load Table 5 ----
    with open('data/processed/hughes-table5-visa-quantiles.json') as f:
        table5 = json.load(f)
    q2019 = [r for r in table5 if r['taxyr'] == TAX_YEAR]
    print(f"Table 5: {len(q2019)} quantile records for {TAX_YEAR}")

    # ---- Step 2: Pivot ----
    cells = defaultdict(dict)
    for r in q2019:
        key = f"{r['visa_category']}|{r['age_start']}"
        cells[key][r['quantile']] = r['tax_dollars']
        cells[key]['count'] = r['count']
        cells[key]['visa_category'] = r['visa_category']
        cells[key]['age_start'] = r['age_start']
    print(f"Unique cells: {len(cells)}")

    # ---- Step 3: Table 4 per-capita mean tax ----
    with open('data/processed/hughes-table4-visa-subcategory.json') as f:
        table4 = json.load(f)
    t4_agg = defaultdict(lambda: {'tax': 0.0, 'count': 0})
    for r in table4:
        if r['year'] == TAX_YEAR and r['age_start'] is not None:
            key = f"{r['visa_category']}|{r['age_start']}"
            t4_agg[key]['tax'] += r['tax_billions'] * 1e9
            t4_agg[key]['count'] += r['count']
    t4_means = {}
    for key, v in t4_agg.items():
        t4_means[key] = v['tax'] / v['count'] if v['count'] > 0 else 0
    print(f"Table 4 aggregated: {len(t4_means)} cells")

    # Verify inverse PAYE
    for test_tax, expected_inc in [(0, 0), (1470, 14_000), (7420, 48_000),
                                    (14_020, 70_000), (50_320, 180_000)]:
        actual = inverse_paye(test_tax)
        assert abs(actual - expected_inc) < 1.0, \
            f"inverse_paye({test_tax}) = {actual}, expected {expected_inc}"
    print("Inverse PAYE verified ✓")

    # ---- Step 4: Fit distributions ----
    results = {}
    print(f"\nFitting {len(cells)} cells...")

    for idx, (key, cell) in enumerate(sorted(cells.items())):
        tax_qs = {q: cell[q] for q in _Q_ORDER}
        target_mean_tax = t4_means.get(key, 0)

        # De minimis cleaning: tax < $100 treated as zero
        clean_tax = {q: (v if v >= DE_MINIMIS_TAX else 0.0) for q, v in tax_qs.items()}

        # Convert cleaned tax quantiles → income quantiles
        income_qs = {q: inverse_paye(v) for q, v in clean_tax.items()}

        # Count positive quantiles after de minimis
        n_positive = sum(1 for v in income_qs.values() if v > 0)

        if n_positive == 0:
            # All zero — trivial case
            p_zero, mu, sigma = 1.0, 0.0, 1.0

        elif n_positive == 1:
            # One positive quantile — manual parameter setting, no calibration.
            # These cells are edge cases (teens, retirees, visitors) with
            # negligible fiscal contribution.
            pos_q = [(q, income_qs[q]) for q in _Q_ORDER if income_qs[q] > 0][0]
            q_name, q_val = pos_q
            q_prob = _QPROBS[q_name]

            # p_zero: midpoint between last zero and first positive quantile prob
            zero_probs = [_QPROBS[q] for q in _Q_ORDER if income_qs[q] == 0]
            p_zero = (max(zero_probs) + q_prob) / 2.0

            sigma = 0.8  # reasonable default
            adj_p = max((q_prob - p_zero) / (1.0 - p_zero), 0.01)
            mu = math.log(max(q_val, 1.0)) - sigma * norm.ppf(adj_p)

        elif n_positive == 2:
            # Two positive quantiles — determine mu and sigma analytically.
            # No mean calibration: the quantile-determined parameters define
            # the distribution. For high-sigma cells (teens with bimodal income),
            # a single log-normal can't match both quantiles AND the mean.
            # We prioritise quantile accuracy and accept mean deviation.
            pos_qs = [(q, income_qs[q]) for q in _Q_ORDER if income_qs[q] > 0]
            zero_probs = [_QPROBS[q] for q in _Q_ORDER if income_qs[q] == 0]
            p_zero = max(zero_probs) if zero_probs else 0.0

            q1_name, q1_val = pos_qs[0]
            q2_name, q2_val = pos_qs[1]
            adj_p1 = max((_QPROBS[q1_name] - p_zero) / (1.0 - p_zero), 0.01)
            adj_p2 = max((_QPROBS[q2_name] - p_zero) / (1.0 - p_zero), 0.01)
            z1, z2 = norm.ppf(adj_p1), norm.ppf(adj_p2)

            if abs(z2 - z1) > 0.01 and q1_val > 0 and q2_val > 0:
                sigma_raw = (math.log(q2_val) - math.log(q1_val)) / (z2 - z1)
                sigma = max(min(sigma_raw, SIGMA_CAP), 0.1)
                # Set mu to match the HIGHER quantile (p90).
                # This is more important for R² (dominates ss_tot) and
                # for fiscal impact (captures the earning tail).
                mu = math.log(q2_val) - sigma * z2
            else:
                mu = math.log(max(q2_val, 1.0))
                sigma = 0.8

        else:
            # ≥3 positive quantiles — use the optimizer + mean calibration
            params = fit_zero_inflated_lognormal(income_qs, target_mean=None)
            p_zero = params['p_zero']
            mu = params['mu']
            sigma = min(params['sigma'], SIGMA_CAP)

            # Mean PAYE calibration only for well-constrained cells
            if target_mean_tax > 100 and p_zero < 1.0 and sigma > 0:
                mu = calibrate_mu(p_zero, mu, sigma, target_mean_tax)

        # Fit quality: R² of predicted PAYE vs source tax quantiles
        r2 = compute_r2_tax(p_zero, mu, min(sigma, SIGMA_CAP), tax_qs)

        results[key] = {
            'visa_category': cell['visa_category'],
            'age_start': cell['age_start'],
            'p_zero': round(p_zero, 6),
            'mu': round(mu, 6),
            'sigma': round(min(sigma, SIGMA_CAP), 6),
            'fit_quality': round(r2, 4),
            'calibration_mean': round(target_mean_tax, 2),
            'source_quantiles': tax_qs,
            'count': cell['count'],
        }

        if (idx + 1) % 20 == 0:
            print(f"  ... {idx + 1}/{len(cells)} cells fitted")

    # ---- Step 5: Save ----
    output_path = Path('synth_pop/income-distributions.json')
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved {len(results)} cells → {output_path}")

    # ---- Summary ----
    fit_qs = [r['fit_quality'] for r in results.values()]
    all_zero = sum(1 for r in results.values() if r['p_zero'] >= 1.0)
    high_q = sum(1 for q in fit_qs if q > 0.8)
    pct_high = 100 * high_q / len(results)

    print(f"\nSummary:")
    print(f"  All-zero cells: {all_zero}")
    print(f"  R² > 0.8: {high_q}/{len(results)} ({pct_high:.1f}%)")
    print(f"  Mean R²: {np.mean(fit_qs):.4f}")
    print(f"  Min R²: {min(fit_qs):.4f}")

    # 5 worst fits
    print(f"\n5 worst-fitting cells:")
    worst = sorted(results.items(), key=lambda x: x[1]['fit_quality'])
    for key, r in worst[:5]:
        print(f"  {key}: R²={r['fit_quality']:.4f}, p_zero={r['p_zero']:.3f}, "
              f"mu={r['mu']:.2f}, sigma={r['sigma']:.2f}, cal_tax=${r['calibration_mean']:,.0f}")

    # 5 best non-trivial fits
    print(f"\n5 best non-trivial fits:")
    best = [x for x in sorted(results.items(), key=lambda x: -x[1]['fit_quality'])
            if x[1]['p_zero'] < 1.0]
    for key, r in best[:5]:
        print(f"  {key}: R²={r['fit_quality']:.4f}, p_zero={r['p_zero']:.3f}, "
              f"mu={r['mu']:.2f}, sigma={r['sigma']:.2f}")

    # ---- Self-check ----
    print(f"\n{'='*60}")
    print("Self-check: sample-based validation")
    print(f"{'='*60}")

    rng = np.random.default_rng(42)
    N = 10_000
    q_violations = 0
    mean_violations = 0
    mean_violation_details = []
    param_violations = 0

    for key, r in sorted(results.items()):
        p = {'p_zero': r['p_zero'], 'mu': r['mu'], 'sigma': r['sigma']}
        samples = sample_income(p, N, rng)

        # Quantile accuracy: compare PAYE of sampled income to source tax quantiles
        sample_paye_for_q = compute_paye_vectorized(samples)
        tax_source = r['source_quantiles']
        for q_name, pct in [('p10', 10), ('p25', 25), ('p50', 50), ('p75', 75), ('p90', 90)]:
            actual = tax_source[q_name]
            sample_val = float(np.percentile(sample_paye_for_q, pct))
            if actual > 0:
                if abs(sample_val - actual) / actual > 0.05 and abs(sample_val - actual) > 200:
                    q_violations += 1
            else:
                if sample_val > 200:
                    q_violations += 1

        # Mean PAYE calibration
        cal_tax = r['calibration_mean']
        if cal_tax > 1000:
            sample_paye = compute_paye_vectorized(samples)
            sample_mean_tax = float(np.mean(sample_paye))
            err = abs(sample_mean_tax - cal_tax) / cal_tax
            if err > 0.10:
                mean_violations += 1
                mean_violation_details.append((key, cal_tax, sample_mean_tax, err))

        # Parameter sanity
        if not (0 <= r['p_zero'] <= 1):
            param_violations += 1
        if r['sigma'] <= 0 and r['p_zero'] < 1.0:
            param_violations += 1

    total_qs = len(results) * 5
    print(f"  Quantile violations (>5% AND >$200): {q_violations}/{total_qs}")
    print(f"  Mean tax violations (>10%): {mean_violations}/{len(results)}")
    print(f"  Parameter violations: {param_violations}/{len(results)}")

    if mean_violation_details:
        print(f"\n  Mean tax violation details:")
        for key, target, actual, err in sorted(mean_violation_details, key=lambda x: -x[3])[:5]:
            print(f"    {key}: target=${target:,.0f}, sample=${actual:,.0f}, err={100*err:.1f}%")

    print(f"\n  Fit quality gate: {pct_high:.1f}% cells with R² > 0.8 (need ≥90%)")
    if pct_high >= 90:
        print("  ✓ PASSED")
    else:
        print("  ✗ FAILED — investigate low-R² cells")

    # Show sample distributions for key cells
    print(f"\n{'='*60}")
    print("Sample distributions for key cells")
    print(f"{'='*60}")
    rng2 = np.random.default_rng(123)
    for key in ['Resident|30', 'Student|20', 'Australian|30', 'Non-residential work|30',
                'Permanent Resident|30', 'Birth Citizen|30']:
        if key not in results:
            continue
        r = results[key]
        p = {'p_zero': r['p_zero'], 'mu': r['mu'], 'sigma': r['sigma']}
        s = sample_income(p, 20_000, rng2)
        paye_s = compute_paye_vectorized(s)
        print(f"\n  {key} (n={r['count']:,}):")
        print(f"    Params: p_zero={r['p_zero']:.3f}, mu={r['mu']:.2f}, sigma={r['sigma']:.2f}, R²={r['fit_quality']:.3f}")
        print(f"    Income: mean=${np.mean(s):,.0f}, median=${np.median(s):,.0f}, "
              f"p10=${np.percentile(s,10):,.0f}, p90=${np.percentile(s,90):,.0f}")
        print(f"    PAYE:   mean=${np.mean(paye_s):,.0f} (target=${r['calibration_mean']:,.0f})")


if __name__ == '__main__':
    main()
