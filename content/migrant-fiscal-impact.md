# The lifecycle fiscal impact of migrants to New Zealand
## Combining tax and expenditure data for a first estimate

**Author:** Heuser|Whittington
**Date:** April 2026

## Executive summary

This paper combines two public Treasury datasets — Hughes AN 26/02 on migrant tax payments and Wright and Nguyen AN 24/09 on fiscal incidence by age — to estimate the lifecycle net fiscal impact of migrants to New Zealand by visa type, nationality, and arrival age. It is a proof of concept: using published summary statistics rather than linked microdata, it demonstrates that meaningful lifecycle fiscal estimates can be derived from existing public data. The analysis is intended to inform Treasury's 2025 Long-Term Fiscal Statement and to motivate a full lifecycle model using the Integrated Data Infrastructure.

Foreign-born taxpayers comprise 32% of New Zealand's taxpaying population but contribute 38% of personal income tax. Our estimates suggest that a skilled migrant arriving at age 30 has a lifecycle fiscal contribution of $132,100 in present value terms — a surplus of $60,500 over the NZ-born equivalent of $71,600. The primary mechanism is out-migration: a skilled migrant arriving at 30 has only a 44% probability of remaining in New Zealand at age 65, avoiding NZ Superannuation and the elevated health expenditure of retirement. The data also reveal striking economic integration: Chinese migrants in their 30s moved from approximately 8% of the NZ-born median tax in 2002 to 117% by 2024. The 2021 Resident Visa reclassified approximately 165,000 temporary visa holders into resident categories, shifting the composition of New Zealand's migrant population toward higher-retention, higher-tax pathways.

These findings indicate that the fiscal selection properties of New Zealand's migration system produce net positive fiscal outcomes: skilled migrants are net contributors across the lifecycle, and out-migration moderates the Crown's long-run expenditure exposure. The analysis is limited by its reliance on summary-level data and cross-sectional methods. A natural next step is a full lifecycle model using IDI-linked administrative data, following the approach developed by the Australian Treasury (Varela et al., 2021). This would enable individual-level tracking, household matching, and proper treatment of return migration — the elements needed for policy-grade estimates.

## 1. Introduction and motivation

<!-- Why this matters for Treasury's Long-Term Fiscal Statement. The gap in NZ evidence on lifecycle fiscal impact. What this paper does and does not attempt. Reference Hughes AN 26/02 and Wright & Nguyen AN 24/09 as the two source datasets. Frame as proof of concept using summary-level public data — not microdata — to motivate Treasury to commission a full IDI-based lifecycle model. ~400 words. -->

## 2. Data and methodology

### 2.1 Data sources

**Hughes AN 26/02.** This dataset draws on Inland Revenue administrative records covering all individual taxpayers in New Zealand across tax years 2000 to 2024. It comprises approximately 370,000 data rows across 24 tables. For our analysis, the key tables are:

- **Table 1** (2,698 rows): aggregate personal income tax revenue by transaction category (resident, non-resident, and other classifications), 10-year age band, and year.
- **Table 4** (5,145 rows): tax revenue by 34 visa subcategories — including Skilled/Investor, Family, Humanitarian, Student, Working Holiday, and Skilled Work — by age band and year. Tax values are aggregate totals in billions of dollars, from which we compute per-capita means.
- **Table 5** (11,100 rows): tax quantile distributions (p10, p25, p50, p75, p90) by 10 broad visa categories, age, and year. Values are in dollars per person per year.
- **Table 8** (9,730 rows): tax quantiles by 11 nationality groups, age, and year.
- **Table 16** (94,232 rows after suppression): cohort retention curves by detailed visa type, tracking the proportion of each arrival cohort that remains in New Zealand over time.

Cells containing fewer than six taxpayers are suppressed under Stats NZ confidentialisation rules (marked 'S'). Suppression affects 38% of Table 16 rows due to fine granularity, but retention rates averaged across up to 20 cohort years mitigate this.

**Wright and Nguyen AN 24/09.** This dataset provides a complete fiscal incidence model for the 2018/19 fiscal year, estimating both the revenue contribution and the government expenditure attributable to individuals at each age. It contains 1,437 rows across 17 age bands under two allocation assumptions ("family sharing" and "no sharing"). The approximately 20 revenue and expenditure categories include income tax, GST, excise duties, education spending, health spending, New Zealand Superannuation, welfare benefits, and other government outlays.

The net fiscal impact (NFI) for each age band represents the difference between taxes contributed and government spending received. Under family sharing, individuals are net contributors from approximately age 20 to age 64 and net recipients from age 65 onwards, when NZ Super and health expenditure dominate.

Wright and Nguyen reflects NZ population averages — it does not distinguish between migrants and the NZ-born. The tax side of the fiscal ledger is where migrants differ most from the population average, and Hughes provides exactly this migrant-specific tax data.

### 2.2 Matching methodology

Our approach substitutes the revenue side of the Wright and Nguyen fiscal balance with actual migrant tax data from Hughes, retaining the expenditure side as a population-average template with targeted adjustments for known eligibility differences. The matching proceeds as follows:

1. **Base fiscal profile.** We adopt the Wright and Nguyen NFI under family sharing as the baseline for all calculations. This captures both direct and indirect taxes on the revenue side and all government spending categories on the expenditure side. Family sharing allocates the household's fiscal balance across family members based on modified OECD equivalence scales — the standard Treasury approach for lifecycle fiscal analysis.

2. **Tax premium.** From Hughes Table 4, we compute the per-capita mean tax for each visa subcategory and age band for the 2019 tax year (the closest match to Wright and Nguyen's 2018/19 fiscal year). The per-capita mean equals aggregate tax revenue (in billions) divided by the taxpayer count. The tax *premium* is the difference between the migrant visa mean and the NZ-born (Birth Citizen) mean for the same age band. We use the mean rather than the median because total revenue equals the mean multiplied by the count — the mean captures the fiscal contribution of high earners in the right tail of the distribution.

3. **Age band alignment.** Hughes reports in 10-year age bands (0–9, 10–19, through to 100+), while Wright and Nguyen uses 5-year bands (0–4, 5–9, through to 80+). The NPV model iterates year by year from arrival to age 85, mapping each integer age to the corresponding band in each dataset. A single tax premium value applies across all ages within a Hughes 10-year band.

4. **Year matching.** We match on the 2019 tax year from Hughes, which corresponds directly to the 2018/19 fiscal year in Wright and Nguyen. This avoids the need for CPI deflation. All dollar values throughout the analysis are in 2018/19 New Zealand dollars.

5. **Migrant-specific adjustments.** The population-average expenditure profile overstates government spending on migrants who face eligibility restrictions. We apply the following adjustments as reductions to the expenditure side:
   - *NZ Super*: zero entitlement until 10 years of continuous residence from age 20 and attainment of age 65.
   - *Working for Families*: zero for temporary visa holders (Student, Working Holiday, Skilled Work).
   - *Benefit stand-down*: working-age income support and housing support reduced to 50% for the first two years of residence; zero for temporary visa holders.
   - *Health spending*: working-age migrants assumed to consume 85% of NZ-average health expenditure, reflecting the healthy migrant effect documented in New Zealand health literature.
   - *Other income support*: zero for temporary visa holders (student allowance, other income support, and paid parental leave).

### 2.3 The NPV formula

The net present value of a migrant's lifecycle fiscal impact is:

> NPV = Σ(t=0 to T) [ R(t) × S(t) / (1 + r)^t ]

where:

- *t* = years since arrival in New Zealand
- *T* = years from arrival to age 85 (the projection horizon)
- *R(t)* = net fiscal contribution in year *t*, comprising the Wright and Nguyen NFI for the migrant's current age, adjusted for the visa-specific tax premium and eligibility restrictions described above. When *R(t)* is negative, the migrant is a net contributor to the Crown; when positive, a net cost.
- *S(t)* = retention probability — the probability the migrant remains in New Zealand at time *t*, drawn from Hughes Table 16 survival curves.
- *r* = real discount rate (3.5%), consistent with the New Zealand Treasury's standard cost-benefit analysis guidance.

Retention *S(t)* is the mechanism that most sharply distinguishes migrant from NZ-born fiscal profiles. A migrant who arrives at 30 and departs at 50 contributes during their peak earning years but never draws NZ Super or the elevated health spending of retirement — the "out-migration dividend."

**Retention curve methodology.** Hughes Table 16 tracks the proportion of each arrival cohort remaining in New Zealand in subsequent years. We average retention rates across up to 20 arrival cohort years (approximately 2000 to 2019) to produce smoothed, visa-specific survival curves. Actual data extends to 24 years since arrival for the earliest cohorts.

Beyond the observed data range, we extrapolate using an exponential decay function fitted on years 10 to 18 since arrival, where the curves are most stable and cohort coverage is deepest:

> S(t) = a × exp(−b × t)

The fit achieves R² > 0.93 for all visa types except Working Holiday, which exhibits a flat retention profile beyond year 10 (the decay parameter *b* approaches zero). For Working Holiday visa holders, we apply a constant retention rate of approximately 33% beyond year 10.

### 2.4 Key assumptions and limitations

1. **Discount rate.** 3.5% real, per Treasury CBA guidance. Our NPV estimates are sensitive to this choice: a lower rate increases the weight of distant retirement costs, narrowing the migrant–NZ-born surplus.

2. **Projection horizon.** Age 85. This truncates the most expensive retirement years for the NZ-born (whose retention is 100% by construction), somewhat understating the migrant fiscal advantage.

3. **NZ Super eligibility.** Assumed available after 10 years of continuous residence from age 20 and attainment of age 65. This does not model partial entitlements or bilateral social security agreements.

4. **Healthy migrant adjustment.** Working-age migrants assumed to consume 85% of NZ-average health expenditure. The adjustment does not vary by visa type or nationality.

5. **Retention extrapolation.** Beyond the observed 24 years of data, retention is projected using exponential decay fitted on years 10–18. This assumes departures continue to decline smoothly — which may not hold if migrants face changing incentives at specific life stages.

6. **Expenditure template.** Government expenditure uses NZ population averages by age, not migrant-specific spending. Actual patterns may differ — for example, lower welfare uptake in early years or different education spending if children arrive mid-schooling.

7. **Cross-sectional approach.** This analysis observes what different cohorts look like at a point in time, rather than tracking the same individuals longitudinally. It assumes today's age-specific fiscal profiles approximate the lifecycle trajectory of a cohort arriving now.

### 2.5 What this analysis is not

This is not individual-level microsimulation. We use published summary statistics, not linked administrative microdata from the Integrated Data Infrastructure (IDI). We cannot control for selection on observable characteristics — migrants who pay high tax may differ from NZ-born high earners in ways that affect their future fiscal trajectory. This is not causal analysis: it does not estimate the effect of changing migration policy settings on fiscal outcomes. It does not capture second-round effects — the impact of migration on housing markets, infrastructure demand, wages, or productivity spillovers. It is a proof of concept using publicly available data, intended to demonstrate the feasibility and value of a full IDI-based lifecycle fiscal model.

### 2.6 Synthetic population methodology

The group-mean estimates in the preceding sections answer the question "what is the average fiscal impact of a skilled migrant?" But policy analysis also requires distributional detail: what proportion of skilled migrants are net contributors? What is the range of outcomes within a visa category? How would a shift in visa composition change the aggregate fiscal balance? Phase 2 of this analysis generates a synthetic population of 500,000 individual migrants to produce these distributional estimates.

**Income imputation.** For each of the 91 visa-category-by-age cells in the 2019 tax year, we fit a zero-inflated log-normal distribution to five quantile points (p10, p25, p50, p75, p90) derived from Hughes Table 5. Tax quantiles from Table 5 are first inverted to gross income quantiles using a closed-form inverse of the NZ PAYE schedule, since the downstream fiscal computation requires gross income as its input. The zero-inflation component captures the proportion of non-earners within each cell — children, students, and retirees who report zero or negligible taxable income. The fitting objective minimises squared relative quantile deviations using the Nelder-Mead algorithm (scipy.optimize), subject to a mean calibration constraint: for each cell, the log-normal location parameter is adjusted so that the expected PAYE liability of sampled incomes matches the per-capita mean tax observed in Hughes Table 4. This ensures the synthetic population reproduces aggregate tax revenue by construction. The fit achieves R² above 0.80 for 90 of 91 cells (98.9%), with key working-age cells — where the fiscal impact is concentrated — achieving R² above 0.98 and mean tax errors below 2%.

**Seed population and attribute assignment.** We draw a proportional random sample of 500,000 individuals from the 226 non-empty visa-subcategory-by-age cells in Hughes Table 4 (tax year 2019), maintaining the observed population composition. Each individual is assigned a gross income drawn from the fitted distribution for their cell, then stochastically assigned a nationality (from Table 10 marginal distributions), family relationship type (conditional on nationality, from Table 10), and years of New Zealand residence (from Table 11 tenure distributions). Primary applicants are linked with spouses and dependent children into family units using a greedy matching algorithm based on age proximity and visa-type-specific family composition rates.

**Individual fiscal computation.** Each individual's tax liability is computed directly from their assigned gross income using the 2024 NZ PAYE brackets (10.5% on income up to $14,000; 17.5% on $14,001–$48,000; 30% on $48,001–$70,000; 33% on $70,001–$180,000; 39% above $180,000) plus the 1.6% ACC earners' levy, rather than applying group-mean tax rates. Government expenditure uses age-specific per-capita templates from Wright and Nguyen, with the same migrant-specific adjustments described in section 2.2: the healthy migrant health factor (85% of NZ-average health expenditure), benefit stand-down for recent arrivals (50% of income support for the first two years), NZ Super eligibility after 10 years of residence, and exclusion of temporary visa holders from Working for Families and income support. The lifecycle NPV for each individual follows the same discounted retention-weighted formula as the group-level model (section 2.3), applied to individual-level fiscal flows.

**Validation.** The synthetic population aggregates reproduce Phase 1 group-mean results within tight tolerances. Aggregate tax revenue matches to within 0.33%. Mean NPV estimates for cleanly comparable categories — NZ-born and Australian visa holders across ages 20 to 50 — agree within 3% (maximum deviation 3.0% for Australian age 20). Retention curves are shared data and match at 0.0% deviation across all 21 tested points. Nine cells at extreme ages (teens and retirees) show larger tax deviations, reflecting the inherent difficulty of fitting a single log-normal to bimodal income distributions in those age bands; these cells are fiscally immaterial. The full validation report documents all five metrics and the gate decision to proceed.

It is important to note what these estimates are not. The synthetic population is model-generated: individual incomes and attributes are stochastically imputed from aggregate distributions, not observed at the individual level. The distributional detail that follows — histograms, percentile ranges, and probability statements — reflects the range of outcomes consistent with the group-level data, not individual administrative records. The distributions are as reliable as the underlying summary statistics and the distributional assumptions imposed on them.

The sections that follow apply this framework to the Hughes and Wright and Nguyen data, moving from the aggregate fiscal picture to visa-specific analysis, nationality convergence, lifecycle NPV estimates, and — drawing on the synthetic population — distributional analysis of fiscal outcomes within visa categories.

## 3. The aggregate picture

In 2000, foreign-born individuals comprised 24% of New Zealand's taxpaying population and paid a proportionate 24% of personal income tax — $3.6 billion of $14.6 billion total (Hughes Table 4). By 2024, their population share had risen to 32%, but their tax share had grown faster, reaching 38% — $20.2 billion of $53.5 billion. Foreign-born taxpayers now contribute six percentage points more in tax share than their population share would suggest.

This widening gap reflects both volume and value effects. The number of foreign-born taxpayers grew from 909,000 in 2000 to 1.61 million in 2024 — a 77% increase, compared with 17% growth in NZ-born taxpayers over the same period (2.94 million to 3.44 million). But per-capita contributions also shifted. In 2000, foreign-born and NZ-born taxpayers paid similar per-person tax: $3,900 and $3,800 respectively. By 2024, the foreign-born average had reached $12,500, compared with $9,700 for the NZ-born — a 29% premium per person (Hughes Table 4). Roughly 60% of the tax share increase is attributable to the growing number of foreign-born taxpayers (the volume effect), with the remaining 40% driven by their rising per-capita contributions (the value effect).

The foreign-born tax share has grown steadily: crossing 27% by 2005, 30% by 2010, 34% by 2019, and 38% by 2024 (Hughes Table 4). The acceleration after 2019 partly reflects the one-off 2021 Resident Visa discussed in Section 5.

Within the foreign-born population, a marked concentration has occurred in higher-earning visa categories. In 2000, skilled, investor, and entrepreneur visa holders represented fewer than 2% of all foreign-born taxpayers and contributed 2% of foreign-born tax. By 2024, they comprised 32% of the foreign-born population and paid 41% of all foreign-born tax — $8.3 billion per year (Hughes Table 4). The average skilled/investor visa holder paid $16,100 in personal income tax in 2024, 66% above the NZ-born average. Other resident visa categories collectively contributed $6.9 billion (other resident streams) and $2.2 billion (family stream), while humanitarian visa holders contributed $0.4 billion.

This concentration reflects two decades of policy emphasis on skilled migration pathways. In 2000, the skilled/investor stream accounted for 2% of foreign-born tax; by 2010, it was 23%; by 2024, 41% (Hughes Table 4). New Zealand's migration system has progressively selected for higher-earning entrants.

The foreign-born tax contribution is concentrated in working ages. Skilled and investor migrants typically arrive in their 20s and 30s, placing them in peak earning years. At age 30, the per-capita mean tax for a resident skilled migrant was $16,720 in 2024, 12% above the NZ-born mean of $14,951 at the same age (Hughes Table 4). This age pattern is central to the lifecycle fiscal story: migrants contribute most during years when government expenditure on them — predominantly health care and income support — is lowest.

Non-resident workers and visitors — people who earn in New Zealand but do not live here permanently — contributed $0.5 billion in personal income tax in 2023, or approximately 1% of the total (Hughes Table 1). This represents a fiscal gain requiring no corresponding public service expenditure, but falls outside the lifecycle model that follows.

The synthetic population model developed in section 2.6 indicates a wide range of individual outcomes beneath these aggregate figures. For resident visa holders, estimated annual direct tax payments range from $530 at the 10th percentile to $33,800 at the 90th — a factor of more than sixty, reflecting the mix of non-earners, part-time workers, and high-income professionals within a single visa category (synthetic population output). Health expenditure shows a far tighter distribution: $1,700 to $3,978 per year across the same percentile range. The estimated annual net fiscal impact for individual resident visa holders spans from a net cost of $21,400 at the 10th percentile to a net contribution of $22,900 at the 90th, with a median net contribution of approximately $700. Variation in fiscal outcomes is driven overwhelmingly by the revenue side — by differences in individual earnings — rather than by expenditure.

The aggregate picture shows foreign-born taxpayers as a growing and disproportionate share of New Zealand's revenue base. But this headline masks wide variation by visa type — variation that shapes whether a given migration pathway generates a net fiscal surplus or a net cost over a lifetime.

<div data-demo="fiscal-waterfall"></div>

<div data-demo="fiscal-waterfall-dist"></div>

## 4. Fiscal selection by visa type

The aggregate over-contribution of foreign-born taxpayers masks sharply different fiscal profiles across visa types. Hughes Table 4 provides per-capita mean tax by visa subcategory, and the variation at age 30 in the 2019 tax year — the matching year for our NPV model — is striking.

NZ-born taxpayers at age 30 paid a per-capita mean of $10,715. Skilled/investor visa holders paid $13,007, a premium of $2,292 per year or 21% above the NZ-born mean. Australian citizens were similar at $13,860.

Skilled work visa holders (temporary workers in occupations on skills shortage lists) paid $9,056 — below the NZ-born mean but reflecting shorter tenures and occupation-specific visa conditions. Family stream migrants paid $8,314, 22% below the NZ-born mean. Humanitarian visa holders paid $6,101, 43% below. Student visa holders paid $1,357 — 87% below the NZ-born mean (Hughes Table 4, 2019 tax year).

These patterns persist in the 2024 data. The median (p50) NZ-born taxpayer at age 30 earned $11,134. Resident visa holders (a composite category spanning skilled, family, and humanitarian streams) had a median of $13,404, 20% above. Permanent residents were similar at $14,197. Non-residential work visa holders — typically in specific industries — had a lower median of $9,448. Student visa holders had a median of just $1,078 (Hughes Table 5, 2024).

**The shape of the earnings distribution.** The p75/p25 ratio reveals within-group inequality. NZ-born taxpayers at age 30 have a p75/p25 ratio of 10.8 — wide dispersion reflecting the full range from part-time workers to professionals (Hughes Table 5). Resident migrants have a ratio of 3.5, and non-residential workers 3.1. The visa system compresses the earnings distribution by selecting against the lowest earners, narrowing the range between the 25th and 75th percentiles.

**Gender differences.** Male skilled migrants at age 30 had a median tax of $16,170, compared with $11,494 for female skilled migrants — a 29% gender gap (Hughes Table 7). The gap was 45% for family stream migrants (male $12,710, female $6,947) and 62% for humanitarian visa holders (male $10,059, female $3,866). These gaps are comparable to the 48% gap observed for NZ-born taxpayers (male $14,374, female $7,434), indicating they reflect New Zealand's structural gender earnings gap rather than a migration-specific phenomenon.

**Why departure timing matters.** Tax levels tell only half the fiscal story. A student visa holder pays little tax, but students depart relatively quickly. Five years after arrival, only 51% of fee-paying students remain in New Zealand; by ten years, just 35% (Hughes Table 16, 2005 cohort averages). Humanitarian visa holders, by contrast, pay less tax than the NZ-born average but have the highest initial retention rate of any visa type: 87% after five years. Skilled/investor migrants retain at 84% after five years and 62% after eighteen years, while working holiday holders drop to 36% after five years and stabilise at approximately 33% thereafter (Hughes Table 16).

This interaction between annual tax and departure timing is the mechanism that drives the lifecycle results in Section 7. A migrant who pays moderate tax for ten years and then departs may contribute more in NPV terms than one who pays higher tax but remains through retirement. The fiscal selection created by the visa system operates not just on earnings potential but — through its effect on retention — on the expected duration of public expenditure. Before turning to the lifecycle model in Section 7, Section 5 examines a one-off policy event that reshaped the visa composition underlying these patterns.

The synthetic population model translates these annual tax differentials into lifecycle probabilities. Among resident visa holders arriving at age 30, an estimated 64% are net fiscal contributors over their expected New Zealand lifetime, with a p10–p90 range spanning from a net cost of $92,000 to a net contribution of $323,000 (synthetic population output). Non-residential workers at the same age — shorter-tenure but concentrated in peak earning years — show an estimated 86% probability of net contribution, with a tighter range of −$23,000 to +$225,000. Australian citizens at age 30 show a 73% probability. Student visa holders at age 20 show only an estimated 19% probability of net contribution, though their rapid departure limits the aggregate fiscal cost. For comparison, an estimated 49% of the NZ-born at age 30 are net contributors over the lifecycle — the visa system selects for a markedly higher probability of positive fiscal outcomes than the general population produces.

<div data-demo="retention-explorer"></div>

## 5. The 2021 resident visa effect

In late 2021, in response to COVID-19 border closures that had stranded tens of thousands of migrants on temporary visas, the New Zealand government offered a one-off pathway to residence — the 2021 Resident Visa (RV2021). Approximately 165,000 temporary visa holders were eligible (Immigration New Zealand). The policy produced a step-change in the composition of New Zealand's migrant population that is visible across the datasets we analyse.

The most direct evidence appears in the visa category counts from Hughes Table 4. In 2021, 341,000 taxpayers held skilled, investor, or entrepreneur resident visas. By 2024, this had grown to 517,000 — an increase of 176,000 or 52%. Over the same period, temporary work visa holders fell from 197,000 to 93,000, a decline of 105,000 or 53%. Student visa holders fell from 66,000 to 30,000, down 37,000 or 55% (Hughes Table 4). The arithmetic is broadly consistent: roughly 165,000 temporary visa holders were reclassified into resident categories, predominantly into the skilled/investor stream.

**Did the influx dilute per-capita tax?** One concern is that absorbing a large number of former temporary workers into the skilled resident category would lower the average tax contribution of that group. The data suggest otherwise. Per-capita tax for the skilled/investor category was $13,500 in 2021 and rose to $16,100 by 2024 (Hughes Table 4). The former temporary workers — who in 2021 had an average tax of $8,600 per person in the temporary work category — did not drag down the skilled/investor per-capita figure. Two factors explain this: general wage growth over the period lifted all per-capita values, and the reclassified migrants included individuals already earning at levels consistent with the skilled category, having held work-to-residence or essential skills visas.

**The retention effect.** The more consequential fiscal implication is the change in expected retention. Under temporary visas, these migrants had uncertain duration — the data show that only 36% of working holiday holders remain after five years (Hughes Table 16). Conversion to a resident visa changes the expected trajectory. Resident skilled migrants retain at 84% after five years and 62% after eighteen years. If the reclassified migrants adopt retention patterns closer to the resident norm, the RV2021 shifted approximately 165,000 people from low-retention pathways (expected departure within five to ten years) to high-retention pathways (expected residence of twenty years or more).

For the Crown's fiscal accounts, this is a double-edged shift. Higher retention means more years of working-age tax revenue — but also a higher probability of drawing NZ Super and health expenditure in retirement. The net fiscal effect depends on whether the additional working-age tax contributions exceed the additional retirement costs. For a skilled migrant arriving at age 30, our NPV model in Section 7 suggests they do. But migrants who were already in their late 40s or 50s at the time of reclassification may have too few remaining working years to offset retirement costs.

Our model does not separately estimate the fiscal impact of the RV2021 cohort. These migrants have an unusual profile: they already had years of NZ residence and established earnings trajectories, but their retention curves from the point of residence grant may differ from typical skilled migrants who arrive with a residence visa. A full assessment would require IDI-level data linking individual tax histories to visa transitions — precisely the type of analysis this paper is designed to motivate.

The distributional implications of the reclassification can be inferred from the synthetic population model. Among non-residential workers arriving at age 30, an estimated 86% are net contributors over the lifecycle, reflecting high working-age earnings combined with early departure before retirement costs accumulate (synthetic population output). Resident visa holders of the same age show a lower estimated 64% probability of net contribution, because higher retention exposes more individuals to the retirement-age cost phase. By moving approximately 165,000 migrants from temporary to resident retention pathways, the RV2021 likely reduced the share who are net contributors while extending the duration of both their tax payments and their eventual public service claims. Whether the additional working-age revenue outweighs the additional retirement exposure for this specific cohort remains a question that would require IDI-linked analysis to resolve.

<div data-demo="rv2021-shift"></div>

## 6. Nationality and economic integration

Hughes Table 8 tracks median (p50) tax payments by nationality group over time, providing a window into economic integration. We express each nationality group's median tax as a ratio of the NZ-born median at the same age. The most striking pattern is convergence: nationality groups that started with low earnings have systematically moved toward — and in several cases surpassed — the NZ-born benchmark.

**China: the most dramatic convergence.** In 2002, a Chinese migrant in the 30–39 age band paid a median tax of $374 — approximately 8% of the NZ-born median of $4,860 (Hughes Table 8). By 2010, the ratio had reached 68%. By 2020, it stood at 99%. And by 2024, Chinese migrants in their 30s paid $13,010, or 117% of the NZ-born median of $11,134. In two decades, this group moved from among the lowest-taxed nationalities to above-average contributors. The trajectory reflects the evolution of Chinese migration to New Zealand: early cohorts were concentrated in family reunification and business investment pathways with initially low declared income, while recent cohorts are increasingly represented in skilled professional roles.

**Other Asian nationalities** (excluding China, South Asia, and the Philippines) followed a parallel trajectory: from 20% of the NZ-born median in 2002 to 123% by 2024 in the 30–39 age band (Hughes Table 8).

**UK and South Africa: consistently high.** UK migrants in their 30s paid 175% of the NZ-born median in 2002 and 170% in 2024 — an absolute increase from $8,509 to $18,916, but a stable ratio over time (Hughes Table 8). South African migrants were similar at 160% in 2002 and 161% in 2024. Both groups reflect the high initial selection inherent in skilled migration from English-speaking, high-income economies. Their earnings levels have remained well above the NZ-born median throughout the period.

**Philippines: strong and strengthening.** Filipino migrants in their 30s paid 125% of the NZ-born median in 2002, rising to 160% by 2024. In absolute terms, the median Filipino taxpayer in this age band paid $17,866 in 2024 — among the highest of any nationality group (Hughes Table 8). This reflects the occupational profile of Filipino migration to New Zealand, concentrated in health care, trades, and other skilled sectors.

**Pacific Island migrants** maintained a stable position above the NZ-born median throughout the period, with the ratio in the 30–39 band at 113% in 2002 and 129% in 2024 (Hughes Table 8). This reflects the role of Pacific Access Category and Samoan Quota residents, many of whom enter employment-focused pathways.

**South Asian migrants** — the largest foreign-born nationality group by number — present a nuanced profile. In the 30–39 age band, they moved from 90% of the NZ-born median in 2002 to 130% by 2024, with a peak of 150% in 2020 (Hughes Table 8). The subsequent decline from 150% to 130% coincides with the large influx of new residents under the 2021 Resident Visa, which brought in individuals earlier in their New Zealand earnings trajectory.

South Asian migrants span a wide range of visa pathways — from skilled professionals in information technology and health care to workers in hospitality and agriculture via student-to-residence and work-to-residence routes. The per-capita data reflects this breadth. The group also includes a high proportion of family stream and dependent visa holders, who may not be primary earners. The South Asian lifecycle NPV at age 30 is an estimated net contribution of $160,000, with a surplus of $88,000 over the NZ-born benchmark (NPV model output) — a positive fiscal outcome driven by the group's high retention combined with above-average tax in the 30–39 age band.

**Lifecycle NPV by nationality.** The NPV model, which uses per-capita mean tax rather than the median, confirms the fiscal importance of nationality of origin. US and Canadian migrants arriving at age 30 have an estimated lifecycle fiscal contribution of $298,000, with a surplus of $226,000 over the NZ-born benchmark. UK migrants are similar at $275,000 (surplus $203,000). South African migrants contribute $232,000 (surplus $161,000), and Filipino migrants $189,000 (surplus $117,000). These groups combine high tax premiums — 95% above the NZ-born mean for UK and US/Canadian migrants at age 30 — with moderate retention rates that limit retirement-age expenditure (NPV model output).

Chinese migrants at age 30 show an estimated contribution of $47,000, below the NZ-born benchmark of $72,000 (NPV model output). This reflects the lower mean tax in the 2019 matching year, before the convergence documented above had fully materialised. An updated model using 2024 tax data would yield a higher estimate for this group — a reminder that static point-in-time estimates understate the fiscal contribution of nationality groups on an upward earnings trajectory. Section 7 combines these visa- and nationality-specific tax patterns with retention probabilities into lifecycle NPV estimates.

The synthetic population estimates add an important caveat to these nationality-level averages. Within every visa category, the gap between mean and median lifecycle NPV is wide: for resident visa holders at age 30, the estimated mean contribution is $88,000 but the estimated median is $41,000 (synthetic population output). This positive skewness — driven by the right tail of high earners — means that the mean lifecycle contribution reported for each nationality group is pulled upward by a minority of very high contributors. Median outcomes are roughly half the mean. The within-category p10–p90 range of −$92,000 to +$323,000 for resident visa holders at age 30 suggests that every nationality group, regardless of its mean contribution, contains individuals spanning the full range from net cost to net contribution.

<div data-demo="nationality-convergence"></div>

## 7. Lifecycle net fiscal impact

The preceding sections established that migrants pay varying amounts of tax and remain in New Zealand for varying durations. The lifecycle NPV model combines these two dimensions — annual fiscal contribution and retention probability — into a single present-value estimate of each migrant's net fiscal impact from arrival to age 85.

### 7.1 The headline results

A skilled/investor migrant arriving at age 30 has an estimated net fiscal contribution of $132,100 in present value terms (2018/19 NZD, discounted at 3.5%). The NZ-born equivalent over the same age range is $71,600. The skilled migrant contributes approximately $60,500 more than the NZ-born benchmark — a fiscal surplus of 85% (NPV model output).

Other visa types at age 30 are also net contributors in absolute terms: skilled work visa holders contribute an estimated $113,300, Australian citizens $114,800, working holiday holders $43,700, and family stream migrants $39,600. Humanitarian visa holders contribute $2,100 — a marginal net positive, essentially break-even. Only student visa holders show a near-zero result at an estimated net cost of $300 (NPV model output). In sign convention, all visa types except students generate a net fiscal surplus for the Crown over their expected New Zealand lifetime.

The synthetic population estimates developed in section 2.6 suggest the distribution of individual outcomes behind these group means. For resident visa holders arriving at age 30 — a composite category encompassing skilled, family, and humanitarian streams — the estimated p10–p90 range spans from a net cost of $92,000 to a net contribution of $323,000, with 64% estimated to be net contributors (synthetic population output). Across the full synthetic population of 500,000 individuals, an estimated 28% are net fiscal contributors over the lifecycle — a figure that includes children, retirees, and other age groups who are structurally net recipients. The distribution is positively skewed: the estimated mean contribution of $88,000 for resident arrivals at age 30 exceeds the median of $41,000 by a factor of more than two, indicating that the fiscal surplus reported above is concentrated among a subset of higher earners.

### 7.2 Why the gap exists

Three mechanisms drive the surplus of skilled migrants over the NZ-born.

First, **higher annual tax during working years**. The skilled migrant premium of $2,292 per year at age 30 — 21% above the NZ-born mean — accumulates over approximately three decades of working life (Hughes Table 4, 2019 tax year).

Second, **lower benefit receipt in early years**. Migrants face a two-year benefit stand-down, and temporary visa holders are excluded from Working for Families and other income support. These eligibility restrictions reduce government expenditure during the initial years of residence.

Third, and most consequentially, **out-migration before retirement** — the "out-migration dividend." A skilled migrant who arrives at age 30 has a 44% probability of still being in New Zealand at age 65, based on exponential decay extrapolation of observed retention rates (Hughes Table 16, 2005 cohort). The NZ-born equivalent is, by construction, 100%. This means 56% of skilled migrants avoid drawing NZ Superannuation and the elevated health expenditure of retirement.

### 7.3 The fiscal components

The fiscal components data illustrates this mechanism. Weighted by retention probability (but undiscounted), a skilled migrant arriving at age 30 generates approximately $895,000 in lifetime tax revenue (direct and indirect), against approximately $502,000 in government expenditure — including $361,000 in income support, $129,000 in health, and $12,000 in education. The NZ-born equivalent generates more revenue ($1,409,000) but incurs far higher costs ($1,243,000), driven by health expenditure of $346,000 and income support of $881,000 over the full lifecycle at retention 1.0 (NPV model, fiscal components output).

The difference is concentrated in the retirement years. At age 75, a NZ-born individual draws $34,200 per year in net fiscal cost (NZ Super plus health minus residual tax), and 100% of NZ-born are present to draw it. A skilled migrant at the same age faces the same per-year cost, but only 36% are still in New Zealand (Wright and Nguyen; Hughes Table 16). The retention-weighted retirement cost is therefore a fraction of the NZ-born equivalent.

At the household level, the annual fiscal balance shifts. A representative migrant family — primary applicant earning $53,000 per year, non-earning spouse, and three dependent children — has an estimated annual net fiscal cost of $68,400 in the year of arrival, driven by education and health expenditure on children at approximately $21,400 per child per year (synthetic population output). This compares with an NZ-born family of similar composition at a net cost of $58,600. The primary applicant alone is a net contributor of approximately $2,500 per year; it is the dependants who tip the household balance to a net cost. A working holiday couple with no children, by contrast, shows a combined annual net contribution of $5,700. These household-level figures are point-in-time snapshots — over the lifecycle, children age into working years and the household fiscal balance improves — but they illustrate how family composition dilutes the individual-level fiscal advantage of working-age migrants.

### 7.4 Variation by arrival age

NPV is sensitive to arrival age because this determines how many working years occur before retirement:

- **Age 20**: estimated NPV of −$79,300 (surplus $39,200). A long potential working life, but some early years spent in education or low-paid employment.
- **Age 30**: estimated NPV of −$132,100 (surplus $60,500). Sufficient working years at skilled earnings levels, with out-migration reducing retirement costs.
- **Age 40**: estimated NPV of −$142,500 (surplus $93,200). The surplus exceeds that of age-30 arrivals because the NZ-born benchmark at 40 is weaker — fewer remaining high-contribution years before the transition to net cost.
- **Age 50**: estimated NPV of −$61,700 (surplus $138,500). Fewer working years remaining, but the NZ-born at 50 is approaching net cost status rapidly, and the migrant's out-migration probability at 65 remains high.
- **Age 55**: estimated NPV of +$30,100 — a net cost to the Crown. Only ten working years before NZ Super eligibility. But the NZ-born at 55 costs an estimated $193,400, so the skilled migrant is still $163,300 less expensive than the domestic alternative (NPV model output).

The pattern is clear: even when older arrivals are net fiscal costs in absolute terms, they are consistently less costly than NZ-born individuals of the same age, because out-migration reduces expected retirement expenditure.

### 7.5 Students and humanitarian visa holders

The near-zero NPV for students ($300 net cost at age 30) reflects two offsetting forces: low tax — $1,357 per-capita mean, 87% below the NZ-born (Hughes Table 4, 2019) — but rapid departure, with only 35% remaining after ten years (Hughes Table 16). Students who leave quickly cost the government little beyond their study period. Tuition fee revenue, a separate government income stream from international students, is not captured in the income tax data; if included, students would likely show a positive fiscal contribution.

Humanitarian visa holders are near break-even ($2,100 net contribution at age 30) despite the lowest per-capita tax of any category. Their high retention — 87% at five years, 61% at eighteen years (Hughes Table 16) — means they draw public services for extended periods, but their working-age tax contributions, combined with migrant-specific expenditure adjustments (benefit stand-down, healthy migrant effect), are sufficient to offset the costs.

### 7.6 Sensitivity

The NPV estimates are sensitive to three parameters. The **discount rate** has the largest effect: a lower rate (for example, 2%) would increase the present value of distant retirement costs, narrowing the migrant–NZ-born surplus for younger arrivals. A higher rate (5%) would compress all NPV differences. **Retention assumptions** matter most for the out-migration dividend: if skilled migrants stay longer than the base case projects, they draw more NZ Super and the surplus falls; if they leave sooner, it rises. The **10-year NZ Super residence requirement** amplifies the out-migration effect by delaying the single largest expenditure item, giving migrants who leave before qualifying a disproportionate fiscal advantage.

These directional sensitivities indicate that the skilled migrant surplus is robust to reasonable parameter variation, though the absolute magnitude of the surplus will shift. Formal sensitivity analysis across a range of discount rates and retention scenarios is a natural extension of this proof of concept.

<div data-demo="npv-calculator"></div>

<div data-demo="npv-distribution"></div>

### Household-level analysis

Understanding the fiscal impact of complete family units — including spouses and children — provides a more realistic picture than individual analysis alone.

<div data-demo="household-npv"></div>

## 8. Caveats and limitations

**Cross-sectional matching, not longitudinal tracking.** This analysis observes different cohorts of migrants at a single point in time and constructs a synthetic lifecycle by combining age-specific tax profiles with visa-specific retention curves. It does not track the same individuals over time. This approach may overstate convergence if later cohorts are fundamentally different from earlier ones, or understate it if recent arrivals have steeper earnings growth than their predecessors.

**Summary-level data, not individual microdata.** The analysis uses published tables, not unit-record data from the Integrated Data Infrastructure. We cannot control for individual characteristics — education, occupation, region, household composition — or match the same individuals across datasets. Migrants who pay high tax may differ from NZ-born high earners in ways that affect their future fiscal trajectory.

**Fiscal template vintage.** The government expenditure side of the model draws on Wright and Nguyen's 2018/19 fiscal incidence estimates. Government spending patterns — particularly health expenditure levels, NZ Super rates, and benefit structures — have changed since 2018/19. The tax side uses the 2019 matching year from Hughes, which is well aligned with the fiscal template, but the model does not capture structural shifts in government expenditure over the subsequent five years.

**NZ-average expenditure template.** Government spending on health, education, and welfare is assumed to follow the NZ population-average age profile. Migrants may differ — for instance, lower welfare uptake in early years, different health service utilisation patterns, or different education spending if children arrive mid-schooling. The healthy migrant and benefit stand-down adjustments capture some of this variation, but the expenditure template remains an approximation.

**No second-round effects.** The model captures direct fiscal flows — taxes paid minus government spending received. It does not capture indirect effects: impacts on housing demand, infrastructure requirements, wage competition, labour market complementarities, or productivity spillovers. These second-round effects could be positive (agglomeration, skill complementarities) or negative (congestion, housing pressure), and their omission is a material limitation for policy purposes.

**Retention extrapolation.** Actual retention data extends to 18 years for the 2005 cohort (24 years for the earliest cohorts, though with thinner data). Beyond this horizon, retention is extrapolated using an exponential decay function fitted on years 10 to 18. The NPV estimates are sensitive to this extrapolation: longer actual retention increases NZ Super exposure and reduces the surplus, while shorter retention amplifies it.

**Healthy migrant approximation.** Working-age migrants are assumed to consume 85% of NZ-average health expenditure, reflecting international evidence on the "healthy migrant effect." This is an approximation applied uniformly across all visa types and nationalities. NZ-specific evidence on migrant health expenditure would improve the precision of this adjustment.

**NZ Super eligibility simplification.** We assume NZ Super eligibility after 10 years of continuous residence from age 20 and attainment of age 65. This does not model partial entitlements under bilateral social security agreements, the effect of interrupted residence, or the possibility that some migrants accumulate eligibility across multiple periods of residence.

Despite these limitations, the direction and broad magnitude of the findings are robust. Skilled migrants are net fiscal contributors under any reasonable set of assumptions. The precise quantum of the surplus is less certain, and formal sensitivity analysis — across discount rates, retention scenarios, and expenditure assumptions — is a natural extension of this proof of concept.

## 9. Conclusion and next steps

This analysis finds that skilled migrants arriving in their 20s to 40s are net fiscal contributors to the New Zealand Crown. A skilled migrant arriving at age 30 contributes an estimated $60,500 more than the NZ-born equivalent over the lifecycle. The primary mechanism is out-migration before retirement: 56% of skilled migrants arriving at age 30 leave before age 65, paying tax during peak earning years but never drawing NZ Superannuation or the elevated health costs of old age. This out-migration dividend is the dominant driver of the fiscal surplus.

The synthetic population extension developed in section 2.6 adds distributional detail: among resident arrivals at age 30, an estimated 64% are net contributors over the lifecycle, with individual outcomes ranging from a net cost of $92,000 to a net contribution of $323,000 (p10–p90). The fiscal advantage of migration operates across most of the individual outcome range, not merely at the mean.

The analysis demonstrates that meaningful lifecycle fiscal estimates can be derived from publicly available Treasury data. The approach is deliberately simple — combining two published datasets with standard NPV techniques and migrant-specific eligibility adjustments. It produces estimates that are broadly consistent in direction and magnitude with international evidence, including the Australian Treasury's lifecycle fiscal model (Varela et al., 2021).

The natural extension is a full lifecycle model using the Integrated Data Infrastructure (IDI), which would allow:

- individual-level matching of tax payments, benefit receipt, and public service use
- household-level analysis linking primary migrants with spouses and dependent children
- panel tracking of actual cohorts over time, replacing the synthetic lifecycle approach
- proper treatment of return migration and re-entry
- expenditure-side differentiation by migrant status, rather than NZ-average templates

The Australian Treasury model (Varela et al., 2021) provides a direct benchmark: their analysis framework uses linked administrative data to estimate fiscal impact by visa category and arrival age — precisely the type of analysis New Zealand is well positioned to replicate using the IDI.

### What if settings changed?

The interactive scenario explorer below allows readers to examine how changes to visa composition, retention rates, and NZ Super eligibility thresholds affect the aggregate fiscal picture.

<div data-demo="policy-scenario"></div>

As New Zealand's population ages and the fiscal cost of NZ Superannuation grows, understanding the fiscal profile of migration becomes increasingly relevant to long-run fiscal sustainability. The evidence in this paper — that the migration system selects for fiscal contributors who moderate the Crown's retirement-age expenditure exposure — is relevant to Treasury's 2025 Long-Term Fiscal Statement and to the broader policy conversation about New Zealand's migration settings.

## References

Hughes, T. (2026). *Personal income tax paid in New Zealand by migrants.* New Zealand Treasury Analytical Note AN 26/02.

Wright, M. and Nguyen, D. (2024). *The fiscal incidence of New Zealand's tax and spending: 2018/19 update.* New Zealand Treasury Analytical Note AN 24/09.

Varela, P., Husek, N., McDonald, S., and Converse, B. (2021). *Estimating the fiscal impact of immigration: An analysis framework.* Australian Treasury Working Paper 2021-01.
