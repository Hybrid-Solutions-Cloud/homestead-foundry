# SPIKE-05: cost model and governance

Status: research complete. No Azure resources created, no spend, no budgets or alerts provisioned.
Date: 2026-07-11
Author: foundry-researcher (Opus)
Scope: the money and the guardrails for a shared Azure AI Foundry (AIServices) resource that hosts an MAI-Image-2.5 deployment and serves MAI-Voice-2 through Azure Speech. Turns published pricing tables into decision-grade dollar rollups, then specifies how an owner-set monthly USD cap is actually enforced. Grounded in Microsoft first-party sources, cited inline; anything Microsoft has not published is marked UNKNOWN and no number is invented. The concrete figures this methodology was first applied to (a specific subscription, region, catalog, voice set, and monthly cap) are collected in the "Worked example" section near the end; the body reads as a template for any Azure AI Foundry image-plus-voice build in this repo.

Division of labor with the sibling spikes: **SPIKE-01 owns the image token mechanics** (rate-card verification, the tokens-per-image UNKNOWN, the empirical measurement method, canvas and rate-limit ladders). This spike does not re-derive them; it consumes them and builds the cost model and governance on top. Where a rate is used below, the same confidence caveat SPIKE-01 recorded is carried forward.

---

## Question

Five questions, mapped to the owner's cost concerns for any Azure AI Foundry build of this shape:

1. **Image economics.** Confirm the current MAI-Image-2.5 token rates (text input, image input, image output per 1M tokens) and the MAI-Image-2.5-Flash rates. Tokens-per-image is undocumented (flag UNKNOWN): give a clearly labeled estimate range per roughly 1 MP image (target 1248x832) that must be measured empirically in the smoke test, then roll it up for a small pilot (a handful of scenes, a capped number of calls) and a full catalog backfill (scene count times candidate count).
2. **Voice economics.** Confirm 22 US dollars per 1M characters. Using a catalog's character counts, estimate the initial multi-voice backfill and the ongoing monthly cost.
3. **Budget governance.** How Azure budgets and cost alerts work, and the critical caveat that an Azure budget alert is a notification, not a hard spending cap. How a true hard stop is enforced in the pipeline (a client-side ledger and a pre-flight budget flag). Recommend budget scope, alert thresholds, and action groups, against an owner-set monthly cap.
4. **Credit burn-down.** How to track consumption against a monthly credit (Cost Management views, tags), and a resource tag scheme for cost attribution.
5. **Model-tier cost trade-off.** When to prefer MAI-Image-2.5-Flash over 2.5 for bulk to control spend, and the quality trade-off.

---

## Findings

### Q1. Image economics

**Billing model (first-party confirmed).** MAI image models are billed only for the tokens processed by the API. There is no charge for the Foundry resource itself or for the model deployment; you pay per token used, and billed usage appears in Microsoft Cost Management as model input and output meters associated with the resource. [Foundry Models FAQ](https://learn.microsoft.com/azure/foundry-classic/foundry-models/faq), [Plan and manage costs for Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/manage-costs) The image output (the generated PNG) is the dominant meter; text-prompt input is a rounding error at typical prompt lengths (see below).

**Rate card (working figures).** Per 1M tokens:

| Meter | MAI-Image-2.5 | MAI-Image-2.5-Flash |
|---|---|---|
| Text input | 5.00 USD | 1.75 USD |
| Image input (edits arm) | 8.00 USD | 1.75 USD |
| Image output (the generated image) | 47.00 USD | 33.00 USD |

Confidence note, carried from SPIKE-01: the live [Foundry Models pricing, Microsoft models page](https://azure.microsoft.com/en-us/pricing/details/ai-foundry-models/microsoft/) is a client-rendered widget and did not render the 2.5 family during either spike (it timed out again this session). The 2.5 figures (5 / 8 / 47) and the Flash figures (1.75 / 1.75 / 33) are independently corroborated by indexed search of that same pricing page and by third-party model catalogs this session (for example OpenRouter returned 5 USD/M text input for MAI-Image-2.5). SPIKE-01 recorded one conflicting secondary figure for Flash image output (19.50 USD in one place versus 33 USD elsewhere); my searches this session returned 33 USD consistently, so 33 is used as the working figure while the conflict is noted. **These rates are not yet confirmed from a rendered first-party pricing page and must be read live in the Foundry portal at deploy time before any spend is authorized.**

**Tokens per generated image: UNKNOWN.** Microsoft does not publish a tokens-per-image figure for any MAI image model, and the documented generations response does not show a usage field. This is the single largest lever in every image dollar figure below. SPIKE-01 specifies the empirical method to resolve it (inspect the live response for a usage field; else divide a Cost Management output-token meter delta by a fixed-size micro-batch, at two sizes to learn whether output tokens scale with pixels). [SPIKE-01 Q2](SPIKE-01-image-model.md), [Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai) The smoke test must run that probe first and replace every range below with a point number.

**Per-image estimate (LABELED ESTIMATE, not documented).** Basis: comparable token-metered image models meter on the order of 1,000 to 4,200 output tokens for a roughly 1 MP image (the target is 1248x832 = 1,038,336 px, the nearest valid 3:2 under MAI's 1,048,576 px cap, per SPIKE-01 Q4). Applying the output rates above:

| Item | MAI-Image-2.5 | MAI-Image-2.5-Flash |
|---|---|---|
| Output tokens per image (assumed range) | 1,000 to 4,200 | 1,000 to 4,200 |
| Image output cost per image | ~0.05 to 0.20 USD | ~0.03 to 0.14 USD |
| Prompt input per image (400 to 600 tokens) | under 0.01 USD | under 0.01 USD |
| Edits-arm input image (about 1 MP at image-input rate) | add ~0.01 to 0.03 USD | add ~0.002 to 0.008 USD |

The prompt input is negligible because typical prompts run 400 to 600 tokens against a 32,000-token context limit (SPIKE-01 Q3), so image output dominates. Treat 0.05 to 0.20 USD (2.5) and 0.03 to 0.14 USD (Flash) as the per-image working band until the smoke test measures it.

**Rollup method: pilot.** Each image call returns one image, so a pilot of P capped calls yields up to P images: cost = P x the per-image output band, plus negligible prompt input. Set a hard cap above the expected total to absorb retries and a higher-than-assumed tokens-per-image. (Worked figures are in the Worked example.)

**Rollup method: full catalog backfill.** For a catalog of N images (scene count times candidate count): cost = N x the per-image band on the chosen tier. Every image figure scales linearly off the unmeasured tokens-per-image; the smoke test's first two calls convert the entire column into a real number and should run before any batch is authorized (SPIKE-01 recommendation 3).

### Q2. Voice economics

**Rate confirmed (first-party).** MAI-Voice-2 is priced at 22 USD per 1M characters, stated on Microsoft's own model page and corroborated by launch coverage. [MAI-Voice-2 model page](https://microsoft.ai/models/mai-voice-2/), [New MAI models in Microsoft Foundry (June 2026)](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/new-mai-models-in-microsoft-foundry-across-text-image-voice-and-speech/4524632) The exact Azure meter name and unit should still be confirmed on the [Azure Speech pricing page](https://azure.microsoft.com/pricing/details/speech/) at provisioning (that page is also a client-rendered widget and did not render this session). Unlike images, the billable unit here is characters, which are known before synthesis, so voice cost is deterministic pre-call (this matters for the hard stop in Q3).

**Per-voice unit cost.** For a catalog of C characters, each additional full-catalog voice costs C x 22 / 1,000,000 USD. Because characters are known before the call, this is exact, not an estimate.

**Initial multi-voice backfill.** Adding V listen-only voices across a catalog of C characters is a one-time cost of V x C x 22 / 1,000,000, with each brand's existing narrator kept as the default track. The number of voices and the concrete per-catalog totals for this repo's first build are in the Worked example (a locked three-voice owner decision).

**Ongoing monthly.** New content only, at V voices: (new characters per month) x V x 22 / 1,000,000. For catalogs of this size that is on the order of 1 to 2 USD per month, trivial against a monthly cap in the tens of dollars. Storage and egress are non-costs: a multi-voice audio build of this size fits inside a typical object-store free tier with free egress.

### Q3. Budget governance and how the monthly cap is really enforced

**Combined spend picture versus the cap.** Put Q1 and Q2 together against the monthly cap. The largest realistic single month (do the entire voice backfill and an entire image catalog backfill at once, on the premium image model) should be sized to land near, but not over, the cap; steady state after backfill is a few dollars a month. A cap chosen to absorb a full one-shot build-out while still stopping a runaway loop is well sized. The worked month-by-month table against this repo's real cap is in the Worked example.

**FACT: an Azure budget alert is a notification, not a hard cap.** This is the central governance finding and it is stated first-party. The Foundry cost doc is explicit: "While OpenAI has an option for hard limits that prevent you from going over your budget, Azure OpenAI doesn't currently provide this functionality. You can start automation from action groups as part of your budget notifications to take more advanced actions, but this functionality requires additional custom development." [Plan and manage costs for Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/manage-costs) Cost Management's own description agrees that budgets "notify recipients when cost exceeds a predefined cost or forecast amount." [What is Microsoft Cost Management](https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management)

**Why a budget cannot stop spend in real time (latency).** Budget costs are evaluated against the threshold about once per day, and when a crossing is detected a notification is triggered within the hour (emails may take up to 24 hours), on top of the ingestion delay before usage even becomes cost data. [Manage costs with automation](https://learn.microsoft.com/azure/cost-management-billing/costs/manage-automation), [Tutorial: create and manage budgets](https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets) By the time a budget alert fires, the money is already spent. A budget is a rear-view detector, not a valve.

**What automation can and cannot do.** A budget at subscription or resource-group scope can call an Azure Monitor action group, which can trigger a Logic App, Automation runbook, or Function to "take automated actions to reduce or even stop further charges." [What is Microsoft Cost Management](https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management), [Manage costs with budgets](https://learn.microsoft.com/azure/cost-management-billing/manage/cost-management-budget-scenario) But this is still reactive (fires after the daily evaluation detects the crossing), action groups are supported only for subscription and resource-group scopes, and Microsoft states it "requires additional custom development." It is a useful backstop, not a synchronous cap.

**The true hard stop lives in the pipeline.** The only mechanism that stops spend *before* it happens is the publish pipeline's own pre-flight guard, because it runs client-side and synchronously ahead of each metered call:

- The pipeline maintains a per-month ledger (characters and estimated USD, where estUsd = chars x 22 / 1,000,000), printed every run, plus a budget flag that refuses to proceed once the month's estimated spend would exceed the flag. This mirrors an existing per-brand character-budget guard already tracked in pipeline state. The budget flag's default is set to match the cap.
- For voice this stop is **deterministic**: characters are known before the call, so the ledger can refuse a run that would breach the cap with zero overshoot.
- For images the same pattern applies, but the pre-spend estimate is **approximate until tokens-per-image is calibrated** (Q1 UNKNOWN). Until the smoke test measures it, an image ledger should use a deliberately conservative (high) tokens-per-image assumption so the guard trips early rather than late, then switch to the measured value.
- Important shared-resource nuance: when one Foundry resource is shared by multiple consumers (brands), each consumer's per-brand ledger sees only its own usage but the underlying meter is the sum, so the ledger and the Azure budget must both account for every consumer landing on one resource. A resource-group-scoped budget naturally aggregates this (see below).

**Governance recommendations (detail in the Recommendation section):** put the Azure budget at **resource-group scope** on the single shared Foundry resource's RG in the chosen region, amount equal to the monthly cap, actual-cost thresholds at 50 / 75 / 90 / 100 percent plus a forecasted alert at 100 percent (Cost Management supports up to 5 thresholds and 5 email recipients per budget, both Actual and Forecasted types), wired to one action group that emails the owner. [Tutorial: create and manage budgets](https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets), [WAF: set spending guardrails](https://learn.microsoft.com/azure/well-architected/cost-optimization/set-spending-guardrails) The budget is the backstop and notifier; the pipeline budget flag is the actual cap.

### Q4. Credit burn-down and tag scheme

**Tracking burn-down.** Use Cost Analysis scoped to the Foundry resource's resource group, the Accumulated costs view, monthly granularity, grouped by **Meter** to separate image-output versus image-input versus voice-character spend; the Foundry cost doc walks exactly this (scope to the RG, Group by Meter, then by Resource, where meters appear as `model-name-GUID`). [Plan and manage costs for Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/manage-costs) During a burn push, subscribe the owner to a scheduled daily or weekly cost email off a saved RG view so consumption is visible without opening the portal. [What is Microsoft Cost Management](https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management)

**Caveat: Azure "credit alerts" are Enterprise Agreement only.** Cost Management has a dedicated credit-alert type that fires automatically at 90 percent and 100 percent of an Azure Prepayment (previously monetary commitment) balance, but the offer-support table shows credit alerts are available only on Enterprise Agreement, not on Microsoft Customer Agreement or Web direct / Pay-As-You-Go. [Use cost alerts](https://learn.microsoft.com/azure/cost-management-billing/costs/cost-mgt-alerts-monitor-usage-spending) A credit or MVP subscription is unlikely to be an EA Prepayment, so **do not rely on automated credit alerts to watch the monthly credit**. The portable substitute (works on every offer type) is a budget set to the credit amount (or the monthly cap) with actual and forecast alerts, plus the scheduled cost email above.

**The credit can fund the whole burn.** Azure Prepayment credit pays for Models sold by Azure charges (which is what MAI-Image-2.5 is) and for first-party Azure Speech usage (MAI-Voice-2); only models billed through Azure Marketplace (other providers) are excluded. [Plan and manage costs for Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/manage-costs) So both the image and the voice spend draw down the owner's credit, which is exactly the intent of burning it before it resets. Cost data can also be exported to a storage account for Power BI or Excel analysis if a deeper burn-down view is wanted. [Plan and manage costs for Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/manage-costs)

**Resource tag scheme for cost attribution.** Resource tags are the only way to add business context to cost data, they surface as a dimension in Cost Analysis (Group by / Add filter on Tag), and tag inheritance can copy resource-group tags down into cost records without touching the resources. [What is Microsoft Cost Management](https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management), [Cost analysis common uses](https://learn.microsoft.com/azure/cost-management-billing/costs/cost-analysis-common-uses) Recommended keys (CAF-aligned), applied to the resource group and the Foundry resource:

| Tag key | Example value | Purpose |
|---|---|---|
| `initiative` | `<initiative>` | Isolate this workload's spend from everything else in the subscription |
| `env` | `demo` | Separate demo from any future prod resource |
| `owner` | `<owner alias>` | Accountability (name only, no secret) |
| `costCenter` | `<value>` | Optional, for chargeback rollups |

Two Foundry-specific helpers and one hard limitation:

- Foundry automatically tags Models-sold-by-Azure usage with a `project` tag, so per-project image cost is filterable in Cost Analysis with zero manual tagging (Preview; documented for Azure Direct models, which the image model is). [Plan and manage costs for Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/manage-costs) Whether MAI-Voice-2 (billed through Speech) also carries this tag is UNKNOWN (see below).
- **Azure tags cannot split per-consumer spend.** One shared resource serves multiple brands, and there is no per-request tag on an individual generation or synthesis call, so the meter aggregates all consumers at the resource level. Per-brand and per-model attribution therefore comes from the pipeline's own ledger (it knows which brand, voice, and model each call was for), which should be treated as the authoritative per-brand ledger; Azure tags and meters give the initiative-level roll-up and the reconciliation baseline, not the brand split.
- Tags are not applied retroactively, so apply them before the backfill runs, and expect some records to show as Untagged or Tags not available for services that omit tags from usage. [Cost analysis common uses](https://learn.microsoft.com/azure/cost-management-billing/costs/cost-analysis-common-uses), [Group and filter options](https://learn.microsoft.com/azure/cost-management-billing/costs/group-filter) Formal cost-allocation rules are not needed here and require an MCA-E or EA billing role in any case, so prefer simple tag filtering over allocation rules. [Create and manage Azure cost allocation rules](https://learn.microsoft.com/azure/cost-management-billing/costs/allocate-costs)

### Q5. Model-tier cost trade-off: Flash versus 2.5 for bulk

**Price delta.** Per 1M tokens, Flash is materially cheaper on every meter: image output 33 versus 47 USD (about 30 percent less), and input 1.75 versus 5 (text) / 8 (image) USD (about 65 to 78 percent less). Because image output dominates, the practical saving on a several-hundred-image catalog backfill is roughly **5 to 20 USD** (Flash lower band versus 2.5, Q1). In absolute terms that is small for a one-time build of a catalog this size.

**What is identical between the tiers (so Flash buys cost, not speed).** Both are version `2026-06-02`, both support text-to-image generation and image-to-image edits (unlike MAI-Image-2e, which is generations-only, is retiring 2026-08-15, and is not a viable fallback per SPIKE-01 Q1), both expose the same parameter set, and both are offered in the same seven Global Standard regions. Critically, on the primary subscription both sit at the **same 10 RPM (Tier 5)** quota, and even at Tier 6 both cap at 12 RPM. [SPIKE-01 Q1 and Q5](SPIKE-01-image-model.md), [Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai) So choosing Flash saves money but not wall-clock time here.

**Quality trade-off.** MAI-Image-2.5 is the flagship (Arena No. 3 text-to-image, No. 2 image editing, with its largest gains over MAI-Image-2 in Cartoon/Anime/Fantasy at +90 ELO, the band closest to a hand-illustrated children's-book look). Flash is positioned as "faster, cheaper." The exact quality gap between Flash and 2.5 on a specific target art style is **UNKNOWN** (not benchmarked for a given style by Microsoft), which is why it must be tested, not assumed. [Introducing MAI-Image-2.5](https://microsoft.ai/news/introducing-mai-image-2-5/), [SPIKE-01 Q1](SPIKE-01-image-model.md)

**Guidance.**
- Use **MAI-Image-2.5** for the pilot and for all final published or hero art. The pilot's entire purpose is to prove the target style match at maximum quality; proving it on Flash would prove nothing about 2.5.
- Prefer **Flash for bulk** only when one of these holds: (a) the pilot has already shown, via an added Flash arm, that Flash's quality is acceptable for the target style (rule: add a Flash arm only after 2.5 wins); (b) you are generating many throwaway candidates per scene where a cheaper pass is worthwhile; or (c) the catalog grows large enough that the roughly 30 percent output saving becomes material. For a catalog of a few hundred scenes the absolute saving (single-digit-to-low-double-digit USD) is modest, so let quality win unless a Flash arm demonstrates parity.
- Do not substitute MAI-Image-2e to save money (no edits endpoint, retiring, different lineage). [SPIKE-01 Q1](SPIKE-01-image-model.md)

---

## What is still UNKNOWN

1. **Tokens per generated image for MAI-Image-2.5 and Flash.** Microsoft publishes no figure. This is the largest single lever in every image dollar estimate above; all per-image, pilot, and backfill ranges collapse to point numbers once the smoke test measures it (method in SPIKE-01 Q2). Until then, treat the image figures as bands, not commitments.
2. **The image rate card confirmed from a rendered first-party pricing page.** The Azure pricing widgets did not render in either spike; the 5 / 8 / 47 and 1.75 / 1.75 / 33 figures are corroborated by indexed search and third-party catalogs but not by a live first-party render, and SPIKE-01 saw a conflicting 19.50 USD Flash-output figure in one secondary source. Read the rates live in the Foundry portal at deploy time before authorizing spend.
3. **Whether the credit subscription's credit is an EA Azure Prepayment.** Only EA offers get automated credit alerts; a credit or MVP subscription likely is not EA, so the plan relies on a budget plus scheduled emails rather than credit alerts. Confirm the offer type when the budget is created.
4. **Flash-versus-2.5 quality on a specific target art style.** Not benchmarked by Microsoft for a given style; resolved only by adding a Flash arm to the pilot.
5. **Whether MAI-Voice-2 usage carries the Foundry `project` tag** the way Models-sold-by-Azure image usage does (voice bills through Speech). Minor: the pipeline ledger covers per-brand and per-model attribution regardless.
6. **Preview pricing volatility.** The entire MAI family is in preview with no SLA; rates and meters can change. Re-verify at GA and treat every figure here as a preview-window snapshot. [voice plan section 10, image plan section 8]

---

## Recommendation

1. **Adopt the working rate card but gate spend on a live portal read.** Use 5 / 8 / 47 USD per 1M tokens (MAI-Image-2.5), 1.75 / 1.75 / 33 USD (Flash), and 22 USD per 1M characters (MAI-Voice-2, first-party confirmed) for all planning. Before the first paid run, read the image rates live in the Foundry portal and the voice rate on the Speech pricing page, and reconcile against these figures. Never authorize a batch against an unconfirmed image rate combined with an unmeasured tokens-per-image.

2. **Make the image smoke test a cost probe first.** The first one or two MAI-Image-2.5 calls exist to read tokens-per-image (SPIKE-01 Q2) and to convert the pilot and the full catalog backfill from ranges into real numbers. Do this before any bulk image run.

3. **Budget the voice work from the deterministic formula.** The one-time multi-voice backfill is V voices x catalog characters x 22 / 1,000,000; ongoing new content is about 1 to 2 USD per month. Voice cost is deterministic (characters are known pre-call), so the ledger can enforce it exactly.

4. **Enforce the monthly cap in two layers, and understand which one is the real cap.**
   - **Real cap (synchronous, pre-spend): the pipeline.** Keep the pre-flight budget guard and the per-month ledger in the publish pipeline as the authoritative stop, because it is the only mechanism that refuses a call before the money is spent. Set the default to match the cap. For voice the guard is exact; for images use a conservative (high) tokens-per-image assumption until the smoke test calibrates it, so the guard trips early rather than late. Honor the owner's decision to keep the guard effectively lifted during a credit-burn window, then set it to the cap once the credit resets.
   - **Backstop (reactive, notify-only): an Azure budget.** Create a monthly budget at **resource-group scope** on the shared Foundry resource's RG (RG scope aggregates all consumers and both models in one place and isolates the initiative from unrelated subscription cost). Amount equal to the cap. Actual-cost alert thresholds at 50 / 75 / 90 / 100 percent, plus a Forecasted alert at 100 percent (up to 5 thresholds and 5 recipients are supported). Wire one action group that emails the owner; optionally, later and as custom development, have it flip a "publish disabled" flag, but never treat that as the cap. Understand that this budget detects and notifies about once a day after the spend; it does not prevent it.

5. **Track credit burn-down with a budget plus Cost Analysis, not credit alerts.** Because credit alerts are EA-only and a credit or MVP subscription is likely not EA, watch the credit with the RG budget above, a subscription-scoped budget set to the credit amount, and a scheduled daily cost email off a saved Cost Analysis view during the burn push. Both the image (Models sold by Azure) and voice (first-party Speech) charges draw down Azure Prepayment credit, so the credit funds the entire build-out.

6. **Tag for attribution now, and lean on the pipeline ledger for the brand split.** Apply `initiative=<initiative>`, `env=demo`, `owner=<alias>`, and optional `costCenter` to the resource group and Foundry resource before the backfill (tags are not retroactive), enable tag inheritance, and use the auto-applied Foundry `project` tag for per-project image cost. Accept that one shared resource means Azure tags cannot separate per-brand spend; the pipeline ledger is the per-brand and per-model source of truth, reconciled against the RG meters.

7. **Model tier: 2.5 for the pilot and final art, Flash for bulk only after a Flash arm proves parity.** The Flash saving on a catalog this size (single-digit-to-low-double-digit USD one-time) does not justify risking the style match, and Flash buys no extra throughput here (same 10 RPM). Add a Flash arm to the pilot; if it holds the target style, use Flash for large candidate sweeps and any future large-catalog backfill. Do not use MAI-Image-2e.

Net cost picture: steady state is a few dollars a month; the entire one-time build-out (multi-voice backfill plus a full image catalog backfill on the premium model) tops out near the monthly cap in a single worst-case month, which is exactly what an owner cap sized for this is meant to absorb while still stopping a runaway. The cap is enforced for real by the pipeline guard, not by the Azure budget, which is a same-day notifier and backstop only.

---

&lt;!-- safety-scan-worked-example:start -->

## Worked example: Gunner the Lab / Holdfast Press

This is the concrete build the methodology above was first applied to: two publishing brands (Gunner the Lab and Holdfast Press StoryReader) sharing one East US Azure AI Foundry (AIServices) resource, against an owner cap of 100 US dollars per month. Grounding: `ai/plans/source/mai-image-2-5-art-match.md` (image pricing table, pilot and backfill scope), `ai/plans/source/ai-voice-mai-voice-2.md` (voice pricing, catalog sizes, ledger and `--mai-budget-usd` guard, owner decisions), `ai/verification/environment-readiness.md` (primary subscription, East US, Tier 5 quota).

### Image rollups

**Pilot (Story 1, 3 scenes, up to 20 calls on MAI-Image-2.5).** Each call returns one image, so up to 20 images:

| Line | Calculation | Estimate |
|---|---|---|
| 20 images, output | 20 x 0.05 to 0.20 USD | ~1 to 4 USD |
| Prompt input, 20 calls | 20 x under 0.01 USD | under 0.20 USD |
| **Pilot total** | | **~1 to 4 USD, hard cap 10 USD** |

The 10 USD cap gives headroom for retries and for a higher-than-assumed tokens-per-image. This matches the image source plan's pilot figure.

**Full catalog backfill (about 170 scenes x 2 candidates = 340 images).**

| Model | Calculation | Estimate |
|---|---|---|
| MAI-Image-2.5 | 340 x 0.05 to 0.20 USD | ~17 to 68 USD |
| MAI-Image-2.5-Flash | 340 x 0.03 to 0.14 USD | ~10 to 48 USD |

Every figure scales linearly off the unmeasured tokens-per-image; the smoke test's first two calls convert the entire column into a real number before any batch is authorized.

### Voice rollups

Catalog sizes (from publish state, voice plan sections 1 and 9): Gunner about 450,000 characters (42 stories, all with audio); Holdfast about 31,630 characters (prologue plus chapter one). Per single extra voice: Gunner ~9.90 USD, Holdfast ~0.70 USD.

Locked owner decision (MASTER-PLAN; A2 in the voice plan): **three listen-only voices, the same set for both brands** (Harper en-US, Lisa en-AU, Ethan en-US with the excited style), with each brand's existing narrator kept as the default track.

| Item | Characters | One-time cost |
|---|---|---|
| Gunner, 3 voices | ~1,350,000 | ~29.70 USD |
| Holdfast, 3 voices | ~94,890 | ~2.09 USD |
| **Total initial backfill (both brands, 3 voices)** | ~1,444,890 | **~32 USD** |

The voice plan's section 9 table showed about 21 USD because it modeled two voices; the locked three-voice set lands at about 32 USD, and that is the figure carried into the credit-burn plan.

Ongoing monthly (new content only, x3 voices):

| Cadence | Characters (x3 voices) | Cost |
|---|---|---|
| New Gunner story (~11k chars each) | ~33,000 | ~0.73 USD |
| New Keepers chapter (~16k chars each) | ~48,000 | ~1.06 USD |
| Typical month (1 story + 1 chapter) | ~81,000 | ~1.78 USD |

Storage and egress stay inside Cloudflare R2's 10 GB free tier with free egress.

### Combined spend versus the 100 USD cap

| Month type | Voice | Image | Month total | Against 100 USD cap |
|---|---|---|---|---|
| Steady state (typical) | ~1.78 USD | occasional small regen | ~2 to 5 USD | 2 to 5% |
| Voice backfill month | ~32 USD (3 voices, both brands) | pilot ~1 to 4 USD | ~33 to 36 USD | ~35% |
| Full-push month, images on 2.5 | ~32 USD | full catalog ~17 to 68 USD | ~49 to 100 USD | at the cap |
| Full-push month, images on Flash | ~32 USD | full catalog ~10 to 48 USD | ~42 to 80 USD | under the cap |

Reading: the biggest realistic single month (do the entire voice backfill and an entire image catalog backfill at once, on the premium image model) lands right at 100 USD, so the owner's 100 USD cap accommodates a full one-shot build-out yet still stops a runaway loop. Steady state after backfill is a few dollars a month.

### Pipeline hard stop (the real cap)

The voice plan adds `state.maiLedger[month] = { chars, estUsd }` (estUsd = chars x 22 / 1,000,000), printed every run, plus a `--mai-budget-usd` hard stop in `publish.mjs` that refuses to proceed once the month's estimated spend would exceed the flag. This mirrors the existing F0 character guard (`MONTHLY_CHAR_BUDGET = 450,000` tracked in `tools/.state/<brand>.json`). The owner set the `--mai-budget-usd` default to 100 to match the cap (voice plan decision 5; MASTER-PLAN), with the guard kept effectively lifted during the credit-burn window and set to 100 once the credit resets. The F0 `charLedger` is per brand-state but the underlying resource is shared by both brands, so real usage is the sum; the resource-group-scoped budget aggregates this.

### Tags and subscription

Applied tags: `initiative=studio-foundry`, `env=demo`, `owner=<owner alias>`, optional `costCenter`. The credit subscription ("This Is My Demo - MVP Subscription") is unlikely to be an EA Prepayment, so the plan relies on a budget plus scheduled cost emails rather than automated credit alerts. Both the image (Models sold by Azure) and voice (first-party Speech) spend draw down that subscription's Azure Prepayment credit.

&lt;!-- safety-scan-worked-example:end -->

---

## Sources

- Plan and manage costs for Microsoft Foundry (token billing; budgets and alerts; "Azure OpenAI doesn't currently provide" hard limits; action-group automation needs custom dev; Group by Meter/Resource; `project` tag attribution; Azure Prepayment covers Models sold by Azure): <https://learn.microsoft.com/azure/foundry/concepts/manage-costs>
- Foundry Models FAQ (token billing, no resource or deployment cost): <https://learn.microsoft.com/azure/foundry-classic/foundry-models/faq>
- Foundry Models pricing, Microsoft models page (canonical image rate card; client-rendered widget, did not render the 2.5 family this session): <https://azure.microsoft.com/en-us/pricing/details/ai-foundry-models/microsoft/>
- Deploy and use MAI image models in Microsoft Foundry (preview) (endpoints, parameters, both tiers do generations and edits, same regions): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
- MAI-Voice-2 model page (22 USD per 1M characters; 15 languages): <https://microsoft.ai/models/mai-voice-2/>
- New MAI models in Microsoft Foundry, June 2026 (voice and image launch): <https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/new-mai-models-in-microsoft-foundry-across-text-image-voice-and-speech/4524632>
- Azure Speech pricing (voice character meter; client-rendered widget, did not render this session): <https://azure.microsoft.com/pricing/details/speech/>
- Introducing MAI-Image-2.5 (Arena ranks; +90 Cartoon/Anime/Fantasy; Flash positioning): <https://microsoft.ai/news/introducing-mai-image-2-5/>
- Use cost alerts to monitor usage and spending (budget vs credit vs department alerts; credit alerts are EA-only at 90%/100%): <https://learn.microsoft.com/azure/cost-management-billing/costs/cost-mgt-alerts-monitor-usage-spending>
- Tutorial: create and manage budgets (RG-scope budgets; up to 5 thresholds/5 emails; actual vs forecast; action groups; within-the-hour notification): <https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets>
- Manage costs with automation (costs evaluated against threshold about once per day): <https://learn.microsoft.com/azure/cost-management-billing/costs/manage-automation>
- Manage costs with budgets (action-group orchestration; subscription/RG scope): <https://learn.microsoft.com/azure/cost-management-billing/manage/cost-management-budget-scenario>
- What is Microsoft Cost Management (budgets notify; tags are the only way to add business context; scheduled alerts; organize/allocate costs): <https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management>
- Cost analysis common uses (view costs for a tag; tags are not retroactive): <https://learn.microsoft.com/azure/cost-management-billing/costs/cost-analysis-common-uses>
- Group and filter options in Cost Analysis and Budgets (Tag and Meter dimensions; Untagged/Tags not available behavior): <https://learn.microsoft.com/azure/cost-management-billing/costs/group-filter>
- Create and manage Azure cost allocation rules (allocation rules require MCA-E/EA billing roles): <https://learn.microsoft.com/azure/cost-management-billing/costs/allocate-costs>
- Well-Architected: set spending guardrails (alert at 90% ideal, 100% target, 110% over): <https://learn.microsoft.com/azure/well-architected/cost-optimization/set-spending-guardrails>
- Sibling spike (image token mechanics, rate-card caveat and 19.50 USD Flash conflict, tokens-per-image method, canvas, RPM ladder, 2e retirement): `docs/research/SPIKE-01-image-model.md`
- Local grounding: `ai/plans/source/mai-image-2-5-art-match.md` (image pricing table, pilot and backfill scope), `ai/plans/source/ai-voice-mai-voice-2.md` (voice pricing, catalog sizes, ledger and `--mai-budget-usd` guard, owner decisions), `ai/verification/environment-readiness.md` (primary subscription, East US, Tier 5 quota)
