# Migrant lifecycle fiscal impact — project rules

## Project context

This is an autonomous agentic project that combines two Treasury datasets to estimate the lifecycle net fiscal impact of migrants to New Zealand. The output is an interactive think piece published as a static website.

## Data files

- `data/raw/hughes-an2602.xlsx` — Hughes AN 26/02 (19MB, ~370k data rows across 24 tables). Migrant tax payments, retention curves, nationality, visa type. 2000-2024.
- `data/raw/wright-nguyen-an2409.csv` — Wright & Nguyen AN 24/09 (1,437 rows). Full fiscal incidence by age: income tax, education, health, NZ Super, benefits, GST. 2018/19.
- `data/processed/` — Extracted JSON tables from Hughes (one per key table group)
- `data/output/` — Widget-ready JSON files for the frontend

## Tech stack

- **Frontend**: Vite 7 + React 19 + TypeScript + Tailwind CSS 4
- **Data processing**: Python 3 with pandas and openpyxl
- **Widgets**: Self-contained React components, lazy-loaded via chartRegistry
- **Build**: Custom TypeScript pipeline (generate-static-data.ts → vite build)
- **Deploy target**: Cloudflare Pages (static + functions)

## Key conventions

### Data processing
- All Python scripts go in `analysis/` and write JSON to `data/processed/` or `data/output/`
- Suppress rows where measure1 == 'S' (Stats NZ confidentialisation)
- Tax values in Hughes are in billions (column `measure2` = `tax_b`). Convert to dollars for display.
- Use Treasury discount rate of 3.5% for NPV calculations
- Document all assumptions in the script and in SCRATCHPAD.md

### Widget development
- Follow the pattern in existing pacific-llm-report widgets (VATDemoWidget etc.)
- Register in `client/src/components/charts/chartRegistry.ts`
- Embed in markdown via `<div data-demo="widget-id"></div>`
- Load data from `/data/*.json` using React Query
- Use the project colour palette from `client/src/index.css`
- All widgets must be responsive and handle empty/loading states

### Report writing
- Sentence case headings
- Precise language — no advocacy, no overclaiming
- Every numerical claim must trace to a specific data source
- Clear caveats for all estimates (this is summary-level public data, not microdata)
- HW report style: evidence-based, professionally hedged

### Agentic workflow
- Read `.agent/SCRATCHPAD.md` at the start of every task
- Update SCRATCHPAD.md with findings and decisions after each task
- Log unexpected discoveries to `.agent/LEARNINGS.md`
- If stuck, write details to SCRATCHPAD.md under "## Blockers" and stop
- Never modify `.agent/PLAN.md` directly — the orchestrator manages task status

## File locations

| Content type | Location |
|---|---|
| Agentic files | `.agent/` |
| Task workfiles | `tasks/` |
| Python scripts | `analysis/` |
| Raw data | `data/raw/` |
| Processed JSON | `data/processed/` |
| Widget JSON | `data/output/` |
| React components | `client/src/components/charts/` |
| Report markdown | `content/migrant-fiscal-impact.md` |
| Build scripts | `script/` |
