# Design: performance efficiency

- Status: draft for review
- Date: 2026-07-11 (genericized 2026-07-21)
- Author: foundry-architect
- WAF pillar: Performance Efficiency (with Cost Optimization named where a choice serves both)
- Grounded in: ADR-0002 (image model, canvas, tiers), ADR-0003 (voice model, limits), ADR-0008 (publish-time pre-render and pipeline shape); supporting references to ADR-0004 (S0 throughput) and ADR-0006 (cost bands the throughput math reuses)
- Companion docs: `architecture-overview.md`, `resource-topology-and-caf-naming.md`, `reliability-and-operations.md`

This document describes the general performance-efficiency methodology for any Azure AI Foundry build following this pattern: one image model and one voice model, publish-time pre-rendering, and a metered, budget-guarded backfill. Section headings and mechanisms are brand-neutral; the closing **Worked example** section restates the one real, deployed instance this methodology was built and measured against.

---

## 1. The performance model: all latency is paid at publish time

The design's central Performance Efficiency decision is inherited from ADR-0008: every AI-generated asset is pre-rendered at publish time and served statically. Runtime performance is therefore decoupled from model performance entirely:

- Readers fetch immutable, content-hashed objects from object storage (a long-lived, immutable cache profile) and a small manifest (a short, near-real-time cache profile), so repeat loads ride the edge cache and offline-first downloads work with no synthesis wait.
- Scene art is hotlinked from the origin site inside the content JSON, so a regenerated scene is as fast as any static site image and needs no republish (ADR-0008).
- No user-facing operation ever waits on an image quota or a synthesis request. Model latency, rate limits, and preview slowness are absorbed entirely by the operator-driven publish run.
- The corollary: "performance work" in this initiative means throughput of the offline backfill and efficiency of each metered call, which the rest of this document quantifies.

Rejected for performance as much as for reliability: on-demand synthesis (long-form audio exceeds a typical per-request duration cap, and edge/serverless runtimes cannot run an ffmpeg-class stitcher), so runtime generation is not a fallback path either (ADR-0008 alternatives).

## 2. The capacity envelope (what the platform will accept)

| Surface | Limit | Source of the number | Design response |
| --- | --- | --- | --- |
| Image, primary model, Global Standard (the image deployment on the shared AI Services account, CAF pattern `ais-<workload>-<env>-<region>-<instance>`) | 10 requests per minute (Tier 5, observed live in the primary subscription); enforced over sub-minute windows, bursts return 429 | ADR-0002 | Pace the image-generation caller at or above 6 seconds per call; retry 429 with backoff |
| Image, tier ceiling | Tier 6 is 12 RPM, the ladder's top for the primary model and its bulk variant | ADR-0002 follow-up | A quota request buys at most 20 percent more throughput; request only if backfill wall-clock becomes a real constraint |
| Image, per call | Exactly one image per call; no candidate-count, seed, mask, or negative-prompt parameter | ADR-0002 | Candidates are additional sequential calls; human review selects |
| Image, canvas | Each dimension at least 768; width times height at most 1,048,576 pixels | ADR-0002 | Standard canvas 1248x832; client-side validation before the call |
| Image, prompt | Prompts up to 32,000 tokens; typical prompts run 400 to 600 | ADR-0002 grounding (SPIKE-01) | Prompt-input cost and latency are a rounding error; no trimming needed |
| Voice, service throughput | S0 default 200 transactions per second, per resource | ADR-0004 | Never binding: the pipeline synthesizes sequentially per block |
| Voice, per request | 10 minutes of audio per request; 64 KB SSML per turn | ADR-0003 grounding (SPIKE-02) | Per-block synthesis plus ffmpeg stitch, the existing pipeline shape (ADR-0008) |
| Voice, legacy pacing | A legacy narration voice on an older tier account carries a multi-second inter-request spacing requirement | ADR-0008 grounding (SPIKE-06) | Calls on the newer, higher-throughput account can relax the spacing via the per-voice options bag, removing dead time between blocks; the legacy voice path keeps its own spacing |

Performance Efficiency note on the two-model asymmetry: image throughput is quota-bound (RPM), voice throughput is workload-bound (characters and blocks). The plans below treat them separately for that reason.

## 3. Canvas standard: 1248x832

Standardized by ADR-0002 decision 3; restated here with the arithmetic because it is a per-call efficiency decision:

| Canvas | Pixels | Versus the 1,048,576 cap | Ratio | Role |
| --- | --- | --- | --- | --- |
| 1248x832 | 1,038,336 | Fits, 10,240 under | Exactly 3:2 | The standard scene-art canvas |
| 1254x836 | 1,048,344 | Fits, 232 under | Exactly 3:2 | Largest exact 3:2 that fits; not chosen (no headroom) |
| 1152x768 | 884,736 | Fits, 85 percent of the standard's pixels | Exactly 3:2 | Candidate cheaper canvas, pending the token-scaling measurement below |
| 1264x848 (a legacy cover size) | 1,071,872 | Over by 23,296; returns 400 | 1.491 | Cannot be reproduced; visual delta from the standard is about 1 to 2 percent scale |

Whether output tokens (and therefore cost) scale with pixel count is unpublished. The smoke-test cost probe measures tokens-per-image at the standard canvas and at a second size for exactly this reason (ADR-0002 decision 5). If tokens do scale with pixels, 1152x768 offers roughly a 15 percent per-image saving for any art direction that tolerates the smaller canvas; until measured, all planning uses 1248x832. Performance Efficiency and Cost Optimization together.

## 4. Batching strategy

- Image: there is no server-side batching (one image per call, no `n`), so "batching" means client-side micro-batches paced to the RPM: per-collection batches for scene art, and a fixed small micro-batch (for example 20 images) the cost probe uses to divide a Cost Management meter delta (ADR-0002). Human candidate review between batches is deliberate, not waste: with no seed, selection is the quality-control step (ADR-0002).
- Voice: the unit of work is the speakable block; content synthesizes block by block and stitches. A hosted batch-synthesis API is deliberately not part of this design: ADR-0007 keeps the real-time path for its zero-retention property, batch-mode eligibility for the chosen voice model is unverified, and the real-time plus ffmpeg path is already proven (ADR-0003 and ADR-0008 grounding). If a future backfill's wall-clock ever matters enough to revisit, that is a new decision with a retention trade-off attached, not a tuning knob.
- Both: the ledger guard runs before each metered call, so batches never race past the budget (ADR-0006; per-call arithmetic is negligible).

## 5. Backfill throughput math

### 5.1 Image backfill (bounded by RPM)

Pilot phase (ADR-0002 scope): a small pilot batch (order of tens of calls) proves the API floor is fast in absolute terms. At the 10 RPM floor (6 seconds per call), even a full 20-call pilot completes in about 2 minutes of API time, so pilot duration is review-dominated, not API-dominated.

Full-catalog backfill: the shape is a simple formula, (scenes x candidates-per-scene) / RPM, converted to minutes at 6 seconds per call. The tier ladder changes the multiplier, not the shape:

| Tier | RPM | Effect vs Tier 5 |
| --- | --- | --- |
| Tier 5 (current, primary) | 10 | Baseline: sustained even pacing at 6 seconds per call |
| Tier 6 (ladder maximum) | 12 | About 20 percent faster; rarely worth a quota request for the time saved alone (ADR-0002 follow-up) |
| Tier 1 (fallback subscription default) | 2 | 5x slower than Tier 5; the reason a Tier 5-or-better subscription materially matters (ADR-0002 consequence) |

Interpretation: at Tier 5, a catalog of several hundred images stays well under an hour of API time even with retry overhead, spread into per-collection batches. Human review of candidates, not the API, is the schedule driver. The bulk variant of the image model changes none of these numbers because it shares the same RPM ladder (section 6).

Reconciliation practice: before authorizing a full-catalog backfill, reconcile the scene count against the prompt library. Different research spikes can phrase the same backfill scope differently (per-scene vs per-candidate counting is a common source of a 2x discrepancy), and a wrong count doubles both the time and cost estimate. Check this before the batch runs, not after (see the Worked example section for how this surfaced in production).

Cost bands the throughput plan carries (decided in ADR-0006, measured before use per ADR-0002): a per-image cost band on the primary model, and a lower band on its bulk (Flash-class) variant. Every figure scales linearly off the unmeasured tokens-per-image; a small (2-call) cost probe converts the bands to real numbers before any batch runs.

### 5.2 Voice backfill (bounded by character volume, priced by character rate)

The billable and plannable quantity is characters, known exactly before any call (this is what makes the voice budget guard deterministic, ADR-0006). At the voice model's per-character rate (ADR-0003), typical work items scale like this:

| Work item (shape) | Characters | Cost |
| --- | --- | --- |
| One collection's full catalog, per voice | Tens to hundreds of thousands | Characters x rate; a few dollars to low tens of dollars |
| A locked multi-voice backfill across every collection | Sum of the above x number of voices | A one-time cost in the tens of dollars |
| Ongoing: one new story unit, all voices | Tens of thousands | Well under a dollar to about a dollar |
| Ongoing: one new chapter unit, all voices | Tens of thousands | About a dollar |
| Typical month (one story plus one chapter) | Under 100,000 | A couple of dollars |

Throughput shape:

- The S0 service ceiling (200 TPS) is orders of magnitude above the sequential pipeline's request rate, so the service never gates the backfill.
- Wall-clock time is governed by per-block synthesis time plus ffmpeg stitching. The real-time synthesis factor for the chosen voice model should be measured on a short spike before a full backfill is scheduled, not assumed (gap noted in section 8).
- One measurable win generalizes across any deployment on this pattern: dropping legacy inter-request spacing for calls on a modern, higher-throughput account removes fixed dead time per block across the whole catalog (section 2).
- Storage and egress rarely gate anything if the object-storage tier's free egress and free-tier capacity comfortably covers a multi-voice, multi-collection build (verify per deployment).

Incremental efficiency rules (ADR-0008): a voices flag defaults to none/off so ordinary publishes pay nothing new; a voice-aware variant hash re-renders only missing or stale variants, so re-runs and partial failures never re-pay for finished audio; adding another voice later is a full catalog re-render for that voice only, a planned and bounded cost, not a redesign.

## 6. Bulk variant for scale

The bulk (Flash-class) variant of the image model is the designed bulk arm, strictly sequenced after the primary model wins the style pilot (ADR-0002 decision 4):

- What it buys: about 30 percent lower image-output cost (the dominant meter) and cheaper inputs; on a representative several-hundred-image catalog that is a real, bounded dollar saving (see the Worked example section for the measured figure, ADR-0006 basis).
- What it does not buy: throughput. The bulk variant sits on the same RPM ladder (10 RPM at Tier 5, 12 at Tier 6) as the primary model, so backfill wall-clock is identical. Performance Efficiency verdict: the bulk variant is a Cost Optimization lever only.
- Usage rule: the primary model for the pilot and all final published art; the bulk variant considered for large candidate sweeps and future bulk backfills only after it demonstrates the chosen art direction holds. Any generations-only, retiring model variant is not an option at any price once it is past its posted retirement date (ADR-0002).

## 7. Efficiency guardrails already built into the pipeline

| Guardrail | Effect | Ground |
| --- | --- | --- |
| Content and variant hashes gate all rendering | No asset is ever generated twice for the same input; backfills are incremental and resumable | ADR-0008 |
| Voices flag defaults off; the base narration path untouched | The expensive path runs only when explicitly requested | ADR-0008 |
| Ledger guard precedes every metered call | A runaway loop stops at the cap instead of saturating the quota | ADR-0006 |
| Conservative tokens-per-image assumption until measured | The image guard trips early rather than late while the real number is unknown | ADR-0006 |
| Cost probe before any batch | Converts per-image cost and pixel-scaling behavior from bands to measurements, sizing all future runs correctly | ADR-0002 |
| Even pacing rather than bursts | Avoids 429-retry churn that would waste the tiny RPM budget | ADR-0002 grounding |

## 8. Gaps the ADRs leave open (recorded, not filled)

1. Tokens-per-image is unpublished for the image model family, so every image cost figure above is a band until the smoke-test probe measures it (ADR-0002 treats this as measure-first, restated here because all throughput-cost planning hangs on it).
2. The real-time synthesis factor (wall-clock per synthesized minute) for the chosen voice model is undocumented; no ADR estimates it. Any voice backfill schedule cannot be committed until a short spike observes it.
3. Catalog-size discrepancies between research spikes (per-scene vs per-candidate counting) are a recurring, unreconciled risk class; whatever cost basis an ADR decides on should be reconciled against the prompt library before a backfill runs.
4. Whether output tokens scale with pixel count (and therefore whether the smaller candidate canvas is a real saving) is unknown until the two-size probe runs (ADR-0002 decision 5 defines the probe; the answer is pending).
5. Batch synthesis eligibility for the chosen voice model is unverified and unneeded by this design; recorded only so a future wall-clock optimization does not assume it exists (ADR-0003 grounding).

&lt;!-- safety-scan-worked-example:start -->

## Worked example: Gunner the Lab / Holdfast Press

Everything above is the general methodology. This section restates the one real, deployed instance it was built and measured against, as proof the pattern works in production.

- **Real resources:** the image deployment `mai-image-25` runs on the shared AI Services account `aif-studioai-prod-eus-01` (resource group `rg-studioai-prod-eus-01`, region East US), matching the CAF pattern in section 2 exactly.
- **Real capacity envelope:** the primary account observed Tier 5 (10 RPM) live; the fallback subscription default is Tier 1 (2 RPM), which is why keeping the primary subscription's Tier 5 mattered concretely (ADR-0002 consequence).
- **Real full-catalog backfill:** the ADR-0006 cost basis is about 170 scenes x 2 candidates = 340 images. At Tier 5, that is 340 calls x 6 seconds = 34 minutes of API floor; at Tier 6, about 28 minutes (6 minutes saved, not worth a quota request); at the fallback Tier 1, about 170 minutes, which is the concrete reason Tier 5 mattered.
- **The catalog-discrepancy gap, as it actually occurred:** SPIKE-01 phrased the same backfill as "roughly 340 scenes at 2 candidates each (about 680 calls)," while SPIKE-05 and the ADR-0006 cost bands use about 170 scenes x 2 candidates = 340 images. This design carried 340 images, the basis of the decided 17 to 68 USD cost band. If the catalog truly held 340 scenes, time and cost would double (68 minutes, 34 to 136 USD), which is why section 5.1's reconciliation practice exists as a named methodology step, not just a footnote.
- **Real cost bands (ADR-0006, measured via the two-call cost probe before use):** 0.05 to 0.20 USD per image on the primary model (17 to 68 USD for 340 images), 0.03 to 0.14 USD on the Flash variant (10 to 48 USD for 340 images); the Flash saving on this catalog is about 5 to 20 USD.
- **Real voice backfill figures (at 22 USD per 1M characters, the MAI-Voice-2 rate):**

  | Work item | Characters | Cost at 22 USD per 1M |
  | --- | --- | --- |
  | Gunner catalog, per voice (42 stories) | about 450,000 | about 9.90 USD |
  | Holdfast catalog, per voice (prologue plus chapter one) | about 31,630 | about 0.70 USD |
  | Locked three-voice backfill, both brands (Harper, Lisa, Ethan) | about 1,444,890 | about 32 USD one-time |
  | Ongoing: new Gunner story, three voices | about 33,000 | about 0.73 USD |
  | Ongoing: new Keepers chapter, three voices | about 48,000 | about 1.06 USD |
  | Typical month (one story plus one chapter) | about 81,000 | about 1.78 USD |
- **Real pacing win:** dropping the 3.1-second F0 spacing for MAI calls on the S0 account removed fixed dead time per block across the whole 42-story Gunner catalog.
- **Real storage fit:** the full three-voice build (Gunner plus Holdfast, all three voices) stays inside R2's free tier with free egress (SPIKE-05 grounding).
- **Real legacy-voice detail:** the 3.1-second inter-request spacing applied to the narrator's F0 account (20 transactions per 60 seconds); MAI variant calls on the S0 account relax this via the per-voice options bag, while the narrator path keeps its own F0 spacing.

&lt;!-- safety-scan-worked-example:end -->

## Sources

- `docs/adr/ADR-0002-image-model-and-access.md` (canvas math, parameter surface, tier ladder and Tier 6 ceiling, Flash sequencing, cost-probe design)
- `docs/adr/ADR-0003-voice-model-and-voice-set.md` (voice set, S0 and per-request limits, 22 USD per 1M characters)
- `docs/adr/ADR-0008-publish-pipeline-integration.md` (pre-render architecture, hashes, `--voices`, variant keys, ledger and guard placement, rejection of on-demand synthesis)
- `docs/adr/ADR-0004-foundry-topology-and-region.md` (S0 200 TPS default)
- `docs/adr/ADR-0006-cost-governance.md` (cost bands and rollups the throughput math reuses; guard defaults)
- `docs/research/SPIKE-01-image-model.md` (canvas table, RPM ladder, prompt-token context, 680-call phrasing noted in the Worked example)
- `docs/research/SPIKE-02-voice-model.md` (10-minute cap, 64 KB SSML, S0 TPS, F0 pacing origin)
- `docs/research/SPIKE-05-cost-governance.md` (catalog character counts, per-voice costs, 340-image basis, R2 free-tier fit)
- `docs/research/SPIKE-06-pipeline-integration.md` (3.1-second spacing location, per-voice options bag, cache profiles)
