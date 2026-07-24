# SPIKE-10: latest available in-tenant GPT model

Role: foundry-researcher (Opus). Status: research spike complete. No Azure resources created, no spend, no model deployed.
Date: 2026-07-22
Scope: independent, first-party verification of what the newest deployable OpenAI GPT-family model is in this tenant's Azure AI Foundry catalog today, and whether the roster's planned `gpt-5.6-terra` is still current or has been superseded. Grounds every claim in a Microsoft Learn source, cited inline. Anything Microsoft has not published is marked UNKNOWN.

Grounding documents read first: the model roster (the model roster that plans `gpt-5.6-terra` as one half of a two-vendor reviewer-LLM pair) and this spike's brief (this spike's brief). This spike confirms, corrects, and deepens the roster entry. The paired xAI Grok half is covered by SPIKE-11 and is not duplicated here.

Bottom line up front: `gpt-5.6-terra` is still current. It is one of three models in the GPT-5.6 series (`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`), all version `2026-07-09`, all GA, which is the newest OpenAI GPT generation in the Foundry catalog. Terra is the balanced mid tier of that generation and remains the right default for a low-volume reviewer role. The one material correction: GPT-5.6 no longer requires the GPT-5 limited-access registration the roster lists as a gate. It needs quota only, and this tenant's Tier 5 subscription has that quota by default.

---

## Q1. What is the newest GPT-family model deployable in this tenant today

**Question.** Is `gpt-5.6-terra` still the newest OpenAI GPT model available as a Foundry model deployment, or has something newer shipped since the roster entry was written?

**Findings.**

- The newest OpenAI GPT generation in the Foundry catalog is the **GPT-5.6 series**, flagged NEW in the model highlights, comprising `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`, all version `2026-07-09`. Source: [Foundry Models sold by Azure, Azure OpenAI models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#azure-openai-in-microsoft-foundry-models).

- `gpt-5.6-terra` is therefore not superseded by generation: it is a member of the current newest generation. The published capability table lists all three GPT-5.6 models with identical specs: reasoning, Chat Completions API, Responses API, structured outputs, text and image processing (vision), functions/tools and parallel tool calling, computer use, a 1,050,000 token context window (input 922,000 / output 128,000), 128,000 max output tokens, and training data up to June 2026. Source: [Foundry Models sold by Azure, GPT-5.6](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-56).

- The version churn ladder behind it, for context (each a distinct generation, newest last): GPT-5 (`2025-08-07`), GPT-5.1 (`2025-11-13`), GPT-5.2 (`2025-12-11`), GPT-5.3 (`2026-02-24`), GPT-5.4 (`2026-03-05`), GPT-5.5 (`2026-04-24`), GPT-5.6 (`2026-07-09`). The codex-suffixed variants (`gpt-5.x-codex`) are Responses-API and code-tuned, not general reviewers. Sources: [Azure OpenAI reasoning models, API and feature support](https://learn.microsoft.com/azure/foundry/openai/how-to/reasoning#api-&-feature-support) and the models-sold page sections above.

- **Version note.** The roster records `gpt-5.6-terra` as "GA (v2026-07-09)", which matches the authoritative version on the models-sold page, the region-availability pages, the retirement schedule, the priority-processing page, and the Responses API supported-models list. One reasoning-page table rendered the GPT-5.6 row as `2026-06-25`; every other first-party page shows `2026-07-09`, so `2026-07-09` is treated as correct and the `2026-06-25` snippet as a stale rendering. Sources: [reasoning models feature table](https://learn.microsoft.com/azure/foundry/openai/how-to/reasoning#api-&-feature-support) versus [models-sold GPT-5.6](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-56) and [Responses API supported models](https://learn.microsoft.com/azure/foundry/openai/how-to/responses#supported-models).

## Q2. Is it actually deployable (lifecycle, region, vision, access gating, quota)

**Question.** GA versus preview, region availability in this tenant's East US, whether it is vision-capable for the reviewer/grading role, and what access gates apply.

**Findings.**

- **Lifecycle: GA, not preview.** All three GPT-5.6 models are listed GA with a retirement date of `2027-07-09` (a full 12 months of guaranteed support from the `2026-07-09` version date). Source: [Model retirement schedule, Foundry Models sold by Azure](https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirement-schedule#foundry-models-sold-by-azure). This is a meaningful upgrade over the roster's stated "preview risk": the planned GPT reviewer is a GA model, so the preview caveats that apply to the image and voice models do not apply here.

- **Region: available in East US on Global Standard.** In the Global Standard Americas table, `gpt-5.6-terra` `2026-07-09` shows available in eastus and eastus2 (and every other listed Americas region). This matches the roster's "GlobalStandard East US" placement. Source: [Region availability for Foundry Models sold by Azure, Global Standard](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard). Note that Global Provisioned Managed placement is split across regions (terra shows in japaneast/koreacentral/southeastasia and some EU regions but not eastus in the provisioned table); this only matters if a provisioned (PTU) deployment is ever chosen. For the Global Standard pay-as-you-go path this repo uses, East US is clear.

- **Vision-capable: yes.** The capability table marks image input (text and image processing) for all three GPT-5.6 models, and the vision-enabled chat models doc lists the GPT-5 series among current vision-enabled models. This satisfies the reviewer/grading role, which must see the images the FLUX and MAI generators produce. Sources: [models-sold GPT-5.6](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-56) and [Use vision-enabled chat models](https://learn.microsoft.com/azure/foundry/openai/how-to/gpt-with-vision).

- **Access gating: no limited-access registration required (this corrects the roster).** The reasoning models availability table lists `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` with: "No access request needed. Quota request required depending on quota tier. Tier 5 and Tier 6 subscriptions have quota by default." This differs from the older GPT-5 tier (`gpt-5`, `gpt-5-pro`, `gpt-5-codex`, `gpt-5.1`, `gpt-5.2`), which the same page still gates behind the `aka.ms/oai/gpt5access` limited-access application. The roster's gate for `gpt-5.6-terra` ("one-time GPT-5 limited-access registration (aka.ms/oai/gpt5access) + TPM quota") is therefore out of date for GPT-5.6: the registration step no longer applies, only quota does. Source: [Azure OpenAI reasoning models, Availability](https://learn.microsoft.com/azure/foundry/openai/how-to/reasoning#availability).

- **Quota in this tenant.** The models-sold GPT-5.6 note states some quota tiers require a quota request to deploy GPT-5.6, and that "Tier 5 and Tier 6 subscriptions have quota by default." SPIKE-01 established this repo's primary subscription (the MVP credit subscription, a Tier-5 / MVP-tier subscription, East US) at Tier 5. On that basis GPT-5.6 quota should be available by default without a quota-increase request, though the exact TPM allotment is not published per tier and must be read live (see UNKNOWN). Sources: [models-sold GPT-5.6 quota note](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-56) and `docs/research/SPIKE-01-image-model.md` (Tier 5 finding for the same subscription).

## Q3. How does it compare to the already-planned model, and which GPT-5.6 tier fits the reviewer role

**Question.** Since `gpt-5.6-terra` is still current, is Terra the right tier, or should Sol or Luna be chosen instead for a low-volume reviewer / prompt-authoring role?

**Findings.**

- **Microsoft Learn does not document any functional difference between sol, terra, and luna.** The three share an identical published capability table (context window, APIs, vision, tools, computer use, output limit, training cutoff). Microsoft does not publish a per-model benchmark, quality ranking, or price that distinguishes them. So from first-party Azure docs alone, the three are interchangeable on paper. Source: [models-sold GPT-5.6](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-56).

- **The tier distinction is a vendor (OpenAI) design, described in OpenAI's own and secondary coverage, not in Azure docs.** GPT-5.6 is a three-tier family named for the cosmos: Sol is the flagship (deepest reasoning, slowest, most expensive), Terra is the balanced mid tier (positioned as competitive with GPT-5.5 at roughly half the flagship cost, and the intended default for production work), and Luna is the fastest and cheapest (best for simple high-frequency tasks). The generation number advances the whole family while the sol/terra/luna tier names persist across generations as durable capability/cost lanes. Sources: [OpenAI, GPT-5.6](https://openai.com/index/gpt-5-6/) and secondary coverage [DataCamp, GPT-5.6 Sol, Terra and Luna](https://www.datacamp.com/blog/gpt-5-6-sol-luna-terra) and [Vellum, GPT-5.6 tiers](https://www.vellum.ai/blog/gpt-5-6-benchmarks-explained). These are not Microsoft first-party sources; treat the tier positioning as vendor guidance, not an Azure-documented SLA.

- **Fit for this repo's reviewer role.** The reviewer/prompt-authoring job in the model roster is low volume (grading a bounded set of generated scenes and refining prompts), needs vision and solid reasoning, and runs under a tight cost posture (the initiative carries a small monthly cap on the voice side and holds bulk generation for the owner). Terra's mid-tier positioning (near-flagship capability, roughly half the flagship cost, GA, vision, 1.05M context) matches that profile better than Sol (pay flagship price for reasoning depth a grading task rarely needs) or Luna (optimized for cheap high-frequency calls, a throughput profile this low-volume role does not have). The roster's choice of Terra is well-founded and does not need to change.

## Q4. Rate limits and cost

**Question.** Deployment SKU options, per-token pricing, and whether the TPM quota is realistic for a low-volume review workload.

**Findings.**

- **Deployment types.** GPT-5.6 is offered on Global Standard and Data Zone Standard (pay-as-you-go, token-metered), and on Global Provisioned Managed (PTU). For this repo's low-volume, cost-sensitive use, Global Standard in East US is the fit; provisioned/PTU is for sustained high throughput and is not warranted here. Priority processing is also available on Global Standard for GPT-5.6 if lower latency is ever wanted, at additional cost. Sources: [Region availability, Global Standard](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard) and [Enable priority processing for Microsoft Foundry models](https://learn.microsoft.com/azure/foundry/openai/concepts/priority-processing#priority-processing-availability-by-deployment-type).

- **Billing model.** Like all Foundry models, GPT-5.6 is billed per token for input and output, with no separate charge for the resource or deployment; prices are visible before deploy and usage appears in Cost Management. Source: [Plan and manage costs for Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/manage-costs) (billing mechanism established in `docs/research/SPIKE-01-image-model.md` Q2).

- **Exact per-token rates for GPT-5.6 could NOT be verified from a rendered first-party pricing page during this spike.** The models-sold page directs to the Azure OpenAI pricing page for numbers, and that page is a client-rendered widget that does not reliably surface a specific model's rate in a fetchable form (the same limitation SPIKE-01 hit for the MAI image family). The vendor/secondary tier positioning (Terra roughly half of Sol and competitive with GPT-5.5; Luna under half of GPT-5.5) gives a relative sense but is not an Azure per-token figure. This spike will not assert a rate it could not verify. Resolve by reading the price shown in the Foundry portal at deploy time. See UNKNOWN.

- **TPM quota realism.** Tier 5 (this tenant) has GPT-5.6 quota by default. A reviewer workload that grades a bounded batch of scenes and iterates on prompts is well within any default TPM, especially since each review is one request with a modest prompt plus one or a few images; the 1.05M context window means even long rubrics plus multiple reference images fit in a single call. The practical constraint is spend, not TPM. Source: [models-sold GPT-5.6 quota note](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-56).

---

## What is still UNKNOWN

1. **Exact per-token price for `gpt-5.6-terra` (and sol/luna) on Global Standard.** Not verifiable from a rendered first-party pricing page during this spike. Resolve by reading the price shown in the Foundry portal at deploy time, or the Azure OpenAI pricing page once it surfaces the GPT-5.6 rows. The vendor "roughly half of flagship / competitive with GPT-5.5" positioning is directional only, not an Azure number.
2. **The default TPM allotment for GPT-5.6 at Tier 5.** Microsoft states Tier 5 has quota by default but does not publish the specific TPM per tier for this model. Resolve by reading the deployment quota in the portal at deploy time. Low risk given the low-volume workload.
3. **Any functional or quality difference between sol, terra, and luna as documented by Microsoft.** None is published; the tier distinction is OpenAI vendor guidance. Whether Terra's vision-grading quality is sufficient versus Sol for this specific art-review task is only resolvable by a side-by-side pilot on real generated scenes.
4. **Whether GPT-5.6 quota shares a pool with, or is separate from, the older GPT-5 limited-access models in this subscription.** The reasoning page says no access request is needed for GPT-5.6, but does not state whether existing GPT-5 access or quota carries over. Resolve at deploy time.

## Recommendation

1. **Keep `gpt-5.6-terra` as the planned OpenAI half of the reviewer-LLM pair.** It is still current: a GA member of the newest GPT generation (GPT-5.6, `2026-07-09`), vision-capable, 1.05M context, available on Global Standard in East US, and its Terra mid tier is the right cost/capability lane for a low-volume vision-grading and prompt-authoring role. No newer GPT model supersedes it, and no change of model is warranted. This does not require a new ADR (the underlying decision rationale is unchanged).

2. **Correct the roster's gate for this entry.** GPT-5.6 does not require the `aka.ms/oai/gpt5access` limited-access registration the roster lists. Per the reasoning-models availability table, GPT-5.6 needs "No access request" and only a quota request depending on tier, and Tier 5 (this tenant) has quota by default. The roster's gate line should be updated from "one-time GPT-5 limited-access registration (aka.ms/oai/gpt5access) + TPM quota" to "no limited-access registration required; quota only, available by default at Tier 5." (Roster edit deferred to the backlog owner under this repo's model policy; flagged here, not applied by this spike.)

3. **Drop the "preview risk" framing for the GPT reviewer specifically.** GPT-5.6 is GA with a `2027-07-09` retirement date, unlike the preview image/voice models. The preview-risk acceptance recorded for the media models does not need to extend to this reviewer.

4. **At deploy time, read the live per-token price and the Tier 5 TPM in the Foundry portal before enabling the reviewer**, and set a Cost Management budget alert on the resource group, consistent with SPIKE-01's cost discipline. Do not rely on the vendor relative-cost positioning as a spend figure.

5. **If the pilot finds Terra's grading quality insufficient, Sol is the same-generation upgrade** (identical APIs and context, deeper reasoning, higher cost) and is a drop-in change of deployment name only. Luna is the cheaper downgrade if cost ever dominates over grading quality. All three are GA, vision-capable, and East US Global Standard, so switching tiers carries no new access or region work.

## Sources

- Foundry Models sold by Azure, Azure OpenAI model highlights (GPT-5.6 flagged NEW): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#azure-openai-in-microsoft-foundry-models>
- Foundry Models sold by Azure, GPT-5.6 capabilities and quota note: <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-56>
- Region availability for Foundry Models sold by Azure, Global Standard (terra in eastus/eastus2): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard>
- Model retirement schedule, Foundry Models sold by Azure (GPT-5.6 GA, retire 2027-07-09): <https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirement-schedule#foundry-models-sold-by-azure>
- Azure OpenAI reasoning models, Availability (GPT-5.6 "No access request needed", quota by tier): <https://learn.microsoft.com/azure/foundry/openai/how-to/reasoning#availability>
- Azure OpenAI reasoning models, API and feature support (GPT-5 generation ladder): <https://learn.microsoft.com/azure/foundry/openai/how-to/reasoning#api-&-feature-support>
- Use vision-enabled chat models (GPT-5 series is vision-enabled): <https://learn.microsoft.com/azure/foundry/openai/how-to/gpt-with-vision>
- Use the Azure OpenAI Responses API, supported models (GPT-5.6 version 2026-07-09): <https://learn.microsoft.com/azure/foundry/openai/how-to/responses#supported-models>
- Enable priority processing for Microsoft Foundry models (GPT-5.6 on Global Standard): <https://learn.microsoft.com/azure/foundry/openai/concepts/priority-processing#priority-processing-availability-by-deployment-type>
- Plan and manage costs for Microsoft Foundry (token billing, Cost Management): <https://learn.microsoft.com/azure/foundry/concepts/manage-costs>
- OpenAI, GPT-5.6 (Sol/Terra/Luna tier design, vendor source, not Azure-documented): <https://openai.com/index/gpt-5-6/>
- DataCamp, GPT-5.6 Sol, Terra and Luna (secondary, tier positioning): <https://www.datacamp.com/blog/gpt-5-6-sol-luna-terra>
- Vellum, GPT-5.6 tiers explained (secondary, tier positioning): <https://www.vellum.ai/blog/gpt-5-6-benchmarks-explained>
