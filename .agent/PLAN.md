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
