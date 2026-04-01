# The fiscal impact of migration to New Zealand

An interactive web report examining the fiscal contribution of migrants to New Zealand, built on data from Hughes (2024) AN 26/02 and Wright & Nguyen (2024) AN 24/09.

## Overview

This think piece combines two public Treasury analytical notes to estimate the net present value (NPV) of the lifecycle fiscal contribution of migrants by visa type, nationality, and arrival age. It covers five analytical dimensions:

1. **Lifetime NPV by visa category** — net fiscal contribution from arrival through to departure or retirement
2. **Fiscal incidence** — how tax, education, health, superannuation, and benefit costs vary by age
3. **Retention and out-migration** — cohort survival curves showing when migrants leave NZ
4. **Income convergence** — how migrant earnings converge toward (or exceed) NZ-born levels over time
5. **2021 Residence Visa impact** — fiscal implications of the one-off RV2021 pathway

The report includes five interactive visualisations embedded within the narrative.

## Running locally

**Prerequisites:** Node.js 18+

```bash
npm install
npx tsx script/generate-static-data.ts
npm run dev
```

This starts a development server at `http://localhost:5001`.

## Building for production

```bash
npm install
npm run build
```

The build script generates static data and runs the Vite production build. Output is in `dist/public/`.

To preview the production build locally:

```bash
./serve.sh
```

Then open `http://localhost:3000`.

## Tech stack

- Vite 7, React 19, TypeScript
- Tailwind CSS 4
- @tanstack/react-query for data fetching
- Plain SVG for charts (no charting library)
- Markdown report rendered client-side via react-markdown

## Data sources

- **Hughes (2024)** — Treasury AN 26/02. Migrant tax payments, retention curves, nationality, visa type. 2000–2024. Source: Statistics NZ IDI.
- **Wright & Nguyen (2024)** — Treasury AN 24/09. Full fiscal incidence by age: income tax, education, health, NZ Super, benefits, GST. 2018/19.

Pre-processed JSON files are in `data/output/` (widget-ready) and `data/processed/` (extracted tables).

## Project structure

```
content/          Report markdown
data/raw/         Source spreadsheets (not committed)
data/processed/   Extracted JSON tables from Hughes
data/output/      Widget-ready JSON for the frontend
client/           React SPA (Vite)
  src/components/charts/   Interactive widget components
script/           Build and data generation scripts
analysis/         Python data processing scripts
```

## Deployment

This is a static single-page application. Deploy the contents of `dist/public/` to any static host.

**Cloudflare Pages:**
- Build command: `npm run build`
- Output directory: `dist/public`
- Node.js version: 18+

## Authors

Heuser | Whittington — Economic Consulting
