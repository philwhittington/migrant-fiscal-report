# Prose QA report

Generated: 2026-04-01

## Summary

- Heading case fixes: 0
- Vague qualifier fixes: 7
- Missing citations: 0
- Advocacy language fixes: 1
- Voice/length fixes: 1
- Transition improvements: 3
- Executive summary adjustments: 0
- Total changes made: 12

## Detailed findings

### Heading fixes

All 24 headings (H1 through H3) already used sentence case correctly. No changes needed.

### Vague qualifier fixes

| Line | Before | After |
|------|--------|-------|
| 13 | "skilled migrants are **substantial** net contributors" | "skilled migrants are net contributors" |
| 31 | "20 cohort years **substantially** mitigate this" | "20 cohort years mitigate this" |
| 136 | "but **most** students leave quickly" | "but students depart relatively quickly" |
| 148 | "**many of** the reclassified migrants were already earning" | "the reclassified migrants included individuals already earning" |
| 162 | "early cohorts included **many in** family reunification" | "early cohorts were **concentrated in** family reunification" |
| 256 | "are **substantial** net fiscal contributors" | "are net fiscal contributors" |
| 256 | "**most** leave before drawing NZ Superannuation" | "**56%** of skilled migrants arriving at age 30 leave before age 65" |

**Retained with justification:**
- Line 86: "somewhat understating the migrant fiscal advantage" — retained because the magnitude of understatement is genuinely unknown (truncating at age 85 omits an unknown number of retirement years).
- Line 172: "many of whom enter employment-focused pathways" — retained because the underlying data (Pacific Access Category composition) does not provide precise proportions.
- Line 244: "capture some of this variation" — retained as an accurate hedge; the adjustments address some eligibility differences but not all spending patterns.

### Missing citations

No missing citations found. Every numerical claim in Sections 3–7 has an inline parenthetical citation (Hughes Table N, NPV model output, etc.).

The executive summary omits inline citations, which is standard practice for executive summaries in analytical reports. All claims traced successfully to corresponding body sections.

**Minor item:** "(Immigration New Zealand)" on line 146 is an institutional source not listed in the References section. This is acceptable for a widely-reported government announcement (165,000 RV2021 eligibility figure) but Phil may wish to add a formal reference.

### Advocacy language

| Line | Before | After |
|------|--------|-------|
| 13 | "are **broadly effective**" | "**produce net positive fiscal outcomes**" |

No other advocacy language found. No instances of "should," "must," "essential," or "recommend" in the prose. The report maintains descriptive framing throughout.

### Voice/length fixes

| Line | Type | Description |
|------|------|-------------|
| 33 | Long sentence split | Original: ~47-word sentence with double em-dash parenthetical listing ~20 revenue categories. Split into two sentences: one stating the row/band structure, one listing the categories. |

**No passive voice issues found.** The report uses active voice consistently ("Foreign-born taxpayers comprise...", "Our estimates suggest...", "We adopt...").

**No paragraphs exceed 6 sentences.** The longest paragraphs are 5–6 sentences (Section 3 line 108, Section 2.5 line 100), both within the limit.

### Transition improvements

| Location | Type | Change |
|----------|------|--------|
| End of Section 2.5 → Section 3 | Added bridging sentence | "The sections that follow apply this framework to the Hughes and Wright and Nguyen data, moving from the aggregate fiscal picture to visa-specific analysis, nationality convergence, and lifecycle NPV estimates." |
| End of Section 4 → Section 5 | Added bridging sentence | "Before turning to the lifecycle model in Section 7, Section 5 examines a one-off policy event that reshaped the visa composition underlying these patterns." |
| End of Section 6 → Section 7 | Added bridging sentence | "Section 7 combines these visa- and nationality-specific tax patterns with retention probabilities into lifecycle NPV estimates." |

**Already adequate transitions (no change needed):**
- Section 3 → Section 4: Line 120 provides an effective bridge ("But this headline masks wide variation by visa type").
- Section 7 → Section 8: Line 232 references "natural extension of this proof of concept," setting up the caveats section.
- Section 8 → Section 9: Line 254 begins "Despite these limitations..." — clean transition.

### Executive summary consistency

All 9 numerical claims in the executive summary were cross-checked against the corresponding body sections:

| Exec summary claim | Body reference | Match |
|---|---|---|
| 32% population share | Section 3, line 106 | Exact ✓ |
| 38% tax share | Section 3, line 106 | Exact ✓ |
| $132,100 NPV | Section 7.1, line 190 | Exact ✓ |
| $60,500 surplus | Section 7.1, line 190 | Exact ✓ |
| $71,600 NZ-born | Section 7.1, line 190 | Exact ✓ |
| 44% probability at 65 | Section 7.2, line 202 | Exact ✓ |
| 8% → 117% China convergence | Section 6, line 164 | Exact ✓ |
| 165,000 RV2021 | Section 5, line 146 | Exact ✓ |
| Varela et al. 2021 reference | Section 9, line 260 | Present ✓ |

No discrepancies found. The executive summary accurately reflects body findings.

## Items flagged for human review

1. **Section 1 (Introduction and motivation) is still a placeholder.** Line 17 contains only an HTML comment with writing instructions. This section was not written during any P2.x task. Phil should decide whether to write this section or restructure the report to begin directly with the executive summary and methodology.

2. **Immigration New Zealand citation.** The 165,000 RV2021 eligibility figure on line 146 cites "(Immigration New Zealand)" but no corresponding entry appears in the References section. Phil may wish to add a formal reference (e.g., the Immigration NZ press release or policy page).

3. **"Broadly consistent" in Section 9.** Line 260 uses "broadly consistent in direction and magnitude with international evidence." This is an appropriate hedge for a proof-of-concept comparison with Australian estimates that use different data and methods, but Phil may wish to either specify which Australian estimates are comparable or remove "broadly."

4. **Line 148 "broadly consistent" in Section 5.** Similar usage: "The arithmetic is broadly consistent: roughly 165,000 temporary visa holders were reclassified..." This is appropriate given the approximate nature of the calculation (176k in − 105k − 37k out ≈ 165k), but Phil may prefer to make the arithmetic explicit.

## Self-check

1. All headings use sentence case. ✓
2. No vague qualifiers remain without justification. ✓ (3 retained with documented rationale)
3. Every numerical claim has a citation. ✓
4. No advocacy language remains. ✓
5. No paragraphs exceed 6 sentences. ✓
6. Active voice predominates. ✓
7. Section transitions are smooth. ✓ (3 added, 3 already adequate)
8. Executive summary matches the body. ✓ (9/9 claims verified)
9. This QA report documents all changes. ✓
