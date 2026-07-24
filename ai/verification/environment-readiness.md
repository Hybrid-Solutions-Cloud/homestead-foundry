# Environment readiness: methodology

Status: read-only verification methodology. No Azure resources should be created, updated, or deleted while running this check.
Author: foundry-env-verifier

Scope: determine whether one Azure AI Foundry (AIServices) resource can be deployed in a target region, hosting the model deployments a given build needs, in the owner's preferred subscription first, falling back to an alternate tenant or subscription if the primary is not viable.

---

## Summary and go/no-go pattern

The output of this check is a single **GO** or **NO-GO** recommendation for a primary candidate subscription, plus an ordered list of fallback candidates that were checked with the same rigor so a fallback decision can be made quickly if the primary later becomes unusable (credit exhaustion, access change, region shortage).

A candidate is **GO** when all of the following hold: the resource provider is registered (or registerable), the AIServices resource kind is offerable in the target region, every model the build needs is confirmed available in that region, quota headroom exists on the meters that matter, and no policy assignment blocks Cognitive Services resource creation. A candidate that fails one of these is either **NO-GO** or **not ready without extra work first**, depending on whether the gap is a hard blocker (policy deny, region not supported) or a fixable prerequisite (provider not yet registered).

## Candidate subscriptions (by name)

List every subscription under consideration in a table with columns: subscription name, tenant, role (primary or fallback, ranked), and enablement state. Confirm each candidate is reachable read-only with the identity that will run the check; note any access errors immediately, since an unreachable candidate cannot be evaluated further.

## Provider registration

Check the `Microsoft.CognitiveServices` resource provider registration state per candidate subscription (`az provider show`). Registering a resource provider is a low-risk, non-destructive activation step, but it is still a write operation and should not be performed under a read-only mandate. If a candidate's provider is not registered, `az provider register -n Microsoft.CognitiveServices` is the documented remedy, and it must be run and allowed to finish propagating before any resource create is attempted there. Treat an unregistered provider as "not ready without extra work," not as a hard no-go.

## AIServices and region availability

Run `az cognitiveservices account list-skus --location <region> --kind AIServices` against every candidate. A consistent result (SKU tier offerable, no restrictions listed) across candidates means the AIServices resource kind itself is not the limiting factor.

Cross-check region availability for each model the build needs against Microsoft Learn, fetched live during the verification rather than pulled from any source plan's citations (documentation changes faster than plans get updated): confirm the region appears in the model's supported-region list, and confirm any preview or capability caveats called out on the same page.

## Model availability

Confirm each Foundry model the build needs is present in the live model catalog for the target region: `az cognitiveservices model list --location <region>`, filtered for the model's kind and name. Record the lifecycle status (Preview, GA, Deprecating), the model version returned, and the deployable SKU (for example Global Standard) with its default capacity. A near-term deprecation date on a specific model version is a tracked item, not a blocker: newer dated versions typically supersede rather than the model disappearing, but the deployment step should re-check the current version at deploy time rather than hardcoding a version string discovered during this check.

Some models the build needs are not Foundry model deployments at all (voice models accessed through a Speech resource, for example). If a model does not appear in `az cognitiveservices model list`, check whether it is expected to: some services are selected at call time by name inside a request payload against a standard endpoint, with no separate deployment step. For these, confirm availability through the service's own Microsoft Learn region-support page instead of the Foundry model catalog, since the catalog is the wrong tool to look for them.

## Quota

Check `az cognitiveservices usage list --location <region>` per candidate subscription, filtered to the meters relevant to the build (account-count caps, requests-per-minute caps per model and SKU). Build a comparison table across candidates so relative headroom is visible at a glance, since a subscription can offer the same model at a materially lower default rate-limit tier than another.

A candidate whose provider is not yet registered may return no entries at all for these meters. That is expected, not evidence of a hard cap: quota has simply not been provisioned to that subscription's regional scope yet, and it should reappear once the provider is registered.

Some services (Speech transaction/character quotas, for example) are enforced per-resource at the service level rather than exposed through this subscription-scoped usage API. Note this explicitly rather than treating its absence from the usage list as a gap; the true limit lives in the service's own documented per-tier quota table.

## Policy blockers

Run `az policy assignment list` at subscription scope for every candidate. Record every assignment found and evaluate whether it carries a deny effect against Cognitive Services or AIServices resource types specifically; most built-in security initiatives (Defender for Cloud, for example) are audit/monitor only and do not block resource creation.

Caveat for any landing-zone-style tenant: a subscription-scoped policy query does not see guardrails applied at the management group level, which can still apply to a subscription without showing up as a subscription-scoped assignment. Call this out explicitly as an open caveat for that tenant rather than treating the subscription-scoped query as conclusive; a management-group-scoped check, or simply attempting a real deployment, is the only way to fully rule it out.

## Existing resources (avoid duplication)

List existing Cognitive Services accounts per candidate subscription (kind, tier, location, resource group). Two things fall out of this pass: first, whether an existing resource can be reused (it usually cannot, if its kind or tier does not match what the build needs, for example a single-service resource that cannot take a Foundry model deployment); second, whether an existing AIServices resource elsewhere in the same subscription is standing precedent that the resource type deploys successfully there, which strengthens confidence in that candidate even if the existing resource is in a different region.

If the build needs more than one kind of model capability (image generation and speech, for example) and a single AIServices-kind resource can serve both, prefer one shared resource over one resource per capability; note this explicitly so downstream planning does not accidentally provision duplicates.

## Recommendation pattern

Rank the primary candidate first if it passes every check above, citing the specific facts that support it: provider state, region and SKU availability, confirmed model availability, quota headroom relative to the other candidates, absence of policy blockers, and any proximity benefit (existing Key Vault, existing related resources already living there).

Rank fallback candidates in preference order using the same criteria, being explicit about what makes one fallback stronger than another (for example, a registered provider and existing precedent beats an unregistered provider with no precedent, even if both are otherwise clean). Mark any candidate that has a real gap (unregistered provider, no existing precedent, missing quota baseline) as "not recommended without extra work first" rather than a hard no-go, and state exactly what closes that gap.

## What the deployment step still needs

This check only establishes that the infrastructure can exist. Before a deployment agent runs, it still needs, in order:

1. **Owner confirmation to create resources**, per repo policy (nothing in this check authorizes a write).
2. **A resource group** in the recommended subscription and region (confirm it does not already exist as part of this check's resource listing).
3. **The AIServices resource itself**, sized to serve every model capability the build needs from one resource where possible.
4. **Each model deployment** the build needs, using `az cognitiveservices account deployment create` with the SKU and version confirmed live during this check (re-verify the version string is still current at deploy time, given any deprecation date noted above).
5. **An auth decision carried over from the source plans**: Entra ID (a least-privilege Cognitive Services role, `DefaultAzureCredential`) is preferred with no stored key; if a key is used instead, it goes to the tenant's Key Vault by name only, never into a committed file.
6. **Any research spike already scoped** to answer pricing or product-behavior questions this check cannot (per-unit token costs, tier-specific feature support, event or callback behavior). None of these are infrastructure questions, so none of them change the go/no-go above.
7. **A budget/cost-management alert on the resource group**, before any spend starts.

No further read-only checks are needed to move forward once every item above is clean; any surviving caveat (typically the management-group policy caveat for a landing-zone tenant) only matters if a fallback candidate is ever activated.

<!-- safety-scan-worked-example:start -->
## Worked example: Brand A / Brand B

This is an anonymized example environment-readiness record for the
methodology's real worked example (two publishing brands, referred to here
as Brand A and Brand B), with resource names genericized to the CAF
placeholder pattern. It is not a live private inventory.

Date: 2026-07-11

Scope actually checked: can this build deploy one Azure AI Foundry (AIServices) resource in region East US that hosts a MAI-Image-2.5 model deployment (Global Standard) and serves MAI-Voice-2 through Azure Speech, in the owner's preferred subscription first, falling back to the fallback Azure Local tenant if not.

### Summary and go/no-go

**GO**, in the primary subscription. the MVP credit subscription (the MVP tenant) is ready today: the resource provider is registered, an AIServices resource in Standard (S0) tier is offerable in East US, MAI-Image-2.5 appears in the live model catalog for East US in Preview status with a Global Standard deployment path, MAI-Voice-2 is confirmed for East US on Microsoft Learn's Azure Speech region table, quota headroom exists on every meter checked, and no policy assignment blocks Cognitive Services resource creation.

No fallback deployment is needed right now. If the primary subscription becomes unusable (credit exhaustion, access change), the fallback Azure Local tenant has one candidate subscription that is ready with the same caveats as the primary (fallback subscription 1) and one that needs a provider-registration step first (fallback subscription 2). Both are documented below for that scenario.

### Candidate subscriptions (by name)

| Subscription | Tenant | Role | State |
|---|---|---|---|
| the MVP credit subscription | the MVP tenant | Primary (current CLI default) | Enabled |
| fallback subscription 1 | fallback Azure Local tenant | Fallback candidate 1 (preferred of the two) | Enabled |
| fallback subscription 2 | fallback Azure Local tenant | Fallback candidate 2 | Enabled |

All three were reachable read-only with the logged-in owner identity. No access errors were encountered on any check below.

### Provider registration

`Microsoft.CognitiveServices` resource provider, checked per subscription:

| Subscription | Registration state |
|---|---|
| the MVP credit subscription | **Registered** |
| fallback subscription 1 | **Registered** |
| fallback subscription 2 | **NotRegistered** |

If fallback subscription 2 is ever needed, `az provider register -n Microsoft.CognitiveServices` must run first and be allowed to finish propagating before any resource create is attempted there.

### AIServices and region availability

`az cognitiveservices account list-skus --location eastus --kind AIServices` returned the same result in all three subscriptions: SKU `S0`, tier Standard, offerable in `EASTUS`, no restrictions listed.

Cross-checked against Microsoft Learn (fetched live during this verification, not from the source plan's citations):

- "Deploy and use MAI image models in Microsoft Foundry (preview)" states MAI image models (including MAI-Image-2.5) are available for **Global Standard deployment** in exactly seven regions: West Central US, **East US**, West US, West Europe, Sweden Central, South India, UAE North. East US confirmed directly from current Microsoft documentation.
- "Supported regions for Azure Speech" (regions#regions) lists a dedicated "MAI voices" column. **East US is checked** for MAI voices, and East US is one of only a handful of regions also checked for "Voices and styles in preview," matching the source plan's claim.

### Model availability

**MAI-Image-2.5: CONFIRMED via CLI**, not just documentation. `az cognitiveservices model list --location eastus` returns a live entry in all three subscriptions:

- `kind: "MAI"`, `format: "Microsoft"`, `name: "MAI-Image-2.5"`, `lifecycleStatus: "Preview"`, version `2026-06-02`
- Deployable SKU: `GlobalStandard`, default capacity 1, `usageName: "AIServices.GlobalStandard.MAI-Image-2.5"`
- Sibling models also present: MAI-Image-2 (Deprecating), MAI-Image-2e (Preview), MAI-Image-2.5-Flash (Preview)
- One data point worth tracking, not a blocker: the model version's `inference` deprecation date is listed as 2026-09-01, about seven weeks out. This is normal Azure model-version lifecycle (a newer dated version typically supersedes rather than the model disappearing), but the deployment step should re-check the current version at deploy time rather than hardcoding 2026-06-02.

**MAI-Voice-2: not present in `az cognitiveservices model list`, and that is expected, not a gap.** Grepped the full East US model list dump for "mai-voice" in the primary subscription: zero matches. This is because MAI-Voice-2 is not a Foundry model deployment at all. Microsoft Learn's "What is MAI-Voice (preview)?" page lists the MAI-Voice-2 prerequisite as simply "a Speech resource in a region that supports MAI-Voice-2," with no deployment step. Voices are selected at call time by name (for example `en-US-Harper:MAI-Voice-2`) inside the SSML `<voice>` element against the standard Speech synthesis endpoint. The Azure Speech region table (fetched live, see above) confirms East US support directly, and the live "Language and voice support for Azure Speech" page confirms the specific voice names the sibling voice plan proposed exist today (`en-US-Grant:MAI-Voice-2`, `en-US-Harper:MAI-Voice-2` with a style set, `en-US-Iris:MAI-Voice-2`, `en-US-Jasper:MAI-Voice-2`, `en-US-Olivia:MAI-Voice-2` with a style set). Net: **CONFIRMED available in East US**, sourced from Microsoft Learn rather than the CLI model catalog, because the CLI model catalog is the wrong tool to look for it.

Conclusion: both models the initiative needs are usable in East US. Neither is a source of no-go risk. The remaining unknowns (exact tokens per generated image, whether F0 accepts MAI-Voice-2, whether word-boundary events fire for MAI-Voice-2) are pricing and product-behavior questions already flagged in the two source plans and belong to the research spike, not to this infrastructure check.

### Quota

Checked via `az cognitiveservices usage list --location eastus` per subscription (only the meters relevant to this initiative are shown; the full response also carries dozens of unrelated OpenAI meters).

| Meter | Scope | the MVP credit subscription | fallback subscription 1 | fallback subscription 2 |
|---|---|---|---|---|
| AIServices.S0.AccountCount (max AIServices S0 resources) | eastus | 0 used / limit 100 | 0 used / limit 100 | not returned (see note) |
| AIServices.GlobalStandard.MAI-Image-2.5 (RPM) | global | 0 used / limit **10** | 0 used / limit **2** | not returned (see note) |
| AIServices.GlobalStandard.MAI-Image-2.5-Flash (RPM) | global | 0 used / limit 10 | 0 used / limit 2 | not returned (see note) |

Note on fallback subscription 2: the usage query returned no entries at all for these meters, consistent with the resource provider not being registered there yet (no registered provider, no established quota baseline to report). This is not evidence of a hard cap, just that quota has not been provisioned to that subscription's East US scope yet; it should reappear once the provider is registered.

Per Microsoft Learn's MAI image quota table, a Requests Per Minute limit of 10 corresponds to Global Standard "Tier 5," and a limit of 2 corresponds to "Tier 1" (the default new-subscription tier). **the MVP credit subscription already sits at a materially higher default tier than fallback subscription 1** for MAI-Image-2.5 and MAI-Image-2.5-Flash (10 RPM vs 2 RPM), which matters once work moves past the pilot (the image plan's whole-catalog backfill estimate, about 340 images, is already flagged as slow at 2 RPM).

No Speech-specific (TTS characters/transactions-per-second) quota meter appears in `az cognitiveservices usage list` in any subscription. That is expected: Speech quota is enforced per-resource at the service level (F0 = 20 transactions/60s, S0 = 200 TPS by default, per the source voice plan's citation of Microsoft Learn's quotas page), not exposed through this ARM usage API. There is nothing to report here beyond what the source plan already documented; it is not a subscription-level constraint.

### Policy blockers

`az policy assignment list` at subscription scope, per subscription:

| Subscription | Assignments found | Relevant to Cognitive Services creation? |
|---|---|---|
| the MVP credit subscription | 1: an ASC (Microsoft Defender for Cloud) initiative for open-source relational database protection | No, unrelated resource type |
| fallback subscription 1 | 1: "ASC Default," Defender for Cloud's built-in security initiative | No, audit/monitor only, not a deny effect on resource creation |
| fallback subscription 2 | 0 | No blocker visible at this scope |

None of the assignments found carry a deny effect against Cognitive Services or AIServices resource types. Caveat for the fallback Azure Local tenant specifically: this is a subscription-scoped query only. Azure landing zone architectures (and the subscription names here, `fallback subscription 1`, follow that naming convention) commonly apply guardrail policies at the management group level, which can still apply to a subscription without showing up as a subscription-scoped assignment in every case. Nothing found here contradicts a go, but a management-group-scoped policy check (or simply attempting a real deployment) is the only way to fully rule this out for the fallback Azure Local tenant. This caveat does not apply to the primary subscription's recommendation.

### Existing Cognitive Services accounts (avoid duplication)

| Subscription | Existing account | Kind | Tier | Location | Resource group |
|---|---|---|---|---|---|
| the MVP credit subscription | the legacy narrator Speech resource | SpeechServices | F0 | eastus | its resource group |
| fallback subscription 1 | an existing AIServices resource | AIServices | S0 | eastus2 | its resource group |
| fallback subscription 2 | none | | | | |

Two useful facts fall out of this:

1. **The legacy narrator Speech resource cannot host the new work.** It is kind `SpeechServices` (single-service), not `AIServices`, so it cannot take a Foundry model deployment like MAI-Image-2.5. It is also F0 tier, and the voice plan already flags F0 eligibility for MAI-Voice-2 as unverified. A new resource is required regardless of what the spike finds; this is confirmation, not new risk.
2. **an existing AIServices resource proves AIServices resources deploy successfully in the fallback subscription 1 subscription**, just in eastus2 rather than eastus today. That is real precedent for the fallback path, on top of the clean provider/quota/policy checks above.

Because the new resource needs to be `AIServices` kind (not `SpeechServices`) to take the MAI-Image-2.5 deployment, and `AIServices` kind also serves Speech, one new resource can host both MAI-Image-2.5 and the MAI-Voice-2 listen-voice work, exactly as the image plan's provisioning section proposed. This also means the two source plans should share one resource rather than each provisioning its own.

### Recommendation

**Primary: the MVP credit subscription, region East US.** Reasons: resource provider already registered, AIServices S0 confirmed offerable in East US, MAI-Image-2.5 present in the live East US model catalog in Preview with a working Global Standard deployment path, MAI-Voice-2 confirmed for East US via current Microsoft Learn docs, zero quota consumed today against a 100-account AIServices cap, and the subscription's default MAI-Image-2.5 rate limit (10 RPM) is five times the other viable candidate's (2 RPM), which matters once the initiative moves past the pilot into backfill. No policy blocker found. This is also the owner's stated preferred home and where the existing legacy narrator Speech resource and Key Vault already live, so it keeps everything in one place.

**Fallback: fallback subscription 1 (fallback Azure Local tenant), region East US.** Reasons: provider already registered (no extra step needed), AIServices S0 confirmed offerable in East US, same MAI-Image-2.5 catalog entry present, zero quota consumed in East US against the same 100-account cap, only a standard Defender monitoring policy assigned at subscription scope, and it already has a working AIServices resource elsewhere in the subscription (eastus2) proving the resource type deploys cleanly here. Its MAI-Image-2.5 rate limit defaults lower (2 RPM, Tier 1), which is fine for the pilot's roughly 12 to 20 images but would slow a full-catalog backfill; a quota increase request is the documented remedy if this path is ever activated for real.

**Not recommended without extra work first: fallback subscription 2.** Same tenant, but `Microsoft.CognitiveServices` is not registered, so no quota baseline exists yet for the meters that matter, and there is no existing Cognitive Services resource in the subscription to serve as precedent. It is not broken, just not ready; registering the provider and re-running this checklist would clear it for consideration alongside fallback subscription 1.

### What the deployment step actually needed next

1. **Owner confirmation to create resources**, per repo policy (nothing here authorizes a write).
2. **A resource group** in the MVP credit subscription, region East US (both source plans suggest names; neither exists yet, confirmed by this check's resource group listing).
3. **The AIServices resource itself**, kind `AIServices`, SKU `S0`, region `eastus`, sized to also serve as the Speech endpoint for the voice plan (avoids a second resource).
4. **The MAI-Image-2.5 model deployment** on that resource: `az cognitiveservices account deployment create` with `--model-format Microsoft --model-version 2026-06-02 --sku-name GlobalStandard --sku-capacity 1` (verify the version string is still current at deploy time, given the 2026-09-01 inference-deprecation date noted above).
5. **Auth decision carried over from the source plans**: Entra ID (Cognitive Services Contributor role, `DefaultAzureCredential`) is preferred with no stored key; if a key is used instead, it goes to Key Vault `kv-<workload>-<env>-01` by name only, never into a committed file.
6. **The research spike** (already scoped in both source plans) to answer what this check could not: tokens-per-image for MAI-Image-2.5 (unpublished), whether MAI-Voice-2 works on F0 or requires S0 billing, and whether MAI-Voice-2 emits usable WordBoundary events. None of these are infrastructure questions, so none of them change the go/no-go above.
7. **A budget/cost-management alert on the resource group**, per both source plans' own recommendation, before any spend starts.

No further read-only checks were needed to move forward; the blockers, if any turn out to exist, are the management-group policy caveat noted above for the fallback Azure Local tenant, which only matters if the fallback is ever activated.
<!-- safety-scan-worked-example:end -->
