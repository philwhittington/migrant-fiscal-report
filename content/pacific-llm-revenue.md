# Small tax administrations, large language models: a practical agenda for Pacific revenue mobilisation

**Phil Whittington** · Heuser|Whittington · March 2026

---

Pacific Island Countries face large spending pressures and limited fiscal space. The International Monetary Fund estimates the average tax gap across PICs at roughly 3 per cent of GDP.[^1] Meeting the Sustainable Development Goals requires an additional 6.3 per cent of GDP annually; climate-resilient infrastructure a further 3.1 per cent.[^2] Average annual disaster losses already run at 3 to 5 per cent of GDP.[^3] Raising more domestic revenue is central to fiscal sustainability in the region.

Traditional approaches to closing the gap — broadening tax bases, improving compliance, strengthening administration — remain necessary but are slow and capacity-intensive. The scale of the constraint is visible in Table 1. Niue's tax office has 6 staff. The Marshall Islands has 11. Even Fiji, the largest PIC tax administration at 695, covers all core revenue functions with a fraction of the workforce available to regional comparators: New Zealand has 4,500 and Australia 18,000.[^4]

This paper argues that large language models — AI systems that process and generate natural language text — may change the frontier for these administrations. They lower the expertise threshold for capabilities that small administrations have never been able to afford. That is a narrower claim than AI transformation, but it is also a more plausible and investable one.

### Table 1: Staffing levels in Pacific tax administrations

Core tax functions per staff member, selected Pacific Island Countries and comparators.

| Country | Staff | Population | Tax-to-GDP (%) | Functions per person |
|---|--:|--:|--:|--:|
| **Niue** | **6** | 2,000 | 35.3 | **6.0** |
| **Marshall Islands** | **11** | 42,000 | 17.5 | **3.3** |
| Nauru | 16 | 13,000 | 24.1 | 2.3 |
| Palau | 22 | 18,000 | 19.3 | 1.6 |
| Kiribati | 28 | 130,000 | 20.5 | 1.3 |
| Micronesia | 53 | 114,000 | 18.9 | 0.7 |
| Samoa | 230 | 222,000 | 23.7 | 0.2 |
| Fiji | 695 | 930,000 | 24.8 | 0.05 |
| *New Zealand* | *4,500* | *5,200,000* | *33.8* | *0.008* |
| *Australia* | *18,000* | *26,500,000* | *28.5* | *0.002* |

*Sources: ISORA FY2022 via data.rafit.org; IMF Government Finance Statistics. Tax-to-GDP: IMF Government Finance Statistics except Niue (OECD, Revenue Statistics in Asia and the Pacific 2025, doi:10.1787/d7423248-en). Niue's 35.3% exceeds the OECD average (33.9%), reflecting a very small GDP denominator rather than an unusually large tax base. Six core functions: policy and legislation, taxpayer services, audit and compliance, collections, processing and returns, forecasting and reporting. The IMF's 2025 Marshall Islands TA report refers to seven staff; the ISORA FY2022 figure of 11 may reflect different counting conventions or subsequent attrition.*

## AI is starting to transform tax administration

The scale of AI adoption in tax is well documented. The OECD's Tax Administration 2025 report, covering 58 jurisdictions, finds that around 25 per cent of all technology examples reported are AI-related.[^5] Singapore has deployed an LLM-powered search tool for internal tax knowledge retrieval. The IMF published two technical notes in 2024–25 specifically on AI and generative AI in tax and customs administration.[^6][^7]

In developing countries, practical deployments are emerging. Armenia, supported by the World Bank, has built machine learning models for audit case selection that achieve above 90 per cent prediction accuracy for tax audits.[^8] Georgia has piloted a similar approach using synthetic data for initial model training.[^9] 

We argue that the documented difficulties of tax administrations in the Pacific can be addressed with thoughtful deployment of large language models. 

AI no longer requires large structured databases, dedicated analytics teams, or substantial IT infrastructure. It requires a spreadsheet, a skilled AI user, and a commitment of the tax officer to bring the operational context they know about their jurisdiction to the analytical power of a large language model. In doing so we argue and show with three live examples how a very small tax administration can achieve substantial administrative and analytical leverage.

## The Marshall Islands as an illustrative case

The Marshall Islands provides this paper's primary illustration. The IMF's 2025 technical assistance report gives a detailed, public account of what a small tax administration must accomplish and how far its current resources fall short.[^11] The case is chosen for the quality of its documentation, which is recent, specific, and public. Other Pacific jurisdictions face comparable constraints. The description in the technical assistance report captures the constraints that large language models may be able to address:

> The foremost challenge for the tax administration is ensuring business continuity while preparing for the introduction of new taxes. Currently, a team of only seven staff members operates in a manual environment and lacks the resources needed for the successful implementation of new taxes. Key areas of focus should include reform project management, organizational structure, taxpayer registration, operating procedures and manuals, staffing and training, taxpayer education and publicity, information technology (IT) systems, taxpayer compliance, and post-implementation monitoring. Accomplishing these tasks in a relatively short timeframe is a daunting challenge, even for larger tax administrations.[^12]

The same report quantifies the taxpayer base: as of September 2023, 642 taxpayers were registered for the Marshall Islands' gross revenue tax, 844 for the Marshallese wages and salaries tax, and 450 for the expatriate wages and salaries tax. 

The entire tax register can fit in a single spreadsheet.

LLMs differ from conventional IT in what they require. A frontier LLM needs a skilled user who knows what to ask. It does not need structured data, a functioning IT system, or dedicated technical staff. 

At the scale of the Marshall Islands, a current consumer-grade frontier model can run natural-language queries directly on a spreadsheet of 642 records. It can also construct the database itself — taking what is likely informal or partially structured record-keeping and producing a standard schema, with consistent fields and validated entries, through a series of prompted workflows. That structured register is a prerequisite for the tax reforms the IMF recommends, including a VAT. The LLM creates the organised data that makes analysis possible, as well as conducting the analysis with human oversight and verification.

Three properties of LLMs make them specifically relevant to administrations at this scale.

First, **LLMs process unstructured information**. Correspondence, narrative audit notes, email chains, can be read directly by an LLM. The LLM can identify patterns, inconsistencies, or compliance risks from the text and images. The data engineering burden that blocks traditional AI is materially reduced for some use cases — especially where the alternative would have required structured databases, specialist labelling, and dedicated analytics teams.

Second, **LLMs augment judgment across compressed management layers**. In a PIC tax office of eleven or even 230 staff, officials exercise judgment across multiple domains simultaneously. 

In the smallest administrations, the same person who drafts policy may also run audits and answer taxpayer queries.[^13] An LLM that supports that person operates at the point of highest leverage. 

This dynamic is especially pronounced where the gain to a worker from a complementary (but currently absent) skill is large, and this dynamic is likely present in small administrations. The IMF's technical assistance report makes this point most strongly for the skill of reform project management:

> The current structure composed of only Compliance and Audit sections does not support modern tax administration. Essential functions, such as taxpayer services and assistance, or reform project management are missing. With only seven employees, the tax administration is understaffed, requiring the recruitment of additional staff.

An LLM can provide significant support for project management with a well-directed prompt. This creates leverage for the tax administration's other skills, such as knowledge of local context and history of the tax system and administration.

Third, **LLMs can enable capabilities that have been absent, not just make existing processes faster**. When a new technology creates functions the operating model never had — risk triage, forecasting, documented institutional memory — the administration gains capabilities it could never previously afford to build.

The same structural features that make LLMs potentially high-leverage in small administrations also make failure more damaging. Small administrations have weaker governance, less redundancy, fewer staff to check bad outputs, and more fragile institutional trust. LLMs are not a substitute for clean transactional data, formal legal authority, enforcement logistics, or managerial discipline. Table 2 draws the boundary explicitly.

### Table 2: What a frontier LLM can and cannot do for a small tax administration

Assessed against the six core functions, assuming English-language interaction with a commercially available frontier model (Claude, GPT-5) and no custom training data.

| Function | Feasible now, with supervision | Not feasible without human judgment |
|---|---|---|
| ***Information and analysis*** | | |
| Policy and legislation | Summarise comparative tax law. Draft explanatory notes. Identify relevant precedents from IMF/OECD guidance. Translate policy intent into plain-language guidance. | Assess constitutional requirements. Assess political feasibility. Draft binding legislation without legal review. |
| Forecasting and reporting | Build simple revenue projection models. Generate narrative commentary on fiscal trends. Prepare formatted reports. | Produce reliable forecasts where training data is absent. Assess the credibility of macro assumptions. |
| ***Operations*** | | |
| Taxpayer services | Answer routine queries from legislation. Draft correspondence. Pre-populate forms from unstructured inputs. | Exercise discretion on hardship cases. Navigate culturally specific communication norms without oversight. |
| Processing and returns | Extract data from scanned paper returns. Cross-check arithmetic. Flag inconsistencies against prior-year filings. | Access or modify the tax register without system integration. Validate identity documents. Process payments. |
| ***Compliance*** | | |
| Audit and compliance | Screen returns against risk indicators. Summarise taxpayer histories. Draft initial audit findings for human review. | Make formal compliance determinations. Conduct interviews. Exercise legal judgment on penalties. |
| Collections | Generate payment reminder letters. Prioritise overdue accounts. Draft instalment agreements. | Negotiate with taxpayers. Authorise write-offs. Initiate legal enforcement. |

*Authors' assessment based on: published capability evaluations (OpenAI, Anthropic, and Google system cards, 2024–25); IMF technical assistance reports in Pacific tax administrations; OECD Tax Administration 2025 comparative data.*

> **Language.** This table assumes English-language interaction. English is an official or working language across all PIC tax administrations. Frontier LLMs can produce reasonable output in several Pacific languages, including Samoan, Tongan, and Niuean, but no systematic evaluation of accuracy exists for any Pacific language in a tax administration context. Any local-language application should be treated as untested and requiring significant human oversight.

---

**Three live demonstrations below** draw on the Marshall Islands VAT implementation — the same scenario the IMF report describes — to show what each of these LLM capabilities looks like in practice.

## A concrete test case: VAT implementation in the Marshall Islands

The IMF's 2025 technical assistance report recommends that the Marshall Islands introduce a VAT. The report identifies seven challenge areas and makes seven specific recommendations (4.1–4.7), including recruiting additional staff, appointing a long-term advisor, and acquiring an Integrated Tax Administration System.[^14]

At a $100,000 registration threshold, 89 businesses would be VAT-registered — mandatory registrants. But the actual register will be larger. Businesses below the threshold with significant import activity have strong incentives to register voluntarily to claim input tax credits back on their purchases. A construction firm that imports materials or a food supplier that imports food may calculate that voluntary registration is commercially rational. In practice, a VAT register in the Marshall Islands is likely to begin with 89 mandatory registrants (see Table 3.1 of IMF technical assistance report) and grow meaningfully as voluntary registrations come in.

This creates the refund problem immediately. Administrations new to VAT are vulnerable to fraudulent input credit claims — a business registers voluntarily, claims a large refund in the first quarter, and disappears. This will, at least at the start, require human review of refund claims before payment. The LLM can flag; only an officer can authorise.

The live demonstration below works through both problems in three panels. 

**Panel 1 shows what the source data looks like** — three files with different column structures, inconsistent spelling, and officer notes that no reporting system reads. 

**Panel 2 shows the structured prompt that transforms them into a unified register**.

**Panel 3 shows that register queried in plain English**, with the Claude API (Sonnet 4.6) responding in real time. 

Select an example query or type your own.

#### Live demo: Marshall Islands VAT register

<div data-demo="vat-registrants"></div>

The second demonstration looks at LLM-solutions to the reform project management challenge. 

The prompt given to Claude included the IMF's seven recommendations, the Marshall Islands operational context (seven staff, manual environment, no IT system), and a structured planning instruction built around explicit human-authority gates. 

The output is an 18-task implementation plan with four delivery phases, seven milestones, and explicit dependencies, targeting VAT go-live in October 2026. 

Select any task in the Gantt or Kanban view for the full specification.

#### Live demo: VAT implementation plan

<div data-demo="implementation-plan"></div>

Compliance programmes, forms, and procedures — one of the seven challenge areas the IMF identifies — includes a task unusual for a small administration: reviewing every return filed. With 89–112 VAT registrants, a jurisdiction the size of the Marshall Islands can run a complete compliance screen each quarter. 

The demonstration below shows the output of that exercise. 112 Q1 2027 dummy returns — the first full quarter after VAT go-live in October 2026 — were submitted to Claude with a structured review prompt. Claude flagged three returns as immediate priority, all involving refund claims that require an officer to verify before payment. Five were flagged for attention. Five observations were reported for information. 

Each finding can be expanded for the full analysis and recommended action.

#### Live demo: Compliance exception report

<div data-demo="compliance-review"></div>

The three demonstrations above each address one of the seven challenge areas the IMF identifies for the Marshall Islands VAT implementation. Box 1 maps the full set.

> **Box 1: How an LLM maps to the IMF's VAT implementation requirements**
>
> | IMF challenge area | What an LLM can do | What still requires human authority | See the live demo |
> |---|---|---|---|
> | **Reform project management** (¶71, Rec 4.2) | Decompose the IMF's recommendations into a structured project plan with tasks, dependencies, milestones, and assigned responsibilities. Maintain as a living document. Generate status reports from brief updates. | Allocating authority. Deciding who is responsible for what. Making resource trade-offs when two tasks compete for the same person's time. | [→ Implementation plan](#implementation-plan) |
> | **Taxpayer registration** (¶73–76, Rec 4.4) | Build a clean VAT register from existing GRT data. Produce consistent fields, validated entries, and standard schema from informal record-keeping. Identify qualifying registrants, flag missing information, and generate registration correspondence. | Approving registrations. Verifying identity documents. Deciding whether a voluntary registrant meets the criteria. | [→ VAT register](#vat-demo) |
> | **Organisation, staffing, and training** (¶77–79, Rec 4.3) | Draft position descriptions, competency frameworks, and interview questions. Generate training curricula from legislation. Produce training materials, worked examples, and practice returns. Build onboarding packs. | Hiring decisions. Budget allocation. Negotiating secondments from local government. Delivering training in person. | — |
> | **Compliance programmes, forms, and procedures** (¶80–81, Rec 4.6) | Draft standard operating procedures for VAT filing, assessment, and audit. Design the VAT return form. Build a risk-scoring model. For 89–112 taxpayers, review every return and produce an exception report. | Approving audit selections. Conducting field audits. Exercising judgment on penalties and settlements. Signing assessments. | [→ Exception report](#compliance-review) |
> | **Taxpayer education and publicity** (¶82, Rec 4.5) | Produce plain-language guides, FAQs, worked examples, and template invoices. Draft in English and, with supervised review, in Marshallese. Draft public communications plan and announcement text. | Approving messaging. Conducting face-to-face workshops. Culturally appropriate delivery. | — |
> | **IT systems** (¶84, Rec 4.7) | Until the ITAS is operational, serve as the processing layer between the commissioner and a set of spreadsheets. Accept natural-language queries against the taxpayer register, produce formatted reports, and maintain data integrity. Draft the business requirements specification for the eventual ITAS. | Procuring and implementing the ITAS. System administration. Data security. Integration with ASYCUDA for customs VAT. | — |
> | **Post-implementation monitoring** (¶68, implied in Rec 4.6) | Build monitoring templates tracking filing rates, payment compliance, and revenue against projections. Flag anomalies. Produce monthly performance reports from spreadsheet data. | Interpreting anomalies. Deciding whether a pattern indicates fraud, confusion, or a policy design problem. Adjusting the threshold or exemptions. | — |
>
> The right-hand column lists decisions that require authority, judgment, or physical presence — the things a commissioner is already responsible for. The LLM's contribution is to ensure that every decision is supported by structured information, drafted documentation, and operational tools that would otherwise require months of consultant time or an IT system that does not yet exist.
>
> **Cost.** A frontier LLM subscription with high token limits costs approximately US$200 per month. 

## Practical use cases for any Pacific Island Country tax administration

The following use cases have been mapped out by the authors of this piece from their knowledge of tax administration and policy and their use of frontier models. They are not specific to the Marshall Islands — they apply to any Pacific tax administration, regardless of VAT status, size, or current IT capability.

**Institutional knowledge capture.** In small tax administrations, the critical operational context — how the system works day to day, which compliance challenges recur, why particular policy changes were adopted and what happened next — may never have been written down. 

The simplest and most impactful first step may not be deploying an LLM as a compliance tool. It may be using one to capture what is currently only known orally. A senior official dictates into a voice-enabled LLM, which asks follow-up questions and creates structured notes: the practical history of key tax changes, how specific challenges have been handled, the informal knowledge that a new staff member would take years to acquire.

When a senior PIC tax official retires those records become the onboarding system for their successor. This single application may be worth more to a Pacific tax administration than any compliance or analytics tool, because it creates the context for both new tax administrators, but also future LLM use cases.

**Internal knowledge retrieval and guidance drafting.** An LLM that retrieves answers from approved internal documents — legislation, rulings, procedure manuals — gives officials instant access to the administration's own knowledge base without requiring a search infrastructure that PICs may lack. It can also draft taxpayer guidance for human review, reducing the cost of producing written communications across multiple taxpayer segments.

**Case triage support.** Evaluations by the IMF's Pacific Financial Technical Assistance Centre note that compliance risk management in PIC tax administrations is still at an early stage.[^15] Case selection has historically been ad hoc rather than risk-based. An LLM that reads available text records — returns, correspondence, audit notes — can assist with narrative summarisation across fragmented records, flag generation for human review, and structured risk registers built from text. 

**Revenue forecasting support.** The IMF identifies revenue forecasting as a high-priority gap in PICs.[^16] An LLM can help a commissioner or finance official build and interrogate simple scenario models — testing what happens to revenue if the VAT base broadens or compliance improves by a given percentage — that would otherwise require external technical assistance. The LLM helps a non-specialist construct, document, and stress-test a forecasting model.

## Tool access alone produces no system-level improvement

While individuals regularly report large gains in productivity from their use of LLMs, system-level outputs seem to lag or be hindered by other bottlenecks. In the authors' experience, large gains can be achieved at a system-level once existing workflows are broken down and rebuilt to take full advantage of LLMs. As with any system-level change, this requires deliberate redesign of how work is done, not just adoption of a new tool.

Three principles follow.

First, **any deployment should begin with a structured review of how the administration actually works** — where information flows, where decisions are made, where bottlenecks sit. A well-designed workflow with a basic LLM will outperform a poor workflow with a frontier model.

Second, **governance should be proportional to consequence**. A chatbot answering routine taxpayer queries carries different risks from an LLM generating audit recommendations. The answer is tiered oversight — light controls for low-consequence uses, heavier controls for consequential ones.

Third, **early deployments must be chosen for reliability**. In an administration of six or eleven staff, one visible failure — generic output, hallucinated references, culturally inappropriate language — erodes institutional trust in ways that take years to rebuild.

**Minimum safeguards for any pilot.** No fully automated enforcement decisions. Human review for all taxpayer-facing outputs. Retrieval restricted to approved internal documents. De-identified data for experimentation where possible. Audit logs and prompt logging for all consequential uses. Clear red lines for high-stakes applications such as automated penalty assessments or unsupervised taxpayer communications.

## A practical starting point for development partners

Individual PICs cannot build LLM infrastructure independently. The fixed costs of model access, data governance, and technical support exceed what a single small administration can sustain. A phased, regionally supported programme is feasible.

**Phase 1: Readiness diagnostic.** Map workflows, information sources, and constraints in two to three pilot administrations. Identify use cases ranked by feasibility and expected fiscal value. Assess data, legal, language, and governance constraints. The output is a deployment-ready workflow design.

**Phase 2: Low-risk pilot.** Deploy the highest-confidence use cases first: institutional knowledge capture, internal knowledge retrieval, taxpayer guidance drafting with human review, and case triage support. These carry the lowest risk and build institutional familiarity with LLM-augmented work before any higher-stakes application.

**Phase 3: Evaluation and scale-up.** Measure time savings, quality changes, case yield, forecast accuracy, and staff adoption. Develop regional shared-service options — a Pacific Tax AI Lab that maintains tools, trains staff, and manages data governance on behalf of participating countries. The ADB's Asia Pacific Tax Hub provides a model for regional coordination in tax.[^17]

The practical question for development partners is whether frontier models can help small administrations perform materially better on a handful of high-value functions that are currently underprovided: capturing institutional memory, retrieving internal knowledge, drafting taxpayer guidance, triaging cases, and supporting simple forecasting. That is a narrower claim than AI transformation, but it is also a much more plausible and fundable one.

---

**About the author**

Phil Whittington is a founding partner of Heuser|Whittington, an economics consultancy in Wellington, New Zealand. He is a former Chief Economist of the New Zealand Inland Revenue Department, where he led the deployment of AI tools (Microsoft Copilot) across policy and tax counsel teams. He has worked with the OECD on tax policy and has extensive experience in fiscal modelling and tax system design. Enquiries: phil@heuserwhittington.com

---

[^1]: IMF (2022), *Funding the Future: Tax Revenue Mobilization in the Pacific Island Countries*, Departmental Paper No. 2022/015.
[^2]: Ibid.
[^3]: World Bank (2025), 'Building Strong Fiscal Foundations: Essential Strategies for Pacific Island Countries'.
[^4]: CIAT, IOTA, IMF, OECD, International Survey on Revenue Administration (ISORA), FY2022, via data.rafit.org.
[^5]: OECD (2025), *Tax Administration 2025*, 13th edition.
[^6]: Aslett et al. (2024), *Understanding Artificial Intelligence in Tax and Customs Administration*, IMF Technical Note TNM/2024/011.
[^7]: Aslett et al. (2025), *Generative Artificial Intelligence for Compliance Risk Analysis*, IMF Technical Note.
[^8]: World Bank (2025), 'AI to Modernize Tax Administration: The Story Behind Armenia's Success'.
[^9]: World Bank, *Institutions in Action: AI for Tax Audit Cases in Georgia*, GovTech Brief.
[^11]: IMF (2025), *Republic of the Marshall Islands: Technical Assistance Report — Consumption and Income Tax Reform*, Technical Assistance Reports Vol. 2025, Issue 022.
[^12]: Ibid., ¶68–69.
[^13]: PFTAC Phase V Mid-Term Evaluation Final Report; IMF (2022), *Funding the Future*.
[^14]: IMF (2025), *Republic of the Marshall Islands: Technical Assistance Report*, ¶68–84 and Recommendations 4.1–4.7.
[^15]: PFTAC Phase V Mid-Term Evaluation Final Report; PFTAC FEMM Revenue Regional Paper.
[^16]: IMF PFM Blog (2020), 'PFM Reform Strategy in the Pacific Island Countries'; PFTAC Phase V Mid-Term Evaluation.
[^17]: ADB, *Asia Pacific Tax Hub*.
