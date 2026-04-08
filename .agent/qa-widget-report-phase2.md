# Phase 2 widget build QA report

**Date:** 2026-04-08
**Build tool:** Vite 7.3.1
**TypeScript:** strict mode (`npx tsc --noEmit`)

## Summary

| Check | Result |
|-------|--------|
| TypeScript compilation | **PASS** (zero errors) |
| Production build | **PASS** (1.13s) |
| Widget files present | **9/9** |
| Registry entries | **9/9** |
| Data files present | **26/26** |
| Data files valid JSON | **26/26** |

## TypeScript compilation

- **Status:** PASS
- **Errors fixed:** None — clean on first run

## Production build

- **Status:** PASS
- **Build time:** 1.13s
- **Modules transformed:** 418
- **Warnings:** 1 — main chunk exceeds 500 KB (653.54 KB / 204.78 KB gzipped). This is the core app bundle (React, React Query, markdown renderer). Acceptable for a CDN-served static site. Widgets are correctly code-split into separate lazy-loaded chunks.

### Bundle sizes

| Chunk | Raw | Gzipped |
|-------|-----|---------|
| index.js (main) | 653.54 KB | 204.78 KB |
| index.css | 28.31 KB | 6.57 KB |
| NPVCalculatorWidget | 12.50 KB | 3.79 KB |
| NPVDistributionWidget | 8.96 KB | 3.12 KB |
| HouseholdNPVWidget | 8.66 KB | 3.24 KB |
| FiscalWaterfallDistWidget | 8.55 KB | 3.08 KB |
| FiscalWaterfallWidget | 8.38 KB | 3.19 KB |
| PolicyScenarioWidget | 8.34 KB | 2.84 KB |
| NationalityConvergenceWidget | 7.85 KB | 3.19 KB |
| RV2021ShiftWidget | 6.03 KB | 2.49 KB |
| RetentionExplorerWidget | 5.08 KB | 2.13 KB |

**Total widget JS:** 84.35 KB raw / 30.07 KB gzipped

## Widget inventory

| # | Demo ID | Component file | Named export | Registry entry | Status |
|---|---------|---------------|--------------|----------------|--------|
| 1 | npv-calculator | NPVCalculatorWidget.tsx | NPVCalculatorWidget | Yes | PASS |
| 2 | nationality-convergence | NationalityConvergenceWidget.tsx | NationalityConvergenceWidget | Yes | PASS |
| 3 | retention-explorer | RetentionExplorerWidget.tsx | RetentionExplorerWidget | Yes | PASS |
| 4 | rv2021-shift | RV2021ShiftWidget.tsx | RV2021ShiftWidget | Yes | PASS |
| 5 | fiscal-waterfall | FiscalWaterfallWidget.tsx | FiscalWaterfallWidget | Yes | PASS |
| 6 | npv-distribution | NPVDistributionWidget.tsx | NPVDistributionWidget | Yes | PASS |
| 7 | fiscal-waterfall-dist | FiscalWaterfallDistWidget.tsx | FiscalWaterfallDistWidget | Yes | PASS |
| 8 | household-npv | HouseholdNPVWidget.tsx | HouseholdNPVWidget | Yes | PASS |
| 9 | policy-scenario | PolicyScenarioWidget.tsx | PolicyScenarioWidget | Yes | PASS |

All 9 widgets have both named exports (used by registry `.then()` callbacks) and default exports.

## Data file inventory

### Phase 1 files (22)

| # | File | Size | Valid JSON | Status |
|---|------|------|-----------|--------|
| 1 | fiscal-components-by-migrant-type.json | 77 KB | Yes | PASS |
| 2 | hughes-table1-aggregate.json | 425 KB | Yes | PASS |
| 3 | hughes-table10-nationality-relationship.json | 98 KB | Yes | PASS |
| 4 | hughes-table11-tenure-tax.json | 60 KB | Yes | PASS |
| 5 | hughes-table14-cohort-visa.json | 6.6 MB | Yes | PASS |
| 6 | hughes-table142-cohort-age.json | 7.7 MB | Yes | PASS |
| 7 | hughes-table16-cohort-visa-detail.json | 13 MB | Yes | PASS |
| 8 | hughes-table4-visa-subcategory.json | 900 KB | Yes | PASS |
| 9 | hughes-table5-visa-quantiles.json | 1.6 MB | Yes | PASS |
| 10 | hughes-table7-sex-visa-quantiles.json | 296 KB | Yes | PASS |
| 11 | hughes-table8-nationality.json | 1.4 MB | Yes | PASS |
| 12 | hughes-table9-relationship-tax.json | 335 KB | Yes | PASS |
| 13 | methodology-assumptions.json | 2.7 KB | Yes | PASS |
| 14 | nationality-convergence.json | 167 KB | Yes | PASS |
| 15 | npv-by-nationality.json | 7.0 KB | Yes | PASS |
| 16 | npv-by-visa-age.json | 450 KB | Yes | PASS |
| 17 | report.json | 53 KB | Yes | PASS |
| 18 | retention-curves-by-age.json | 24 KB | Yes | PASS |
| 19 | retention-curves-by-visa.json | 51 KB | Yes | PASS |
| 20 | retention-curves-widget.json | 42 KB | Yes | PASS |
| 21 | rv2021-composition.json | 6.2 KB | Yes | PASS |
| 22 | wright-nguyen-fiscal-template.json | 15 KB | Yes | PASS |

### Phase 2 files (4)

| # | File | Size | Valid JSON | Status |
|---|------|------|-----------|--------|
| 23 | synth-npv-distributions.json | 185 KB | Yes | PASS |
| 24 | synth-fiscal-distributions.json | 11 KB | Yes | PASS |
| 25 | synth-household-npv.json | 4.8 KB | Yes | PASS |
| 26 | synth-population-summary.json | 2.0 KB | Yes | PASS |

**Total data directory:** ~34 MB (Phase 2 adds only ~203 KB)

## Issues found and resolved

None. All checks passed on first run.

## Issues remaining

None. Ready for P12.1 deployment.

## Notes

- The Vite chunk size warning (main bundle >500 KB) is cosmetic. The bundle is 205 KB gzipped, served from Cloudflare edge. No action needed.
- One `npm audit` vulnerability flagged (high severity). This is a pre-existing dependency issue, not related to Phase 2 changes. Should be reviewed separately.
