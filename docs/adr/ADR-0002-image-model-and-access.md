# ADR-0002: Image-model selection methodology and access for Azure AI Foundry builds

- Status: Proposed
- Date: 2026-07-11
- Revised 2026-07-24: generalized from a single-model pick into a selection methodology; the model list now lives in the model catalog (`docs/reference/model-catalog.md`).
- Decider: repo owner

## Context

An Azure AI Foundry build in this repo needs a repeatable, defensible way to
select and access a first-party image model, and to add, compare, and swap
image models as the catalog and the workload evolve. This is a methodology
repo: it must support evaluating and choosing among many image models over
time, not enshrine one pick. This ADR therefore decides the **selection
methodology, the evaluation criteria, and the access model**, and it delegates
the actual list of deployed, available, evaluated, and rejected models to the
living model catalog (`docs/reference/model-catalog.md`), which is the single
source of truth for status. Adding a new image model is a catalog row plus a
model-registry entry against this methodology, not a new ADR.

Two research spikes ground the criteria below against first-party Microsoft
sources: SPIKE-01 (`docs/research/SPIKE-01-image-model.md`) verified the MAI
image family, its lifecycle, cost mechanics, style-matching surface, canvas
constraints, and rate limits; SPIKE-12
(`docs/research/SPIKE-12-image-video-alternatives.md`) widened the survey to
the full current catalog (FLUX family, GPT-image family) and to video. The
environment readiness check (`ai/verification/environment-readiness.md`)
confirms which models are live in the target subscription.

The forces this decision reconciles generalize to any Azure AI Foundry
image-model selection:

- **Style-match and fidelity are workload-specific, not a single ranking.** A
  non-photorealistic illustrated house style, a realism-and-face workload, and
  a text-overlay layout are different problems. A model's Arena rank or
  marketing fidelity claim does not tell you whether it holds a specific style;
  only a pilot on real target assets does. Reference-image and multi-reference
  conditioning, not raw quality, is what locks a consistent style and
  characters across many frames.
- **Reference-image / consistency support is a hard capability axis.** Some
  surfaces are text-only on the generation path (the documented MAI request
  surface is `model`, `prompt`, `image` for edits, `width`, `height` only, with
  no seed, mask, negative prompt, or multi-reference input), so style-lock is
  prompt-only and non-reproducible. Others (the FLUX family) accept multiple
  reference images per generation. If the workload needs character-and-style
  lock, a model without reference conditioning cannot supply it no matter how
  high its fidelity.
- **Region availability gates the whole choice.** A model is only selectable if
  it is in the live catalog of the target subscription and region. Deploying a
  model that is out of region means a second resource, a region change, or
  cross-region calls. First-party region-availability tables are the authority,
  and they differ by family (for example the FLUX and MAI image families are
  available in East US, while the GPT-image family in the Americas is East US 2
  and West US 3 only).
- **Subscription-tier and quota eligibility set throughput and access.** RPM
  ceilings follow a published tier ladder per model, and some models sit behind
  a limited-access application. The target subscription's tier and any access
  gate determine whether a candidate is usable at the needed throughput.
- **Cost is token-metered and often unpublished.** Foundry image models bill
  per token in and out, with no charge for the resource or deployment itself.
  The exact per-token rate frequently does not render on a first-party pricing
  page, and tokens-per-generated-image is not published for the MAI image
  models. Per-image cost is therefore UNKNOWN until measured.
- **Responsible-AI posture matters, especially for children's content.** RAI
  rules differ by surface: the photorealistic-minors block and C2PA Content
  Credentials are documented for Azure OpenAI image models, not for MAI; the
  MAI RAI section names violent, sexual, public-figure, and trademark-replication
  risks but no minors policy. Non-photorealistic, hand-drawn art is the safer
  category, but the enforced policy surface must be checked per model.
- **Lifecycle and preview churn force a re-check discipline.** Preview models
  change weights, runtime, and schema and can retire on a published schedule; a
  Retired model returns `410 Gone`. Versions must be re-queried at deploy time,
  never hardcoded, and Preview models re-verified around any published inference
  or retirement date. GA models with no retirement date carry lower churn risk.
- **Canvas constraints are per-model.** Pixel caps and minimum dimensions vary
  (for the MAI image models both dimensions must be at least 768 and the product
  must not exceed 1,048,576 px). Existing assets above a model's cap cannot be
  reproduced at their exact dimensions and must be re-standardized.

## Decision

**Select and access image models by the methodology below, evaluated against a
fixed set of criteria, with the concrete deployed / available / evaluated /
rejected list maintained in the model catalog (`docs/reference/model-catalog.md`)
and its machine-readable counterpart the model registry.** No single model is
the decision here. MAI-Image-2.5 (Preview) is the current baseline example
(first-party, in-region fallback and A-B comparison point); the catalog records
which models are primary, which are candidates, and which were passed over, and
why.

### Selection criteria (score every candidate against these)

1. **Style-match / fidelity for the specific workload**, proven by a pilot on
   real target assets, not by leaderboard rank.
2. **Reference-image / consistency support** (single vs multi-reference
   conditioning) where the workload needs character-and-style lock.
3. **Region availability** in the target subscription and region, from the
   first-party region-availability table.
4. **Subscription-tier and quota eligibility** (RPM tier ladder, and any
   limited-access application gate).
5. **Cost model** (token metering confirmed; exact per-token rate and
   tokens-per-image treated as UNKNOWN until measured).
6. **Responsible-AI posture**, with children's-content rules (minors policy,
   content filtering, provenance/C2PA) checked per surface.
7. **Lifecycle / preview-churn risk** (Preview vs GA, published retirement or
   inference dates).
8. **Canvas / output constraints** against the workload's required sizes.

### Access and identity

Image inference uses **Microsoft Entra ID (keyless) via
`DefaultAzureCredential`**, managed-identity-first, per
ADR-0005 (`docs/adr/ADR-0005-identity-and-secrets.md`): the credential resolves
to the compute's managed identity on Azure or Arc, to a user-assigned managed
identity via OIDC federation in off-Azure CI, and to the signed-in `az login`
user on a workstation. Least-privilege data-plane role is Cognitive Services
User; model deploy is the one-time control-plane Cognitive Services Contributor.
Any endpoint secret a consuming pipeline requires lives only in the tenant Key
Vault, never in a committed file. This access model is model-agnostic and
applies to every image model in the catalog.

### How to add, evaluate, A-B, and swap an image model

1. **Add** a candidate as a catalog row (status `evaluated` or `available`)
   plus a registry entry, citing the spike or region-availability source. No new
   ADR is required unless adoption changes a decision the methodology cannot
   express (a new region, a new resource, or a new access-governance posture).
2. **Evaluate** it against the eight criteria above, and pilot it on real target
   assets for the style-match and RAI criteria, which documentation cannot
   settle.
3. **A-B** a new model against the current primary by deploying both on the same
   shared resource and comparing on the same prompts and reference images; keep
   the incumbent as the baseline until the challenger wins the decisive
   criterion.
4. **Swap** by promoting the winner to `deployed` (primary) in the catalog and
   registry and demoting the incumbent to fallback or `rejected` with a reason;
   never delete a rejected row, so the decision is not re-researched later.

### Deployment discipline (applies to whichever model is selected)

- **Version pinned at deploy and re-checked, never hardcoded.** Re-query
  `az cognitiveservices model list --location <region>` at deploy time and
  deploy the then-current version. Re-verify Preview models around any published
  inference or retirement date; do not deploy a model that retires within the
  planning horizon.
- **Cost measured, not guessed.** Make the first two pilot calls a cost probe
  (inspect the live response for a usage field, else divide a Cost Management
  output-token meter delta by a fixed micro-batch). Set a resource-group budget
  alert before any batch spend (ADR-0006) and read live per-token rates in the
  Foundry portal rather than any unverified figure.
- **Provenance sidecar for every image** (generator, endpoint, deployment,
  model, version, timestamp, prompt, prompt hash, size, seed state), independent
  of whether the model embeds C2PA.
- **RAI discipline for children's content:** keep every prompt explicitly
  non-photorealistic / illustrated, genericize trademarked references, log
  filter refusals, and verify the enforced minors and content-safety policy for
  the specific model at pilot time.

## Consequences

**Positive.**
- The repo can evaluate and choose among many image models against one stable
  methodology; adding a model is a catalog row plus a registry entry, not a new
  ADR.
- The decision does not go stale when the catalog changes: the living list lives
  in the catalog, and this ADR keeps deciding how to choose.
- The criteria make region, quota, cost, RAI, and lifecycle risks explicit and
  comparable across candidates.
- Keyless Entra access and the deploy-time re-query and cost-probe discipline
  carry across every model uniformly.

**Negative.**
- The methodology defers the concrete answer to the catalog, so a reader must
  follow the link to learn which model is primary today.
- Preview models carry no SLA and periodic churn; the deploy-time re-query and
  re-verification is mandatory ongoing work.
- Per-image cost and style-match quality are UNKNOWN until measured per model,
  so a pilot and a cost probe are required before any batch on a new model.
- Maintaining a multi-model roster spreads deployment, cost tracking, and
  pipeline model-selection logic across more surface area than a single pick.

**Follow-ups.**
- Keep the model catalog and registry current as models are added, promoted, or
  rejected; this ADR is the methodology, the catalog is the state.
- Run the two-call cost probe before any batch on any newly promoted model.
- Re-query the model catalog at deploy time and again at and after any published
  inference or retirement date.

## Alternatives considered

- **One ADR per image model.** Rejected: it enshrines specific picks and forces
  a new ADR for every catalog change. The methodology-plus-catalog split lets
  many models be evaluated and swapped against one decision. (The prior
  single-model framing of this ADR and the separate FLUX record ADR-0010 are the
  history this revision generalizes.)
- **Hardcoding a single model version.** Rejected: Preview models churn versions
  and Preview inference dates signal re-checks; the deploy step re-queries the
  catalog instead.
- **Choosing a model on leaderboard rank or marketing fidelity alone.** Rejected:
  rank does not predict whether a model holds a specific style or supplies
  reference-image conditioning; a pilot on real assets is the decisive test.
- **Waiting for a universal style-reference or seed feature across all models.**
  Rejected: capability differs per model (text-only MAI vs multi-reference FLUX);
  select the model whose documented surface supplies the needed capability
  today.
- **Key-based image access.** Rejected in favor of keyless Entra
  (managed-identity-first) per ADR-0005; the image REST surface accepts an Entra
  bearer token with zero stored secret.

&lt;!-- safety-scan-worked-example:start -->
## Worked example: the first proven build

This ADR was first written and decided for this repo's first proven build,
which serves two publishing brands, Brand A and Brand B, through their reader
apps. The concrete instantiation of the methodology above:

- **Trigger.** An early feature needed new scene art for Brand A's reader app
  plus a repeatable path to future story art matching an existing hand-drawn
  graphite and colored-pencil illustration style (graphite crosshatch storybook
  art).
- **Baseline model selected first.** MAI-Image-2.5 (Preview) was confirmed live
  in the East US catalog of the primary subscription (the MVP credit
  subscription, a Tier-5 / MVP-tier subscription), lifecycle Preview, version
  2026-06-02, Global Standard, Tier 5 (10 RPM), and deployed as the first-party
  baseline on the shared AIServices resource that also serves the narration
  model (ADR-0003).
- **Applying the criteria surfaced a capability gap.** Driven text-only,
  MAI-Image-2.5 could not hold the illustrated house style or keep characters
  consistent, because its documented surface has no reference-image conditioning
  (criterion 2). The FLUX family, which accepts multiple reference images per
  generation and is GA and in-region in East US, supplied that capability. The
  A-B and swap steps promoted the FLUX roster to primary and kept MAI-Image-2.5
  as the first-party fallback and A-B baseline. That promotion is recorded in the
  model catalog (`docs/reference/model-catalog.md`) and was originally captured
  in ADR-0010 (now superseded by this ADR plus the catalog).
- **Canvas.** The existing covers are 1264x848 (1,071,872 px), 23,296 px over the
  1,048,576 cap for the MAI image models, so they cannot be reproduced at their
  exact dimensions. The scene-art canvas was standardized on 1248x832 (1,038,336
  px, a clean 3:2), about a 1 to 2 percent scale difference from the originals.
- **Cost.** Per-token rates and tokens-per-image were treated as UNKNOWN and
  scheduled for the two-call cost probe before any batch, with a resource-group
  budget alert (ADR-0006) set first.
- **RAI.** Every prompt keeps explicit hand-drawn / illustrated style wording to
  stay in the non-photorealistic lane for scenes with children, and a named
  apparel brand on a character was genericized to "denim bib overalls with a red
  rectangular chest patch" to avoid trademark replication.
&lt;!-- safety-scan-worked-example:end -->

## Sources

- `docs/reference/model-catalog.md` (the living deployed / available / evaluated / rejected image-model list this methodology maintains)
- `docs/research/SPIKE-01-image-model.md` (MAI image family and lifecycle, cost mechanics, style-matching surface, canvas math, rate-limit ladder, RAI and provenance)
- `docs/research/SPIKE-12-image-video-alternatives.md` (broader catalog: FLUX family GA and in-region, GPT-image out-of-region and realism-biased, token-metered cost UNKNOWN until measured)
- `docs/adr/ADR-0005-identity-and-secrets.md` (keyless Entra, managed-identity-first data-plane access)
- `docs/adr/ADR-0006-cost-governance.md` (resource-group budget guardrail)
- `ai/verification/environment-readiness.md` (which models are confirmed in the live target catalog)
- Deploy and use MAI image models in Microsoft Foundry (preview): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
- Deploy and use FLUX models in Microsoft Foundry: <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux>
- Foundry Models sold by Azure (capability tables, canvas rule, image families): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure>
- Region availability for Foundry Models sold by Azure (per-family region gates): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability>
- Model retirement schedule (Preview churn, GA no-retirement): <https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirement-schedule>
- Azure OpenAI image generation models, Models and capabilities (GPT-image region, realism bias, access gates): <https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e#models-and-capabilities>
- Introducing MAI-Image-2.5 (Arena ranks, stylization gains): <https://microsoft.ai/news/introducing-mai-image-2-5/>
