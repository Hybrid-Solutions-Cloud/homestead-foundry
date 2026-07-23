# Design: resource topology and CAF naming

- Status: draft for review
- Date: 2026-07-11 (main body rewritten brand-neutral 2026-07-21, per D-03 and D-16; see the closing worked-example section for the real deployed instance)
- Author: foundry-architect
- Grounded in: ADR-0001 (target tenant and region), ADR-0004 (topology and naming intent), ADR-0006 (budget and tag scheme); supporting reference to ADR-0005 for the reused Key Vault and secret names
- Companion docs: `architecture-overview.md`, `reliability-and-operations.md`, `performance-efficiency.md`

This document finalizes the exact Cloud Adoption Framework names, the resource topology, and the tag scheme that ADR-0004 deferred to the design phase. These strings are canonical for a given deployment: once fixed, every later phase (diagrams, implementation guide, deployment, as-built) uses them verbatim. WAF pillar for naming and tagging discipline throughout: Operational Excellence (consistent identification across portal, CLI, billing, and automation) and Cost Optimization (tag-driven cost attribution).

This is the repo's CAF naming standard, so the pattern below is stated generically first so any adopter can apply it to their own initiative. A single fully worked placeholder example proves the pattern resolves cleanly. The real, already-deployed instance this repo runs in production is restated in full in the closing "Worked example" section.

---

## 1. Naming convention

Per CAF guidance (Define your naming convention), names are composed as:

```
<resource-type abbreviation>-<initiative token>-<environment>-<region token>-<instance>
```

with hyphens as delimiters. Not every resource carries every component: child resources scoped inside a parent omit the components the parent already fixes, and pre-existing reused resources keep their original names because Azure resource names are immutable after creation.

How to pick each segment for your own deployment:

| Component | Rule | Notes |
| --- | --- | --- |
| Resource type abbreviation | Look up the resource's provider type in the Microsoft Learn CAF abbreviation table first. | If no entry exists, use a short, descriptive, undelimited word and document the choice (see section 2.1 for a worked example of both cases). |
| Initiative token | A short, undelimited form of the full initiative name. | Keep it short enough that composed names stay well under Azure's per-resource-type length limits. Carry the full initiative name in the `initiative` tag (section 4) so nothing is lost to the abbreviation. |
| Environment | A short environment discriminator (`prod`, `dev`, `test`, ...). | Choose based on what the deployment actually serves, not a default; if it produces production-serving output, it is `prod` even during an early rollout. |
| Region | The CAF-documented short code for the Azure region the resource lives in. | Which region is legitimate is a real ADR question, not a naming one: pin it to wherever the specific models or services in scope are actually available. This repo's own deployment illustrates that: ADR-0001 pins region to East US (`eastus`) because it is the only region offering the specific models this deployment uses at Global Standard, plus a preview flag one of them depends on; `eastus2` is recorded there as a hard blocker, not a preference, for that reason. A different initiative deploying different models would re-derive its own region constraint the same way, not copy this one. |
| Instance | Two digits, first instance `01`, incremented only if a second parallel instance is ever deployed. | |

Before any create, names are validated against the governance MCP `validate` check, per the ADR-0004 decision.

## 2. Worked placeholder example

The table below instantiates the pattern from section 1 for a fictional initiative, `contoso-ai` (short token `contosoai`), to prove the pattern resolves cleanly end to end. None of the strings in this section are real; the repo's actual deployed names are in the closing worked-example section.

| Resource | Provider type (kind, SKU) | Abbrev | Initiative | Env | Region | Inst | Name |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Resource group | `Microsoft.Resources/resourceGroups` | `rg` | `contosoai` | `prod` | `eus` | `01` | `rg-contosoai-prod-eus-01` |
| Foundry account | `Microsoft.CognitiveServices/accounts` (kind `AIServices`, SKU `S0`) | `ais` (see 2.1) | `contosoai` | `prod` | `eus` | `01` | `ais-contosoai-prod-eus-01` |
| Model deployment | `Microsoft.CognitiveServices/accounts/deployments` (SKU `GlobalStandard`, capacity 1) | none defined by CAF | model slug, e.g. `sample-model-01` | inherited | inherited | n/a | `sample-model-01` |
| Foundry project | `Microsoft.CognitiveServices/accounts/projects` | `proj` | `contosoai` | inherited | inherited | `01` | `proj-contosoai-media-01` |
| Budget (workload cap) | `Microsoft.Consumption/budgets` (resource-group scope) | none defined by CAF; full word `budget` | `contosoai` | `prod` | `eus` | `01` | `budget-contosoai-prod-eus-01` |
| Key Vault | `Microsoft.KeyVault/vaults` | `kv` | pre-existing | pre-existing | pre-existing | pre-existing | `kv-example-platform-vault-01` (REUSE, do not create) |
| Action group (budget email) | `Microsoft.Insights/actionGroups` | `ag` | `contosoai` | `prod` | `eus` | `01` | `ag-contosoai-prod-eus-01` |
| Budget (credit burn-down) | `Microsoft.Consumption/budgets` (subscription scope, amount = monthly credit) | none defined by CAF | `contosoai` | n/a | n/a | `01` | `budget-contosoai-credit-sub-01` |

Notes on the child resources, illustrated generically:

- A model deployment name should be deliberately version-free when the underlying model is in active preview or receives version churn: the deployment name is the string API callers pass as the `model` parameter, so version updates are absorbed by redeploying under the same name with no caller change (WAF Operational Excellence). This repo's own deployment does exactly this; see ADR-0002 and the closing worked-example section for the real, version-free deployment name it uses.
- A Foundry project (`proj-<initiative>-<purpose>-01`) carries a purpose token instead of env and region because it is scoped inside the account, which already fixes both. Whether to create one at all is a design-phase decision, not fixed by the pattern; this repo's own deployment creates one, and its purpose is recorded in the closing worked-example section.

### 2.1 CAF abbreviation verification (checked against Microsoft Learn, 2026-07-11)

| Abbrev used | Resource | Current CAF page mapping | Verdict |
| --- | --- | --- | --- |
| `rg` | Resource group | `rg` for `Microsoft.Resources/resourceGroups` | Exact match |
| `kv` | Key Vault | `kv` for `Microsoft.KeyVault/vaults` | Exact match |
| `proj` | Foundry account project | `proj` for `Microsoft.CognitiveServices/accounts/projects` | Exact match |
| `ag` | Action group | `ag` for `Microsoft.Insights/actionGroups` | Exact match |
| `ais` | Foundry account, kind `AIServices` (placeholder example only, see below) | The current abbreviations page maps kind `AIServices` to `aif` ("Foundry account") and maps `ais` to the classic multi-service account of kind `CognitiveServices` ("Foundry Tools, multi-service account") | Illustrative deviation only; NOT adopted in this repo's real deployment, see below |
| `budget`, model deployment names | Consumption budget, model deployment | Not present in the CAF abbreviation table | No CAF abbreviation exists; descriptive names used, which CAF permits |

How to record a deviation, illustrated with `ais`: the placeholder example above fixes `ais-contosoai-prod-eus-01` to show what documenting a deviation from `aif` would look like, despite the Learn page currently mapping kind `AIServices` to `aif`. The CAF abbreviation list is explicitly a set of recommendations an organization tailors; the requirement is a documented, consistently applied convention. Any adopter choosing to deviate should record the delta the same way this section does, note whether the deviation collides with anything else in their estate, and register the chosen abbreviation as fixed for that initiative. **This repo's own real deployment does NOT make this deviation**: an `ais` deviation was considered during design/review (see `ai/REVIEW.md`'s pre-deployment HOLD item), but the owner directed following the current Learn `aif` mapping instead before the resource was created, so the real account is `aif-studioai-prod-eus-01` with no deviation - see the closing worked-example section. The design docs and diagrams had drifted from that directive (still showing `ais-`) until this correction.

## 3. Resource topology

### 3.1 Scope chain

```
<tenant display name> (by name only)
  <subscription display name> (by name only; spending-limit posture as decided)
    rg-<initiative>-<env>-<region>-<instance>       (region, tagged, budget-scoped)
      ais-<initiative>-<env>-<region>-<instance>    (AIServices, S0, custom subdomain)
        <model deployment name>                     (Global Standard, capacity as decided)
        proj-<initiative>-<purpose>-<instance>       (Foundry project, if created)
      budget-<initiative>-<env>-<region>-<instance> (Cost Management budget on the RG scope)
    <adjacent pre-existing resource groups>          (untouched; see section 3.6)
    kv-<platform>-vault-<instance>                   (pre-existing platform Key Vault; REUSED, not created)
```

Subscription and tenant are recorded by display name only; no subscription IDs or tenant GUIDs appear in any committed file (hard rule; ADR-0005 secret posture).

### 3.2 The Foundry account

| Property | Value | Ground |
| --- | --- | --- |
| Kind | `AIServices` | Required whenever a single account must host both a Foundry model deployment and another cognitive service (this deployment: image generation plus Speech) (ADR-0004) |
| SKU | Chosen per the lowest tier that supports every service in scope at the throughput needed | Verify tier eligibility per service before assuming a lower tier works (ADR-0004) |
| Region | Pinned by the ADR governing target tenant and region for this initiative | The one region satisfying every model/service constraint in scope (ADR-0001, ADR-0004) |
| Custom subdomain | Enabled, matching the account name | AIServices default; prerequisite for a later Entra-based auth move (ADR-0004, ADR-0005) |
| Public network access | Enabled or disabled per whether the calling pipeline runs inside or outside the Azure network boundary | Decided per deployment; a pipeline running outside Azure needs public endpoints unless a different access path is designed (ADR-0005 record) |
| Data plane endpoints | `https://<account-name>.services.ai.azure.com/...` for the Foundry-hosted model; the applicable regional endpoint for any classic cognitive service on the same account | ADR-0004; regional endpoint choice per ADR-0005 key decision |
| Residency note | Global Standard deployments may process transiently outside the pinned region even though at-rest data and real-time service calls stay in-region; state this explicitly per deployment | ADR-0004 |

WAF Security: the account is created with the custom subdomain so the keyless door stays open. WAF Reliability: keep any pre-existing, already-proven service account outside this initiative's resource group, isolating a proven track from a preview stack.

### 3.3 The model deployment

Deployment shape per ADR-0004, with the placeholder deployment name inserted:

```
az cognitiveservices account deployment create \
  --name ais-contosoai-prod-eus-01 \
  --resource-group rg-contosoai-prod-eus-01 \
  --deployment-name sample-model-01 \
  --model-name "<real model name>" \
  --model-format Microsoft \
  --model-version <current, re-queried at deploy time> \
  --sku-name GlobalStandard \
  --sku-capacity 1
```

The version string should be re-queried from `az cognitiveservices model list --location <region>` at deploy time and never hardcoded, for any model in active preview (ADR-0002 pattern); re-verify on whatever cadence the model's own preview lifecycle warrants. Not every model in scope needs a deployment row: a model selected per call by name (for example, a voice selected by SSML voice name) has no deployment resource at all (ADR-0004 pattern).

### 3.4 The reused Key Vault

REUSE, do not create, do not rename, whenever a platform Key Vault already exists in the tenant: Azure names are immutable, and CAF brownfield practice is to keep existing names and bring new resources into the convention around them. Secret names for this initiative's own material, values never in git (ADR-0005 pattern):

| Secret name pattern | Holds | Created? |
| --- | --- | --- |
| `<initiative>-speech-key` | Speech (or equivalent) key for the new account, if that surface uses key auth | As decided per surface |
| `<initiative>-speech-region` | The pinned region (not a secret; co-located for one-stop retrieval) | As decided per surface |
| `<initiative>-image-endpoint` | The account's data-plane endpoint (not a secret) | As decided per surface |
| `<initiative>-image-key` | Image-surface key | Only if that surface uses key auth rather than a keyless (Entra) path; if the surface is keyless, this secret is simply never created (ADR-0005 pattern) |

### 3.5 The budget

| Property | Value | Ground |
| --- | --- | --- |
| Scope | The initiative's resource group | RG scope aggregates everything the initiative deploys and isolates it from the rest of the estate (ADR-0006 pattern) |
| Amount | An owner-locked monthly cap | ADR-0006 pattern |
| Alerts | Actual at 50, 75, 90, 100 percent; forecasted at 100 percent | ADR-0006 pattern |
| Action | One action group emailing the owner | ADR-0006 pattern |
| Nature | Notify-only backstop, evaluated roughly daily; a synchronous cap belongs in the pipeline itself, not in the budget alert | ADR-0006 pattern |

Create before any spend (environment-readiness deployment prerequisite). A companion subscription-scoped credit budget, plus scheduled Cost Analysis emails, covers credit burn-down wherever automated credit alerts are not available at the subscription's commercial tier (ADR-0006 pattern). WAF Cost Optimization.

### 3.6 Adjacent estate: name-check but do not change

Every deployment tends to sit next to pre-existing resources that this initiative should record and leave alone, not fold in:

| Item | Disposition |
| --- | --- |
| Any pre-existing, single-purpose service account already serving a separate, proven pipeline | Untouched; keeps that track isolated from this initiative's preview stack (ADR-0004 pattern) |
| Any content storage outside Azure and outside CAF scope (for example, object storage on another cloud) | Existing names kept as-is; out of scope for this repo's naming convention |
| Pipeline environment variable names for this initiative's own resources | Names only; values live in a gitignored local file or the CI secret store, never in git (ADR-0005 pattern) |

## 4. Tag scheme

Applied to the resource group and the Foundry account before any backfill runs (tags are not retroactive), with tag inheritance enabled so resource-group tags flow into cost records (ADR-0006 pattern). WAF Cost Optimization.

| Tag key | Value | Purpose |
| --- | --- | --- |
| `initiative` | The full initiative name (the token the naming pattern's `<initiative>` segment abbreviates) | Isolates this workload's spend from everything else in the subscription; carries the full name the short token can't |
| `env` | Matches the name token | Environment discriminator |
| `owner` | Owner alias, set at deploy time | Accountability; a name only, never a credential or ID |
| `costCenter` | Set at deploy time, optional | Chargeback rollups |

Two boundaries worth stating so nobody over-promises: an auto-applied Foundry `project` tag (where a project exists) gives per-project cost with zero manual tagging, but Azure tags generally cannot split spend below whatever granularity the platform's own auto-tagging supports; if the initiative needs a finer split (for example, per downstream consumer of a shared account), that ledger has to be built and reconciled by the pipeline itself, not assumed from Azure tags alone (ADR-0006 pattern).

## 5. What deliberately has no new name

- No storage account, when assets live entirely outside Azure (for example, in the site repos or third-party object storage) (ADR-0008-style topology).
- No second instance of a shared account or a second region, when one shared account is the decided topology and a split is a failure mode to avoid, not a design.
- No Log Analytics workspace or diagnostic-settings resource, until an ADR decides one is needed (a gap worth recording explicitly in `reliability-and-operations.md` if it applies).
- No new Key Vault, when an existing platform vault is reused (ADR-0005 pattern).

## 6. Design-phase decisions and deltas: how to record them

Whenever an ADR leaves an exact string or a yes/no open for the design phase, record the finalization here as a conscious delta, not a silent change. Recurring categories this repo has hit in its own deployment (see the closing worked-example section for the real values):

1. **Environment token choice.** An ADR's illustrative shape may use a placeholder environment value; the design phase finalizes the real one based on what the account actually serves, and records that as a conscious finalization delta.
2. **Whether to create an optional child resource** (for example, a Foundry project) that an ADR left open. Record the purpose it serves (an audition/verification step, a cost-tag anchor, or both) and whether any pipeline call actually depends on it.
3. **Abbreviation deviations** from the current CAF Learn mapping, kept for cross-phase consistency once fixed (section 2.1).
4. **Proposed names for resources an ADR decided but did not name.** Flag these for reviewer confirmation; everything else in the naming table is fixed once reviewed.

## Sources

- `ai/adr/ADR-0001-target-tenant.md` (subscription, tenant, region, eastus2 blocker)
- `ai/adr/ADR-0004-foundry-topology-and-region.md` (kind, SKU, deployment shape, custom subdomain, naming intent deferred to design)
- `ai/adr/ADR-0006-cost-governance.md` (budget scope, amount, thresholds, action group, tag scheme, tag limits)
- `ai/adr/ADR-0005-identity-and-secrets.md` (Key Vault reuse, secret names, names-only rule)
- `ai/verification/environment-readiness.md` (existing accounts, deployment prerequisites)
- Abbreviation recommendations for Azure resources (Microsoft Learn, checked 2026-07-11): <https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations>
- Define your naming convention (Microsoft Learn, component order and delimiters): <https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-naming>

---

<!-- safety-scan-worked-example:start -->

## Worked example: Gunner the Lab / Holdfast Press

This section restates the real, already-deployed instance of the pattern above, in full, as proof the convention resolves cleanly in production today. Every name below is real and canonical; nothing here is a placeholder.

### Real naming table

| Resource | Provider type (kind, SKU) | Abbrev | Workload | Env | Region | Inst | Name | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Resource group | `Microsoft.Resources/resourceGroups` | `rg` | `studioai` | `prod` | `eus` | `01` | `rg-studioai-prod-eus-01` | Canonical |
| Foundry account | `Microsoft.CognitiveServices/accounts` (kind `AIServices`, SKU `S0`) | `aif` | `studioai` | `prod` | `eus` | `01` | `aif-studioai-prod-eus-01` | Canonical |
| Model deployment | `Microsoft.CognitiveServices/accounts/deployments` (SKU `GlobalStandard`, capacity 1) | none defined by CAF | model slug `mai-image-25` | inherited | inherited | n/a | `mai-image-25` | Canonical |
| Foundry project | `Microsoft.CognitiveServices/accounts/projects` | `proj` | `studioai` | inherited | inherited | `01` | `proj-studioai-media-01` | Canonical |
| Budget (workload cap) | `Microsoft.Consumption/budgets` (resource-group scope) | none defined by CAF; full word `budget` | `studioai` | `prod` | `eus` | `01` | `budget-studioai-prod-eus-01` | Canonical |
| Key Vault | `Microsoft.KeyVault/vaults` | `kv` | pre-existing | pre-existing | pre-existing | pre-existing | `kv-hcs-vault-01` | Canonical (REUSE, do not create) |
| Action group (budget email) | `Microsoft.Insights/actionGroups` | `ag` | `studioai` | `prod` | `eus` | `01` | `ag-studioai-prod-eus-01` | Proposed (ADR-0006 decided one owner-email action group; string not canonicalized) |
| Budget (credit burn-down) | `Microsoft.Consumption/budgets` (subscription scope, amount = monthly credit) | none defined by CAF | `studioai` | n/a | n/a | `01` | `budget-studioai-credit-sub-01` | Proposed (ADR-0006 decided a subscription-scoped credit budget; string not canonicalized) |

Real notes: `mai-image-25` is deliberately version-free (ADR-0002: current version 2026-06-02, re-check around 2026-09-01), so preview version churn is absorbed by redeploying under the same name with no caller change. `proj-studioai-media-01` carries the purpose token `media` since it is scoped inside the account; it exists for the Foundry playground voice audition (reading the deployed narrator's voice identifier and the `excited` style token, ADR-0003 follow-up) and for the auto-applied `project` cost tag on Models-sold-by-Azure usage (ADR-0006).

No abbreviation deviation in the real deployment: the account is `aif-studioai-prod-eus-01`, matching the current Learn mapping for kind `AIServices` exactly. An `ais` deviation was discussed during design and review (`ai/REVIEW.md`'s pre-deployment HOLD item), but the owner directed following the current `aif` mapping before the resource was created (see `ai/implementation/as-built.md`). This section previously stated the opposite - that `ais` was retained - which was a documentation error, not what was actually deployed; corrected 2026-07-23.

### Real scope chain

```
This Is My Demo tenant (by name only)
  This Is My Demo - MVP Subscription (by name only; spending limit ON)
    rg-studioai-prod-eus-01            (eastus, tagged, budget-scoped)
      aif-studioai-prod-eus-01         (AIServices, S0, custom subdomain)
        mai-image-25                   (MAI-Image-2.5, GlobalStandard, capacity 1)
        proj-studioai-media-01         (Foundry project)
      budget-studioai-prod-eus-01      (Cost Management budget on the RG scope)
    rg-storyreader                     (pre-existing; storyreader-tts F0 narrator account; UNTOUCHED)
    kv-hcs-vault-01                    (pre-existing platform Key Vault; REUSED, not created)
```

Subscription and tenant are recorded by display name only; no subscription IDs or tenant GUIDs appear in any committed file (hard rule; ADR-0005 secret posture).

The Foundry account (`aif-studioai-prod-eus-01`): kind `AIServices` (hosts a Foundry model deployment while also serving Speech, ADR-0004); SKU `S0` (F0 eligibility for MAI voices unverified, and the image deployment needs S0 regardless; S0 also carries the 200 transactions-per-second default Speech throughput, ADR-0004); region `eastus` (the one region satisfying both models plus the preview-styles flag, ADR-0001, ADR-0004); custom subdomain enabled, matching the account name (AIServices default; prerequisite for a later Entra-for-Speech move, ADR-0004, ADR-0005); public network access enabled (the publish pipeline runs outside Azure; private endpoints would break it, ADR-0005 record); data plane endpoints `https://aif-studioai-prod-eus-01.services.ai.azure.com/mai/v1/images/generations` and `/edits`, plus the Speech key path via `https://eastus.tts.speech.microsoft.com/cognitiveservices/v1` (ADR-0004; regional Speech endpoint per ADR-0005 key decision); residency note: the image deployment is Global Standard so transient processing may leave East US, at-rest data stays in the US geography, and real-time TTS stays in-region and stores nothing (ADR-0004).

### Real Key Vault secrets (`kv-hcs-vault-01`, reused, not created)

| Secret name | Holds | Created? |
| --- | --- | --- |
| `studio-foundry-speech-key` | Speech key for the new account | Yes (Speech uses key auth for now) |
| `studio-foundry-speech-region` | `eastus` (not a secret; co-located for one-stop retrieval) | Yes |
| `studio-foundry-image-endpoint` | `https://aif-studioai-prod-eus-01.services.ai.azure.com` (not a secret) | Yes |
| `studio-foundry-image-key` | Image-surface key | No; the image path is Entra keyless, so per ADR-0005 this secret is simply never created |

### Real adjacent estate

| Item | Name | Disposition |
| --- | --- | --- |
| Narrator Speech account | `storyreader-tts` (SpeechServices, F0, `rg-storyreader`) | Untouched; keeps the narrator and read-along track (ADR-0004) |
| R2 buckets | `storyreader-holdfast-content`, `storyreader-gunner-content` | Cloudflare, outside Azure and outside CAF scope; existing names kept |
| Pipeline env vars | `MAI_SPEECH_KEY`, `MAI_SPEECH_REGION`, `MAI_IMAGE_ENDPOINT` (and narrator `AZURE_SPEECH_*`) | Names only; values live in `.dev.vars` (gitignored) or the CI secret store (ADR-0005) |

### Real tag values

| Tag key | Value |
| --- | --- |
| `initiative` | `studio-foundry` |
| `env` | `prod` |
| `owner` | Owner alias, set at deploy time |
| `costCenter` | Set at deploy time, optional |

Real deltas from the design-phase decisions in section 6: environment token `prod` was finalized over ADR-0004's illustrative `demo` because the account's output ships to both Gunner the Lab's and Holdfast Press's production apps; the Foundry project `proj-studioai-media-01` was created for the playground voice audition (reading the exact deployed voice identifier and the `excited` style token) plus the `project` cost tag; the `ais` deviation floated at review was NOT adopted, the account uses the current Learn `aif` mapping instead; `ag-studioai-prod-eus-01` and `budget-studioai-credit-sub-01` remain proposed strings pending reviewer confirmation.

<!-- safety-scan-worked-example:end -->
