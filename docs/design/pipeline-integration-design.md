# Design: publish-pipeline integration

- Status: Proposed (phase 4 design)
- Date: 2026-07-11
- Author: foundry-architect
- WAF pillars: **Operational Excellence** (reconcile-then-extend change management, provenance), **Reliability** (immutable content-hashed keys, additive manifest schema, manifest-last upload), **Performance Efficiency** (publish-time pre-render, tier-aware pacing), with cost hooks cross-referenced to `cost-and-governance.md`
- Grounded in: **ADR-0008** (pipeline integration), **ADR-0003** (voice model and voice set), **ADR-0002** (image model and canvas), plus ADR-0005 (auth, cross-referenced) and ADR-0007 (prompt hygiene); research base SPIKE-06
- Code claims below were re-verified against a reference deployment during this design phase; line references are illustrative of the pattern (the exact instance verified is recorded in the worked example)

## Scope

Exactly how MAI voice variants and MAI image generation plug into a publish pipeline that is duplicated across two content-consumer repos and a public site repo, starting with the mandatory reconciliation of the drifted pipeline copies, and ending with the exact per-repo file-change lists. This pattern generalizes to any content-publishing workflow built on a shared Node.js (`.mjs`) publish pipeline that has been copy-pasted into more than one brand or tenant repo.

## Repo roles (generic)

This design assumes four repo roles, defined once here and referred to by role for the rest of the document:

| Role | What it holds |
| --- | --- |
| **Consumer Repo A** | A publishing-brand app repo. Carries a full copy of the pipeline tooling (`tools/`, per-brand config under `brands/`, and a local `.state/`). |
| **Consumer Repo B** | A second publishing-brand app repo, sharing the same pipeline shape as Consumer Repo A but drifted independently (see section 0). |
| **Site Repo** | The public-facing static site repo for whichever brand's scene art and covers are hotlinked rather than stored in the consumer app. Image generation in this design is scoped to this repo only (ADR-0008). |
| **Prompt-Source Repo** | A sibling repo holding the illustration prompt library and character bible, read (never written) by the image tool. |

## Canonical names (fixed for every design doc)

| Item | Placeholder name |
| --- | --- |
| Resource group | `rg-<workload>-<env>-<region>-<instance>` |
| Azure AI Foundry (AIServices) account | `ais-<workload>-<env>-<region>-<instance>` |
| Foundry project | `proj-<workload>-<purpose>-<instance>` |
| Image model deployment | `<image-model-deployment-name>` |
| Monthly budget | `budget-<workload>-<env>-<region>-<instance>` |
| Key Vault (existing platform vault, REUSED, never recreated) | `kv-<platform-vault-name>` |
| Region | `<region>` (a single Azure region, per the wipe-and-redeploy design requirement) |
| Tags | `initiative=<initiative-name>`, `env=<env>`, `owner=<alias>`, `costCenter=<value>` |

Concrete values for the deployed reference instance are given in the worked example at the end of this document.

## 0. Verified as-is state (design-phase code audit)

The pipeline is duplicated in both consumer repos (each carries full `tools/`, `brands/` for both brands, and `.state/`; each `publish.mjs` can build either brand, and both repos expose per-brand publish scripts). Audit results:

| File | Consumer Repo A | Consumer Repo B | Verdict |
| --- | --- | --- | --- |
| `tools/publish.mjs` | Has `--force` (`args.force \|\| prev?.hash !== hash`) and the voice-aware audio hash (`contentHash({ blocks, title, voice: brand.tts.voice })`, uploaded and stored as `audio.hash`). No `timeframe` in the manifest | No `--force`, audio keyed by the plain content hash. Manifest emits `timeframe: book.timeframe` | **Drifted in both directions**, exactly as ADR-0008 states |
| `tools/tts.mjs` | Key auth via `fromSubscription`, per-call `{ key, region }` options bag, hardcoded `Audio48Khz96KBitRateMonoMp3`, no `mstts` namespace | Same | Identical content (line endings differ; normalize in the reconciliation commit) |
| `tools/stitch.mjs` | ffmpeg stitcher | Same | Identical |
| `tools/r2-upload.mjs` | `putObject` wraps `wrangler r2 object put` in a **4-attempt backoff retry** (works around an intermittent libuv abort on Windows) | **Single attempt, no retry** | **Additional drift, not named by ADR-0008** (SPIKE-06 recorded these as identical; the code says otherwise). Converged in the same reconciliation commit, see section 1 |
| Site Repo's `tools/` | n/a | n/a | **Does not exist**; `mai-image.mjs` creates it |
| Site Repo's `public/images/provenance.json` | n/a | n/a | Does not exist; net-new |
| Prompt-Source Repo's `resources/` | n/a | n/a | Exists and holds `Illustration_Prompts_All_Stories.md`, `Branding_Illustration_Prompts.md`, `Character_Bible.md` (the prompt sources ADR-0008 names) |

Pipeline invariants that every change below preserves (ADR-0008): ffmpeg stitching happens on the publish machine, the apps stay offline-first, no key ever reaches the worker or browser, and a publish-time budget guard runs before metered calls.

## 1. STEP ONE: reconcile the drifted pipeline copies (blocking, before any MAI work)

ADR-0008 decision 1: a standalone two-way reconciliation commit in each repo, landed before any feature work. Consumer Repo B is the larger catalog and the bulk of the voice backfill, and it currently publishes with the older non-voice-aware code, so this is not optional hygiene; it is the prerequisite for variant hashing to mean anything.

| Direction | Change | From | To |
| --- | --- | --- | --- |
| A to B | `--force` flag: header doc line and `const changed = args.force \|\| prev?.hash !== hash;` | Consumer Repo A's `tools/publish.mjs` | replaces Consumer Repo B's `tools/publish.mjs` |
| A to B | Voice-aware audio hash: compute `audioHash = contentHash({ blocks, title, voice: brand.tts.voice })`, upload audio and timings under it, store `audio: { durationMs, hash: audioHash }` | Consumer Repo A | replaces Consumer Repo B's equivalent block |
| B to A | `timeframe: book.timeframe` manifest field, with its comment | Consumer Repo B | inserted after `publishDate` in Consumer Repo A's manifest block |
| A to B (**design addition; ADR-0008 silent, flagged as a gap**) | `r2-upload.mjs` 4-attempt backoff retry in `putObject` | Consumer Repo A's `tools/r2-upload.mjs` | replaces Consumer Repo B's single-attempt `putObject` |
| Both | Normalize line endings on `tools/*.mjs` so future diffs are meaningful | n/a | n/a |

Acceptance criteria for the reconciliation commit:

1. After the commit, `tools/publish.mjs`, `tools/tts.mjs`, `tools/stitch.mjs`, and `tools/r2-upload.mjs` are byte-identical across the two consumer repos.
2. **No forced catalog re-render.** The changed-detection compares content hashes, and the manifest builds audio URLs from saved state (`saved.audio.hash`), not from recomputed hashes. Unchanged chapters therefore keep their existing R2 keys and are not re-synthesized; the voice-aware hash applies to chapters synthesized after the commit (or re-rendered deliberately with `--force`).
3. `node tools/publish.mjs --brand <brand> --dry-run` reports the same changed-set in both repos before and after the commit (behavior-preserving for unchanged content).
4. One commit per repo, no MAI code mixed in. The orchestrator commits at phase close per repo policy.

Root cause (two drifting copies) stays unfixed by explicit ADR-0008 decision: deduplicating into a shared package is deferred.

## 2. Voice variants (workstream A2, ADR-0003 plus ADR-0008 decision 2)

### 2.1 `tts.mjs`: the one real code change, expressive style

The per-call `{ key, region }` options bag **already exists** (`synthesizeChapter`, `synthesizeBlock`), so pointing a variant call at the new account is purely a matter of `publish.mjs` passing different values. What `tts.mjs` lacks is expressive style: one listen voice renders with the `excited` style via `mstts:express-as`, which needs the `mstts` namespace the current `ssmlPrefix` does not declare.

Design:

- Extend the options bag with per-voice fields: `style`, optional `styledegree`, optional `outputFormat` override, optional request spacing override (the hardcoded `REQUEST_SPACING_MS = 3100` honors the narrator resource's F0 pacing; the S0 account does not need it, so variants may pass a smaller value).
- When `style` is set, the SSML becomes:

```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
  <voice name="en-US-Ethan:MAI-Voice-2">
    <mstts:express-as style="excited">...escaped text...</mstts:express-as>
  </voice>
</speak>
```

- Implementation constraint: fold the `express-as` opening tag into the computed `ssmlPrefix` string so the existing WordBoundary offset correction (`e.textOffset - ssmlPrefix.length`) stays valid. Variants ship listen-only with empty word arrays regardless, but the math must not silently break for any future WordBoundary use.
- Confirm at the voice spike, before this lands in `brand.json`: the exact accepted spelling of the `excited` style token, whether `Audio48Khz96KBitRateMonoMp3` is accepted by the MAI voices (fall back to `Audio24Khz160KBitRateMonoMp3` if not), and whether WordBoundary fires at all (ADR-0003 follow-up; ADR-0004 follow-up).

### 2.2 `publish.mjs`: the `--voices` flag and the variant loop

- New flag `--voices <all|slug[,slug]|none>`, default `none` (today's behavior unchanged).
- The variant loop iterates the **full plan**, not just changed chapters, so `--voices all` backfills the catalog without touching content: for each chapter and each requested voice `v` from `brand.tts.listenVoices`:
  1. `variantHash = contentHash({ blocks, title, voice: v.id, style: v.style })` (reuses the existing `contentHash` from `tools/lib/md.mjs`).
  2. Skip if `state.chapters[key].variants?.[v.slug]?.hash === variantHash` (renders only missing or stale variants).
  3. Budget check against `--mai-budget-usd` (section 2.6); refuse before the call if the month's estimate would exceed it.
  4. `synthesizeChapter(chapter, v.id, dir, { key: process.env.MAI_SPEECH_KEY, region: process.env.MAI_SPEECH_REGION, style: v.style })`, then `stitchChapter` (unchanged), then `putAudio` to the variant key.
  5. Record `state.chapters[key].variants[v.slug] = { hash: variantHash, durationMs }` and accumulate the `maiLedger`.
- Narrator synthesis keeps using `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` against the existing resource; the two-resource key split is specified in `identity-and-security.md` section 1.4.
- Variants produce **no timings file** (listen-only; empty word arrays; `stitch.mjs` already tolerates blocks with no words).

### 2.3 R2 key layout (additive)

| Artifact | Key | Cache profile |
| --- | --- | --- |
| Chapter JSON (existing) | `books/<bookId>/chapters/<chapterId>.<contentHash>.json` | immutable |
| Narrator audio (existing) | `books/<bookId>/audio/<chapterId>.<audioHash>.mp3` | immutable |
| Narrator timings (existing) | `books/<bookId>/timings/<chapterId>.<audioHash>.json` | immutable |
| **Listen-variant audio (new)** | `books/<bookId>/audio/<chapterId>.<slug>.<variantHash>.mp3` | immutable |
| Covers (existing) | `books/<bookId>/covers/cover.<sha256-12>.<ext>` | immutable |
| Manifest (existing) | `manifest.json` | short TTL, always uploaded last |

The slug in the key makes variants human-listable in the bucket; the variant hash busts the immutable cache whenever text, voice, or style changes.

### 2.4 Manifest: the additive `audioVariants` field (schemaVersion stays 1)

Each chapter entry may gain:

```json
"audioVariants": [
  { "voice": "en-US-Harper:MAI-Voice-2", "slug": "harper", "label": "Harper",
    "gender": "f", "audio": "books/<bookId>/audio/<chapterId>.harper.<variantHash>.mp3",
    "durationMs": 1234567 }
]
```

The existing `audio`, `timings`, `hasAudio`, and `audioDurationMs` fields keep meaning the narrator track, so read-along and older app builds are untouched; old clients simply ignore the unknown array (ADR-0008 decision 2, alternative "bump schemaVersion" explicitly rejected).

### 2.5 `brand.json`: `tts.listenVoices` (one file per brand, per repo)

```json
"tts": {
  "voice": "en-US-AndrewMultilingualNeural",
  "listenVoices": [
    { "id": "en-US-Harper:MAI-Voice-2", "slug": "harper", "label": "Harper", "gender": "f" },
    { "id": "en-AU-<confirm-at-spike>:MAI-Voice-2", "slug": "lisa", "label": "Lisa", "gender": "f" },
    { "id": "en-US-Ethan:MAI-Voice-2", "slug": "ethan", "label": "Ethan", "gender": "m", "style": "excited" }
  ]
}
```

Same listen-voice set for every brand per the owner-locked ADR-0003 decision; the narrator voice for a brand not covered by this design's listen-voice set stays on its existing non-MAI narrator voice, unchanged. The exact en-AU identifier for Lisa and the exact `excited` token spelling are read off the Foundry playground at the voice spike before these strings are committed (ADR-0003 decision 5).

### 2.6 Ledger and hard stop (cost hooks)

`state.maiLedger[month] = { chars, estUsd }` with `estUsd = chars * 22 / 1,000,000`, printed at the end of every run, plus the `--mai-budget-usd <n>` guard that refuses a variant call before the money is spent, mirroring the existing `MONTHLY_CHAR_BUDGET = 450_000` F0 stop (verified in both copies: the constant near the file top, the pre-synthesis check). Default posture (lifted during the credit-burn window, 100 afterward) and the enforcement layering are specified in `cost-and-governance.md`; this doc only wires the mechanism.

### 2.7 App-side changes (listen-only rule)

Hook point verified in `app/src/lib/player.ts`: `startPlayback` resolves the track and calls `audioController.load(contentUrl(chapter.audio), ...)` when `chapter.hasAudio && chapter.audio`, then `setReadAlongMode`.

- **Whenever read-along (or the combined mode) is active, always load the narrator `chapter.audio` plus `chapter.timings`.** The highlight never leaves the proven WordBoundary track (ADR-0003 decision 3).
- In pure listen mode, if `settings.listenVoice` matches a variant slug present in `chapter.audioVariants`, load that variant; fall back to the narrator when absent.
- New `setListenVoice(slug)` swaps the audio source preserving position by fraction (narration pace differs per voice).
- `NowPlayingItem` gains the available variants so `NowPlaying.tsx` renders the voice picker; `Settings.tsx` gains a "Listen voice" select with the read-along note; `downloads.ts` fetches the selected variant and records it.
- No change to `AudioController.ts`, `SpeechFallback.ts`, or the worker.

## 3. Image generation (workstream G11, ADR-0002 plus ADR-0008 decisions 3 to 5)

### 3.1 New tool: Site Repo's `tools/mai-image.mjs`

The Site Repo has no `tools/` directory today; this creates it. The tool lives here because the output images, the story markdown, and the covers all live in this repo (ADR-0008 alternative "place it in a consumer repo" rejected). It stays a `.mjs` application module for consistency with the existing pipeline, as ADR-0008 decided by naming it; the HCS scripting standard's PowerShell preference targets ops scripts, and SPIKE-06 flagged the tension for the owner (recorded in gaps).

| Aspect | Design |
| --- | --- |
| Invocation | `node tools/mai-image.mjs --scene <sceneId>` or `--story NN --all-scenes`; `--edit <sourcePng>` selects the edits arm; `--size 1248x832` default; `--candidates <n>` (one call per candidate, no candidate-count parameter exists); `--budget-usd <n>`; `--dry-run` |
| Auth | Entra keyless: `DefaultAzureCredential` bearer token, scope `https://cognitiveservices.azure.com/.default`. No stored key, per `identity-and-security.md` |
| Endpoints | `https://<foundry-account-subdomain>.services.ai.azure.com/mai/v1/images/generations` (JSON body `{ model, prompt, width, height }`) and `/mai/v1/images/edits` (multipart with the source PNG plus prompt). `model` is the deployment name `<image-model-deployment-name>` |
| Canvas | Default **1248x832** (clean 3:2 at 1,038,336 pixels, under the 1,048,576 cap). Client-side validation: each dimension at least 768 and `width * height` at most 1,048,576, rejecting invalid sizes before the call. A legacy 1264x848 cover canvas exceeds the cap and cannot be reproduced; regenerated covers standardize on 1248x832 (ADR-0002 decision 3) |
| Pacing | Paces to the deployed tier: 10 requests per minute (Tier 5 on the primary subscription), configurable, and backs off honoring Retry-After on 429 |
| Cost guard | A state sidecar `tools/.state/mai-image.json` in the Site Repo, `{ [month]: { images, estTokens, estUsd } }`, mirroring the publish pipeline's state pattern; `--budget-usd` refuses a call pre-spend. Uses the conservative 4,200 tokens-per-image assumption until the smoke-test probe writes the measured value (see `cost-and-governance.md` section 7). The tool logs any usage field found on live responses |
| Output | PNGs into `public/images/stories/` (scene art) or `public/images/covers/` (covers). Candidates write as `<scene>.cand-<n>.png` for human review; selection is a human step because the API has no seed and output is not reproducible (ADR-0002). A prune step removes losing candidates and their provenance records together, keeping directory and index in sync |
| Prompt hygiene | Warns if a known trademark token (for example "Dickies") survives in a prompt, and requires the hand-drawn storybook framing wording to be present (ADR-0007 via `identity-and-security.md` section 6) |

### 3.2 Prompt source: the Prompt-Source Repo

Prompts are read from the separate Prompt-Source Repo (verified present: `resources/Illustration_Prompts_All_Stories.md` keyed by scene, `Branding_Illustration_Prompts.md`, `Character_Bible.md`), not from the Site Repo, which has no `resources/` directory (ADR-0008 decision 4; the source plan's site-repo path was stale). The tool takes the checkout location from a `--prompts <path>` flag or an env var, since it is a sibling working copy. Trademark genericization is applied in the canonical prompt files themselves (one edit, per ADR-0007), with the tool's warning as the safety net. `promptRef` in provenance points back at the exact heading.

### 3.3 Provenance: the committed index (ADR-0008 decision 5)

Site Repo's `public/images/provenance.json`, committed, mapping repo-relative image path to a record; `mai-image.mjs` writes a record on every successful call:

```json
{
  "images/stories/story-01-scene-01-the-orchard.png": {
    "generator": "MAI-Image-2.5",
    "modelVersion": "2026-06-02",
    "endpoint": "generations",
    "promptHash": "sha256:9f2c...",
    "promptRef": "resources/Illustration_Prompts_All_Stories.md#story-1-scene-1",
    "width": 1248, "height": 832,
    "sourceImage": null,
    "createdAt": "2026-07-11",
    "tool": "mai-image.mjs@0.1.0"
  }
}
```

Seed is recorded as none (the API has no seed). For covers only, an optional `artProvenance` echo (`generator`, `modelVersion`, `promptHash`) is stamped into the story frontmatter, because the cover is the one asset that is a frontmatter field; scene art stays in the index only (it is body-referenced). `modelVersion` is read from the deployment at run time, never hardcoded (ADR-0002 decision 1). This closes the unknown-generator gap permanently and satisfies the ADR-0007 transparency ask at the data layer, independent of whether MAI embeds C2PA (UNKNOWN).

### 3.4 How generated art reaches readers (two distinct paths, verified in code)

- **Scene art is hotlinked, not stored in R2.** `tools/lib/md.mjs`'s `resolveSrc` rewrites root-relative `/images/...` references into absolute URLs on the marketing origin inside the chapter JSON, and image blocks are never narrated or counted toward TTS characters. Consequence: **regenerated scene art goes live in the reader app on the next site deploy**, with no republish, as long as the filename is unchanged. A publish run for the Site Repo's brand is needed only when a scene's markdown `src` or filename changes (to refresh the chapter JSON).
- **Covers are copied into R2** under a content-hashed key and **re-upload automatically on the next publish run for that brand** when the bytes change (verified in the covers section and `coverSourceFor`, resolving frontmatter `coverImage` through the Site Repo's `public/`).

## 4. Exact file-change lists

### 4.1 Consumer Repo A AND Consumer Repo B (both repos; reconciliation first)

| File | Change |
| --- | --- |
| `tools/publish.mjs` | Reconciliation (section 1); then `--voices`, the variant loop, `variantHash`, variant R2 keys, `state.chapters[*].variants`, `state.maiLedger` plus `--mai-budget-usd`, and the additive `audioVariants` manifest field |
| `tools/r2-upload.mjs` | Reconciliation only (retry ported into Consumer Repo B); no variant-specific change |
| `tools/tts.mjs` | Per-voice `style` / `styledegree` via the `mstts:express-as` wrapper and namespace; optional `outputFormat` and spacing overrides |
| `brands/<brand>/brand.json` (one per brand, in each repo) | Add `tts.listenVoices` |
| `app/src/lib/types.ts` | `AudioVariant` type; `ChapterEntry.audioVariants?`; `Settings.listenVoice?` |
| `app/src/lib/state.ts` | Default `listenVoice: 'narrator'` |
| `app/src/lib/player.ts` | Variant resolution in `startPlayback` (narrator whenever read-along is active); `setListenVoice`; variants on `NowPlayingItem` |
| `app/src/screens/NowPlaying.tsx` | Voice-picker row |
| `app/src/screens/Settings.tsx` | "Listen voice" select with the read-along note |
| `app/src/lib/downloads.ts` | Fetch the selected variant on download; `DownloadRecord.voices` |
| `docs/content-pipeline.md` | Document the variant flow and the two-resource key split |
| `tools/.state/<brand>.json` | Runtime, not hand-edited: gains `maiLedger` and per-chapter `variants` |
| No change | `tools/stitch.mjs`, `app/src/reader/AudioController.ts`, `app/src/reader/SpeechFallback.ts`, the worker |

### 4.2 Site Repo (image work, scoped to the site-repo brand only per ADR-0008)

| File | Change |
| --- | --- |
| `tools/mai-image.mjs` | NEW (creates the `tools/` directory): generations and edits arms, Entra auth, pacing, budget guard, provenance writer |
| `tools/.state/mai-image.json` | NEW runtime sidecar: monthly image ledger |
| `public/images/provenance.json` | NEW committed provenance index |
| `public/images/stories/*.png`, `public/images/covers/*.png` | New or regenerated art (a first pilot batch, about 3 scenes, hard cap 10 USD) |
| `src/content/stories/*.md` | Frontmatter may gain `artProvenance` for covers; body image references change only if filenames change (which then requires a publish run for that brand) |

### 4.3 Prompt-Source Repo (read-mostly)

| File | Change |
| --- | --- |
| `resources/Illustration_Prompts_All_Stories.md` | Read as the canonical prompt source; edited once to genericize trademarked terms (ADR-0007) |
| `resources/Branding_Illustration_Prompts.md`, `resources/Character_Bible.md` | Read-only references for prompt engineering |

Image tooling for the brand without a Site Repo is explicitly out of scope for this design: ADR-0008 scopes image work to the Site Repo (that brand's covers live in `brands/<brand>/assets/covers/` in the consumer repos and are untouched).

## 5. Sequencing and gates

1. **Reconciliation commit in each consumer repo** (section 1). Blocking; no MAI code rides along. Gate: dry-run parity and byte-identical `tools/*.mjs` across repos.
2. **Provisioning** (owner-gated per repo policy): the AIServices account, the image model deployment, the Foundry project, budget and tags per the companion designs.
3. **Voice spike, about 30 minutes, against the new account** (ADR-0003 and ADR-0004 follow-up): WordBoundary behavior, `Audio48Khz96KBitRateMonoMp3` acceptance, the exact en-AU voice identifier, the exact `excited` token, and key auth against the regional endpoint. Gate for sections 2.1 and 2.5 landing in `brand.json`.
4. **Voice variant implementation** in both consumer repos (sections 2.1, 2.2, 2.6), then app-side work (section 2.7).
5. **Image tool** in the Site Repo (section 3), with the **cost probe as its first metered calls** (gate defined in `cost-and-governance.md` section 7), then the first pilot batch.
6. **Backfills** (full-voice catalog, full image catalog) are owner-driven, budgeted separately, and out of scope for this plan per the master plan.

## 6. Why this holds together (WAF mapping)

- **Reliability:** immutable content-hashed keys mean a half-finished backfill never corrupts anything; the manifest uploads last so readers never see references to missing objects; `audioVariants` is additive so old clients keep working; read-along stays on the proven narrator WordBoundary track.
- **Operational Excellence:** reconcile-then-extend keeps one reviewable behavior change per commit; the provenance index makes every generated asset auditable; the ledgers make every run's spend visible in the terminal.
- **Performance Efficiency:** publish-time pre-render (Option A) is the decided architecture because chapters exceed the 10-minute synthesis cap and Workers cannot run ffmpeg; variant staleness hashing means backfills render only what is missing or stale; image pacing matches the deployed tier (10 RPM) instead of guessing.
- **Security and Cost** are governed by the two companion designs; this doc only wires their hooks (`MAI_SPEECH_*`, Entra bearer calls, `maiLedger`, `--mai-budget-usd`, `--budget-usd`).

## ADR gaps found (not invented here, flagged for the owner or reviewer)

1. **`r2-upload.mjs` has drifted too** (Consumer Repo A carries the wrangler retry loop; Consumer Repo B does not), which ADR-0008 and SPIKE-06 both recorded as identical. This design folds the convergence into the reconciliation commit as a one-way port; the reviewer should confirm that widening the reconciliation scope this way is acceptable.
2. **Tool language tension, recorded as settled.** ADR-0008 names `tools/mai-image.mjs`, settling the SPIKE-06 flag about the HCS PowerShell-first scripting standard; this design follows the ADR and records the tension for the owner rather than reopening it.
3. **One listen voice's exact voice id and the `excited` token spelling are UNKNOWN until the voice spike** (ADR-0003 decision 5). `brand.json` entries land only after the spike confirms both strings.
4. **The image tool's state-file location** (`tools/.state/mai-image.json`) is a design elaboration; no ADR specifies where its ledger persists. It mirrors the publish pipeline's `.state` pattern.
5. **Candidate-file workflow** (`<scene>.cand-<n>.png` plus prune) is a design elaboration of ADR-0008's "human review" requirement; the ADR does not prescribe the on-disk shape.
6. **Pipeline deduplication is deferred by decision** (ADR-0008): the two repos keep converged copies rather than a shared package; the drift risk returns over time and is accepted.

## Sources

- `docs/adr/ADR-0008-publish-pipeline-integration.md` (Option A, reconciliation first, `--voices` and variant hashing, R2 variant keys, `audioVariants`, `mai-image.mjs`, prompt source, provenance index)
- `docs/adr/ADR-0003-voice-model-and-voice-set.md` (voice set, expressive style via `mstts:express-as`, listen-only v1, spike items)
- `docs/adr/ADR-0002-image-model-and-access.md` (model, version re-check, 1248x832 canvas, no seed, candidate review, Flash arm)
- `docs/adr/ADR-0005-identity-and-secrets.md` and `docs/adr/ADR-0007-content-safety-and-responsible-ai.md` (auth and prompt hygiene, via the companion designs)
- `docs/research/SPIKE-06-pipeline-integration.md` (as-is pipeline, drift, hook points, file lists)
- Code verification this phase: Consumer Repo A's `tools/publish.mjs`, Consumer Repo B's `tools/publish.mjs`, both repos' `tools/tts.mjs`, both repos' `tools/r2-upload.mjs` (retry-loop drift), `app/src/lib/player.ts`, `tools/lib/md.mjs`, both repos' `package.json` (per-brand publish scripts), Site Repo's `public/images/` layout, Prompt-Source Repo's `resources/` contents. Exact repo names and line numbers for the verified instance are in the worked example below.

&lt;!-- safety-scan-worked-example:start -->

## Worked example: Gunner the Lab / Holdfast Press

This methodology is deployed and running in production today for two real publishing brands, Gunner the Lab and Holdfast Press. This section maps the generic roles and placeholder names above onto the concrete instance, as proof the pattern works, not as the primary design.

**Repo role mapping:**

| Generic role | Concrete repo |
| --- | --- |
| Consumer Repo A | `storyreader-holdfast` |
| Consumer Repo B | `storyreader-gunner` |
| Site Repo | `gunnerthelab.github.io` |
| Prompt-Source Repo | `gunner-studio` |

**Concrete Azure names** (canonical for this instance, cross-referenced by the other `docs/design/` docs before their own genericization passes):

| Item | Concrete name |
| --- | --- |
| Resource group | `rg-studioai-prod-eus-01` |
| Azure AI Foundry (AIServices) account | `aif-studioai-prod-eus-01` |
| Foundry project | `proj-studioai-media-01` |
| MAI-Image-2.5 deployment | `mai-image-25` |
| Monthly budget | `budget-studioai-prod-eus-01` |
| Key Vault (existing platform vault, reused) | `kv-hcs-vault-01` |
| Region | East US (`eastus`) |
| Tags | `initiative=studio-foundry` (predates the repo rename to homestead-foundry; an Azure resource tag, not a repo reference), `env=prod`, `owner=<alias>`, `costCenter=<value>` |

**Concrete facts folded into the generic design above:**

- Consumer Repo B (Gunner) is the 42-story catalog and the bulk of the voice backfill.
- The three listen voices are Harper (`en-US-Harper:MAI-Voice-2`), an Australian voice (`en-AU-<confirm-at-spike>:MAI-Voice-2`, Lisa), and Ethan (`en-US-Ethan:MAI-Voice-2`, `excited` style). Same set for both Gunner the Lab and Holdfast Press.
- Holdfast Press's narrator voice stays `en-GB-Ryan:DragonHDLatestNeural`, unchanged by this design.
- The image endpoint is `https://aif-studioai-prod-eus-01.services.ai.azure.com/mai/v1/images/generations` (and `/mai/v1/images/edits`), deployment name `mai-image-25`.
- The Foundry playground for voice-spike confirmation is `proj-studioai-media-01`.
- The first pilot batch is Gunner's Story #1 (about 3 scenes, hard cap 10 USD).
- Line-verified code (current as of 2026-07-11): `storyreader-holdfast/tools/publish.mjs` (lines 14, 83, 158 to 171), `storyreader-gunner/tools/publish.mjs` (lines 82, 155 to 167, 233), `tools/tts.mjs` both repos (lines 19, 45, 52, 59), `tools/r2-upload.mjs` both repos (retry-loop drift), `app/src/lib/player.ts` (lines 84, 136 to 137, 157), `tools/lib/md.mjs` (lines 59 to 63, 201), both repos' `package.json` (`publish:gunner`, `publish:holdfast`), `gunnerthelab.github.io/public/images/` layout, `gunner-studio/resources/` contents.
- Holdfast Press's covers live in `brands/holdfast/assets/covers/` in the consumer repos and are untouched by the image-generation work, which is scoped to the Gunner site repo only.

&lt;!-- safety-scan-worked-example:end -->
