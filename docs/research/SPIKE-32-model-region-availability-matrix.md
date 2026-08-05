# SPIKE-32: Every model against every region, and what actually differs between them

Role: foundry-researcher (Opus). Status: research spike complete. Read-only: no Azure resources created, updated, or deleted. Every `az` call in this spike is a catalog read (`az cognitiveservices model list`, `az account list-locations`), which needs no more than Reader and changes nothing. No endpoint was called, no model invoked, no spend incurred, no software installed.
Date: 2026-08-05
Scope: a complete availability and configuration comparison of every model this repository's three deployment targets can serve, across every region each is offered in. The two on-premises targets are treated as regions, exactly as an operator experiences them: a place a model either runs or does not. The deliverable is a generated dataset and an interactive matrix, not a hand-maintained table. This spike authorizes no deployment and no spend.

Depends on: `SPIKE-14` (the earlier single-tenant region survey this supersedes in scope), `SPIKE-22` (the two on-premises catalogs, transcribed here rather than re-derived), `SPIKE-31` (cross-target feature parity, which answers "what can the platform do" where this answers "where can this model run"), and `ADR-0011` (the three-target model). It extends those records; it does not restate them.

**Headline: region changes what you can buy, not what the model is.** Across 3,103 model-and-region pairs, not one model's context window or maximum output token count differed between regions. What differs, and differs constantly, is the set of **deployment types** on offer: 56 of 134 cloud models present a different purchasing shape depending on where you deploy them, and `gpt-4.1-mini` alone has **seventeen distinct configurations** across the 34 regions that carry it. The sharpest practical consequence is that **64 model-and-region pairs offer no pay-as-you-go capacity at all** - the model is listed, the portal will show it, and the only way to deploy it there is to buy a reservation. North Europe is the worst affected major region, with 14 models in that state.

The second headline is about time rather than place: **82 of 134 cloud models carry a retirement date inside the next twelve months.**

---

## Question

Nine questions, answered for every model on all three targets:

1. Which regions is each model actually available in, measured rather than read?
2. Where a model is available in several regions, does anything about it differ between them?
3. Specifically: do token limits (context window, maximum output) vary by region?
4. Do the available deployment types (the purchasing and capacity model) vary by region?
5. Do capacity ceilings vary by region for the same deployment type?
6. Which models exist on more than one of the three deployment targets?
7. What is available on Foundry Local and Azure Local Foundry, expressed as regions so the comparison is like-for-like?
8. What is the lifecycle and retirement exposure across the estate?
9. Can all of this be regenerated rather than maintained by hand?

---

## Method, and its one important limit

Availability was measured, not read. For each of the 63 physical Azure regions:

```bash
az cognitiveservices model list --location <region> -o json
```

Forty regions returned a catalog. Twenty-three returned nothing, meaning Foundry model deployment is not offered there at all. Each returned entry is a model *version*, carrying its capabilities, its deployment SKUs with capacity ceilings and rate limits, its lifecycle status, and its retirement date. The two on-premises rosters were taken from [SPIKE-22](./SPIKE-22-foundry-local-model-catalog) and joined in as two further regions.

::: warning This is one subscription's answer, and that is a real limit
Model availability is partly gated by subscription, by registration, and in some
cases by an approval the tenant holds or does not hold. Everything here was read
from a single subscription. **Another tenant querying the same region can get a
different list**, and a model absent here may be present there behind a
registration this subscription does not have. The command is the authority; this
page is a dated snapshot of what the command returned.
:::

A second limit, stated because it constrains the answer to question 3: **only 9 of 134 cloud models publish a `maxContextToken` value at all.** Seven percent. The rest return no token figures in the catalog API, so "context does not vary by region" is a finding about the models that publish it, not proof about the 125 that do not. Those read `not published` in the matrix rather than `0`, because an unpublished limit and a limit of nothing are not the same claim.

---

## The matrix

The full interactive comparison is a reference page, not a table in a spike:

**[Model availability matrix](../reference/model-matrix)** - 233 models across 42 regions, filterable by publisher, modality, target, and deployment type, sortable on every column, searchable, with per-region configuration detail on every row.

---

## Findings

### Q1. Availability is far less even than the catalog implies

Forty regions carry a Foundry catalog. The spread between them is enormous:

| Regions | Distinct models |
|---|---|
| `swedencentral` | **132** |
| `eastus2` | 126 |
| `centralus` | 111 |
| `southindia` | 110 |
| `francecentral` | 105 |
| ... 22 regions clustered at 91 to 103 | |
| `westcentralus` | 63 |
| `japanwest`, `ukwest`, `centraluseuap`, `westus2` | 51 |
| `southeastasia` | 39 |
| **`northeurope`** | **28** |
| `centralindia`, `eastasia`, `qatarcentral` | 9 |
| `jioindiacentral`, `jioindiawest` | 8 |

**North Europe is the finding here.** It is a first-tier Azure region by every other measure and carries **28 models against Sweden Central's 132**. An architecture that picks North Europe as its European home on general Azure grounds, without checking the Foundry catalog specifically, will find roughly a fifth of the estate available.

At the other end, six regions carry single-digit catalogs. They are not viable Foundry homes; they are regions where a handful of models happen to be reachable.

Scarcity by model is the mirror image. **`gpt-4o-mini-tts` is offered in exactly one region** (`eastus2`). The entire Anthropic family on this subscription - `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-fable-5` - is offered in **two** (`eastus2`, `swedencentral`), as are `sora-2` and `o3-deep-research`. A design that assumes a model follows the subscription into any region is wrong for a meaningful slice of the catalog.

### Q2 and Q3. Region does not change the model. It changes what you can buy

**59 of 134 cloud models differ by region in at least one respect.** Sorted by what differs:

| What differs between regions | Models affected |
|---|---|
| **Deployment types available** | **56** |
| Capacity ceiling for the same deployment type | 7 |
| Which versions are offered | 6 |
| Lifecycle status | 3 |
| **Context window** | **0** |
| **Maximum output tokens** | **0** |

The two zeroes are the answer to question 3, subject to the 7-percent caveat above: **where the catalog publishes token limits, they are a property of the model and never of the region.** A model with a 128,000-token context has it everywhere it exists.

This is worth stating plainly because the intuition runs the other way. Region feels like it should be a capability boundary. It is not. It is a **procurement** boundary.

### Q4. Deployment types are where the real variance lives

Ten deployment SKUs appear across the catalog:

| Deployment type | Models offering it | What it is |
|---|---|---|
| `GlobalStandard` | 131 | Pay-as-you-go, routed globally. The default. |
| `DataZoneStandard` | 52 | Pay-as-you-go, processing pinned to a data zone |
| `GlobalProvisionedManaged` | 27 | Reserved throughput, global |
| `DataZoneProvisionedManaged` | 21 | Reserved throughput, data zone |
| `ProvisionedManaged` | 18 | Reserved throughput, single region |
| **`Standard`** | **14** | **Pay-as-you-go, processing stays in the region** |
| `GlobalBatch` / `DataZoneBatch` | 12 each | Asynchronous bulk, ~50% cost |
| `DeveloperTier` | 4 | Small, cheap, no availability guarantee |
| **`Arc`** | **1** | **Arc-connected deployment** |

Two rows deserve attention.

**`Standard` is scarce, and it is the one with the data-residency property.** Only 14 models offer it anywhere, and for `gpt-4.1` it exists in just 8 of the 34 regions that carry the model. If a requirement is "inference must be processed in this region," `GlobalStandard` does not satisfy it, and the set of models that can satisfy it is far smaller than the catalog suggests. This is a compliance question wearing a purchasing question's clothes.

**Exactly one model offers an `Arc` SKU: `Microsoft/Phi-4`, in 33 regions.** This is the only place the hosted cloud catalog and the Arc-connected world touch through the deployment model itself, and it is a single model. Anyone expecting the cloud catalog to project broadly onto Arc-connected infrastructure through this SKU should adjust: it is one model, not a pathway.

`gpt-4.1-mini` illustrates the variance best, with **17 distinct configurations across 34 regions** - the most in the catalog, ahead of `gpt-4.1` at 15 and `gpt-4o-mini` and `o4-mini` at 14. Six of those 34 regions offer it **only** as `GlobalProvisionedManaged`.

### Q5. The provisioned-only trap

**64 model-and-region pairs offer no pay-as-you-go deployment type at all.** The model appears in the catalog and can be deployed, but only against reserved capacity, which is a different commercial commitment entirely.

| Region | Models with no pay-as-you-go option |
|---|---|
| **`northeurope`** | **14** |
| `centralindia`, `eastasia`, `qatarcentral` | 8 each |
| `jioindiacentral`, `jioindiawest` | 7 each |
| `canadacentral`, `switzerlandwest` | 5 each |
| `southeastasia` | 2 |

North Europe again, and this compounds its narrow catalog: of the 28 models it carries, half of the notable ones cannot be deployed there without a reservation.

::: danger A catalog maximum is not a quota, and the gap is a thousandfold
Every capacity figure in this section comes from `model.skus[].capacity.maximum`,
which is **the largest value the deployment type will accept**. It is not what a
given subscription may allocate. Those are different numbers from different
commands, and confusing them is the most likely way to misuse this spike.

Measured in East US on 2026-08-05: `DeepSeek-V4-Pro` publishes a catalog maximum
of **1,000,000** on `GlobalStandard`. The subscription's quota for the same model,
same SKU, same region was **1,000**, and **1,000 was already consumed**. The
deployment was throttled at 100% of its real ceiling while the catalog advertised
a figure a thousand times larger.

The catalog hands you the join key: each SKU carries a **`usageName`**, for
example `AIServices.GlobalStandard.DeepSeek-V4-Pro`, and that is the bucket the
quota command reports against.

```bash
az cognitiveservices usage list -l eastus \
  --query "[?contains(name.value,'DeepSeek-V4-Pro')].{quota:name.value, used:currentValue, limit:limit}" \
  -o table
```

**Quota is granted per deployment type, not per model.** On that same
subscription `DeepSeek-V4-Pro` was exhausted on `GlobalStandard` at 1,000 of
1,000 while holding **0 of 1,000 on `DataZoneStandard`** - unused headroom on a
second SKU, reachable without asking Microsoft for anything. `DeepSeek-V4-Flash`
showed the same shape at 250 of 250 against 0 of 250. **Check every SKU before
concluding a model is out of capacity.**
:::

Capacity ceilings for the same deployment type also move between regions, on 7 models. `gpt-4.1`'s `Standard` ceiling is **1,000,000 units in most regions and 10,000,000 in `northcentralus` and `swedencentral`**. `Ministral-3B`'s `GlobalStandard` ceiling is **1,000 units in 27 regions and 1 unit in six** (`centralus`, `centraluseuap`, `japanwest`, `ukwest`, `westcentralus`, `westus2`) - a thousandfold difference in what the same model in the same SKU will let you allocate.

::: tip A measurement trap worth recording
The API can return **several entries under one SKU name in the same region**, with
different ceilings. `Ministral-3B` returns two `GlobalStandard` entries in East US,
capped at 1 and at 1,000. A first pass that collapses these to the highest value
produces a clean-looking table that reports the same number for a region carrying
both entries and a region carrying only the low one - **silently erasing the very
difference the exercise exists to find.** The matrix shows every ceiling returned.
This repository has now hit a check that quietly measured the wrong thing enough
times to treat it as the default risk rather than a surprise.
:::

### Q6. Eleven models exist on more than one target

Cross-target presence is narrow but real:

| Model | Cloud regions | Also on |
|---|---|---|
| `Phi-4` | 33 | **Foundry Local and Azure Local Foundry** |
| `Phi-4-mini-instruct` | 33 | **Foundry Local and Azure Local Foundry** |
| `Phi-4-mini-reasoning` | 33 | **Foundry Local and Azure Local Foundry** |
| `gpt-oss-20b` | 27 | **Foundry Local and Azure Local Foundry** |
| `Phi-4-reasoning` | 33 | Azure Local Foundry |
| `gpt-oss-120b` | 33 | Azure Local Foundry |
| `DeepSeek-V3-0324`, `-V3.1`, `-V3.2`, `-V3.2-Speciale` | 33 each | Azure Local Foundry |
| `qwen3-32b` | 27 | Azure Local Foundry |

**Four models run on all three targets**: `Phi-4`, `Phi-4-mini-instruct`, `Phi-4-mini-reasoning`, and `gpt-oss-20b`. For a workload that must be portable across cloud, cluster, and device without changing model, that list of four is the entire option set. It is a strong argument for the Phi family in any design where portability across the three targets is a stated requirement.

Everything else is target-bound: 99 models exist only on-premises, and 123 only in the cloud.

### Q7. The on-premises targets as regions

Treating them as regions makes the asymmetry legible:

| | Foundry Local | Azure Local Foundry |
|---|---|---|
| Catalog aliases | **35** | **135** |
| Distinct models (matrix rows) | **35** | **110** |
| Runtimes | ONNX-GenAI (CPU or GPU) | ONNX-GenAI **and** vLLM (GPU only) |
| Image generation, TTS, embeddings, video | No | No |
| Vision input | **No** | **Yes**, and it is exclusive to this target |
| NPU and alternate accelerators | **Yes**, exclusive to this target | No |

**The two counts are different units and both are needed.** The catalog publishes 135 aliases for Azure Local Foundry, but several name the same model twice under an ONNX and a vLLM build (`phi-4-mini` and `phi-4-mini-instruct`, for instance). The matrix merges those onto one row, giving 110 distinct models. Quote the alias count when sizing a catalog sync and the model count when counting what you can actually serve.

The 35 ONNX models are a shared core: everything on Foundry Local also runs on Azure Local Foundry. The 100 additional vLLM entries are cluster-only, because vLLM is a GPU-only container runtime with no device-SDK equivalent. Conversely the Qualcomm, AMD, Intel, WebGPU, and TensorRT-RTX variants are device-only, because Azure Local Foundry's catalog sync paginates CPU and GPU only.

Neither on-premises target offers image generation, text to speech, embeddings, or video. **Nothing in this project's cloud catalog runs on either of them** - a portability claim that sounds conservative until you notice that four models do bridge all three targets, and none of them are the ones this project deployed.

### Q8. The estate retires faster than it looks

Every cloud model carries a `deprecation.inference` date, but 31 of them carry `2099-12-31`, which is a placeholder meaning "not scheduled" rather than a date. Of the 103 with a real date:

| Retirement year | Models |
|---|---|
| 2026 | 44 |
| 2027 | 50 |
| 2028 | 9 |

**82 of 134 cloud models retire within twelve months of this snapshot.** Only **6** name a replacement model in `replacementConfig`, so for the remaining 76 the migration target is a decision somebody has to make rather than a value to read.

Lifecycle status across the 134: 91 `GenerallyAvailable`, 22 `Preview`, 10 `Deprecating`, 14 `Deprecated`, 3 `Legacy`. **Twenty-four models are already `Deprecated` or `Legacy` and still deployable**, which is the catalog's way of saying "you may, but you should not."

### Q9. Yes, and it must be

This spike's dataset is generated by three scripts in [`scripts/model-matrix/`](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/tree/main/scripts/model-matrix):

| Script | What it does |
|---|---|
| `pull-regions.ps1` | Reads the catalog for all 63 physical regions, 8 at a time, one JSON per region |
| `make-onprem.mjs` | Emits the two on-premises rosters from SPIKE-22 |
| `build-matrix.mjs` | Joins them, collapses each model's per-region configuration into distinct profiles, and writes the dataset the page consumes |

Regenerating is three commands and needs only Reader:

```powershell
./scripts/model-matrix/pull-regions.ps1 -Out ./.cache/models
node ./scripts/model-matrix/make-onprem.mjs ./.cache/onprem.json
node ./scripts/model-matrix/build-matrix.mjs ./.cache/models ./.cache/onprem.json ./docs/public/data/model-matrix.json 2026-08-05
```

This directly serves [issue #15](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/issues/15), which asked for the availability catalogs to stop being a manual chore. It does not close it: nothing schedules this yet, and the on-premises half is still a transcription of a snapshot rather than a live read.

---

## What this changes

1. **Region selection for Foundry is a distinct decision from region selection for Azure.** The general-purpose reasoning that makes North Europe a sensible European home does not survive contact with a 28-model catalog. `swedencentral` and `eastus2` are the only two regions carrying the full estate on this subscription.
2. **"Available in that region" is not the same as "deployable there on your commercial terms."** Check the deployment types, not the presence of the model. Sixty-four pairs fail this test.
3. **Data-residency requirements shrink the model list sharply**, because `Standard` is offered by 14 models and, per model, in a minority of regions.
4. **Portability across all three targets means the Phi family or `gpt-oss-20b`.** There are four models, and that is the whole list.
5. **Retirement is the dominant lifecycle risk, not availability.** 82 models retire within a year and 76 of those name no successor.

## What is still unknown

| Unknown | What would resolve it |
|---|---|
| Whether another tenant sees a different catalog in the same region | Run `pull-regions.ps1` under a second subscription and diff |
| Real context and output limits for the 125 models that publish none | Per-model vendor documentation, or an empirical probe against a deployment |
| Whether the on-premises rosters have drifted since 2026-07-28 | `foundry model list` on a device; the catalog ConfigMap on a cluster |
| Whether `rateLimits` on a SKU is the requests-per-minute ceiling operators actually hit | Deploy at a known capacity and measure the 429 boundary |
| Why `Arc` appears on `Phi-4` alone | Microsoft has published nothing on this; a support question |
| What the 23 regions with no catalog will carry, and when | Not published; re-run over time |

## Sources

- `az cognitiveservices model list`, executed against 63 regions on 2026-08-05. Primary evidence for every availability, SKU, capacity, lifecycle, and retirement claim.
- [`az cognitiveservices model list` reference](https://learn.microsoft.com/cli/azure/cognitiveservices/model)
- [Model availability by region](https://learn.microsoft.com/azure/ai-foundry/openai/concepts/models)
- [Deployment types in Microsoft Foundry](https://learn.microsoft.com/azure/ai-foundry/openai/how-to/deployment-types)
- [Model retirements and deprecations](https://learn.microsoft.com/azure/ai-foundry/openai/concepts/model-retirements)
- [Quotas and limits](https://learn.microsoft.com/azure/foundry/openai/quotas-limits)
- [SPIKE-22](./SPIKE-22-foundry-local-model-catalog), for both on-premises rosters.
- [SPIKE-31](./SPIKE-31-cross-track-feature-parity), for the platform-level differences between targets.
