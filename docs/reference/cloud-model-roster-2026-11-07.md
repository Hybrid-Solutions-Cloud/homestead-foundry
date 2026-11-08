# Cloud model roster: 2026-11-07

Published model names and versions represented in the current two-region deployment, read from the live Azure model catalog and deployment list on 2026-11-07. Actual deployment aliases, resource names, capacities and access policy remain in the private overlay. This is a dated snapshot, not a list of all Azure availability or a quality certification. It supersedes the [2026-09-25 roster](./cloud-model-roster-2026-09-25).

The deployment has 44 model deployments across 43 model/version rows: two aliases of DeepSeek V4.1 Flash share one row. The registry also has a Speech capability entry for MAI-Voice-2, which is not a model deployment.

See the [reliability and roster review](../research/model-reliability-and-roster-review-2026-11-07) for what changed since the last snapshot, what is retiring, and what to add. See also [router usage](../guide/model-router) and the [gateway](../guide/model-gateway). Non-chat models use their modality-specific APIs. Claude models use the native Anthropic Messages API, so they are not reachable through a Chat Completions-only gateway.

::: warning Retirements inside the next 60 days
Dates below are the `deprecation` values returned by the Azure model catalog API, which is the authoritative source for a deployed version. Microsoft's published retirement schedule disagrees for a few models (see the [review](../research/model-reliability-and-roster-review-2026-11-07#catalog-and-docs-disagree)). Treat the earlier date as the planning date.

- **Sora 2** (2026-11-02): already past. The deployment reports `Disabled`.
- **MAI-Image-2.5, 2.5-Flash, 2.5-Pro** (2026-11-22). MAI-Image-2.6 and 2.6-Flash are already deployed.
- **Mistral Medium 2505** (2026-12-09). Mistral Medium 3.5 is already deployed.
- **DeepSeek V4.1 Flash 2026-09-10** (2026-12-15, Preview). DeepSeek V4.1 Flash 1017 is the catalog successor.
:::

| Published model | Version | Region | SKU | Chat/router | Lifecycle | Catalog retirement |
|---|---|---|---|---|---|---|
| claude-fable-5-1 | 1 | eastus | GlobalStandard | False (native Messages API) | Preview | 2027-12-05 |
| Codestral-2501 | 2 | eastus | GlobalStandard | True | GenerallyAvailable | none announced |
| DeepSeek-V4-Flash | 2026-04-23 | eastus | GlobalStandard | True | GenerallyAvailable | 2028-02-20 |
| DeepSeek-V4-Pro | 2026-04-23 | eastus | GlobalStandard | True | GenerallyAvailable | 2028-02-20 |
| DeepSeek-V4.1-Flash | 2026-09-10 | eastus | GlobalStandard | True | Preview | 2026-12-15 |
| FLUX-1.1-pro | 1 | eastus2 | GlobalStandard | False | GenerallyAvailable | none announced |
| FLUX.1-Kontext-pro | 1 | eastus2 | GlobalStandard | False | GenerallyAvailable | none announced |
| FLUX.2-flex | 1 | eastus2 | GlobalStandard | False | GenerallyAvailable | none announced |
| FLUX.2-pro | 1 | eastus2 | GlobalStandard | False | GenerallyAvailable | none announced |
| gpt-5.6-luna | 2026-07-09 | eastus | GlobalStandard | True | GenerallyAvailable | 2028-01-11 |
| gpt-5.6-sol | 2026-07-09 | eastus | GlobalStandard | True | GenerallyAvailable | 2028-01-11 |
| gpt-5.6-terra | 2026-07-09 | eastus | GlobalStandard | True | GenerallyAvailable | 2028-01-11 |
| gpt-6-astra | 2026-09-03 | eastus | GlobalStandard | True | GenerallyAvailable | 2028-01-11 |
| gpt-6-luna | 2026-09-22 | eastus | GlobalStandard | True | GenerallyAvailable | 2028-03-11 |
| gpt-6-sol | 2026-09-22 | eastus | GlobalStandard | True | GenerallyAvailable | 2028-03-11 |
| gpt-6.1-sol | 2026-09-29 | eastus | GlobalStandard | True | GenerallyAvailable | 2028-03-11 |
| gpt-live-transcribe | 2026-07-28 | eastus2 | GlobalStandard | False | GenerallyAvailable | 2028-02-01 |
| gpt-transcribe | 2026-07-28 | eastus2 | GlobalStandard | False | GenerallyAvailable | 2028-02-01 |
| grok-4-1-fast-non-reasoning | 1 | eastus | GlobalStandard | True | GenerallyAvailable | none announced |
| grok-4-1-fast-reasoning | 1 | eastus | GlobalStandard | True | GenerallyAvailable | none announced |
| grok-4-20-non-reasoning | 1 | eastus | GlobalStandard | True | Preview | 2027-04-06 |
| grok-4-20-reasoning | 1 | eastus | GlobalStandard | True | Preview | 2027-04-06 |
| grok-4.3 | 1 | eastus | GlobalStandard | True | Preview | 2027-05-12 |
| grok-4.6 | 1 | eastus | GlobalStandard | True | Preview | 2027-08-24 |
| grok-4.7 | 1 | eastus | GlobalStandard | True | GenerallyAvailable | 2027-10-05 |
| Kimi-K2.7-Code | 2026-06-12 | eastus | GlobalStandard | True | Preview | 2027-04-16 |
| Llama-4-Maverick-17B-128E-Instruct-FP8 | 1 | eastus | GlobalStandard | True | GenerallyAvailable | none announced |
| MAI-Image-2.5 | 2026-06-02 | eastus | GlobalStandard | False | Preview | 2026-11-22 |
| MAI-Image-2.5-Flash | 2026-06-02 | eastus | GlobalStandard | False | Preview | 2026-11-22 |
| MAI-Image-2.5-Pro | 2026-06-19 | eastus | GlobalStandard | False | Preview | 2026-11-22 |
| MAI-Image-2.6 | 2026-07-31 | eastus | GlobalStandard | False | GenerallyAvailable | 2027-05-01 |
| MAI-Image-2.6-Flash | 2026-07-31 | eastus | GlobalStandard | False | GenerallyAvailable | 2027-05-01 |
| mistral-document-ai-2512 | 1 | eastus2 | GlobalStandard | False | GenerallyAvailable | none announced |
| Mistral-Large-3 | 1 | eastus | GlobalStandard | True | GenerallyAvailable | none announced |
| mistral-medium-2505 | 1 | eastus | GlobalStandard | True | GenerallyAvailable | 2026-12-09 |
| mistral-medium-3-5 | 1 | eastus | GlobalStandard | True | Preview | 2027-10-01 |
| mistral-ocr-4-0 | 1 | eastus2 | GlobalStandard | False | Preview | 2027-10-01 |
| model-router | 2025-11-18 | eastus | GlobalStandard | True | GenerallyAvailable | 2027-05-20 |
| Phi-4-reasoning | 1 | eastus | GlobalStandard | True | GenerallyAvailable | none announced |
| sora-2 | 2025-12-08 | eastus2 | GlobalStandard | False | Deprecated (deployment disabled) | 2026-11-02 |
| text-embedding-3-large | 1 | eastus2 | GlobalStandard | False | GenerallyAvailable | 2028-02-09 |
| text-embedding-3-small | 1 | eastus2 | GlobalStandard | False | GenerallyAvailable | 2028-02-09 |
| whisper | 001 | eastus2 | Standard | False | GenerallyAvailable | 2027-02-26 |
