# ADR-0001: Target tenant, subscription, and region

- Status: Accepted (owner approved 2026-07-24)
- Date: 2026-07-11

## Context

An Azure AI Foundry build in this repo needs one shared Azure AI Foundry (AIServices) resource in a region that can host every required model and modality (for example an image-generation deployment plus a speech or voice model), so that secrets, budget, and identity share one tenant. The read-only environment check (`ai/verification/environment-readiness.md`) reaches a GO on a preferred subscription, and SPIKE-03 (`docs/research/SPIKE-03-tenant-readiness.md`) synthesizes and extends it. The recurring forces in a tenant-selection decision of this shape:

- **A primary candidate that reaches a clean GO.** The environment check plus SPIKE-03 confirm, for the preferred subscription and region: the `Microsoft.CognitiveServices` provider is Registered, the AIServices S0 SKU is offerable in the region, every required model is present in the live regional catalog on its intended deployment path, the account quota is clean (unused headroom against the S0 account limit), the required rate tier is already granted, and the only subscription-scoped policy is unrelated with no deny effect. The primary is also co-located with the platform Key Vault and any existing related service resource, so secrets, budget, and identity share one tenant.
- **The load-bearing region risk.** Different first-party models are offered in different sets of regions. The deployable region is the intersection of every required model's availability. A model on a Global Standard path may be offered in only a handful of regions, while a speech or voice model may be offered more broadly. Any policy that forces the workload into a region outside that intersection can leave one modality deployable and another undeployable, which breaks the one-shared-resource design.
- **The fallback is a conditional runner-up, not the choice.** A second subscription may pass the same subscription-scoped checks (provider Registered, S0 offerable, same catalog entry, quota clean, only an audit policy) and even carry precedent (an existing AIServices resource). It ranks second when: (a) its default rate tier is lower, (b) it is in a different tenant from the platform Key Vault and existing related resources, and (c) the readiness check can see subscription-scoped policy only. A subscription named to a landing-zone convention commonly inherits management-group guardrails that a subscription owner cannot override, and a precedent resource living in an unexpected region is a soft hint that an Allowed-locations restriction may already be in play.
- **A third candidate that is not ready.** A subscription with `Microsoft.CognitiveServices` NotRegistered has no quota baseline and no precedent resource, so it cannot be evaluated without a write.
- **Credit behavior.** A benefit or MVP subscription whose Azure benefit is a recurring monthly credit that does not roll over, shipped with a spending limit that auto-disables the subscription at the credit ceiling rather than invoicing, shapes the cost governance (ADR-0006) but does not change the tenant choice.

## Decision

**Provision on the primary candidate that reaches a clean GO in the readiness check, co-located with the platform Key Vault, in the region that lies in the intersection of every required model's availability.** One shared AIServices resource (topology in ADR-0004) is created there. This is recorded as decided per the owner-locked GO in the MASTER-PLAN; it is not reopened here.

**Fallback: the documented runner-up subscription, in the same intersection region, contingent on all three read-only pre-checks from SPIKE-03 passing before any resource is created there:**

1. **Enumerate inherited management-group policy.** Run `az policy assignment list --disable-scope-strict-match` at the subscription scope and `az policy assignment list --management-group <name>` for each ancestor management group, then read each definition's effect and parameters. Confirm no Allowed-locations assignment that excludes the target region, no Allowed-resource-types assignment that excludes `Microsoft.CognitiveServices/accounts`, and no Deny on key access.
2. **Note any silent-mutation policy.** Record any Modify or DeployIfNotExists policy that would disable public network access (which would break a publish-from-developer-machine pipeline) or disable local authentication.
3. **Non-destructive deployment preflight.** Run `az deployment group what-if` (or `validate`) for the AIServices S0 account in the target region to surface any `RequestDisallowedByPolicy` before anything is created.

**Treat a region restriction that forces the workload outside the model-availability intersection as a hard blocker, not a preference.** A forced region that excludes any required model breaks the shared-resource model and would require a region-exemption request or a resource split before the fallback is usable.

**A candidate with `Microsoft.CognitiveServices` NotRegistered is not recommended** without first registering the provider (a write, deferred under the read-only mandate) and re-running the full readiness checklist.

## Consequences

**Positive:**
- Everything lives in one place: the Foundry resource sits alongside the platform Key Vault and any existing related service resource, so secrets, budget, and identity all share one tenant and subscription.
- The primary already holds the higher rate tier, which matters once work moves past the pilot into a full-catalog backfill.
- No extra activation steps: provider registered, quota clean, no deny policy found, so deployment can proceed once the owner confirms the write.

**Negative:**
- A credit subscription is subject to a monthly credit that resets and to auto-disable at the credit ceiling; spend timing and the hard-stop strategy are handled in ADR-0006, not here.
- If the primary ever becomes unusable, activating the fallback is not instant: the three read-only pre-checks above must be run and cleared first, and a forced out-of-intersection region finding would force a region exemption or a resource split.
- Preview models carry no SLA; a preview change to region or model availability is a carried risk, mitigated when assets are pre-rendered rather than synthesized live.

**Follow-ups:**
- Re-verify each model version at deploy time. A model version can carry an inference-deprecation date, so the deployment step should read the current version rather than hardcoding it.
- The fallback pre-checks are run only if the primary fails; they are not a gate on the primary.
- CAF names for the resource group and resource are set in the design phase (ADR-0004).

## Alternatives considered

- **The runner-up subscription as the primary.** Rejected as the first choice: it is in a different tenant from the platform Key Vault and existing related resources, its default rate tier is lower, and its unverified management-group policy could force an out-of-intersection region, which would make one model undeployable and break the shared-resource design. It remains the documented fallback.
- **A subscription with `Microsoft.CognitiveServices` NotRegistered.** Rejected: no quota baseline exists and there is no precedent resource. Not broken, just not ready.
- **A region outside the model-availability intersection.** Rejected: at least one required model is not offered there. The chosen region must satisfy every required model plus any additional preview flag a specific modality needs.
- **Two resources or two regions (split by modality).** Rejected: the source plans and the environment check converge on one shared resource in one region; a split is only forced by a region restriction on the fallback, and is treated as a blocker to avoid rather than a design to adopt.

&lt;!-- safety-scan-worked-example:start -->
## Worked example: first proven build

> This section records the concrete decision this ADR was first written for. The methodology above is the reusable part; the names, numbers, and region below are the historical facts of that build (decided 2026-07-11, owner-locked GO in the MASTER-PLAN).

- **Modalities and models:** one shared Azure AI Foundry (AIServices) resource hosting a MAI-Image-2.5 Global Standard deployment (scene art) and serving MAI-Voice-2 through Azure Speech (neural narration).
- **Primary (decided):** the MVP credit subscription (a Tier-5 / MVP-tier subscription in the primary tenant), region East US. The `Microsoft.CognitiveServices` provider is already Registered, AIServices SKU S0 is offerable in East US, MAI-Image-2.5 is present in the live East US model catalog (Preview, Global Standard path), MAI-Voice-2 is confirmed for East US on the Azure Speech regions table, 0 of 100 AIServices S0 accounts are used, the MAI-Image-2.5 rate limit already sits at 10 requests per minute (Tier 5), and the only subscription-scoped policy is an unrelated Microsoft Defender for Cloud initiative with no deny effect. It is the owner's stated preferred home, co-located with the platform Key Vault `kv-<workload>-<env>-01` and the existing legacy narrator Speech resource.
- **Region intersection:** MAI-Image-2.5 Global Standard is offered in only seven regions (West Central US, East US, West US, West Europe, Sweden Central, South India, UAE North). The region `eastus2` is not one of them, while MAI-Voice-2 is supported in `eastus2`. So any policy that forced the workload to `eastus2` would still allow the voice half but would make the image model undeployable. East US is the region that satisfies both models and also carries the Speech "voices and styles in preview" flag needed for the Ethan excited style.
- **Fallback:** the Azure Local tenant (the fallback tenant), region East US. It passed the same subscription-scoped checks (provider Registered, S0 offerable, same catalog entry, 0 of 100 used, only an "ASC Default" audit policy) and has real precedent (an existing AIServices S0 resource, though in `eastus2`). It is second because (a) its default MAI-Image-2.5 rate limit is 2 requests per minute (Tier 1) versus the primary's 10, (b) it is in a different tenant from the owner's Key Vault and existing Speech resource, and (c) the environment check could see subscription-scoped policy only.
- **Not ready:** a third management scope (`<management-scope>`) has `Microsoft.CognitiveServices` NotRegistered, so no quota baseline exists and there is no precedent resource.
- **Credit mechanics:** the primary is an MVP-awarded Visual Studio subscriber subscription whose Azure benefit is a recurring monthly credit that does not roll over and that ships with a spending limit that auto-disables the subscription at the credit ceiling rather than invoicing (feeds ADR-0006).
- **Version watch:** at authoring, MAI-Image-2.5 version `2026-06-02` carried an inference-deprecation date of `2026-09-01`, so the deployment step reads the current version rather than hardcoding it.
&lt;!-- safety-scan-worked-example:end -->

## Sources

- `ai/verification/environment-readiness.md` (read-only GO on the primary; provider, SKU, catalog, quota, policy, existing accounts)
- `docs/research/SPIKE-03-tenant-readiness.md` (readiness synthesis, credit mechanics, management-group policy pre-checks, region and quota deltas)
- Deploy and use MAI image models in Microsoft Foundry (seven-region Global Standard list; requests-per-minute tier table): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
- Azure Speech supported regions (MAI voices column, East US and eastus2): <https://learn.microsoft.com/azure/ai-services/speech-service/regions#regions>
- Understand scope in Azure Policy (management-group inheritance cannot be overridden by a subscription owner): <https://learn.microsoft.com/azure/governance/policy/concepts/scope>
- az policy assignment list (`--disable-scope-strict-match` to include inherited parent-scope assignments): <https://learn.microsoft.com/cli/azure/policy/assignment>
- Azure Policy built-in definitions, General (Allowed locations Deny, Allowed resource types Deny): <https://learn.microsoft.com/azure/governance/policy/samples/built-in-policies#general>
- Preflight: server validation before deployment (what-if and validate evaluate policy with no side effects): <https://learn.microsoft.com/azure/azure-resource-manager/bicep/deploy-preflight>
- Azure spending limit (auto-disable at the credit ceiling for credit subscriptions): <https://learn.microsoft.com/azure/cost-management-billing/manage/spending-limit>
