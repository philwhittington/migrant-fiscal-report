# Widget QA report

Generated: 2026-04-01

## Build status

- npm install: **PASS** (332 packages, 0 vulnerabilities)
- generate-static-data: **PASS** (report.json generated, 22 data files present in client/public/data/)
- tsc --noEmit: **PASS** (zero errors)
- npm run build: **PASS** (Vite 7.3.1, 414 modules, 1.21s build time)

### Build output chunks

| Chunk | Size | Gzip |
|-------|------|------|
| index.html | 1.36 KB | 0.63 KB |
| index.css | 27.07 KB | 6.37 KB |
| RetentionExplorerWidget | 5.08 KB | 2.13 KB |
| RV2021ShiftWidget | 6.03 KB | 2.49 KB |
| NationalityConvergenceWidget | 7.84 KB | 3.20 KB |
| FiscalWaterfallWidget | 8.38 KB | 3.19 KB |
| NPVCalculatorWidget | 12.50 KB | 3.79 KB |
| index (main bundle) | 652.59 KB | 204.50 KB |

Note: Main bundle exceeds Vite's 500 KB warning threshold. All 5 widgets are correctly code-split via lazy imports — the large bundle is React + TanStack Query + markdown renderer. Not a blocker.

## Widget file checks

| Widget | File exists | Named export | Loading state | Error state | Data URL exists |
|--------|------------|--------------|---------------|-------------|-----------------|
| NPV Calculator | YES | `NPVCalculatorWidget` | YES (12 refs) | YES (4 refs) | YES (2 files) |
| Nationality Convergence | YES | `NationalityConvergenceWidget` | YES (6 refs) | YES (3 refs) | YES |
| Retention Explorer | YES | `RetentionExplorerWidget` | YES (6 refs) | YES (3 refs) | YES |
| RV2021 Shift | YES | `RV2021ShiftWidget` | YES (6 refs) | YES (3 refs) | YES |
| Fiscal Waterfall | YES | `FiscalWaterfallWidget` | YES (6 refs) | YES (3 refs) | YES |

### Data URL mapping (verified against client/public/data/)

| Widget | Fetches | File present | Size |
|--------|---------|-------------|------|
| NPVCalculatorWidget | `/data/npv-by-visa-age.json` | YES | 460 KB |
| NPVCalculatorWidget | `/data/fiscal-components-by-migrant-type.json` | YES | 79 KB |
| NationalityConvergenceWidget | `/data/nationality-convergence.json` | YES | 170 KB |
| RetentionExplorerWidget | `/data/retention-curves-widget.json` | YES | 43 KB |
| RV2021ShiftWidget | `/data/rv2021-composition.json` | YES | 6.3 KB |
| FiscalWaterfallWidget | `/data/fiscal-components-by-migrant-type.json` | YES | 79 KB |

Note: Task spec listed RetentionExplorerWidget → `retention-curves-by-visa.json`, but the widget correctly fetches `retention-curves-widget.json` (a widget-optimised subset). Both files exist.

## Chart registry

- Total entries: **5** (correct — no stale Pacific LLM entries)
- All demo IDs correct: **YES** (npv-calculator, nationality-convergence, retention-explorer, rv2021-shift, fiscal-waterfall)
- All import paths valid: **YES** (verified against actual file names and named exports)
- Lazy loading pattern: all use `.then((m) => ({ default: m.WidgetName }))` correctly

## Data files in client/public/data/

| File | Present | Size |
|------|---------|------|
| report.json | YES | 43 KB |
| npv-by-visa-age.json | YES | 460 KB |
| fiscal-components-by-migrant-type.json | YES | 79 KB |
| nationality-convergence.json | YES | 170 KB |
| rv2021-composition.json | YES | 6.3 KB |
| retention-curves-widget.json | YES | 43 KB |
| retention-curves-by-visa.json | YES | 52 KB |
| retention-curves-by-age.json | YES | 24 KB |
| npv-by-nationality.json | YES | 7.2 KB |
| methodology-assumptions.json | YES | 2.7 KB |
| wright-nguyen-fiscal-template.json | YES | 15 KB |
| hughes-table1-aggregate.json | YES | 435 KB |
| hughes-table4-visa-subcategory.json | YES | 921 KB |
| hughes-table5-visa-quantiles.json | YES | 1.7 MB |
| hughes-table7-sex-visa-quantiles.json | YES | 303 KB |
| hughes-table8-nationality.json | YES | 1.5 MB |
| hughes-table9-relationship-tax.json | YES | 343 KB |
| hughes-table10-nationality-relationship.json | YES | 100 KB |
| hughes-table11-tenure-tax.json | YES | 62 KB |
| hughes-table14-cohort-visa.json | YES | 6.9 MB |
| hughes-table142-cohort-age.json | YES | 8.1 MB |
| hughes-table16-cohort-visa-detail.json | YES | 14 MB |

Total: **22 JSON files** in client/public/data/

## Bugs fixed during QA

| File | Issue | Fix |
|------|-------|-----|
| (none) | — | — |

No bugs found. All 5 widgets compile cleanly, the build succeeds on first attempt, all data files are present and correctly wired.

## Outstanding issues

- **Main bundle size warning**: index.js is 652 KB (204 KB gzipped). This is React + TanStack Query + markdown renderer. Not blocking — Cloudflare Pages serves gzipped. Could be addressed with manual chunk splitting if needed.
- **Large processed data in public/**: The hughes-table14/142/16 files total ~29 MB. These are not fetched by any widget but are deployed to the static site. Consider excluding them from the public directory if deployment size is a concern.

## Self-check summary

1. npm install succeeds: **PASS**
2. TypeScript compilation zero errors: **PASS**
3. npm run build succeeds: **PASS**
4. All 5 widget files exist with correct exports: **PASS**
5. chartRegistry.ts has exactly 5 correct entries: **PASS**
6. All data files present in client/public/data/: **PASS**
7. QA report complete: **PASS**
