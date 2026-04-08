# Task plan

<!-- Machine-readable task list. The orchestrator parses this table. -->
<!-- Status values: ready | blocked | running | done | failed -->
<!-- Deps: comma-separated task IDs. "—" means no dependencies. -->

| ID | Task | Deps | Status | Phase | Parallel |
|----|------|------|--------|-------|----------|
| P0.1 | Clone repo and set up project structure | — | done | 0-setup | no |
| P0.2 | Create agentic orchestration files | P0.1 | done | 0-setup | no |
| P0.3 | Copy data files and verify readable | P0.1 | done | 0-setup | no |
| P1.1 | Extract Hughes Table 1 (aggregate tax by transcat/age/year) | P0.3 | done | 1-data | yes |
| P1.2 | Extract Hughes Tables 4,5,7 (tax distributions by visa/age/sex) | P0.3 | done | 1-data | yes |
| P1.3 | Extract Hughes Table 8 (tax by nationality/age/quantile) | P0.3 | done | 1-data | yes |
| P1.4 | Extract Hughes Tables 14,16,142 (retention/survival curves) | P0.3 | done | 1-data | yes |
| P1.5 | Extract Hughes Tables 9,10,11 (family composition and relationship tax) | P0.3 | done | 1-data | yes |
| P1.6 | Extract Wright and Nguyen fiscal incidence template | P0.3 | done | 1-data | yes |
| P1.7 | Build matching dataset and compute NPV lifecycle model | P1.1,P1.2,P1.3,P1.4,P1.5,P1.6 | done | 1-data | no |
| P2.1 | Create report outline with section structure and widget placement | P1.7 | done | 2-content | no |
| P2.2 | Write methodology section | P1.7 | done | 2-content | no |
| P2.3 | Write findings sections (5 analytical angles) | P1.7 | done | 2-content | no |
| P2.4 | Write executive summary, policy implications, conclusion | P2.2,P2.3 | done | 2-content | no |
| P2.5 | Apply hw-report-style review and revise full draft | P2.1,P2.4 | done | 2-content | no |
| P3.1 | NPV lifecycle calculator widget | P1.7 | done | 3-widgets | yes |
| P3.2 | Nationality convergence explorer widget | P1.3,P1.7 | done | 3-widgets | yes |
| P3.3 | Retention curve explorer widget | P1.4 | done | 3-widgets | yes |
| P3.4 | RV2021 composition shift widget | P1.2 | done | 3-widgets | yes |
| P3.5 | Fiscal incidence waterfall widget | P1.7 | done | 3-widgets | yes |
| P3.6 | Register all widgets in chartRegistry and test | P3.1,P3.2,P3.3,P3.4,P3.5 | done | 3-widgets | no |
| P4.1 | Wire widget data into build pipeline | P3.6,P1.7 | done | 4-integration | no |
| P4.2 | Insert data-demo tags into markdown report | P2.5,P3.6 | done | 4-integration | no |
| P4.3 | Update page metadata, title, strip Pacific LLM content | P4.1,P4.2 | done | 4-integration | no |
| P5.1 | Data QA — verify numbers against source | P4.3 | done | 5-qa | yes |
| P5.2 | Prose QA — hw-report-style final pass | P4.3 | done | 5-qa | yes |
| P5.3 | Widget QA — test rendering and edge cases | P4.3 | done | 5-qa | yes |
| P5.4 | Build and final review | P5.1,P5.2,P5.3 | done | 5-qa | no |
| P6.1 | Production build and deploy prep | P5.4 | done | 6-deploy | no |
| P7.1 | Update agentic files for Phase 2 | — | done | 7-setup | no |
| P7.2 | Explore data feasibility and Census API decision | P7.1 | done | 7-setup | no |
| P7.3 | Create synth-pop directory and shared utilities | P7.2 | done | 7-setup | no |
| P8.1 | Build seed population from Table 4 | P7.3 | done | 8-synthpop | yes |
| P8.2 | Fit income distributions from Table 5 quantiles | P7.3 | done | 8-synthpop | yes |
| P8.3 | Build nationality and relationship assignment tables | P7.3 | done | 8-synthpop | yes |
| P8.4 | Assign income to seed population via stochastic imputation | P8.1,P8.2 | done | 8-synthpop | no |
| P8.5 | Assign relationship, nationality, tenure | P8.4,P8.3 | done | 8-synthpop | no |
| P8.6 | Construct family units and compute household fiscal incidence | P8.5 | done | 8-synthpop | no |
| P8.7 | Compute individual NPV and lifecycle trajectories | P8.6 | done | 8-synthpop | no |
| P8.8 | Validation gate: verify synth-pop reproduces Phase 1 aggregates | P8.7 | done | 8-synthpop | no |
| P9.1 | Update methodology section with synthetic population description | P8.8 | done | 9-content | no |
| P9.2 | Add distributional findings to each analytical section | P8.8 | done | 9-content | no |
| P9.3 | Style review of updated content | P9.1,P9.2 | done | 9-content | no |
| P10.1 | NPV distribution widget (histogram and percentile bands) | P8.7 | done | 10-widgets | yes |
| P10.2 | Enhanced fiscal waterfall with uncertainty bands | P8.7 | done | 10-widgets | yes |
| P10.3 | Household NPV widget (family unit view) | P8.6 | done | 10-widgets | yes |
| P10.4 | Policy scenario slider widget | P8.7 | done | 10-widgets | yes |
| P10.5 | Register new widgets and assess existing replacements | P10.1,P10.2,P10.3,P10.4 | done | 10-widgets | no |
| P11.1 | Prepare widget data outputs for build pipeline | P10.5,P8.7 | done | 11-integration | no |
| P11.2 | Insert new widget tags into report markdown | P9.3,P10.5 | done | 11-integration | no |
| P11.3 | Data QA: verify distributional statistics | P11.1 | done | 11-integration | yes |
| P11.4 | Widget QA: build and test all 9 widgets | P11.2 | done | 11-integration | yes |
| P12.1 | Build, commit, push, redeploy to Cloudflare Pages | P11.3,P11.4 | done | 12-deploy | no |
