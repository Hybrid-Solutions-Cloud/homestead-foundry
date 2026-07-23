# ADR-0010: FLUX image models adopted alongside the MAI-Image baseline

- Status: Accepted (retroactive)
- Date: 2026-07-12 (the deployment date this ADR records)
- Authored: 2026-07-23 (this ADR was written after the fact to close a
  documentation gap: the FLUX models were deployed and in production before
  this repo's spike-then-ADR discipline caught up to them)
- Decider: repo owner

This is a **retroactive** ADR. The decision it records was made and deployed on
2026-07-12; ADR-0002 (`docs/adr/ADR-0002-image-model-and-access.md`) then covered
only MAI-Image-2.5 and made no mention of FLUX at all. This ADR closes that gap.
It authorizes no new work; it documents a decision already live on the Foundry
resource so the written record matches the running system.

## Context

ADR-0002 adopted MAI-Image-2.5 (Preview) as the first-party scene-art model and
recorded a reusable method for selecting and accessing an Azure AI Foundry image
model. In use, that single-model roster proved insufficient for the decisive
requirement: holding a consistent, non-photorealistic illustrated house style
and keeping characters consistent across many frames. MAI-Image-2.5, driven
text-only (no reference-image input wired into the generation path), could not
anchor to existing gold-standard frames, so style and character identity drifted.
The ADR-0002 API analysis already flagged the root cause: the documented MAI
request surface exposes only `model`, `prompt`, `image` (edits), `width`, and
`height`, with no seed, no mask, no negative prompt, and no dedicated
style-reference or multi-reference input, so style-lock is prompt-only and
non-reproducible.

A research spike (`docs/research/SPIKE-12-image-video-alternatives.md`, and the
original source research it generalizes) surveyed the catalog for a model that
supplies the missing capability, in-region, without an access application. The
forces this decision had to reconcile generalize to any Azure AI Foundry
style-lock image workload:

- **Multi-reference conditioning is the missing capability, not raw quality.**
  The failure mode was character and style drift, which is solved by feeding
  locked character sheets plus a style anchor into each generation. The MAI
  surface has no reference-image conditioning input for that; the FLUX family
  does. Source: `docs/research/SPIKE-12-image-video-alternatives.md` (Q1, Q3).
- **In-region, no-application deployability is a hard constraint.** The realistic
  switch candidates must deploy on the existing East US AIServices resource with
  no region change and no limited-access application. The FLUX family
  (FLUX.2-pro, FLUX.1-Kontext-pro, FLUX-1.1-pro, and FLUX.2-flex) is Global
  Standard in every Americas region including East US and is GA with no
  retirement date. The GPT-image family, by contrast, is East US 2 / West US 3
  only (out of region for an East US account) and its lower tiers require a
  limited-access application, and it is realism-optimized, the wrong bias for a
  non-photorealistic house style. Source:
  `docs/research/SPIKE-12-image-video-alternatives.md` (Q1, Q4).
- **A tiered FLUX roster matches the range of jobs.** No single FLUX model is
  right for every task: multi-reference character-and-style locking, single
  reference character edits, and fast low-stakes style exploration are distinct
  needs with distinct cost and output-size envelopes. This argues for adopting a
  small set, not one model.
- **The MAI baseline is worth keeping, not deleting.** MAI-Image-2.5 remains the
  first-party, in-region fallback and an A-B baseline. Adopting FLUX augments the
  ADR-0002 decision; it does not reverse it.
- **Cost mechanics stay UNKNOWN until measured, same as ADR-0002.** FLUX bills on
  the Foundry token-metering model (per token in and out, no charge for the
  resource or deployment itself), but the exact per-token / per-image rate is not
  published on a rendered first-party page and must be read live in the Foundry
  portal at deploy time. Source:
  `docs/research/SPIKE-12-image-video-alternatives.md` (Q4).

### Related decisions and cross-references

- **ADR-0002** (`docs/adr/ADR-0002-image-model-and-access.md`) is the baseline this
  ADR augments: MAI-Image-2.5 is retained as first-party fallback and A-B
  baseline, not superseded.
- **Reviewer-LLM candidates are out of scope here.** Two vision-capable reviewer
  models, `gpt-5.6-terra` (OpenAI) and `grok-4-1-fast-reasoning` (xAI), are
  separately researched in `docs/research/SPIKE-10-latest-gpt-model.md` and
  `docs/research/SPIKE-11-newer-grok-model.md` and tracked in the model roster as
  **planned and gated, not deployed**. This ADR writes no decision for them; the
  cross-reference marks where that thread lives so a reader does not mistake this
  FLUX record for a reviewer-LLM decision.
- **FLUX.2-flex is available but not adopted here.** SPIKE-12 confirms it is GA
  and deployable in East US (10 reference slots vs 8) but rates its added value
  as marginal for wordless scene art and says it would need its own ADR. This ADR
  covers only the three FLUX models that were actually deployed.

## Decision

**Adopt three FLUX image models, deployed as Global Standard on the existing
shared East US AIServices resource, as the primary scene-art roster, with
MAI-Image-2.5 retained as the first-party fallback and A-B baseline.** The three:

1. **FLUX.2-pro, the primary generator.** Multi-reference conditioning (up to 8
   reference images) plus up to 4 MP output and the best fidelity of the family.
   This directly supplies the character-and-style-lock capability the MAI
   text-only path lacked: locked character sheets and a style anchor are fed into
   each generation. This is the model that carries the main workload.
2. **FLUX.1-Kontext-pro, the single-reference companion.** In-context editing
   anchored to one reference image (1 MP cap), used for single-reference
   character edits where the whole point is to hold one identity or look stable
   across an edit rather than composing from many references.
3. **FLUX-1.1-pro, the fast exploration arm.** Text-only, no reference lock, the
   cheapest and fastest FLUX; used for quick style exploration and low-stakes
   passes, not for locked-character final frames.
4. **MAI-Image-2.5 retained (ADR-0002), not removed.** It stays deployed as the
   first-party, in-region fallback and A-B baseline. FLUX becomes primary; MAI is
   the safety net and comparison point.

Access and deployment discipline carries over unchanged from ADR-0002:

5. **Version pinned at deploy and re-checked, never hardcoded.** Re-query the
   live model catalog (`az cognitiveservices model list --location <region>`) at
   deploy time and deploy the then-current version. All four FLUX models are GA
   with no published retirement date, which is a lower churn risk than the
   Preview MAI line, but the re-query discipline still applies.
6. **Keyless Entra data-plane access, no image key stored.** Consistent with
   ADR-0002 and ADR-0005, image inference uses Entra ID token auth
   (DefaultAzureCredential) through a data-plane role, with access granted via a
   security group. Any FLUX endpoint secret, if one is required by the consuming
   pipeline, lives only in the tenant Key Vault, never in a committed file.
7. **Cost measured, not guessed, before any batch.** Treat per-image cost as
   UNKNOWN until measured: read the live per-token rate in the Foundry portal at
   deploy time and run a small cost probe before authorizing bulk generation. The
   resource-group budget alert from ADR-0006 remains the guardrail and the
   pipeline's own spend ledger remains the hard cap; bulk image generation stays
   owner-gated per this repo's hard rules.

## Consequences

**Positive.**
- Supplies the one capability the MAI baseline structurally lacked
  (multi-reference conditioning for character and style lock), which was the
  decisive failure axis for a consistent illustrated house style.
- Deploys entirely in-region on the existing shared AIServices resource, with no
  region change, no second resource, and no limited-access application.
- All three FLUX models are GA with no published retirement date, a lower
  lifecycle-churn risk than the Preview MAI line the roster started on.
- A tiered roster (multi-reference primary, single-reference companion, fast
  exploration arm) matches the range of real jobs, and keeping MAI as fallback
  preserves a first-party A-B baseline.

**Negative / trade-offs.**
- The roster is now four image models instead of one, so deployment, cost
  tracking, and pipeline model-selection logic all carry more surface area.
- FLUX per-image cost is UNKNOWN until measured; FLUX is a token-metered add on
  top of the MAI baseline cost, so the image line item grows and must be watched
  against the ADR-0006 budget.
- Output-size ceilings differ across the roster (FLUX.2-pro up to 4 MP,
  FLUX.1-Kontext-pro and FLUX-1.1-pro lower), so canvas and cover-size choices
  are per-model, not uniform.
- This record was written after deployment (retroactive), so the spike-then-ADR
  ordering this repo prefers was not followed for the original decision; the
  follow-ups below reconcile the written record to the running system.

**Follow-ups.**
- Run the per-image cost probe on FLUX.2-pro before any batch and record real
  tokens-per-image and cost-per-image, the same probe ADR-0002 specified for MAI.
- Re-query the catalog at each deploy and keep the deployed versions matched to
  the live GA versions.
- Reconcile the model registry and the as-built record so the deployed FLUX
  roster is captured in the durable as-built inventory, not only in the backlog
  roster (the model roster) and the schema-example registry.
- If a 10-reference A-B arm is ever wanted, evaluate FLUX.2-flex under its own
  ADR per SPIKE-12; do not add it silently.

## Alternatives considered

- **Stay on MAI-Image-2.5 alone (the ADR-0002 status quo).** Rejected: driven
  text-only it could not hold the illustrated house style or keep characters
  consistent, and its documented API exposes no reference-image or
  multi-reference conditioning to fix that. MAI is retained as fallback, not as
  the sole model.
- **Deploy a GPT-image model instead.** Rejected: the GPT-image family is out of
  region for an East US account (East US 2 / West US 3 only), its lower tiers
  need a limited-access application, and every variant is realism-optimized with
  face preservation, the opposite of the non-photorealistic house style required.
  Source: `docs/research/SPIKE-12-image-video-alternatives.md`.
- **Adopt only FLUX.2-pro (a single-model switch).** Rejected: single-reference
  character edits and fast low-stakes exploration are distinct jobs with
  different cost and output-size envelopes; FLUX.1-Kontext-pro and FLUX-1.1-pro
  cover those without over-driving the primary model.
- **Also deploy FLUX.2-flex now.** Deferred: SPIKE-12 rates its added value
  (10 vs 8 reference slots, guidance/steps control) as marginal for wordless
  scene art and says it needs its own ADR. It is not part of this decision.
- **Delete MAI-Image-2.5 once FLUX is primary.** Rejected: MAI is the first-party
  in-region fallback and A-B baseline; removing it would lose a cheap comparison
  point and a safety net for no benefit.
- **A custom FLUX-family LoRA / fine-tune for the house style.** Rejected for
  now: Azure has no first-party image-model fine-tuning path (managed LoRA is
  text/LLM only), and off-Azure training is a separate-infrastructure,
  separate-governance departure. Multi-reference conditioning is tried first;
  a custom model is a later option only if it proves insufficient.

&lt;!-- safety-scan-worked-example:start -->
## Worked example: the first proven build

This ADR was first written and decided for this repo's first proven build, which
serves the Gunner the Lab (gunnerthelab.com) and Holdfast Press StoryReader
brands. The concrete instantiation of the decision above:

- **Target resource.** The three FLUX models plus the retained MAI baseline are
  deployed on the East US AIServices account `aif-studioai-prod-eus-01` (resource
  group `rg-studioai-prod-eus-01`, subscription "This Is My Demo - MVP
  Subscription"), the same shared resource that serves MAI-Voice-2 (ADR-0003).
- **Deployment names.** `flux-2-pro` (FLUX.2-pro, primary), `flux-1-kontext-pro`
  (FLUX.1-Kontext-pro, single-reference edits), `flux-1-1-pro` (FLUX-1.1-pro,
  fast exploration), with `mai-image-25` (MAI-Image-2.5) kept as the first-party
  fallback and A-B baseline. All GlobalStandard.
- **Why the switch.** MAI-Image-2.5, driven text-only in the generation path,
  failed on the two axes that mattered: it did not hold the graphite crosshatch,
  colored-pencil, single-spot-color children's-book house style, and characters
  drifted (a locked character rendered as the wrong species, an invented extra
  character, and object-count / anatomy errors). Feeding locked character sheets
  plus a graphite style anchor into FLUX.2-pro's multi-reference conditioning
  (up to 8 images) is what closed that gap.
- **Source research.** The original stay-or-switch recommendation (pilot
  FLUX.2-pro with FLUX.1-Kontext-pro for single-reference edits, keep
  MAI-Image-2.5 as a cheap fallback) came from the character-and-illustration
  research in the `gunnerthelab/gunner-studio/characters/` studio repo and is
  generalized, brand-neutral, in `docs/research/SPIKE-12-image-video-alternatives.md`.
- **Consuming pipeline.** The operational generator lives in the
  `gunnerthelab/gunnerthelab.github.io/tools/` reader-app repo (a `mai-image.mjs`
  style tool that calls the FLUX `images/generations` and `images/edits`
  endpoints and passes archived gold-standard frames as reference images). Its
  FLUX endpoint secret is the tenant Key Vault secret named
  `studio-foundry-flux-image-key`; the value is never printed or committed.
&lt;!-- safety-scan-worked-example:end -->

## Sources

- `docs/adr/ADR-0002-image-model-and-access.md` (the MAI-Image-2.5 baseline this
  ADR augments, the thin-API / no-reference-input finding that explains the
  style-lock failure, and the deploy-time re-query and cost-probe discipline
  carried forward here)
- `docs/research/SPIKE-12-image-video-alternatives.md` (in-repo, brand-neutral: the
  FLUX family is GA and Global Standard in East US, multi-reference conditioning
  as the capability the MAI surface lacks, GPT-image out-of-region and
  realism-biased, FLUX.2-flex available but marginal and needing its own ADR, and
  token-metered cost with exact rates UNKNOWN until read live)
- `docs/research/SPIKE-01-image-model.md` (the MAI image family lifecycle, cost
  mechanics, and the documented request surface with no reference-image or
  multi-reference input)
- the model roster (the authoritative post-Phase-9 model roster recording
  `flux-2-pro`, `flux-1-kontext-pro`, and `flux-1-1-pro` as DEPLOYED and
  MAI-Image-2.5 as retained fallback, plus the planned-and-gated reviewer-LLM
  pair cross-referenced above)
- `models/registry.example.json` (the brand-neutral registry schema example
  showing how a deployed image model is recorded; the real deployment names live
  in the model roster and the Worked example above)
- `docs/adr/ADR-0005-identity-and-secrets.md` and
  `docs/adr/ADR-0006-cost-governance.md` (the keyless-Entra data-plane access model
  and the resource-group budget guardrail this decision inherits unchanged)
