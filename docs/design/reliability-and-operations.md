# Design: reliability and operations

- Status: draft for review
- Date: 2026-07-11 (rewritten brand-neutral 2026-07-21, D-03/D-16)
- Author: foundry-architect (Fable)
- WAF pillars: Reliability and Operational Excellence (each control below names its pillar)
- Grounded in: ADR-0002 (image model), ADR-0003 (voice model), ADR-0004 (topology), ADR-0006 (cost governance); supporting references to ADR-0001 (fallback path) and ADR-0008 (pipeline invariants)
- Companion docs: `architecture-overview.md`, `resource-topology-and-caf-naming.md`, `performance-efficiency.md`
- Scope note: this document describes the general reliability and operations methodology for a publish-time Azure AI Foundry workload, using CAF-shaped placeholder names (`<workload>`, `<env>`, `<region>`, `<brand>`, and similar). A closing "Worked example" section restates the same methodology with the concrete, already-deployed instance's real names, as proof the pattern runs in production.

---

## 1. The availability model: who actually depends on Azure being up

The single most important reliability fact of this design: readers never depend on Azure AI availability. Both models are called only at publish time, from a developer workstation, and every produced asset is pre-rendered into Cloudflare R2 or the site repo under immutable keys (ADR-0008 via ADR-0004 topology). The dependency graph is:

| Consumer | Depends on | Does NOT depend on |
| --- | --- | --- |
| Readers (every served brand's PWA and site) | R2, Cloudflare Workers, the marketing origins | `ais-<workload>-<env>-<region>-01`, either MAI model, Azure at all |
| Read-along highlight | Narrator audio and timings from the existing, proven-track account's output already in R2 | MAI-Voice-2 (variants are listen-only, ADR-0003) |
| Publish runs (operator-driven) | `ais-<workload>-<env>-<region>-01` (MAI calls), the proven-track account (narrator), R2 uploads | Any 24/7 uptime commitment; a failed run is retried, not paged |

Consequence (WAF Reliability): the workload's recovery objective for the Azure surface is measured in "when can the next publish run succeed," not in user-facing downtime. There is no on-call surface. A preview outage during a run means the run stops and is re-run later; published content keeps serving unchanged.

## 2. Preview and no-SLA risk

Both MAI-Image-2.5 and MAI-Voice-2 are Preview: no SLA, and weights, API schema, voices, regions, or names can change before GA (ADR-0002, ADR-0003). Accepted by the owner, with these designed mitigations:

- Pre-render insulation (Reliability). A live model outage, region move, or voice rename never reaches a listener or reader; it only blocks new generation until resolved (ADR-0003 consequence, ADR-0008 architecture).
- Blast-radius isolation of the proven track (Reliability). The narrator and read-along pipeline stays on the existing, already-proven-track account and is untouched; the preview stack is additive on a separate account, so a preview regression cannot degrade what already works (ADR-0004).
- Listen-only v1 for MAI voices (Reliability). WordBoundary support for MAI-Voice-2 is undocumented and inconsistent across sibling families, so the word-sync highlight never rides on it; variants ship with empty word arrays until the spike proves otherwise (ADR-0003).
- Documented fallbacks, in order (Reliability):
  - Voice quality or availability fails: Dragon HD Omni voices on the GA surface are the recorded fallback voice family (ADR-0003 alternatives).
  - Image model version churn: redeploy the then-current version under the same deployment name, `<image-deployment-name>` (ADR-0002; section 3).
  - Primary subscription becomes unusable: the fallback subscription path exists but is gated on the three read-only pre-checks of ADR-0001 (inherited-policy enumeration, silent-mutation policy scan, what-if preflight), with a region forced to `eastus2` treated as a hard blocker because MAI-Image-2.5 is not offered there.
- Re-verify at GA (Operational Excellence). Retention, residency, and preview privacy practices are the documented steady state and are re-checked when either model reaches GA (ADR-0004 consequence).

## 3. Version pinning and the 2026-09-01 re-check

Preview model versions churn; the design absorbs churn without caller changes (Operational Excellence):

1. Never hardcode the model version. At deploy time, re-query `az cognitiveservices model list --location <region>` and deploy the then-current MAI-Image-2.5 version (2026-06-02 today) (ADR-0002 decision 1).
2. The CLI metadata for version 2026-06-02 carries an inference date of 2026-09-01, read as a version-churn signal, not model end-of-life (MAI-Image-2.5 is absent from the published retirement schedule). Operational rule: re-verify the catalog around and after 2026-09-01 and redeploy if a newer dated version has superseded the current one (ADR-0001 follow-up, ADR-0002).
3. The deployment name `<image-deployment-name>` is version-free, so a redeploy is invisible to the image generation tool, which passes the deployment name as the `model` parameter.
4. Never deploy MAI-Image-2 or MAI-Image-2e: both retire 2026-08-15, and a retired model returns 410 Gone on every call (ADR-0002).
5. Voice has no version pin because it has no deployment; the operational equivalents are the two token confirmations (the exact locale identifier for the chosen voice and the accepted spelling of its expressive style, for example `<voice-name>` and `<style-token>`), locked at spike time before they enter the per-brand config file (ADR-0003 decision 5).

## 4. Rate limits, retries, and request shaping

### 4.1 Image surface (10 requests per minute, Tier 5)

- The deployed tier is Global Standard Tier 5: 10 RPM for MAI-Image-2.5 (and the same for 2.5-Flash), confirmed live in the primary subscription. Limits are enforced over short sub-minute windows, so bursts trigger 429 even under the per-minute average (ADR-0002 grounding).
- Design rules for `tools/mai-image.mjs` (Reliability):
  - Pace calls evenly at or above one call per 6 seconds rather than bursting.
  - On 429, retry with exponential backoff and honor any server-provided retry hint; a 429 is always retryable.
  - On 400 for a canvas violation, do not retry: it is deterministic. The tool validates size client-side first (minimum 768 per dimension, width times height at most 1,048,576; standard canvas 1248x832) (ADR-0002).
  - Each call produces exactly one image (no candidate-count parameter), so candidate calls are independent; a failed call is retried alone without invalidating completed work.
- Tier 6 caps at 12 RPM, so a quota increase buys little; request one only if backfill throughput becomes a real constraint (ADR-0002 follow-up). Throughput math lives in `performance-efficiency.md`.

### 4.2 Speech surface (S0, 200 transactions per second default)

- S0's default 200 TPS is a per-resource service limit and is not the binding constraint: the pipeline synthesizes sequentially, block by block (ADR-0004 grounding). The binding shapes are:
  - The 10-minute audio cap per request: chapters exceed it, so the pipeline synthesizes per block and stitches with ffmpeg on the publish machine. This is an existing invariant, and it is also the reason on-demand worker synthesis was rejected (ADR-0008 via ADR-0003 grounding).
  - The 64 KB SSML message cap per turn, respected by block sizing.
- 429 or transient synthesis errors: retry the block with backoff; blocks are independent and the stitch runs only when all blocks of a chapter exist (Reliability).
- The existing 3.1-second inter-request spacing is an F0-era guard for the proven-track narrator account (20 transactions per 60 seconds). MAI variant calls to the S0 account may relax it via the per-voice options bag; the narrator path keeps its spacing (two-resource split, ADR-0004).
- Real-time TTS behavior for preview MAI voices may throttle differently than documented; the backfill treats any 429 as a pacing signal and backs off (SPIKE-02 unknown carried into operations).

### 4.3 Upload and publish ordering (existing invariants, restated as reliability controls)

- R2 uploads retry with a 4-attempt backoff.
- The manifest is always uploaded last, with a short 60-second cache, after every immutable asset it references; readers can never observe a manifest that points at a missing object (ADR-0008). WAF Reliability.
- All asset keys are content-hashed and immutable, so a re-run after any failure is idempotent: complete work is skipped by hash, missing work is regenerated. The backfill is resumable at any point (ADR-0008; the voice-aware `variantHash` gates variant work).

## 5. Monitoring and alerting

The decided monitoring surface is cost-centric plus pipeline-native (ADR-0006). Each control names its layer honestly: only the first stops spend before it happens.

| Layer | Control | Behavior | Pillar |
| --- | --- | --- | --- |
| 1. Real cap (synchronous, pre-spend) | `--mai-budget-usd` guard and `maiLedger` in `publish.mjs` (default 100 USD once the credit resets; deliberately lifted during the credit-burn window). Voice enforcement is exact (characters known pre-call); image enforcement uses a conservative high tokens-per-image until the smoke test measures the real number | Refuses the call before money is spent | Cost Optimization, Reliability |
| 2. Backstop (reactive, notify-only) | `budget-<workload>-<env>-<region>-01` scoped to `rg-<workload>-<env>-<region>-01`, 100 USD monthly; actual alerts at 50, 75, 90, 100 percent plus forecasted at 100 percent, wired to one action group emailing the owner | Evaluated roughly once per day; emails can lag up to 24 hours; detects, never prevents | Operational Excellence |
| 3. Credit backstop (hard, invoice-side) | Azure spending limit stays ON | Auto-disables the subscription at the credit ceiling instead of invoicing; removed only by a deliberate owner election of pay-as-you-go | Cost Optimization |
| Credit burn-down watch | Subscription-scoped budget at the credit amount plus scheduled daily or weekly Cost Analysis emails off a saved RG view grouped by Meter (credit alerts are Enterprise-Agreement-only and unavailable here) | Visibility without portal visits during the burn push | Operational Excellence |
| Pipeline telemetry | The ledger prints per run (month, characters, estimated USD); `mai-image.mjs` logs token counts off the first responses and every content-filter refusal | The per-brand and per-model record Azure cannot provide (tags cannot split brands on one shared account) | Operational Excellence |

Monthly reconciliation: compare `maiLedger` totals against the RG meters in Cost Analysis; investigate drift beyond the image-estimate tolerance (Operational Excellence, ADR-0006 tag-and-ledger split).

## 6. Operating rhythm for an offline, publish-time workload

There is no standing service, so operations are calendar- and event-driven (Operational Excellence):

| When | Action | Ground |
| --- | --- | --- |
| Before any resource create | Owner confirmation (every `az` write is gated); names validated; budget created before any spend; tags applied before backfill (not retroactive) | MASTER-PLAN guardrail, ADR-0006 |
| Deploy time | Re-query the model catalog and deploy the current version; read the live image rate card in the Foundry portal (the published figures are unconfirmed); verify the voice meter on the Speech pricing page | ADR-0002, ADR-0006 follow-ups |
| First metered calls | Run the two-call cost probe; record tokens-per-image; replace the conservative ledger assumption with the measured value before any bulk run | ADR-0002 decision 5, ADR-0006 |
| Before variant code lands | The roughly 30-minute voice spike on the new account: WordBoundary behavior, output-format acceptance (48 kHz 96 kbps MP3, fallback 24 kHz 160 kbps), AIServices key against the regional endpoint, exact voice identifier, expressive-style token spelling | ADR-0003, ADR-0004 follow-ups |
| During the pilot | Log every content-filter refusal as a prompt-engineering signal (children-present, hand-drawn prompts); verify empirically whether outputs carry C2PA credentials | ADR-0007 follow-ups (operational habit recorded here) |
| Around 2026-09-01 | Catalog re-check and possible redeploy of `<image-deployment-name>` (section 3) | ADR-0001, ADR-0002 |
| At credit reset | Confirm the offer type and reset date in Cost Management plus Billing; set `--mai-budget-usd` back to 100 | ADR-0006 follow-ups |
| At GA of either model | Re-verify retention, residency, rate card, and SLA posture | ADR-0004, ADR-0006 |
| Every publish run | Ledger prints; manifest-last ordering; hash-gated idempotent re-render | ADR-0008 invariants |

Sequencing note (Operational Excellence): when more than one brand or site repo carries its own copy of the publish script, drifted copies are reconciled in a standalone commit per repo before any MAI feature work; an older, non-voice-aware copy still running against an existing content catalog would otherwise mishash the backfill (ADR-0008).

## 7. Failure modes and responses

| Failure | Detection | Response | Reader impact |
| --- | --- | --- | --- |
| 429 storm on image calls | Tool logs, retry counter | Back off, keep pacing at or under 10 RPM, resume; consider Tier 6 only if chronic | None |
| Content-filter refusal on a prompt | Tool logs the refusal | Rephrase per ADR-0007 habits (hand-drawn framing, genericized trademarks); log as signal | None |
| Model version superseded (2026-09-01 signal) | Deploy-time and scheduled catalog re-query | Redeploy current version under `<image-deployment-name>`; callers unchanged | None |
| MAI voice renamed, moved, or degraded (preview) | Publish run fails or audio review fails | Pause variant generation; narrator track unaffected; fall back per section 2 if durable | None (existing audio keeps serving) |
| Publish run dies mid-backfill (network, machine) | Operator observes | Re-run; hashes skip completed work; manifest was not yet updated, so readers saw nothing partial | None |
| R2 upload flakes | Uploader retry logs | 4-attempt backoff already in place; re-run if exhausted | None |
| Budget alert fires (50 to 100 percent) | Action-group email | Check ledger versus meters; stop batches if a runaway is confirmed; the pipeline guard should already have stopped it | None |
| Credit exhausted | Subscription auto-disables (spending limit ON) | Publishing pauses until the next period; published assets in R2 and the sites keep serving; re-enable next cycle | None |
| Primary subscription unusable long-term | Owner decision | Activate the ADR-0001 fallback only after its three read-only pre-checks pass; `eastus2`-forced region is a hard blocker | None |

The uniform "None" column is the designed outcome of pre-render (ADR-0008) and is the reliability core of this architecture.

## 8. Gaps the ADRs leave open (recorded, not filled)

1. No ADR decides Azure Monitor diagnostic settings, a Log Analytics workspace, or metric alerts (for example sustained 429 rate or synthesis error rate) on `ais-<workload>-<env>-<region>-01`. The decided monitoring is cost-only (ADR-0006) plus pipeline logs. If run-level telemetry beyond logs is wanted later, that is a new decision, not an implication of the current ADRs.
2. No ADR defines backup or replication for the generated assets beyond their natural durability (R2 objects plus committed PNGs and provenance in git). Acceptable because every asset is regenerable from source markdown and prompts, but regeneration of images is non-deterministic (no seed, ADR-0002), so a deleted published image is not exactly reproducible. Retention of R2 buckets and repos is governed outside this initiative.
3. No ADR sets an explicit availability target for publish runs (reasonable for an operator-driven batch, recorded for completeness).
4. Whether MAI Foundry Models bill as credit-eligible first-party usage is a reasonable read but unverified until the first metered runs; if wrong, layer 3's credit backstop weakens and the owner is notified via layer 2 (ADR-0006 grounding, SPIKE-03 unknown).

&lt;!-- safety-scan-worked-example:start -->

## Worked example: Brand A / Brand B

Everything above is the general pattern. This section restates it as the concrete, already-deployed instance that proves the pattern runs in production today, serving the two brands this initiative was first built for: Brand A and Brand B.

| Placeholder in the general methodology | Real value in this deployment |
| --- | --- |
| `ais-<workload>-<env>-<region>-01` (the Foundry AIServices account) | `aif-<workload>-<env>-<region>-01` |
| `rg-<workload>-<env>-<region>-01` | `rg-<workload>-<env>-<region>-01` |
| `budget-<workload>-<env>-<region>-01` | `budget-<workload>-<env>-<region>-01` |
| The existing, proven-track narrator account | the legacy narrator Speech resource, the account behind Brand B's reader-app read-along experience |
| `<image-deployment-name>` | `mai-image-25` |
| `<voice-name>` (exact locale identifier confirmed at spike time) | Lisa (en-AU) |
| `<style-token>` (expressive style confirmed at spike time) | `excited` |
| Each served brand's PWA and site | Brand A and Brand B, each with its own site repo |
| "An older, non-voice-aware copy still running against an existing content catalog" | Brand A's copy of `publish.mjs`, run against its 42-story catalog, which had not yet picked up the voice-aware hashing change at the time this gap was recorded |

Section 1's dependency graph, in concrete terms: neither Brand A's nor Brand B's readers depend on `aif-<workload>-<env>-<region>-01`, MAI-Image-2.5, or MAI-Voice-2 being available; both sites keep serving unchanged through a preview outage because every asset is pre-rendered to R2 before either brand's readers ever see it. Brand B's read-along highlight depends only on the legacy narrator Speech resource's output already in R2, never on the MAI voice path (listen-only v1, ADR-0003).

Section 5's monitoring surface is live today as `budget-<workload>-<env>-<region>-01` scoped to `rg-<workload>-<env>-<region>-01`, with the pipeline's own `maiLedger` in `publish.mjs` as the pre-spend guard.

&lt;!-- safety-scan-worked-example:end -->

## Sources

- `docs/adr/ADR-0002-image-model-and-access.md` (version pinning, 2026-09-01, canvas cap, tier ladder, retirement facts)
- `docs/adr/ADR-0003-voice-model-and-voice-set.md` (preview risk, listen-only v1, spike gates, fallback voice family)
- `docs/adr/ADR-0004-foundry-topology-and-region.md` (two-resource isolation, S0 200 TPS, custom subdomain, GA re-verify)
- `docs/adr/ADR-0006-cost-governance.md` (three-layer enforcement, budget mechanics and latency, ledger reconciliation, credit watch)
- `docs/adr/ADR-0001-target-tenant.md` (fallback pre-checks, eastus2 blocker, spending-limit mechanics)
- `docs/adr/ADR-0008-publish-pipeline-integration.md` (pre-render invariants, manifest-last, hashes, reconciliation-first)
- `docs/research/SPIKE-01-image-model.md` and `docs/research/SPIKE-02-voice-model.md` (429 behavior, sub-minute enforcement, quotas: 10-minute cap, 64 KB SSML, S0 TPS)
- `ai/verification/environment-readiness.md` (live tier observation, deployment prerequisites)
