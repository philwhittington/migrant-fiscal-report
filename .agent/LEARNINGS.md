# Build learnings -- migrant fiscal impact report

Generated: 2026-04-01

## What worked well

- **Orchestrated invocations model.** Running one Claude CLI call per task (P1.1, P1.2, etc.) with a shared scratchpad gave clean separation of concerns. Each agent read SCRATCHPAD.md, did its work, and appended its notes. No cross-task interference.
- **Self-contained widget pattern.** Each widget is a single `.tsx` file with its own data fetch, loading/error states, and SVG rendering. No shared chart library to coordinate. Code-splitting via lazy imports works automatically.
- **Data pipeline discipline.** Python scripts write to `data/processed/` or `data/output/`; `generate-static-data.ts` copies to `client/public/data/`. Clear separation of raw → processed → widget-ready JSON.
- **Automated fact-checking (P5.1).** Checking 116 numerical claims against source data caught 2 rounding errors that would have survived human review. The 109 exact/within-rounding matches give high confidence in the remaining prose.
- **Retention curve extrapolation.** Exponential decay fit on years 10-18 of actual cohort data (R² > 0.93 for all visa types except WHV) provides a defensible basis for projecting retention to age 65+. The WHV flat-curve exception was correctly detected and handled with a constant rate.

## What was difficult

- **Hughes xlsx extraction.** The 19MB workbook has 24 tables with inconsistent layouts. Each table needed a custom extraction script. Table 14 vs Table 16 distinction (aggregated vs detailed visa types) was only discovered during extraction — the task spec assumed Table 14 had detailed types.
- **Tax unit conventions.** Table 4 uses `measure_type2 = 'tax_b'` (billions), Table 5 uses `'tax'` (dollars). Getting the mean vs median distinction right for fiscal impact (mean is correct; median understates high earners) required careful analysis.
- **Sign convention.** The NPV model uses negative = net contributor (government perspective). The report and widgets flip signs for readability. This created opportunities for confusion at every handoff point.
- **Large processed data files.** Tables 14, 142, and 16 total ~29MB as JSON. These are deployed to `dist/` but not fetched by any widget. A future optimisation would exclude them from the build output.
- **Section 1 gap.** The introduction section was never written — it fell between task scopes (P2.1 created the structure, P2.2-P2.4 wrote specific sections, but Section 1 was not assigned). This is a process gap, not a technical one.

## Quality issues found and resolved

| Phase | Issue | Resolution |
|-------|-------|------------|
| P1.7 (NPV model) | Table 5 p50 premium for "Resident" was only +$412 — diluted by lumping Skilled+Family+Humanitarian | Switched to Table 4 per-capita mean by visa subcategory. R.Skilled premium = +$2,292 (5x larger and methodologically correct) |
| P1.4 (retention) | WHV exponential decay fit has b≈0 and R²≈0 — curve is flat, not decaying | Used constant retention rate (~33%) for WHV beyond year 10 |
| P1.4 (retention) | Table 16 has 38% suppression rate | Averaged across 20 cohort years to mitigate small-cell issues |
| P3.5 (waterfall) | Student income_support = -$710 (negative spending) | Handled edge case: negative spending steps UP in waterfall chart |
| P5.1 (data QA) | "$0.6 billion" for non-resident workers should be "$0.5 billion" (data shows $0.53B) | Corrected in P5.4 |
| P5.1 (data QA) | Philippines "161%" should be "160%" (ratio=1.6046 rounds to 160.5%) | Corrected in P5.4 |
| P5.2 (prose QA) | 7 vague qualifiers ("substantial" x3, "most" x2, "many" x2) | Replaced with precise language or specific numbers |
| P5.2 (prose QA) | 1 advocacy phrase ("broadly effective") | Replaced with descriptive language ("produce net positive fiscal outcomes") |

## Outstanding items for human review

These items require Phil's judgment and cannot be resolved by automated QA:

1. **Section 1 (Introduction and motivation) is a placeholder.** Line 17 of `content/migrant-fiscal-impact.md` contains only an HTML comment with writing instructions. Phil should write this section or restructure the report to begin directly with the executive summary.

2. **Immigration NZ citation.** The 165,000 RV2021 eligibility figure (Section 5) cites "Immigration New Zealand" but no corresponding entry appears in the References section. Phil should add a formal reference (e.g., the INZ press release or policy page).

3. **Volume/value decomposition (Section 3).** The claim that "roughly 60% of the tax share increase is attributable to the growing number of foreign-born taxpayers (the volume effect), with the remaining 40% driven by their rising per-capita contributions" is not independently verified from source data. It would require a Shapley-value decomposition. Phil should verify this decomposition or soften to an approximation.

4. **Healthy migrant assumption.** The model applies 85% of NZ-average health expenditure for migrants. This is based on international health literature, not NZ-specific data. Phil should confirm this is a defensible assumption for the NZ context.

5. **Family NPV and children.** The Family visa NPV currently uses population-average education expenditure. It does not separately account for children brought under family reunification, who would add education costs in early years. Phil should note this caveat or adjust the estimate.

6. **Two "broadly consistent" phrasings.** Section 5 line 148 and Section 9 line 260 use "broadly consistent" — appropriate hedging for approximate calculations, but Phil may prefer to make the arithmetic explicit or remove the qualifier.

7. **Large processed data files (~29MB).** Tables 14, 142, and 16 are deployed to the static site but never fetched by any widget. Consider excluding from `generate-static-data.ts` to reduce deployment size from 37MB to ~8MB.

## Key assumptions

| Assumption | Where used | Impact if wrong |
|------------|-----------|----------------|
| Discount rate of 3.5% | NPV calculator, all lifecycle estimates | Higher rate reduces future costs more than future taxes (migrants benefit); lower rate does the opposite. ±1pp changes NPV by ~$15-20k |
| Projection horizon to age 85 | NPV model | Truncates NZ Super/health costs for very elderly. Understates NZ-born costs more than migrant costs (most migrants have left by 85) |
| NZ Super: 10-year residence requirement | Migrant eligibility adjustment | Models partial eligibility correctly. If residence requirement changes, affects humanitarian and family NPVs most |
| Healthy migrant effect: 85% of NZ-average health expenditure | Health cost adjustment | Reduces migrant health costs by 15%. If actual ratio is 90%, skilled NPV worsens by ~$5k. If 75%, improves by ~$10k |
| Retention extrapolation: exponential decay from years 10-18 | Retention beyond observed data | Key driver of NPV surplus. If migrants return to NZ in retirement (not captured), surplus would shrink |
| W&N fiscal template: 2018/19 snapshot | All expenditure estimates | Cross-sectional assumption — today's 65-year-old spending pattern applied to someone who will be 65 in 2050. Does not account for future health cost inflation or NZ Super policy changes |
| Per-capita mean tax (not median) | Tax premium calculations | Mean is correct for fiscal impact (captures total revenue). Median would understate contribution of high earners. Using mean inflates the appearance of "average" migrant contribution |
| Working holiday retention: constant ~33% beyond year 10 | WHV lifecycle NPV | Exponential fit failed (R²≈0). Constant rate is conservative. If WHV retention actually continues declining, WHV NPV improves slightly |

## Phase 2 learnings (synthetic population, 2026-04-08)

### What worked well

- **Zero-inflated log-normal fitting.** Inverting Table 5 tax quantiles to gross income via closed-form inverse PAYE, then fitting (p_zero, mu, sigma) worked for 90/91 cells (R² > 0.8). Mean calibration via Monte Carlo binary search on mu achieved aggregate tax agreement within 0.36%. The key insight: fit to income, not tax, so `sample_income()` output is compatible with downstream `compute_paye()`.
- **Premium approach for NPV.** Direct revenue/expenditure computation failed Phase 1 validation (W&N totals don't decompose cleanly to PAYE+ACC). Switching to W&N base NFI + individual premium deviation was correct by construction and validated to within 3% for all clean benchmarks.
- **Validation gate (P8.8) as a hard stop.** Having an explicit pass/fail gate before proceeding to content and widgets prevented propagation of errors. 5 metrics, each with clear tolerances, made the decision objective.
- **SVG-only chart widgets.** No D3 or chart library dependency. Each widget is 500-600 lines of self-contained TSX with direct SVG rendering. Lazy loading via chart registry keeps the main bundle clean.
- **p_zero recalibration in P8.4.** The P8.2 fits got mu/sigma right for quantile shape but p_zero was imprecise. Re-tuning p_zero during income assignment so `(1 - p_zero) × E[PAYE|positive] = Table 4 mean tax` was a critical innovation that brought cell-level calibration under control.

### What was difficult

- **Bimodal income distributions.** Age 10 (teens: 90%+ zeros + part-time workers) and age 70-80 (retirees: investment income + NZ Super interactions) are structurally bimodal. A single log-normal can't capture both modes simultaneously. These 9 cells still exceed 5% deviation but are fiscally immaterial — working-age cells where fiscal impact lives have median 1.2% error.
- **Subcategory vs category income fitting.** Table 5 provides income quantiles at visa CATEGORY level (Resident, Student, etc.), not subcategory (Skilled, Family, Humanitarian). Within "Resident", skilled migrants' income premium over family visa holders is not captured. This is the primary source of subcategory-level NPV deviations. Would need IDI microdata to resolve.
- **Direct tax supplement.** W&N NFI-level direct_taxes ($16,970 at 30-34) includes corporate tax attribution, FBT, and other non-PAYE levies. Our individual PAYE+ACC captures ~60%. The per-band supplement was essential to match W&N revenue framework — without it, NFI underestimates fiscal contribution by ~$5,500/person for working-age adults.
- **Sign convention (again).** Phase 1 used negative = net contributor (government perspective). Phase 2 NPV uses positive = net contributor. The report and widgets flip signs for readability. This remains a persistent source of confusion at every handoff point. Future phases should standardise on one convention throughout.

### Key technical decisions

| Decision | Rationale |
|----------|-----------|
| Invert tax quantiles to income before fitting | `sample_income()` must produce gross incomes for `compute_paye()`. Fitting in tax-space would require an inverse transform at sampling time. |
| Premium approach for NPV (not direct computation) | W&N base NFI is correct by construction. Only individual deviations need estimation. |
| Birth citizens get tenure = age (not random draw) | Essential for NZ Super eligibility — a 70-year-old birth citizen must qualify (10-year residence requirement). |
| De minimis threshold: tax < $100 treated as zero | ~$950 gross income. Below this, someone is effectively "not working" — treating as zero avoids noise from trivially small incomes. |
| Sigma cap at 2.5 | Prevents extreme right tails (>$5M incomes) in high-sigma cells that would distort means. |
| Fiscal materiality exemption: <0.5% of total tax | Diplomatic (768 real pop) and Visitor (0.04% of tax) exempted from per-category tolerance. Avoids failing validation on irrelevant edge cases. |

### Recommendations for future phases

1. **IDI microdata access** would resolve the subcategory income fitting gap — the single biggest limitation of Phase 2.
2. **Exclude large processed tables from build** (Tables 14, 142, 16 total ~29MB deployed but never fetched by any widget). Would reduce deployment from 38MB to ~9MB.
3. **Standardise sign convention** to positive = net contributor throughout the entire pipeline.
4. **Consider mixture models** (e.g., 2-component mixture of log-normals) for structurally bimodal cells (teens, retirees) if those age bands become analytically important.

## Architecture notes

- **Widget pattern:** Self-contained React components in `client/src/components/charts/`. Each widget fetches its own JSON via React Query, renders SVG charts directly (no D3 or chart library), handles loading/error states. Registered in `chartRegistry.ts` with lazy imports for code splitting.
- **Data pipeline:** `analysis/*.py` → `data/processed/*.json` → `analysis/07-build-matching-npv.py` → `data/output/*.json` → `script/generate-static-data.ts` → `client/public/data/*.json` → Vite build → `dist/public/data/*.json`.
- **Report rendering:** Markdown in `content/migrant-fiscal-impact.md` → converted to JSON by `generate-static-data.ts` → rendered by React markdown component → widget `<div data-demo="...">` tags replaced with lazy-loaded chart components.
- **Build tool:** Vite 7.3.1. Custom build script (`script/build.ts`) runs `generate-static-data.ts` first, then Vite. Output to `dist/public/` for Cloudflare Pages.
- **Bundle sizes:** Main bundle 652KB (React + TanStack Query + markdown renderer). 5 widget chunks 5-12KB each. CSS 27KB. All gzip well. Main bundle exceeds 500KB Vite warning but is acceptable for a data-rich report site.

---

## Discovery log (from earlier phases)

### Table 14 vs Table 16 visa type granularity
Table 14 has aggregated first visa types (Resident, Student, Visitor, etc.) while Table 16 has the detailed codes (R.Skilled/investor/entrepreneu, R.Family, W.Working holiday, etc.). Always use Table 16 (or retention-curves-by-visa.json) for visa-type-specific analysis.

### Working holiday retention curve is flat, not decaying
Working holiday visa holders who remain in NZ beyond ~10 years have essentially zero departure hazard. The exponential decay model yields b≈0. Use a constant retention rate of ~0.33 for WHV beyond year 10.

### Table 5 p50 vs Table 4 per-capita mean for tax premium
Table 5 p50 premium for "Resident" at age 30 = +$412 (misleadingly small — averages Skilled+Family+Humanitarian). Table 4 per-capita mean: R.Skilled = +$2,292, R.Family = -$2,402. **Always use Table 4 per-capita means for fiscal impact analysis.**

### Out-migration fiscal dividend: it's about retirement costs
The dividend is NOT that migrants "earn more." It's that migrants leave before the expensive 65+ years. NZ-born retirement cost recovery = $118k vs skilled migrant $32k. The $86k difference IS the out-migration dividend.

### W&N NFI (Family sharing) vs fiscal_components (No sharing)
Use W&N NFI (Family sharing) as the baseline for lifecycle NPV. It's the standard Treasury approach and produces results consistent with the policy question (fiscal impact of admitting one migrant family unit).
