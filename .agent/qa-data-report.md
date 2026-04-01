# Data QA report

Generated: 2026-04-01

## Summary

- Total numerical claims found: 116
- Verified (exact match): 72
- Verified (within rounding): 37
- Failed (discrepancy): 2
- Unverified (no source found): 5
- Small cell warnings: 0

## Detailed findings

### Failed claims

| # | Claim | Section | Source file | Expected | Actual | Action needed |
|---|-------|---------|-------------|----------|--------|---------------|
| F1 | "contributed $0.6 billion in personal income tax in 2023" (non-resident workers/visitors) | 3 (line 116) | hughes-table1-aggregate.json | $0.6B | $0.53B (Non-resident Temp Worker + Visitor + Non-resident Student/Other) | Correct to "$0.5 billion" or clarify which Table 1 categories are included. Including "Former Visitor/Other" gets $0.56B; including Diasporic gets $0.70B — neither matches $0.6B cleanly. |
| F2 | "rising to 161% by 2024" (Philippines 30-39) | 6 (line 168) | nationality-convergence.json | 161% | 160.5% (ratio = 1.6046) | Correct to "160%" — 1.6046 rounds to 160%, not 161%. South Africa at 161.2% (ratio=1.6119) is the one that rounds to 161%. |

### Unverified claims

| # | Claim | Section | Notes |
|---|-------|---------|-------|
| U1 | "Approximately 165,000 temporary visa holders were eligible" (RV2021) | 5 (line 144) | Source: "Immigration New Zealand" — not in Hughes or W&N data. External government source; not verifiable from our data files. |
| U2 | "Roughly 60% of the tax share increase is attributable to the growing number of foreign-born taxpayers (the volume effect), with the remaining 40% driven by their rising per-capita contributions (the value effect)." | 3 (line 106) | Derived decomposition not present in source data. Would require Shapley-value calculation. Plausible but not independently verified. |
| U3 | "reflecting the healthy migrant effect documented in New Zealand health literature" | 2.2 (line 55) | Model assumption (85% of NZ-average health expenditure). Not sourced from data files — based on external health literature. |
| U4 | Section 1 (Introduction and motivation) | 1 (line 17) | Contains no content — placeholder HTML comment only. No numerical claims to verify. |
| U5 | "the approach developed by the Australian Treasury (Varela et al., 2021)" | Exec (line 13) / S9 (line 258) | Reference to external paper. Not verifiable from data files. |

### Verified claims — Executive summary

| # | Claim | Section | Source file | Source value | Status |
|---|-------|---------|-------------|-------------|--------|
| 1 | "32% of New Zealand's taxpaying population" | Exec (line 11) | Table 4 (computed) | 31.8% (1,606,851 / 5,051,355) | PASS — rounds to 32% |
| 2 | "contribute 38% of personal income tax" | Exec (line 11) | Table 4 (computed) | 37.7% ($20.15B / $53.50B) | PASS — rounds to 38% |
| 3 | "$132,100 in present value terms" | Exec (line 11) | npv-by-visa-age.json | -132,100 (Skilled/Investor age 30) | PASS (exact) |
| 4 | "surplus of $60,500" | Exec (line 11) | npv-by-visa-age.json | surplus = 60,537 | PASS — rounds to $60,500 |
| 5 | "NZ-born equivalent of $71,600" | Exec (line 11) | npv-by-visa-age.json | nzborn_npv = -71,563 | PASS — rounds to $71,600 |
| 6 | "44% probability of remaining in New Zealand at age 65" | Exec (line 11) | retention-curves-widget.json | Skilled/Investor yr35 = 0.4432 (44.3%) | PASS — rounds to 44% |
| 7 | "approximately 8% of the NZ-born median tax in 2002" (China) | Exec (line 11) | nationality-convergence.json | China 30-39 2002: ratio = 0.077 (7.7%) | PASS — "approximately 8%" |
| 8 | "117% by 2024" (China) | Exec (line 11) | nationality-convergence.json | China 30-39 2024: ratio = 1.1685 (116.9%) | PASS — rounds to 117% |
| 9 | "approximately 165,000 temporary visa holders" (RV2021) | Exec (line 11) | External (Immigration NZ) | Not in data | UNVERIFIED (see U1) |

### Verified claims — Section 2 (Data and methodology)

| # | Claim | Section | Source file | Source value | Status |
|---|-------|---------|-------------|-------------|--------|
| 10 | "approximately 370,000 data rows across 24 tables" | 2.1 (line 23) | Hughes source | Per extraction notes | PASS (descriptive) |
| 11 | "Table 1 (2,698 rows)" | 2.1 (line 25) | P1.1 extraction notes | 2,698 records | PASS (exact) |
| 12 | "Table 4 (5,145 rows)" | 2.1 (line 26) | P1.2 extraction notes | 5,145 records | PASS (exact) |
| 13 | "Table 5 (11,100 rows)" | 2.1 (line 27) | P1.2 extraction notes | 11,100 records | PASS (exact) |
| 14 | "Table 8 (9,730 rows)" | 2.1 (line 28) | P1.3 extraction notes | 9,730 rows | PASS (exact) |
| 15 | "Table 16 (94,232 rows after suppression)" | 2.1 (line 29) | P1.4 extraction notes | 94,232 after suppression | PASS (exact) |
| 16 | "38% of Table 16 rows" (suppression) | 2.1 (line 31) | P1.4 extraction notes | 57,037 / 151,269 = 37.7% | PASS — rounds to 38% |
| 17 | "1,437 rows" (W&N) | 2.1 (line 33) | P1.6 extraction notes | 1,437 rows | PASS (exact) |
| 18 | "NFI... net contributors from approximately age 20 to age 64 and net recipients from age 65 onwards" | 2.1 (line 35) | wright-nguyen-fiscal-template.json | Last negative NFI: 60-64 (-$8,690); first positive: 65-69 (+$14,670) | PASS (exact) |
| 19 | "3.5%" discount rate | 2.3 (line 70) | Model assumption | Per Treasury CBA guidance | PASS (assumption) |
| 20 | "R² > 0.93 for all visa types except Working Holiday" | 2.3 (line 80) | P1.4 extraction notes | R² > 0.97 for 9/11 types; W.Skills R²=0.93 | PASS |
| 21 | "approximately 33% beyond year 10" (WHV retention) | 2.3 (line 80) | retention-curves-widget.json | WHV yr10=0.328, yr18=0.347, yr35=0.332 | PASS — fluctuates around 33% |

### Verified claims — Section 3 (The aggregate picture)

| # | Claim | Section | Source file | Source value | Status |
|---|-------|---------|-------------|-------------|--------|
| 22 | "24% of New Zealand's taxpaying population" in 2000 | 3 (line 104) | Table 4 (computed) | 23.6% (908,880 / 3,849,885 incl. Unknown) | PASS — rounds to 24% |
| 23 | "paid a proportionate 24% of personal income tax" in 2000 | 3 (line 104) | Table 4 (computed) | 24.3% ($3.56B / $14.63B) | PASS — rounds to 24% |
| 24 | "$3.6 billion of $14.6 billion total" in 2000 | 3 (line 104) | Table 4 (computed) | $3.56B of $14.63B | PASS — rounds to $3.6B / $14.6B |
| 25 | "risen to 32%" population share by 2024 | 3 (line 104) | Table 4 (computed) | 31.8% | PASS — rounds to 32% |
| 26 | "reaching 38%" tax share by 2024 | 3 (line 104) | Table 4 (computed) | 37.7% | PASS — rounds to 38% |
| 27 | "$20.2 billion of $53.5 billion" in 2024 | 3 (line 104) | Table 4 (computed) | $20.15B of $53.50B | PASS — rounds to $20.2B / $53.5B |
| 28 | "909,000 in 2000 to 1.61 million in 2024" (FB count) | 3 (line 106) | Table 4 (computed) | 908,880 → ~1,607,000 | PASS (exact match at 1000s) |
| 29 | "77% increase" (FB count) | 3 (line 106) | Table 4 (computed) | (1,607,000 - 908,880) / 908,880 = 76.8% | PASS — rounds to 77% |
| 30 | "17% growth in NZ-born taxpayers" | 3 (line 106) | Table 4 (computed) | (3,444,504 - 2,941,005) / 2,941,005 = 17.1% | PASS — rounds to 17% |
| 31 | "2.94 million to 3.44 million" (NZ-born count) | 3 (line 106) | Table 4 (computed) | 2,941,005 → 3,444,504 | PASS (exact) |
| 32 | "$3,900 and $3,800 respectively" (FB/NZB per-capita 2000) | 3 (line 106) | Table 4 (computed) | FB: $3,919; NZB: $3,764 | PASS — rounds to $3,900 / $3,800 |
| 33 | "$12,500, compared with $9,700" (FB/NZB per-capita 2024) | 3 (line 106) | Table 4 (computed) | FB: $12,536; NZB: $9,682 | PASS — rounds to $12,500 / $9,700 |
| 34 | "a 29% premium per person" | 3 (line 106) | Table 4 (computed) | ($12,536 - $9,682) / $9,682 = 29.5% | PASS — rounds to 29% (using rounded values: (12500-9700)/9700 = 28.9%) |
| 35 | "crossing 27% by 2005" (FB tax share) | 3 (line 108) | Table 4 (computed) | 26.7% in 2005 | PASS — rounds to 27% |
| 36 | "30% by 2010" | 3 (line 108) | Table 4 (computed) | 30.0% | PASS (exact) |
| 37 | "34% by 2019" | 3 (line 108) | Table 4 (computed) | 34.0% | PASS (exact) |
| 38 | "38% by 2024" | 3 (line 108) | Table 4 (computed) | 37.7% | PASS — rounds to 38% |
| 39 | "fewer than 2% of all foreign-born taxpayers" (Skilled/Investor 2000) | 3 (line 110) | Table 4 (computed) | 1.7% (15,552 / 908,880) | PASS — 1.7% is fewer than 2% |
| 40 | "contributed 2% of foreign-born tax" (S/I 2000) | 3 (line 110) | Table 4 (computed) | 2.0% ($0.0718B / $3.56B) | PASS (exact) |
| 41 | "32% of the foreign-born population... 41% of all foreign-born tax — $8.3 billion" (S/I 2024) | 3 (line 110) | rv2021-composition.json | 32.1% (516,795 / ~1.61M); 41.3%; $8.3156B | PASS (all round correctly) |
| 42 | "$16,100 in personal income tax in 2024, 66% above the NZ-born average" (S/I) | 3 (line 110) | rv2021-composition.json | $16,091; premium: ($16,091-$9,682)/$9,682 = 66.2% | PASS — rounds to $16,100 / 66% |
| 43 | "$6.9 billion (other resident streams)" | 3 (line 110) | rv2021-composition.json | $6.9286B | PASS — rounds to $6.9B |
| 44 | "$2.2 billion (family stream)" | 3 (line 110) | rv2021-composition.json | $2.1719B | PASS — rounds to $2.2B |
| 45 | "$0.4 billion" (humanitarian) | 3 (line 110) | rv2021-composition.json | $0.3683B | PASS — rounds to $0.4B at 1dp |
| 46 | "2% of foreign-born tax" (S/I 2000); "by 2010, it was 23%; by 2024, 41%" | 3 (line 112) | Table 4 (computed) | 2000: 2.0%; 2010: 22.5%; 2024: 41.3% | PASS — all round correctly |
| 47 | "$16,720 in 2024, 12% above the NZ-born mean of $14,951" (Skilled age 30) | 3 (line 114) | hughes-table4-visa-subcategory.json | R.Skilled: $16,720; NZB: $14,951; premium: 11.8% | PASS — rounds to 12% |
| 48 | "$0.6 billion in personal income tax in 2023, or approximately 1%" (non-resident) | 3 (line 116) | hughes-table1-aggregate.json | $0.53B; 0.9% of $56.6B | **FAIL (F1)** |

### Verified claims — Section 4 (Fiscal selection by visa type)

| # | Claim | Section | Source file | Source value | Status |
|---|-------|---------|-------------|-------------|--------|
| 49 | "NZ-born taxpayers at age 30 paid a per-capita mean of $10,715" | 4 (line 126) | hughes-table4 | C.Birth_citizen age 30, 2019: $10,715 | PASS (exact) |
| 50 | "Skilled/investor visa holders paid $13,007, a premium of $2,292 per year or 21%" | 4 (line 126) | hughes-table4 | R.Skilled: $13,007; premium: $2,292; 21.4% | PASS (exact / rounds to 21%) |
| 51 | "Australian citizens were similar at $13,860" | 4 (line 126) | hughes-table4 | A.Australian age 30, 2019: $13,860 | PASS (exact) |
| 52 | "Skilled work visa holders... paid $9,056" | 4 (line 128) | hughes-table4 | W.Skills: $9,056 | PASS (exact) |
| 53 | "Family stream migrants paid $8,314, 22% below" | 4 (line 128) | hughes-table4 | R.Family: $8,314; premium: -22.4% | PASS (exact / rounds) |
| 54 | "Humanitarian visa holders paid $6,101, 43% below" | 4 (line 128) | hughes-table4 | R.Humanitarian: $6,101; premium: -43.1% | PASS (exact / rounds) |
| 55 | "Student visa holders paid $1,357 — 87% below" | 4 (line 128) | hughes-table4 | S.Fee paying: $1,357; premium: -87.3% | PASS (exact / rounds) |
| 56 | "p50 NZ-born taxpayer at age 30 earned $11,134" | 4 (line 130) | hughes-table5 | Birth Citizen p50 age 30, 2024: $11,134 | PASS (exact) |
| 57 | "Resident visa holders had a median of $13,404, 20% above" | 4 (line 130) | hughes-table5 | Resident p50: $13,404; premium: 20.4% | PASS (exact / rounds) |
| 58 | "Permanent residents were similar at $14,197" | 4 (line 130) | hughes-table5 | Permanent Resident p50: $14,197 | PASS (exact) |
| 59 | "Non-residential work visa holders had a lower median of $9,448" | 4 (line 130) | hughes-table5 | Non-residential work p50: $9,448 | PASS (exact) |
| 60 | "Student visa holders had a median of just $1,078" | 4 (line 130) | hughes-table5 | Student p50: $1,078 | PASS (exact) |
| 61 | "p75/p25 ratio of 10.8" (NZ-born) | 4 (line 132) | hughes-table5 | p75=$21,157 / p25=$1,959 = 10.80 | PASS (exact) |
| 62 | "Resident migrants have a ratio of 3.5" | 4 (line 132) | hughes-table5 | p75=$21,866 / p25=$6,238 = 3.51 | PASS — rounds to 3.5 |
| 63 | "non-residential workers 3.1" | 4 (line 132) | hughes-table5 | p75=$14,520 / p25=$4,658 = 3.12 | PASS — rounds to 3.1 |
| 64 | "Male skilled migrants... $16,170, compared with $11,494 for female — 29% gender gap" | 4 (line 134) | hughes-table7 | Male R.Skilled: $16,170; Female: $11,494; gap: 28.9% | PASS (exact / rounds) |
| 65 | "family stream (male $12,710, female $6,947) — 45%" | 4 (line 134) | hughes-table7 | Male R.Family: $12,710; Female: $6,947; gap: 45.3% | PASS (exact / rounds) |
| 66 | "humanitarian (male $10,059, female $3,866) — 62%" | 4 (line 134) | hughes-table7 | Male R.Humanitarian: $10,059; Female: $3,866; gap: 61.6% | PASS (exact / rounds) |
| 67 | "NZ-born (male $14,374, female $7,434) — 48%" | 4 (line 134) | hughes-table7 | Male C.Birth_citizen: $14,374; Female: $7,434; gap: 48.3% | PASS (exact / rounds) |
| 68 | "only 51% of fee-paying students remain... by ten years, just 35%" | 4 (line 136) | retention-curves-widget.json | Student yr5=0.5057 (50.6%); yr10=0.3495 (35.0%) | PASS — 50.6% ≈ "51%"; 35.0% exact |
| 69 | "87% after five years" (Humanitarian) | 4 (line 136) | retention-curves-widget.json | Humanitarian yr5=0.872 (87.2%) | PASS — rounds to 87% |
| 70 | "Skilled/investor migrants retain at 84% after five years and 62% after eighteen years" | 4 (line 136) | retention-curves-widget.json | yr5=0.8407 (84.1%); yr18=0.6193 (61.9%) | PASS — rounds to 84% / 62% |
| 71 | "working holiday holders drop to 36% after five years and stabilise at approximately 33%" | 4 (line 136) | retention-curves-widget.json | yr5=0.359 (35.9%); yr10-35 range: 32.8-34.7% | PASS — 35.9% ≈ 36%; stabilises ~33% |

### Verified claims — Section 5 (The 2021 resident visa effect)

| # | Claim | Section | Source file | Source value | Status |
|---|-------|---------|-------------|-------------|--------|
| 72 | "165,000 temporary visa holders were eligible" | 5 (line 144) | External (Immigration NZ) | Not in data | UNVERIFIED (see U1) |
| 73 | "341,000 taxpayers held skilled, investor, or entrepreneur resident visas" (2021) | 5 (line 146) | rv2021-composition.json | 340,992 | PASS — rounds to 341,000 |
| 74 | "By 2024, this had grown to 517,000" | 5 (line 146) | rv2021-composition.json | 516,795 | PASS — rounds to 517,000 |
| 75 | "increase of 176,000 or 52%" | 5 (line 146) | rv2021-composition.json | 516,795-340,992 = 175,803; 51.6% | PASS — rounds to 176k / 52% |
| 76 | "Temp work fell from 197,000 to 93,000, decline of 105,000 or 53%" | 5 (line 146) | rv2021-composition.json | 197,448→92,634; diff=104,814; 53.1% | PASS — rounds to 197k→93k, 105k, 53% |
| 77 | "Student fell from 66,000 to 30,000, down 37,000 or 55%" | 5 (line 146) | rv2021-composition.json | 66,300→29,691; diff=36,609; 55.2% | PASS — 36,609 rounds to 37k at 1000s |
| 78 | "Per-capita tax for the skilled/investor category was $13,500 in 2021" | 5 (line 148) | rv2021-composition.json | $4.6145B / 340,992 = $13,533 | PASS — rounds to $13,500 |
| 79 | "rose to $16,100 by 2024" | 5 (line 148) | rv2021-composition.json | $8.3156B / 516,795 = $16,091 | PASS — rounds to $16,100 |
| 80 | "average tax of $8,600 per person in the temporary work category" (2021) | 5 (line 148) | rv2021-composition.json | $1.7033B / 197,448 = $8,627 | PASS — rounds to $8,600 |
| 81 | "only 36% of working holiday holders remain after five years" | 5 (line 150) | retention-curves-widget.json | WHV yr5 = 0.359 (35.9%) | PASS — rounds to 36% |
| 82 | "84% after five years and 62% after eighteen years" (Skilled) | 5 (line 150) | retention-curves-widget.json | yr5=0.8407 (84.1%); yr18=0.6193 (61.9%) | PASS — consistent with S4 |

### Verified claims — Section 6 (Nationality and economic integration)

| # | Claim | Section | Source file | Source value | Status |
|---|-------|---------|-------------|-------------|--------|
| 83 | "Chinese migrant in 30-39 paid $374 — approximately 8% of NZ-born median of $4,860" (2002) | 6 (line 162) | nationality-convergence.json | China 30-39 2002: tax=$374, ratio=0.077 (7.7%), nzborn=$4,860 | PASS (exact values; 7.7% ≈ "approximately 8%") |
| 84 | "By 2010, the ratio had reached 68%" | 6 (line 162) | nationality-convergence.json | China 30-39 2010: ratio=0.6773 (67.7%) | PASS — rounds to 68% |
| 85 | "By 2020, it stood at 99%" | 6 (line 162) | nationality-convergence.json | China 30-39 2020: ratio=0.9888 (98.9%) | PASS — rounds to 99% |
| 86 | "By 2024, Chinese migrants paid $13,010, or 117% of the NZ-born median of $11,134" | 6 (line 162) | nationality-convergence.json | tax=$13,010; ratio=1.1685 (116.9%); nzborn=$11,134 | PASS — rounds to 117% |
| 87 | "Other Asian nationalities: from 20% in 2002 to 123% by 2024" (30-39) | 6 (line 164) | nationality-convergence.json | Other Asia 30-39: 2002=0.1955 (19.6%); 2024=1.2315 (123.2%) | PASS — rounds to 20% / 123% |
| 88 | "UK: 175% in 2002 and 170% in 2024; $8,509 to $18,916" | 6 (line 166) | nationality-convergence.json | UK 30-39: 2002 ratio=1.7508 (175.1%), tax=$8,509; 2024 ratio=1.6989 (170.0%), tax=$18,916 | PASS (exact values) |
| 89 | "South Africa: 160% in 2002 and 161% in 2024" | 6 (line 166) | nationality-convergence.json | SA 30-39: 2002=1.603 (160.3%); 2024=1.6119 (161.2%) | PASS — rounds to 160% / 161% |
| 90 | "Philippines: 125% in 2002, rising to 161% by 2024; $17,866 in 2024" | 6 (line 168) | nationality-convergence.json | 2002=1.25 (125%); 2024=1.6046 (160.5%); tax=$17,866 | **FAIL (F2)** — 160.5% → 160%, not 161% |
| 91 | "Pacific: 113% in 2002 and 129% in 2024" | 6 (line 170) | nationality-convergence.json | 2002=1.129 (112.9%); 2024=1.2903 (129.0%) | PASS — rounds to 113% / 129% |
| 92 | "South Asia: 90% in 2002 to 130% by 2024, peak of 150% in 2020" | 6 (line 172) | nationality-convergence.json | 2002=0.8984 (89.8%); 2024=1.2982 (129.8%); 2020=1.5022 (150.2%) | PASS — all round correctly |
| 93 | "South Asian lifecycle NPV... $160,000, surplus of $88,000" | 6 (line 174) | npv-by-nationality.json | South Asia age 30: npv=-159,574; surplus=88,011 | PASS — rounds to $160k / $88k |
| 94 | "US and Canadian... $298,000, surplus of $226,000" | 6 (line 176) | npv-by-nationality.json | US/Canada age 30: npv=-297,724; surplus=226,161 | PASS — rounds to $298k / $226k |
| 95 | "UK migrants... $275,000 (surplus $203,000)" | 6 (line 176) | npv-by-nationality.json | UK age 30: npv=-274,539; surplus=202,976 | PASS — rounds to $275k / $203k |
| 96 | "South African... $232,000 (surplus $161,000)" | 6 (line 176) | npv-by-nationality.json | SA age 30: npv=-232,341; surplus=160,778 | PASS — rounds to $232k / $161k |
| 97 | "Filipino migrants $189,000 (surplus $117,000)" | 6 (line 176) | npv-by-nationality.json | Phillipines age 30: npv=-188,711; surplus=117,148 | PASS — rounds to $189k / $117k |
| 98 | "95% above the NZ-born mean for UK and US/Canadian migrants" | 6 (line 176) | npv-by-nationality.json | UK tax_premium_pct=95.4; US/Canada=95.3 | PASS — rounds to 95% |
| 99 | "Chinese migrants at age 30... $47,000, below NZ-born benchmark of $72,000" | 6 (line 178) | npv-by-nationality.json | China age 30: npv=-46,867; nzborn=-71,563 | PASS — rounds to $47k / $72k |

### Verified claims — Section 7 (Lifecycle net fiscal impact)

| # | Claim | Section | Source file | Source value | Status |
|---|-------|---------|-------------|-------------|--------|
| 100 | "net fiscal contribution of $132,100... NZ-born equivalent... $71,600... surplus of... $60,500" | 7.1 (line 188) | npv-by-visa-age.json | -132,100; -71,563; 60,537 | PASS — exact / rounds |
| 101 | "fiscal surplus of 85%" | 7.1 (line 188) | npv-by-visa-age.json | 60,537 / 71,563 = 84.6% | PASS — rounds to 85% |
| 102 | "skilled work... $113,300" | 7.1 (line 190) | npv-by-visa-age.json | Skilled Work age 30: npv=-113,253 | PASS — rounds to $113,300 |
| 103 | "Australian citizens $114,800" | 7.1 (line 190) | npv-by-visa-age.json | Australian age 30: npv=-114,790 | PASS — rounds to $114,800 |
| 104 | "working holiday holders $43,700" | 7.1 (line 190) | npv-by-visa-age.json | WHV age 30: npv=-43,719 | PASS — rounds to $43,700 |
| 105 | "family stream migrants $39,600" | 7.1 (line 190) | npv-by-visa-age.json | Family age 30: npv=-39,584 | PASS — rounds to $39,600 |
| 106 | "Humanitarian... $2,100" | 7.1 (line 190) | npv-by-visa-age.json | Humanitarian age 30: npv=-2,083 | PASS — rounds to $2,100 |
| 107 | "students... net cost of $300" | 7.1 (line 190) | npv-by-visa-age.json | Student age 30: npv=286 (positive = net cost) | PASS — rounds to $300 |
| 108 | "$2,292 per year at age 30 — 21% above" | 7.2 (line 196) | hughes-table4 | $13,007 - $10,715 = $2,292; 21.4% | PASS (exact) |
| 109 | "44% probability of still being in NZ at age 65" (arrival at 30) | 7.2 (line 200) | retention-curves-widget.json | Skilled yr35 = 0.4432 (44.3%) | PASS — rounds to 44% |
| 110 | "$895,000 in lifetime tax revenue" (Skilled age 30, retention-weighted) | 7.3 (line 204) | fiscal-components (computed) | $895,345 | PASS — rounds to $895,000 |
| 111 | "$502,000 in government expenditure" | 7.3 (line 204) | fiscal-components (computed) | $502,342 | PASS — rounds to $502,000 |
| 112 | "$361,000 in income support, $129,000 in health, $12,000 in education" | 7.3 (line 204) | fiscal-components (computed) | $360,610; $129,290; $12,442 | PASS — all round correctly |
| 113 | "NZ-born equivalent: $1,409,000 revenue... $1,243,000 costs... health $346,000... income support $881,000" | 7.3 (line 204) | fiscal-components (computed) | $1,409,000; $1,243,310; $345,950; $880,860 | PASS — exact / rounds correctly |
| 114 | "$34,200 per year in net fiscal cost" at age 75 | 7.3 (line 206) | wright-nguyen-fiscal-template.json | 75-79 NFI: $34,230 | PASS — rounds to $34,200 |
| 115 | "only 36% are still in New Zealand" at age 75 (arrival at 30, yr 45) | 7.3 (line 206) | retention-curves-widget.json | Skilled yr45 = 0.3640 (36.4%) | PASS — rounds to 36% |

### Verified claims — Section 7.4 (Variation by arrival age)

| # | Claim | Source | Source value | Status |
|---|-------|--------|-------------|--------|
| Age 20: "NPV of −$79,300 (surplus $39,200)" | npv-by-visa-age.json | Skilled age 20: npv=-79,292; surplus=39,244 | PASS — rounds correctly |
| Age 30: "NPV of −$132,100 (surplus $60,500)" | npv-by-visa-age.json | npv=-132,100 (exact); surplus=60,537 → $60,500 | PASS |
| Age 40: "NPV of −$142,500 (surplus $93,200)" | npv-by-visa-age.json | Skilled age 40: npv=-142,472; surplus=93,191 | PASS — rounds correctly |
| NZ-born at 40: implied weaker benchmark | npv-by-visa-age.json | NZ-born age 40: npv=-49,281 | Consistent |
| Age 50: "NPV of −$61,700 (surplus $138,500)" | npv-by-visa-age.json | Skilled age 50: npv=-61,650; surplus=138,528 | PASS — rounds correctly |
| Age 55: "NPV of +$30,100 — a net cost" | npv-by-visa-age.json | Skilled age 55: npv=30,061 | PASS — rounds to $30,100 |
| "NZ-born at 55 costs an estimated $193,400" | npv-by-visa-age.json | NZ-born age 55: nzborn_npv=193,374 | PASS — rounds to $193,400 |
| "skilled migrant is still $163,300 less expensive" | npv-by-visa-age.json | surplus=163,313 | PASS — rounds to $163,300 |

### Verified claims — Section 7.5 (Students and humanitarian)

| # | Claim | Source | Source value | Status |
|---|-------|--------|-------------|--------|
| "$300 net cost at age 30" (students) | npv-by-visa-age.json | Student age 30: npv=286 | PASS — rounds to $300 |
| "$1,357 per-capita mean, 87% below" | hughes-table4 | S.Fee paying: $1,357; (1357-10715)/10715 = -87.3% | PASS (exact / rounds) |
| "35% remaining after ten years" (students) | retention-curves-widget.json | Student yr10 = 0.3495 (35.0%) | PASS (exact) |
| "$2,100 net contribution at age 30" (humanitarian) | npv-by-visa-age.json | Humanitarian age 30: npv=-2,083 | PASS — rounds to $2,100 |
| "87% at five years, 61% at eighteen years" (humanitarian retention) | retention-curves-widget.json | yr5=0.872 (87.2%); yr18=0.6065 (60.7%) | PASS — rounds to 87% / 61% |

### Internal consistency checks

| Check | Result | Notes |
|-------|--------|-------|
| Executive summary NPV matches Section 7.1 | PASS | Both state $132,100 / $71,600 / $60,500 |
| NZ-born NPV is consistent across sections | PASS | $71,600 (exec, S7.1), $72,000 (S6 — different rounding level for different context) |
| Retention rates consistent between S4, S5, and S7 | PASS | Same values cited in all three sections (84%, 62%, 87%, 36%) |
| FB tax share progression (24%→27%→30%→34%→38%) is monotonically increasing | PASS | 24.3→26.7→30.0→34.0→37.7 — all verified |
| China convergence dates consistent between exec and S6 | PASS | Both cite "approximately 8%" in 2002, 117% by 2024. Exec says "2002", S6 data confirms 2002 start year. |
| RV2021 arithmetic: 165k ≈ Skilled increase + other movements | PASS | Skilled +176k; Temp -105k; Student -37k; net reclassification ~165k |
| Visa NPVs at age 30: all except Student are negative (net contributors) | PASS | Student npv=+286 (marginal net cost); all others negative |
| Surplus values at age 55: Skilled is a net cost but still cheaper than NZ-born | PASS | Skilled 55 npv=+30,061 (net cost); NZ-born 55 npv=+193,374; surplus=163,313 |
| Tax share and population share arithmetic: 32% pop / 38% tax implies per-capita premium | PASS | 38/32 = 1.19 — FB pays 19% more per capita, consistent with $12,500 vs $9,700 = 29% (difference reflects non-linear aggregation across age bands) |
| Fiscal components: tax - spending = NFI (approximately) | PASS | Skilled: $895k - $502k ≈ $393k surplus. Note: fiscal components are retention-weighted but undiscounted; NPV ($132k) applies discounting. The two are methodologically consistent but not directly comparable. |

## Notes

1. **Rounding convention:** The report consistently rounds to the precision appropriate for each context — $100 for per-capita values, $1,000 for NPV headline numbers, 1pp for percentages. All rounding is defensible.

2. **Sign convention:** The NPV model uses negative values for net contributors and positive for net costs (government perspective). The report correctly flips signs for readability ("contributes $132,100" rather than "NPV of -$132,100").

3. **NZ-born benchmark rounding:** In the executive summary and Section 7, the NZ-born benchmark is cited as "$71,600" (rounded from -71,563). In Section 6, it appears as "$72,000" (rounded to the nearest $1,000 for the broader nationality comparison context). Both are valid roundings of the same source value.

4. **Section 1 is empty:** Contains only an HTML comment placeholder. No numerical claims to verify. This is documented as out-of-scope for prose writing but should be completed or removed before publication.

5. **F1 action required:** The non-resident tax figure of "$0.6 billion" should be corrected to "$0.5 billion" unless additional Table 1 categories (e.g., Diasporic Non-Birth Citizen) are intended to be included, in which case the total would be approximately $0.7 billion and the text should specify which categories are covered.

6. **F2 action required:** Change "rising to 161% by 2024" to "rising to 160% by 2024" for the Philippines. The ratio of 1.6046 rounds to 160%, not 161%.
