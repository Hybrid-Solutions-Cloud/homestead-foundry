# SPIKE-15: Niche and emerging reviewer models for code and document review

Role: foundry-researcher (Opus). Status: research spike complete. No Azure resources created, no spend, no software installed, no model API called. First-party documentation review only.
Date: 2026-07-22
Scope: independent, first-party assessment of niche or emerging models for a CODE and DOCUMENT reviewer role, reviewing this repo's own docs, Bicep, and scripts, not generated art. This is a DIFFERENT reviewer role from the vision-capable image/content reviewer pair (`gpt-5.6-terra` / `grok-4-1-fast-reasoning`) covered by SPIKE-10 and SPIKE-11; this spike does not duplicate or replace that pair. Every factual claim is grounded in a first-party (Microsoft Learn) source, cited inline. Anything not published first-party is marked UNKNOWN with the test or doc that would resolve it. Model quality claims sourced only to third parties are labelled as such and never treated as verified.

Grounding read first: `pmo/backlog/SPIKE-15-niche-reviewer-models.md` (the tasking), `pmo/BACKLOG.md`, and the model-roster reference. This spike verifies and deepens; it does not restate the plans.

---

## What "K3" turned out to mean (stated explicitly and early, per the tasking)

The owner said "K3" going in without being sure what it referred to. Confirmed interpretation:

**"K3" refers to the Moonshot AI Kimi K-series lineage, and specifically to Kimi K3, a real Moonshot flagship that launched on the Moonshot platform on 2026-07-16.** It is not the same thing as the "Moonshot Kimi-K2.6 (Preview)" entry already in `pmo/BACKLOG.md`: that BACKLOG entry is a considered-but-not-adopted THIRD IMAGE reviewer (a content/vision role), whereas "K3" here is the newer K-series release and the subject of a code/document reviewer question. They are the same vendor and lineage, different releases, different roles.

Two facts must be held together, because they point in opposite directions:

1. **Kimi K3 exists as a Moonshot product, but only per third-party reporting**, which describes it as a roughly 2.8T-parameter mixture-of-experts model with a 1M-token context window, launched 2026-07-16, with open weights slated for release around 2026-07-27. These figures are from vendor-adjacent and third-party blogs, not Microsoft and not Moonshot's own first-party docs that I could verify, so they are recorded as **third-party, unverified** and are not the basis for any recommendation.
2. **Kimi K3 is NOT in the Azure AI Foundry catalog as of this review.** The Moonshot AI models sold by Azure are exactly three, all Preview: `Kimi-K2.5`, `Kimi-K2.6` (version 2026-04-20), and `Kimi-K2.7-Code` (version 2026-06-12). There is no `Kimi-K3` entry. Source: [Foundry Models sold by Azure, Moonshot AI models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#moonshot-ai-models-sold-by-azure).

So: if "K3" means "the literal Kimi K3 model, deployed via Foundry," that is not possible today (UNKNOWN #1: no Foundry catalog entry, no Azure availability or pricing). If "K3" means "the owner's intent, a strong Kimi K-series model for code review, deployable now via Foundry," the deployable proxy is **`Kimi-K2.7-Code` (Preview)**, the coding-specialized member of the same lineage, already in East US. The recommendation below is built on what is deployable today (K2.7-Code), with K3 tracked as a watch item pending Foundry availability.

Note also: Foundry retired `Kimi-k2-thinking` on 2026-03-29 with `Kimi-K2.5` as the named replacement, so the older "K2 Thinking" build is not a live option on the Azure-direct path. Source: [Retired Foundry Models, Moonshot AI](https://learn.microsoft.com/azure/foundry/openai/concepts/retired-models#microsoft).

---

## Question

Five questions from the tasking, answered against first-party sources:

1. What does "K3" refer to (answered above, and revisited under Findings Q1).
2. What is the current Llama release deployable via Azure AI Foundry, and is it credible for code/document review.
3. What other niche or emerging models exist for code and document review specifically (no vision requirement; strong code-reasoning and long-document comprehension instead).
4. Deployability of each credible candidate: catalog availability, region, access gating, pricing.
5. Fit for this repo specifically as a code-reviewer role distinct from the image-review pair.

---

## Findings

### Q1. Kimi K-series on Foundry (the "K3" question, deployable form)

- **Catalog entries (Moonshot AI, sold by Azure, all Preview):** `Kimi-K2.5`, `Kimi-K2.6` (2026-04-20), `Kimi-K2.7-Code` (2026-06-12). All are chat-completion with reasoning content, input text and image up to 262,144 tokens, output text up to 262,144 tokens, languages `en` and `zh`, tool calling Yes. Source: [Foundry Models sold by Azure, Moonshot AI models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#moonshot-ai-models-sold-by-azure).
- **`Kimi-K2.7-Code` is the coding-specialized member.** Microsoft describes the Fireworks-hosted equivalent as a "coding-focused multimodal agentic model for long-horizon software engineering workflows." Source: [Fireworks models on Microsoft Foundry, catalog](https://learn.microsoft.com/azure/foundry/how-to/fireworks/enable-fireworks-models#available-catalog-models). For a code and document reviewer role, the coding-tuned variant is the natural pick over the general K2.5 or K2.6.
- **Region: available in East US** (and every Americas, Europe, Asia Pacific, and Middle East and Africa Global Standard region listed), so it is available in the region this repo's Foundry account already uses. Source: [Region availability for Foundry Models sold by Azure (standard), Global Standard](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard).
- **Access gating:** the Moonshot models are listed without the registration gate that Microsoft applies to some xAI Grok and GPT-5 models (the same page calls out registration for `grok-code-fast-1` and `grok-4`, but states no such requirement for the Kimi models). Source: [Foundry Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#moonshot-ai-models-sold-by-azure). As with the MAI models, standard Foundry acceptable-use and content terms still apply.
- **Preview status:** all three Kimi entries are Preview. The same preview-risk posture the owner already accepted for the MAI models applies here: capabilities and availability can change before GA, and a Preview model can be retired on notice (as `Kimi-k2-thinking` was).
- **Sponsorship-credit coverage (relevant to this repo's credit subscription):** a Microsoft Q&A answer states Kimi usage via Azure AI Foundry is billed as an Azure-native Foundry model and is therefore covered by Azure Sponsorship credits, following Azure billing meters. This is a Q&A answer, not formal pricing documentation; verify against Cost Management on the actual subscription before relying on it. Source: [Microsoft Q&A: Is Kimi-K2.5 covered through Azure Sponsorships credits?](https://learn.microsoft.com/answers/a/12613918).
- **Pricing:** exact Azure per-token pricing for the Kimi models is not stated in these catalog docs and is marked UNKNOWN (#2). Third-party sites quote Moonshot's own direct-API pricing, which is not the Azure Foundry meter and is not used here.

### Q2. Current Llama release on Foundry, and code/document-review credibility

- **Llama models sold by Azure (first-party, Microsoft-hosted):** `Llama-4-Maverick-17B-128E-Instruct-FP8` (input text and images up to 1M tokens, output text up to 1M tokens, tool calling No, per the sold-by-azure table) and `Llama-3.3-70B-Instruct` (input text 128,000 tokens, output text 8,192 tokens, tool calling No). Source: [Foundry Models sold by Azure, Meta models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#meta-models-sold-by-azure).
- **`Llama-4-Scout-17B-16E-Instruct` is available from partners and community** (not sold directly by Azure), text and image up to 128,000 tokens. Source: [Foundry Models from partners and community, Meta](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-from-partners#meta).
- **A tool-calling discrepancy to flag:** the "sold by Azure" table lists Llama-4-Maverick tool calling as No, while the "Featured models" catalog page lists Llama-4-Scout and Maverick tool calling as Yes. Sources: [sold by Azure, Meta](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#meta-models-sold-by-azure) versus [Featured models, Meta](https://learn.microsoft.com/azure/machine-learning/concept-models-featured?view=azureml-api-2#meta). Treat tool-calling support as version and deployment-path dependent and verify at deploy (UNKNOWN #3). For a plain review role this matters less: a reviewer reads content and returns a written critique, which does not require tool calling.
- **Region:** both `Llama-4-Maverick-17B-128E-Instruct-FP8` and `Llama-3.3-70B-Instruct` (multiple versions) are available in East US and across all listed Global Standard regions; `Llama-3.3-70B-Instruct` version 9 is additionally offered under Data Zone Provisioned Managed in the Americas and Europe. Source: [Region availability for Foundry Models sold by Azure (standard) and (provisioned)](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard).
- **Credibility for code/document review:** the current first-party Llama line is credible for document comprehension (Maverick carries a very large 1M-token context, useful for long-document review), but Microsoft's catalog does not publish code-review benchmarks, and Meta's Llama line is a general instruction-tuned family rather than a coding-specialized one. So Llama is a reasonable, widely-available general reviewer, but on published first-party evidence it is not differentiated for code review the way `Kimi-K2.7-Code` (coding-focused) or a code-specialized model is. Any code-benchmark comparison is UNKNOWN (#4) and would need an empirical A/B on real repo review tasks. The exact Azure per-token pricing is likewise not in these docs (UNKNOWN #2).

### Q3. Other niche or emerging code/document-review candidates in the Foundry catalog

The reviewer bar here is strong code reasoning and long-document comprehension, no vision requirement. First-party catalog candidates, grouped by hosting path:

**Sold by Azure (Microsoft-hosted, first-party support, fungible provisioned throughput):**

- **DeepSeek code/reasoning line:** `DeepSeek-V4-Pro` and `DeepSeek-V4-Flash` (version 2026-04-23), plus `DeepSeek-V3.2` and `DeepSeek-V3.2-Speciale`, all available in East US and across Global Standard regions. Source: [Region availability, Global Standard](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard). DeepSeek is a strong code and reasoning family; note the roster memory previously set DeepSeek aside for the IMAGE reviewer role because it is text-focused, which is exactly the right property for a text code/document reviewer, so the earlier rejection does not carry over to this role.
- **Mistral:** `Mistral-Large-3` and `mistral-medium-3-5`, East US and Global Standard. Source: as above.
- **Microsoft Phi reasoning:** `Phi-4-reasoning` and `Phi-4-mini-reasoning`, East US and Global Standard. Small, cheap, first-party; a plausible low-cost pre-filter reviewer rather than a frontier reviewer. Source: as above.

**Partners and community via Fireworks (note the data-handling caveats below):**

- **Qwen code/reasoning:** `FW-Qwen3.6-27B`, `FW-Qwen3.6-35B-A3B`. Source: [Fireworks models on Microsoft Foundry, catalog](https://learn.microsoft.com/azure/foundry/how-to/fireworks/enable-fireworks-models#available-catalog-models).
- **Z.ai GLM coding line:** `FW-GLM-4.7` (352B MoE for coding, reasoning, agentic), `FW-GLM-5`, `FW-GLM-5.1`, `FW-GLM-5.2` (1M-token context, "multi-effort coding"). Source: as above.
- **MiniMax:** `FW-MiniMax-M2.5` (coding, agentic tool use). Source: as above.
- **OpenAI open weight:** `FW-GPT-OSS-120B`. Source: as above.
- **The Kimi coding models are also on the Fireworks path** (`FW-Kimi-K2.7-Code`, `FW-Kimi-K2.6`, `FW-Kimi-K2.5`), but the same models are available on the cleaner "sold by Azure" path, so prefer the Azure-direct path for them.
- **Fireworks caveat, material for a governed repo:** Fireworks on Foundry shares data between Microsoft and Fireworks AI, is currently excluded from EU Data Boundary commitments, has not achieved FedRAMP, and PCI DSS is not applicable. Several Fireworks pay-per-token offerings are also being deprecated (PTU-only going forward for some). Sources: [Fireworks data privacy](https://learn.microsoft.com/azure/foundry/how-to/fireworks/enable-fireworks-models#custom-models-bring-your-own-model), [Fireworks catalog deprecation notes](https://learn.microsoft.com/azure/foundry/how-to/fireworks/enable-fireworks-models#available-catalog-models). For reviewing this repo's own non-regulated docs and Bicep the data-sharing risk is low, but it is a real governance difference from the sold-by-Azure path and should be weighed in any ADR.

### Q4. Deployability summary

| Candidate | Path | In East US | Gating | Pricing | Code-review fit |
|---|---|---|---|---|---|
| `Kimi-K2.7-Code` (Preview) | Sold by Azure | Yes | No registration gate noted; Preview | UNKNOWN #2 (not in docs; likely credit-covered) | Strong; coding-specialized, 262K context, tool calling Yes |
| `Kimi-K2.6` / `K2.5` (Preview) | Sold by Azure | Yes | As above | UNKNOWN #2 | General; use K2.7-Code instead for code review |
| Kimi K3 (literal) | Not in Foundry | No | n/a | n/a (UNKNOWN #1) | Third-party-reported only; not deployable here today |
| `Llama-4-Maverick-17B-128E-Instruct-FP8` | Sold by Azure | Yes | None noted | UNKNOWN #2 | General reviewer; 1M context good for long docs; not code-specialized |
| `Llama-3.3-70B-Instruct` | Sold by Azure | Yes | None noted | UNKNOWN #2 | General; smaller 128K context |
| `DeepSeek-V4-Pro` / `V3.2` | Sold by Azure | Yes | None noted | UNKNOWN #2 | Strong code/reasoning, text-focused (a plus here) |
| `Mistral-Large-3` | Sold by Azure | Yes | None noted | UNKNOWN #2 | Credible general reviewer |
| `Phi-4-reasoning` | Sold by Azure | Yes | None noted | UNKNOWN #2 | Small/cheap pre-filter reviewer |
| GLM 4.7/5.x, Qwen 3.6, MiniMax, gpt-oss-120b | Fireworks (partner) | Yes | Fireworks data-sharing; some PTU-only | UNKNOWN #2 | Strong coding options, but heavier governance caveats |

### Q5. Fit for this repo specifically

- This repo already plans a vision-capable image/content reviewer pair (`gpt-5.6-terra`, `grok-4-1-fast-reasoning`, both PLANNED and GATED). A code/document reviewer is a genuinely different role: it reads Bicep, scripts, ADRs, and design docs and returns a written critique. It does not need vision, does not need image generation, and does not replace the image reviewer.
- The strongest deployable-today fit is **`Kimi-K2.7-Code` (Preview)**: coding-specialized, 262K-token context (comfortably covers this repo's largest Bicep and design files in one pass), tool calling available, in East US, no registration gate noted, and plausibly covered by the credit subscription. Its main risk is Preview status, which the owner's posture already accepts elsewhere.
- **`DeepSeek-V4-Pro`** is the strongest sold-by-Azure alternative for a text code reviewer, and a good A/B counterpart to Kimi for a second opinion.
- **A cheap Phi-4-reasoning pre-filter** could run first and escalate only nontrivial findings to a larger reviewer, which fits this repo's cost discipline (the $100/month cap and budget-guard posture from the voice and image ADRs).
- Whether any of these actually reviews Bicep and prose better than the code assistant already in the harness is a quality question the docs cannot answer (UNKNOWN #4). It should be settled by a small empirical A/B before any deployment.

---

## What is still UNKNOWN

| # | Unknown | Why it is not in the docs | What resolves it |
|---|---|---|---|
| 1 | Whether Kimi K3 (the literal 2026-07-16 flagship) will reach the Azure AI Foundry catalog, and when, in what region, at what price. | K3 is third-party-reported and absent from the Foundry catalog; Microsoft has not published a K3 entry. | Watch the [Moonshot AI models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#moonshot-ai-models-sold-by-azure) page and the Foundry model catalog for a `Kimi-K3` entry. |
| 2 | Exact Azure per-token pricing for the Kimi, Llama, DeepSeek, Mistral, and Phi reviewer candidates. | Catalog and region pages list capability and availability, not price. | Check the Azure pricing calculator and the Foundry portal deployment screen for each model at evaluation time; confirm credit coverage in Cost Management on the target subscription. |
| 3 | Whether Llama-4-Maverick supports tool calling on the sold-by-Azure path (docs conflict). | Two first-party pages disagree (No vs Yes). | Confirm in the Foundry portal model card at deploy; low impact for a plain review role that returns written critique. |
| 4 | Whether any surveyed model actually reviews this repo's Bicep, scripts, and docs better than the existing harness assistant. | A quality question, not a compatibility one; docs cannot answer it. | A small empirical A/B: run a fixed set of real review tasks (a Bicep module, an ADR, a script) through 2 to 3 candidates and compare against the harness baseline before any deployment. |

None of these blocks the recommendation, because the recommendation does not commit to a deployment now.

---

## Recommendation

1. **Confirm the interpretation of "K3" with the owner, stated plainly: "K3" is the Kimi K-series, and specifically Kimi K3, a real Moonshot flagship launched 2026-07-16 but NOT yet in the Azure AI Foundry catalog.** The deployable member of that lineage today is `Kimi-K2.7-Code` (Preview). This is a different reviewer role from the image-review pair and does not replace it.
2. **Do not deploy anything from this spike.** Per the tasking, concluding "here are credible candidates, but confirm fit before committing" is an acceptable and expected outcome. No Azure write is warranted from a research spike.
3. **If the owner wants to pursue a code/document reviewer, the lead candidate is `Kimi-K2.7-Code` (Preview), with `DeepSeek-V4-Pro` as the sold-by-Azure A/B counterpart, and `Phi-4-reasoning` as an optional cheap pre-filter.** All three are in East US on the sold-by-Azure path, matching this repo's existing Foundry region and governance posture. Prefer the sold-by-Azure path over Fireworks-hosted options (GLM, Qwen, MiniMax) unless a specific capability justifies the Fireworks data-sharing and EU Data Boundary caveats.
4. **Track Kimi K3 as a watch item, not a plan.** Revisit when and if a `Kimi-K3` entry appears in the Foundry catalog with a region and price, at which point it could be A/B tested against K2.7-Code.
5. **Follow the same gate as every other model here: spike -> ADR -> design -> deploy gate.** If a reviewer is adopted, a follow-up ADR is needed before any deployment. That ADR should record: the model chosen, that it is a code/document reviewer role DISTINCT from (not a replacement for) the `gpt-5.6-terra` / `grok-4-1-fast-reasoning` image-review pair, the Preview-risk acceptance, and the cost handling against the $100/month cap. It should also resolve UNKNOWN #2 (pricing and credit coverage) and settle UNKNOWN #4 with a real A/B before committing.

Net: "K3" is the Kimi K-series (Kimi K3 specifically), which is real but not yet on Foundry; the deployable code-reviewer candidate today is `Kimi-K2.7-Code` (Preview) in East US, with `DeepSeek-V4-Pro` and `Phi-4-reasoning` as sold-by-Azure alternatives. This is a distinct reviewer role from the image-review pair. Record the finding, take no deployment action, and gate any adoption behind an ADR and an empirical A/B.

---

## Sources

All first-party (Microsoft Learn) unless labelled, reviewed 2026-07-22:

- Foundry Models sold by Azure (Moonshot AI: Kimi-K2.7-Code, K2.6, K2.5 Preview, all text+image 262K, tool calling Yes; Meta: Llama-4-Maverick-17B-128E-Instruct-FP8 and Llama-3.3-70B-Instruct; xAI registration gate noted for grok, none for Kimi): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure>
- Region availability for Foundry Models sold by Azure, standard and provisioned (Kimi K2.5/K2.6/K2.7-Code, Llama-3.3-70B, Llama-4-Maverick, DeepSeek-V4-Pro/Flash/V3.2, Mistral-Large-3, Phi-4-reasoning all in East US and Global Standard regions): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability>
- Foundry Models from partners and community, Meta (Llama-4-Scout via partners): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-from-partners#meta>
- Featured models of Foundry model catalog, Meta (Llama-4 Scout/Maverick tool-calling Yes; discrepancy with sold-by-Azure): <https://learn.microsoft.com/azure/machine-learning/concept-models-featured?view=azureml-api-2#meta>
- Fireworks models on Microsoft Foundry (Kimi K2.7-Code described as coding-focused; GLM 4.7/5.x, Qwen 3.6, MiniMax-M2.5, gpt-oss-120b; data-sharing, EU Data Boundary exclusion, no FedRAMP, pay-per-token deprecations): <https://learn.microsoft.com/azure/foundry/how-to/fireworks/enable-fireworks-models>
- Retired Foundry Models (Kimi-k2-thinking retired 2026-03-29, replaced by Kimi-K2.5): <https://learn.microsoft.com/azure/foundry/openai/concepts/retired-models#microsoft>
- Microsoft Foundry Models overview (catalog structure, sold-by-Azure vs partners and community, responsible-AI and acceptable-use responsibility): <https://learn.microsoft.com/azure/foundry/concepts/foundry-models-overview>
- Microsoft Q&A, Kimi-K2.5 and Azure Sponsorship credits (Q&A answer, not formal pricing; verify in Cost Management): <https://learn.microsoft.com/answers/a/12613918>
- Third-party, UNVERIFIED, recorded for the K3 watch item only (Kimi K3 launched 2026-07-16, ~2.8T MoE, 1M-token context, weights around 2026-07-27): kie.ai "What Is Kimi K3", felloai.com "Kimi K3", explainx.ai "Kimi K3 API Guide". These are not first-party and are not the basis for any recommendation.
- Local, this repo: `pmo/backlog/SPIKE-15-niche-reviewer-models.md` (tasking), `pmo/BACKLOG.md` (roster, Kimi-K2.6 listed as a considered third IMAGE reviewer), model-roster reference; sibling SPIKE-10 (latest GPT) and SPIKE-11 (newer Grok) for the distinct image-review pair.
