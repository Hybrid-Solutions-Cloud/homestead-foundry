# SPIKE-11: a newer Grok than grok-4-1-fast-reasoning

Role: foundry-researcher (Opus). Status: research spike complete. No Azure resources created, no spend, no deployments.
Date: 2026-07-22
Scope: independent, first-party verification of whether a newer xAI Grok model than `grok-4-1-fast-reasoning` is available, vision-capable, and deployable in this tenant's Foundry catalog and region, for the xAI half of the two-vendor reviewer-LLM pair. Grounds every claim in a Microsoft source, cited inline. Anything Microsoft has not published is marked UNKNOWN.

Grounding read first: `pmo/backlog/SPIKE-11-newer-grok-model.md` (the brief), `pmo/BACKLOG.md`'s reviewer-LLM roster, and the model-roster memory. This spike verifies whether the planned name is still the right one. It is deliberately non-overlapping with SPIKE-10 (the OpenAI half of the pair): see the cross-reference at the end.

Vision is a hard requirement for this role (the model grades generated images alongside prompt/text review). Text-only Grok variants are already rejected in `pmo/BACKLOG.md`. Any newer candidate must clear the same bar.

---

## Q1. What is the newest xAI Grok model available as a Foundry deployment today

**Question.** Confirm, from the live Foundry catalog rather than the name in the brief, the current set of xAI Grok models sold by Azure, and identify the newest one.

**Findings.**

- The current xAI models sold by Azure, with capabilities:

  | Model | Lifecycle | Input | Output | Vision |
  |---|---|---|---|---|
  | `grok-4.3` | Preview | text (200,000 tokens) | text (8,192 tokens) | No |
  | `grok-4-20-reasoning` | Preview | text (262,000 tokens) | text (8,192 tokens) | No |
  | `grok-4-20-non-reasoning` | Preview | text (262,000 tokens) | text (8,192 tokens) | No |
  | `grok-4.1-fast-reasoning` | GA (no Preview tag) | text, image (128,000 tokens) | text (128,000 tokens) | **Yes** |
  | `grok-4.1-fast-non-reasoning` | GA (no Preview tag) | text, image (128,000 tokens) | text (128,000 tokens) | **Yes** |
  | `grok-4` | GA | text (262,000 tokens) | text (8,192 tokens) | No |
  | `grok-code-fast-1` | Preview | text (256,000 tokens) | text (8,192 tokens) | No |

  Source: [Foundry Models sold by Azure, xAI models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#xai-models-sold-by-azure).

- **Naming note (important, not a discrepancy).** The capabilities table spells the model `grok-4.1-fast-reasoning` (with a dot). The region-availability table and the deployment-name column spell the same model `grok-4-1-fast-reasoning` (with a hyphen), version `1`. Source: [Region availability, Global Standard, Americas](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard). These are the same model; `pmo/BACKLOG.md`'s `grok-4-1-fast-reasoning` matches the deployment-name spelling and needs no change.

- **There are newer-numbered Grok models than `grok-4.1-fast` in the catalog** (`grok-4.3`, `grok-4-20-reasoning`, `grok-4-20-non-reasoning`), so the brief was right to ask. But every one of those newer-numbered models is text-only (see Q2). `grok-4.1-fast-reasoning` is the newest xAI model that is both vision-capable and GA.

- `grok-4.1-fast-reasoning` is also recent enough to have been added to Azure model router in the `2025-11-18` router version (May 2026 release notes), which corroborates it as a current, actively-shipped model rather than a legacy one. Source: [What's new in model router](https://learn.microsoft.com/azure/foundry/foundry-models/whats-new-model-router).

## Q2. Is the newest model vision-capable

**Question.** The role grades images, so text and image input is mandatory. Confirm which current Grok models accept image input.

**Findings.**

- **Only the `grok-4.1-fast` pair accepts image input.** The capabilities table lists `grok-4.1-fast-reasoning` and `grok-4.1-fast-non-reasoning` as **Input: text, image**. Every other current Grok (`grok-4.3`, `grok-4-20-reasoning`, `grok-4-20-non-reasoning`, `grok-4`, `grok-code-fast-1`) lists **Input: text** only. Source: [Foundry Models sold by Azure, xAI models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#xai-models-sold-by-azure).

- **Therefore the newer-numbered Groks fail the hard requirement.** `grok-4.3` and the `grok-4-20` reasoning/non-reasoning pair are text-only and cannot see the generated art, so they are rejected for this role on the same grounds the roster already rejects text-only Groks. A higher version number does not imply vision on this vendor's Foundry line.

- Of the two vision-capable variants, the **reasoning** one (`grok-4.1-fast-reasoning`) is the correct pick for an independent second-opinion / tie-breaker reviewer that must justify a judgment; the non-reasoning sibling trades that away for latency and is not what this role needs.

## Q3. Is grok-4-1-fast-reasoning actually deployable in this tenant's region

**Question.** GA vs preview, region availability (East US, the proven build's region), deployment types, access gating, context window, pricing.

**Findings.**

- **Lifecycle: GA.** In the capabilities table `grok-4.1-fast-reasoning` carries no **Preview** tag, unlike `grok-4.3`, the `grok-4-20` pair, and `grok-code-fast-1`, which are all marked **Preview**. GA is the more deployable, lower-churn status. Source: [Foundry Models sold by Azure, xAI models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#xai-models-sold-by-azure).

- **Region: available in East US** (the region the environment check cleared for the proven build), in both deployment types. `grok-4-1-fast-reasoning` version `1` shows a check for `eastus` under Global Standard, and also under Data Zone Standard (Americas). It is in fact available in every listed Americas, Europe, Asia Pacific, and Middle East / Africa region. Sources: [Region availability, Global Standard](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard), [Region availability, Data Zone Standard](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#data-zone-standard). This is materially broader than MAI-Image-2.5 (East US, West Central US, West US, South India, Sweden Central, West Europe, UAE North only) on the same page, so the reviewer LLM co-locates with the image resource in East US with no region conflict.

- **Access gating: xAI terms acceptance, but no separate limited-access registration.** Use of any Grok model is subject to the [xAI Acceptable Use Policy](https://x.ai/legal/acceptable-use-policy), with xAI as an intended third-party beneficiary. Source: [Model-specific terms for Microsoft Foundry, Grok models](https://learn.microsoft.com/azure/foundry/responsible-ai/models/model-specific-terms). Separately, the catalog states registration is required only for `grok-code-fast-1` and `grok-4` (via aka.ms/xai/grok-4); `grok-4.1-fast-reasoning` is not on that registration list. Source: [Foundry Models sold by Azure, xAI models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#xai-models-sold-by-azure). Net: the only gate for this model is accepting xAI terms on first deploy plus having quota, which matches the roster's recorded gate.

- **Context window: 128,000 tokens input and 128,000 tokens output**, tool calling supported, English. Ample for a reviewer prompt plus one or more images plus a structured verdict. Source: [Foundry Models sold by Azure, xAI models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#xai-models-sold-by-azure).

- **Pricing: token-metered, but the exact per-token rates for `grok-4-1-fast-reasoning` could NOT be verified from a rendered first-party pricing page during this spike.** Foundry Models sold by Azure (including Grok) are billed by Microsoft in tokens, appearing as model meters in Cost Management; the general billing model is confirmed but the specific numbers are not. Source: [Plan and manage costs for Microsoft Foundry, token-based pricing](https://learn.microsoft.com/azure/foundry/concepts/manage-costs#understand-the-billing-model-for-foundry-models). This spike will not assert a rate it could not verify; read the live price in the Foundry portal at deploy time (see UNKNOWN). The "fast" tier is xAI's cheaper/lower-latency line, consistent with the roster's "fast/cheap" note, but that is a positioning statement, not a verified rate.

## Q4. How does it compare to grok-4-1-fast-reasoning (is anything newer viable)

**Question.** If nothing newer and vision-capable exists, say so plainly and keep the roster as planned.

**Findings.**

- **Nothing newer clears the bar.** The only Grok models newer than the `grok-4.1-fast` family (`grok-4.3`, `grok-4-20-reasoning`, `grok-4-20-non-reasoning`) are all Preview and all text-only, so each fails the vision hard requirement (Q2) and carries higher preview churn than a GA model. Source: [Foundry Models sold by Azure, xAI models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#xai-models-sold-by-azure).

- **The planned model is the right one, and it already superseded the roster's rejected `grok-4-fast`.** The roster's "Rejected reviewer LLMs" list names "deprecated grok-4-fast." The current catalog no longer lists `grok-4-fast-reasoning` among xAI models sold by Azure; the vision-capable fast line is now `grok-4.1-fast`. So the plan already reflects the newer generation, and `grok-4-1-fast-reasoning` is the newest viable choice, not a stale one. (Legacy `grok-4-fast-reasoning` still appears on the classic Agent Service and older model-router pages, which is a documentation lag, not current catalog availability. Sources: [Model region support, classic Agent Service](https://learn.microsoft.com/azure/foundry-classic/agents/concepts/model-region-support#non-openai-models), [Model router supported models](https://learn.microsoft.com/azure/foundry/openai/concepts/model-router#supported-models).)

---

## What is still UNKNOWN

1. **Exact per-token prices for `grok-4-1-fast-reasoning`.** Not verifiable from a rendered first-party pricing page during this spike (only the general token-billing mechanism is confirmed). Resolve by reading the price shown in the Foundry portal at deploy time, or the Azure pricing page once its table lists this model. This is the main open cost item for the reviewer LLM, though reviewer-LLM spend is small next to image and voice generation.
2. **Current RPM / TPM quota tier for `grok-4-1-fast-reasoning` in the target subscription.** Not read in this spike (no Azure calls). Resolve with a read-only `az cognitiveservices` / quota check at deploy time, the same way the image tier was confirmed for MAI-Image-2.5.
3. **Whether xAI ships a vision-capable successor to the `grok-4.1-fast` line before deployment.** The newer-numbered Groks are text-only today, but that can change. Resolve by re-checking the xAI capabilities table at deploy time and treating any future vision-capable, GA Grok as a drop-in candidate to re-evaluate against this same bar.

## Recommendation

1. **Keep `grok-4-1-fast-reasoning` as planned** for the xAI half of the two-vendor reviewer pair. It is the newest xAI Grok that is both vision-capable and GA; every newer-numbered Grok (`grok-4.3`, `grok-4-20-reasoning`, `grok-4-20-non-reasoning`) is Preview and text-only and therefore fails the vision hard requirement. No roster change is needed, so `pmo/BACKLOG.md` is left as-is per the brief.
2. **Deploy in East US** to co-locate with the image resource; the model is available there under both Global Standard and Data Zone Standard. Pick the reasoning variant, not the non-reasoning sibling, for a justified second-opinion verdict.
3. **Gate is xAI terms acceptance plus quota only.** No separate limited-access registration applies to this model (that gate is on `grok-4` and `grok-code-fast-1`). Accept xAI terms on first deploy.
4. **Read the live per-token price and confirm the quota tier in the portal before any reviewer runs.** Do not rely on the "fast/cheap" positioning as a number; verify it, and set a Cost Management budget alert on the resource group before spend starts.
5. **Re-check the xAI catalog at deploy time.** If a vision-capable, GA Grok newer than `grok-4.1-fast` has appeared, re-evaluate it against the same vision-plus-GA bar; otherwise proceed with `grok-4-1-fast-reasoning`.

## Cross-reference

This spike settles only the xAI half of the two-vendor reviewer pair. The OpenAI half is settled by SPIKE-10 (latest GPT reviewer model). The two together determine the final composition of the pair; read them side by side before locking the reviewer-LLM ADR. The pair is intentionally cross-vendor (xAI plus OpenAI) so the two reviewers do not share lineage with each other or with the image generators they grade.

## Sources

- Foundry Models sold by Azure, xAI models (current Grok catalog, capabilities, vision, registration gating): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#xai-models-sold-by-azure>
- Region availability for Foundry Models sold by Azure, Global Standard (grok-4-1-fast-reasoning v1 in East US and all listed regions): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard>
- Region availability, Data Zone Standard (grok-4-1-fast-reasoning in East US): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#data-zone-standard>
- Model-specific terms for Microsoft Foundry, Grok models (xAI Acceptable Use Policy applies): <https://learn.microsoft.com/azure/foundry/responsible-ai/models/model-specific-terms>
- Plan and manage costs for Microsoft Foundry (token-based billing model, rates on pricing page / portal): <https://learn.microsoft.com/azure/foundry/concepts/manage-costs#understand-the-billing-model-for-foundry-models>
- What's new in model router (grok-4.1-fast-reasoning added in router version 2025-11-18, May 2026): <https://learn.microsoft.com/azure/foundry/foundry-models/whats-new-model-router>
- Model region support, classic Agent Service (legacy grok-4-fast listing, documentation lag): <https://learn.microsoft.com/azure/foundry-classic/agents/concepts/model-region-support#non-openai-models>
- Model router supported models (legacy grok-4-fast-reasoning listing): <https://learn.microsoft.com/azure/foundry/openai/concepts/model-router#supported-models>
