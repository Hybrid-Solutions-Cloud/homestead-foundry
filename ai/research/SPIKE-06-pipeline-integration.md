# SPIKE-06: publish-pipeline integration

Status: research complete. No Azure resources created, no spend, no code changed, no keys issued or stored. Read-only inspection of a live consumer pipeline.
Date: 2026-07-11
Author: foundry-researcher (Opus)
Scope: how an Azure AI Foundry media backbone (MAI-Voice-2 narration, MAI-Image-2.5 scene art) integrates with an existing external publish-time asset pipeline, so a design phase can scope the integration against real mechanics rather than assumptions. This spike states the integration as a general PATTERN (any Foundry build wiring into a consumer repo that pre-renders assets at publish time), then proves it against one production instance in the "Worked example" appendix at the end. The pattern themes are: content-hashed immutable object keys, manifest-last upload ordering, per-brand configuration, and drift reconciliation across multiple consumer repos that duplicate the same pipeline.

Grounding fact that drives every answer: in this pattern, audio and cover art are pre-rendered at publish time by a Node pipeline (a set of `tools/*` modules) running on a developer workstation, then uploaded to object storage (an S3-compatible, CDN-backed bucket) under immutable content-hashed keys; the runtime worker and the browser never synthesize and never hold a key. Confirmed in the publish orchestrator and the object-storage upload helper of the consumer repos inspected. Scene art (as opposed to covers) is not stored in the bucket at all; it is hotlinked to the marketing site (see Q3).

---

## Question

1. **Publish pipeline as-is.** How does the synth module authenticate and call the speech service; how does the publish orchestrator upload to object storage and track a usage ledger; what is the current audio key layout. Establish from code, not from a plan.
2. **Voice changes needed.** The exact changes to point synthesis at a new AIServices resource and MAI-Voice-2 voices, a per-call key/region options bag, a `--voices` flag, per-voice variant hashing, the object-storage variant key layout, a paid-resource usage ledger and budget hard stop, and an additive `audioVariants` manifest field, all while keeping read-along on the existing narrator.
3. **Image side.** Is there image-generation tooling today or is scene art manual; propose a small separate tool calling the generations and edits endpoints, recording provenance, writing into the site's images location. Where do images and prompts live, and what are the valid canvas sizes.
4. **Provenance going forward.** A concrete, minimal scheme recording which generator, model version, and prompt produced each asset.
5. **Which repos change.** The concrete files across the consumer repos and the site images location this integration touches.

---

## Findings

### Q1. Publish pipeline as-is (the pattern, confirmed from code and live state)

**Authentication and the speech call (synth module, `tools/tts.*`).** The synth module exposes `synthesizeChapter(chapter, voice, workDir, { key, region, onProgress })` and calls `synthesizeBlock(text, voice, { key, region })` once per speakable block. Auth is a subscription key: `SpeechConfig.fromSubscription(key, region)` using the Node Speech SDK `microsoft-cognitiveservices-speech-sdk`. Each block is wrapped in SSML with the voice name in the `<voice name="...">` element, output format is hardcoded (a 48 kHz mono MP3 profile), and `WordBoundary` events are collected into `[charStart, charEnd, startMs, endMs]` word tuples with escaped-entity offset correction. Requests are spaced by a hardcoded interval to respect the free-tier 20-per-minute limit. Two facts a plan is likely to miss when working from prose rather than code: the synth module may not actually read all the config fields the brand config exposes (dead config), and the SSML may carry no `mstts` namespace or `mstts:express-as` wrapper yet.

**Who supplies key/region.** The publish orchestrator passes `key: process.env.<SPEECH_KEY>, region: process.env.<SPEECH_REGION>` into `synthesizeChapter` for the narrator. Multiple brands can share the same free-tier key; the key never leaves the publish machine.

**Object-storage upload (upload helper, `tools/upload.*`).** Uploads shell out to the storage provider's CLI with a multi-attempt backoff retry (working around an intermittent platform-specific abort). Two cache profiles: `IMMUTABLE = public, max-age=31536000, immutable` for hashed artifacts and `SHORT = public, max-age=60` for the manifest. Helpers cover JSON, audio (`audio/mpeg`), and image puts. The manifest is always uploaded last with the SHORT profile, so readers never see a manifest pointing at objects that have not landed yet. This manifest-last ordering is a load-bearing part of the pattern: immutable content-hashed artifacts can be uploaded in any order and safely coexist with older versions, and only the short-lived manifest flips the reader over to the new set, atomically from the reader's point of view.

**Usage ledger and budget (publish orchestrator).** State lives in a per-brand sidecar `tools/.state/<brand>.json`, default shape `{ chapters: {}, libraryVersion: 0, charLedger: {} }`. `charLedger[month]` accumulates synthesized characters, and a hard stop (a monthly character budget) aborts the run before synthesizing a chapter that would exceed the free tier. A cross-repo drift risk lives here: when a single shared free-tier resource backs multiple brands, each published from its own repo, the per-brand ledgers do not reconcile to real shared usage (true usage is the sum across brands).

**Current audio key layout (from the orchestrator plus live state).** Bucket `<brand>-content`. Per chapter:
- content: `books/<bookId>/chapters/<chapterId>.<contentHash>.json`
- audio: `books/<bookId>/audio/<chapterId>.<hash>.mp3`
- timings: `books/<bookId>/timings/<chapterId>.<hash>.json`
- covers: `books/<bookId>/covers/cover.<sha256-12>.<ext>` (copied into the bucket only for covers)
- manifest: `manifest.json` at the bucket root, `schemaVersion 1`, uploaded last.

`contentHash(obj)` is `sha256(JSON.stringify(obj)).slice(0,8)`.

**Critical, easily-understated finding: when the pipeline is duplicated across multiple consumer repos rather than shared as a package, the copies drift in BOTH directions.** Each app repo can carry a full `tools/`, `brands/`, and `.state/`, and each publish orchestrator can build any brand, but the copies are not the same file. In the instance inspected, one repo's orchestrator was ahead on voice (a `--force` flag and a voice-aware audio hash separate from the content hash, so a voice change busts the audio URL as intended) while the other repo's orchestrator was behind on voice but ahead on sort metadata (a `timeframe` manifest field the first lacked). Consequence: the repo carrying the larger catalog, and therefore the bulk of the MAI voice backfill, may be the one running the older, non-voice-aware code. Reconciliation is a two-way merge, not a one-way port. This multi-consumer drift is the single most important thing to fix before layering new work on top, and it is a general hazard of any pattern that copies a pipeline across repos instead of sharing it.

### Q2. Voice changes needed (mapped to the pattern)

**The options bag already exists; the SSML does not yet express-as.** A plan may list "accept an options bag with key/region per call" as a change, but `synthesizeChapter(..., { key, region, onProgress })` and `synthesizeBlock(text, voice, { key, region })` already take it. So pointing a variant call at a new resource is purely a matter of the orchestrator passing the new key/region (and the MAI voice name) instead of the narrator's. The one real synth-module code change is expressive style: rendering a voice with a style (for example, an `excited` style on a voice whose natural register reads flat) requires the `mstts` namespace and an `mstts:express-as` wrapper, which a plain `<voice>`-only SSML prefix lacks. Microsoft Learn confirms both the mechanism and that no other change is needed: "MAI-Voice models use the same Azure Speech APIs and SDKs ... use the voice name in the `name` attribute of the SSML `<voice>` element," and "MAI-Voice-2 supports expressive styles by using `style` and `styledegree` attributes" via `mstts:express-as`. [MAI-Voice](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices) The voice name format is colon-suffixed, matching the Learn SSML sample `es-MX-Valeria:MAI-Voice-2`. So the synth module should gain a per-voice options field (style, styledegree, outputFormat, and optionally spacing) and, when a style is set, add `xmlns:mstts="http://www.w3.org/2001/mstts"` to `<speak>` and wrap the text in `<mstts:express-as style="...">`.

**Point synthesis at the new resource.** New env `MAI_SPEECH_KEY` / `MAI_SPEECH_REGION` (a MAI-supported region matching the resource), read in the orchestrator and passed only for variant calls. Narrator calls keep the existing `<SPEECH_KEY>` / `<SPEECH_REGION>`. This is the "two-resource key split" the docs to update should describe: one free-tier resource for the proven narrator track, one paid AIServices resource for the MAI variants.

**Brand config: a `tts.listenVoices` array** alongside the existing `tts.voice`. Each entry needs `{ id, slug, label, gender, style? }`. Because the pipeline is duplicated across consumer repos and each repo carries a config file per brand, the array is added in one file per (repo x brand) pair, not just once.

**`--voices <all|slug[,slug]|none>` flag** (default `none`, preserving today's behavior). For each requested variant slug, synthesize the chapter once with the MAI voice plus resource, stitch (no change to the stitch module), and upload. Variant synthesis is gated on its own voice-aware hash so `--voices all` backfills only missing or stale variants without touching the narrator track.

**Per-voice variant hashing and object-storage variant key layout.** Reuse the existing `contentHash` mechanism with the voice folded in: `variantHash = contentHash({ blocks, title, voice: listenVoice.id, style: listenVoice.style })`. Upload to an immutable key that carries the slug and hash, additive to today's layout: `books/<bookId>/audio/<chapterId>.<slug>.<variantHash>.mp3`. Store per chapter in state as `variants: { [slug]: { hash, durationMs } }`. Variants render with empty word arrays (listen-only); the synth module already tolerates empty `words` and the stitch module already handles blocks with no words, so no timings file is needed for variants.

**Paid-resource usage ledger and budget hard stop.** Add `state.maiLedger[month] = { chars, estUsd }` where `estUsd = chars * <rate> / 1_000_000`. MAI-Voice-2 is 22 USD per 1M characters per its model page; verify the meter at provisioning. Mirror the existing free-tier character stop with a `--mai-budget-usd <n>` guard, and print the ledger at the end of every run.

**`audioVariants` manifest field (additive, `schemaVersion` unchanged).** Each chapter entry gains an optional array so older app builds ignore it:
```json
"audioVariants": [
  { "voice": "en-US-Ethan:MAI-Voice-2", "slug": "ethan", "label": "Ethan",
    "gender": "m", "audio": "books/<bookId>/audio/<chapterId>.ethan.<hash>.mp3",
    "durationMs": 1234567 }
]
```
The existing `audio` / `timings` / `hasAudio` / `audioDurationMs` fields keep meaning the narrator track, so read-along and old clients are untouched.

**Keep read-along on the narrator (app side).** The player resolves the track in its `startPlayback` path: it fetches the chapter content and, if present, the timings, then calls the audio controller's `load(contentUrl(chapter.audio), content, timings, ...)` when `chapter.hasAudio && chapter.audio`, and drives the highlight via the read-along setting. The variant hook goes exactly here: in pure listen mode load the variant whose slug matches the selected listen voice, but whenever read-along (or a combined mode) is active always load the narrator `chapter.audio` + `chapter.timings` so the word-sync highlight stays on the proven WordBoundary track. The now-playing item gains the available variants so the UI can render a picker, and a new `setListenVoice(slug)` swaps the source by position fraction (narration pace differs per voice). This needs no worker, audio-controller, or speech-fallback change.

### Q3. Image side: no tooling today; a small separate tool is the right shape

**There is typically no image-generation tooling.** In the instance inspected, a repo-wide grep for `images/generations`, `images/edits`, `DefaultAzureCredential`, and `cognitiveservices.azure.com` returned only a backlog mention. Scene art is produced manually and the original generator is unrecorded (UNKNOWN). Expect this: the speech side has a mature pipeline, the image side usually does not.

**Where images and prompts live.** Site images live in the marketing/site repo's `public/images/`, subfoldered by role: `covers/`, `stories/` (per-scene), `illustrations/`, plus branding/hero/social/ui. Story frontmatter carries a `coverImage` path and an `artStyle`, while scene art is embedded inline in the story body as standalone markdown image lines. This split matters for provenance (Q4): the cover is a frontmatter field, but scenes are body references, so a frontmatter-only scheme cannot cover scene art. The prompt library commonly lives in a separate studio repo (a prompts file plus a character bible), not in the site repo, so the design should read prompts from the studio repo rather than a stale site path.

**How the pipeline consumes that art (important integration nuance).** Covers are copied into object storage under a content hash and re-upload automatically when the bytes change (the orchestrator's cover section resolving `frontmatter coverImage -> book.coverSource -> sourceRepo/public/<coverSource>`). Scene images are NOT uploaded to object storage: the markdown-to-JSON layer rewrites a root-relative `/images/...` into an absolute URL on the marketing origin (`siteOrigin`) inside the chapter JSON image block, and image blocks return `''` for plain text so they are never narrated or counted toward TTS characters. Consequence: regenerated scene art goes live in the reader app as soon as the site redeploys with the new image, with no republish needed if the filename/markdown reference is unchanged; a republish is required only when the image `src` or filename changes (to refresh the chapter JSON) or to re-upload a changed cover. This "hotlinked scene art vs stored cover copy" split is the integration nuance a design must respect: the two asset classes have different go-live paths.

**Valid canvas sizes (confirmed on Learn).** MAI image generations require `width` and `height` each at least 768 with `width * height` not exceeding 1,048,576, output always PNG; edits take one JPEG or PNG as multipart form data. [MAI image how-to](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai), [Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure) A common existing cover dimension such as 1264x848 = 1,071,872 px exceeds that cap, so MAI cannot reproduce it exactly; the nearest valid 3:2 landscape is 1248x832 (1,038,336 px) or 1152x768, and 1024x1024 sits exactly at the 1,048,576 cap. Endpoints (Microsoft-managed, on the resource): generations `https://<resource-name>.services.ai.azure.com/mai/v1/images/generations` (JSON), edits `https://<resource-name>.services.ai.azure.com/mai/v1/images/edits` (multipart); parameters `model` (deployment name), `prompt` (max 32,000 tokens), `image` (edits only), `width`/`height` (generations only). [MAI image how-to](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai)

**Proposed tool: a small separate image module (`tools/mai-image.*`) in the site repo.** It belongs in the site repo's `tools/` because that is where the output images and the story markdown live, and it can reuse the Node conventions of the existing pipeline (`fetch`, `crypto` hashing, a `.state`-style sidecar). Shape:
- Inputs: a scene id (or `--story NN --all-scenes`), the prompt text (read from the studio repo's prompt library, keyed by scene), an arm (`--gen` for generations, `--edit <sourceImage>` for edits), and size (default 1248x832).
- Auth: prefer Entra `DefaultAzureCredential` bearer token (scope `https://cognitiveservices.azure.com/.default`), key fallback via `MAI_IMAGE_KEY` from the tenant vault (by name only, never committed) per SPIKE-04.
- Calls: generations as JSON `{ model, prompt, width, height }`; edits as multipart with the source image plus prompt.
- Output: write the PNG to `public/images/stories/<scene>.png` (or `covers/`), and write a provenance record (Q4).
- Guards: Tier-1 RPM pacing, a `--budget-usd` cap, and read the actual token counts off the first responses to replace the estimated per-image cost. Genericize trademarked terms in prompts per SPIKE-04. Language choice is a design decision to flag for the owner: an HCS scripting standard may prefer PowerShell 7, but the tool is an application module alongside the rest of the pipeline, so a Node module keeps it consistent with the codebase.

### Q4. Provenance scheme (concrete, minimal)

Record provenance per asset the same way the pipeline already records publish state: a small committed JSON sidecar in the site repo (durable, greppable, survives across generators). Two coordinated pieces:

1. **A committed index** `public/images/provenance.json`, mapping image path to a record. One record shape covers covers and scenes:
```json
{
  "images/stories/story-01-scene-01.png": {
    "generator": "MAI-Image-2.5",
    "modelVersion": "2026-06-02",
    "endpoint": "generations",
    "promptHash": "sha256:9f2c...",
    "promptRef": "<studio-repo>/resources/Illustration_Prompts.md#story-1-scene-1",
    "width": 1248, "height": 832,
    "sourceImage": null,
    "createdAt": "2026-07-11",
    "tool": "mai-image@0.1.0"
  }
}
```
   `promptHash` is `sha256` of the exact prompt string (so a prompt edit is detectable and a re-gen is auditable); `promptRef` points at the canonical prompt so the text is not duplicated; `endpoint` distinguishes the generations arm from an edits arm; `sourceImage` names the input image for edit-arm assets. The image module writes this record on every successful generation, mirroring how the orchestrator writes its per-brand state file.
2. **Optional cover echo in frontmatter.** For the one asset that is a frontmatter field (the cover), also stamp an `artProvenance` object into the story's frontmatter (`generator`, `modelVersion`, `promptHash`) so the human-facing story file self-documents its cover. Scene art stays in the index only (it is body-referenced, not frontmatter).

This makes "which AI made this art, from which prompt" answerable forever with a single committed file, closes the current UNKNOWN-generator gap, needs no new service, and satisfies the responsible-AI transparency ask from SPIKE-04 at the data layer.

### Q5. Which repos and files change

**Voice, every consumer repo (apply to all copies; reconcile the drift first):**
- The publish orchestrator (`tools/publish.*`): add `--voices`, the per-variant synth loop, `variantHash`, the `books/<bookId>/audio/<chapterId>.<slug>.<hash>.mp3` keys, `state.variants`, `state.maiLedger` + `--mai-budget-usd`, and the additive `audioVariants` manifest field. Reconciliation: port the voice-aware `audioHash` + `--force` from the ahead-on-voice copy into the behind copy, and port the sort-metadata (`timeframe`) manifest field the other direction, so the copies converge before new work lands.
- The synth module (`tools/tts.*`): add per-voice `style`/`styledegree` support (the `mstts:express-as` wrapper + namespace), plus optional `outputFormat`/spacing overrides.
- Each brand config (`brands/<brand>/brand.json`): add `tts.listenVoices`. One file per (repo x brand) pair.
- App `lib/types.*`: an `AudioVariant` type; `ChapterEntry.audioVariants?`; `Settings.listenVoice?`.
- App `lib/state.*`: default `listenVoice: 'narrator'`.
- App `lib/player.*`: variant track resolution in `startPlayback` (narrator for read-along/combined; variant for pure listen), a new `setListenVoice`, variants on the now-playing item.
- App now-playing screen: the voice-chip picker row.
- App settings screen: a "Listen voice" select with the read-along note.
- App `lib/downloads.*`: fetch the selected variant on download; a `voices` field on the download record.
- Pipeline docs: document the variant flow and the two-resource key split.
- Runtime (not hand-edited): the per-brand state file gains `maiLedger` and per-chapter `variants`.
- No change: the stitch module, the object-storage upload helper, the app audio controller, the speech-fallback path, the worker.

**Image, site repo only:**
- New image module `tools/mai-image.*` (generations + edits, provenance writer).
- `public/images/stories/*.png` and `covers/*.png`: new or regenerated art (a pilot story first).
- `public/images/provenance.json`: new provenance index.
- Story markdown frontmatter: may gain `artProvenance` for the cover; body image references change only if art filenames change (which then requires a publish run to refresh chapter JSON).
- The studio repo's prompt library: read-only prompt source; may be edited to genericize trademarked terms.
- Downstream: after new scene art lands and the site redeploys, the reader app shows it with no republish (scene art is hotlinked); a publish run is needed only to re-upload changed covers or if a scene's markdown `src` changed.

**Provisioning (no code, confirm before any `az` write), per SPIKE-03/04:** one shared AIServices (Foundry) resource in a single region hosting both the MAI-Image-2.5 deployment and the MAI-Voice-2 Speech surface; secrets by NAME only in the tenant vault and gitignored local var files (`MAI_SPEECH_KEY`/`MAI_SPEECH_REGION`, `MAI_IMAGE_ENDPOINT`/`MAI_IMAGE_KEY`); prefer Entra keyless where practical.

---

## What is still UNKNOWN

- **Whether MAI-Voice-2 emits usable `WordBoundary` events.** The MAI-Voice docs do not mention word boundaries; the design keeps variants listen-only (empty word arrays) precisely because this is unproven. A 30-minute synthesis spike against the new resource answers it and is the gate for any future read-along migration to an MAI narrator. [MAI-Voice](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices), [HD voices](https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices)
- **Whether the MAI resource accepts a 48 kHz / 96 kbit mono MP3 output.** The narrator path uses it, but Learn's MAI examples use 24 kHz output; if 48/96 is rejected the variants standardize on a 24 kHz profile (about 1.7x file size). Confirm in the same spike.
- **The exact prebuilt MAI-Voice-2 voice id for each chosen voice.** The precise `id` string (for example the correct en-AU female voice) must be read off the Foundry playground voice list before it goes in brand config; a plan naming a voice colloquially is not authoritative. [MAI-Voice prebuilt voice table](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)
- **Tokens consumed per generated image.** Not published, so per-image cost is an estimate until the first metered runs; the image module should read the real token counts off the first responses. [MAI image how-to](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai)
- **Whether the pipeline duplication across consumer repos should be deduplicated** (a shared package) rather than kept as drifting copies. This spike documents the drift; whether to fix the root cause is a design decision, not a documentation gap.
- **Whether MAI image output carries embedded C2PA / Content Credentials.** Not stated for MAI; the provenance sidecar in Q4 does not depend on it. Flagged in SPIKE-04.

---

## Recommendation

Adopt the publish-time pre-render option exactly as scoped, with these integration specifics grounded in the code. The single most useful correction to any prose plan: where a pipeline is duplicated across multiple consumer repos, the copies drift in both directions and the repo carrying the larger catalog may be running the older, non-voice-aware code, so step one is a small standalone reconciliation commit in each repo that ports the voice-aware audio hash + `--force` into the behind copy and the sort-metadata manifest field the other direction, leaving the copies identical. Only then layer the MAI variant work on top: an `mstts:express-as` addition to the synth module (the only real synth change, since the key/region options bag already exists), a `--voices` flag in the orchestrator that renders each `brand.tts.listenVoices` entry against `MAI_SPEECH_*`, variant keys at `books/<bookId>/audio/<chapterId>.<slug>.<variantHash>.mp3`, a `maiLedger` + `--mai-budget-usd` guard mirroring the existing free-tier stop, and an additive `audioVariants` manifest array so read-along and old clients stay on the untouched narrator track. On the app side, hook variant selection into the player's `startPlayback` at the existing audio-controller `load` call, forcing the narrator track whenever read-along is active.

For image, add one small image module in the site repo that calls the generations and edits endpoints (Entra-preferred auth, 1248x832 default to fit the 1,048,576-pixel cap), writes PNGs into `public/images/stories/`, and stamps a committed `public/images/provenance.json` record (generator, modelVersion, endpoint, promptHash, promptRef, size, createdAt) plus an optional frontmatter `artProvenance` echo for covers, so the "which AI made this" gap never recurs. Because scene art is hotlinked to the marketing site rather than stored in object storage, regenerated scenes go live on the next site deploy with no republish, while covers re-upload automatically on the next publish run. Files that change: across every consumer repo, the publish orchestrator, the synth module, each brand config, the app `lib/{types,state,player,downloads}` and now-playing/settings screens, and the pipeline docs; in the site repo, the new image module, `public/images/{stories,covers}/*.png`, `public/images/provenance.json`, and story frontmatter, reading prompts from the studio repo.

---

<!-- safety-scan-worked-example:start -->

## Worked example: Gunner the Lab / Holdfast Press

This is the production instance the pattern above was validated against, with the real repo, tool, brand, and bucket names, the live-state proof, and the concrete file list. Everything here is one instantiation of the generic Findings; the pattern is what carries forward, this appendix is the evidence.

**The pipeline and repos.** The consumer repos are `storyreader-holdfast` and `storyreader-gunner`, each carrying a full `tools/` pipeline (`tts.mjs`, `stitch.mjs`, `publish.mjs`, `r2-upload.mjs`, plus `tools/lib/md.mjs`), a `brands/` folder with both `brands/holdfast/brand.json` and `brands/gunner/brand.json`, and a `tools/.state/<brand>.json`. Object storage is Cloudflare R2, uploaded via the `wrangler r2 object put` CLI. The two brands served are Gunner the Lab and Holdfast Press, each published from its own repo.

**Q1 proof (line-cited).** `synthesizeChapter(chapter, voice, workDir, { key, region, onProgress })` iterates speakable blocks and calls `synthesizeBlock(text, voice, { key, region })` (`tools/tts.mjs:19`, `:34`), auth `sdk.SpeechConfig.fromSubscription(key, region)` (`:47`) via `microsoft-cognitiveservices-speech-sdk`, SSML voice name in `<voice name="...">` (`:52`), output hardcoded to `Audio48Khz96KBitRateMonoMp3` (`:48`), `WordBoundary` tuples with escaped-entity correction (`:56` to `:66`), spacing `REQUEST_SPACING_MS = 3100` (`:10`) for the F0 20-per-minute limit. Dead config: `tts.mjs` never reads `brand.tts.outputFormat` or `brand.tts.rate` from `brand.json` though both exist, and there is no `mstts` wrapper. The orchestrator passes `key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION` for the narrator (`holdfast tools/publish.mjs:142`); both repos' `.dev.vars` carry the same shared F0 key. `r2-upload.mjs` shells to `wrangler r2 object put` with a 4-attempt backoff around an intermittent libuv abort on Windows (`:12` to `:37`), cache profiles `IMMUTABLE` (`:39`) and `SHORT` (`:40`), helpers `putJson`/`putAudio`/`putImage` (`:42` to `:53`), manifest last with SHORT (`publish.mjs:262`, `putJson(..., false)`). State default `{ chapters: {}, libraryVersion: 0, charLedger: {} }` (`:53` to `:55`), `state.charLedger[month] += charCount` (`:152`), hard stop `MONTHLY_CHAR_BUDGET = 450_000` (`:32`, `:134` to `:140`). Live values: `holdfast.json` `charLedger {"2026-07": 95085}`, `libraryVersion 5`; `gunner.json` `charLedger {"2026-07": 27503}`, `libraryVersion 6`. The F0 resource is shared, so real usage is the sum (about 122,588 this month) and the per-brand ledgers do not reconcile it. Bucket `storyreader-<brand>-content`; `contentHash(obj) = sha256(JSON.stringify(obj)).slice(0,8)` (`tools/lib/md.mjs:201`).

**Q1 drift proof.** Holdfast's `publish.mjs` is ahead on voice: `--force` (`:14`, `:83` `args.force || prev?.hash !== hash`) and a voice-aware audio hash `contentHash({ blocks, title, voice: brand.tts.voice })` (`:160`) stored as `audio: { durationMs, hash: audioHash }` (`:171`); live proof `holdfast.json` the-keepers/prologue has content hash `f58735e1` but audio hash `533b31d4`. Gunner's `publish.mjs` is behind on voice but ahead on sort metadata: no `--force` (`:82` `const changed = prev?.hash !== hash`), audio keyed by the plain content hash (`:160`), manifest emits `timeframe: book.timeframe` (`:233`) which Holdfast lacks; live proof `gunner.json` story-01 audio hash `4eeaaeb4` equals its content hash (content-keyed, not voice-aware), story-02 shows content `2e286ccf` vs audio `39400593`. So Gunner (the 42-story catalog, the bulk of the MAI voice backfill) runs the older non-voice-aware code, and reconciliation is a two-way merge.

**Q2 owner-decided specifics.** The same listen set ships for both brands: Harper (F, en-US), Lisa (F, en-AU), Ethan (M, en-US, `excited` style, chosen because his natural register reads flat). Example entry `{ "id": "en-US-Ethan:MAI-Voice-2", "slug": "ethan", "label": "Ethan", "gender": "m", "style": "excited" }`, added in four files (`brands/{holdfast,gunner}/brand.json` in both repos). Region `eastus`. The `maiLedger` `estUsd = chars * 22 / 1_000_000`; owner cap is 100 USD per month (supersedes an earlier 15 USD proposal), enforced only after the owner's Azure credit resets; until then run uncapped to burn credit. App-side hook is in `storyreader-holdfast/app/src/lib/player.ts` `startPlayback` (`:118` to `:137`, `audioController.load(contentUrl(chapter.audio), content, timings, ...)`, `setReadAlongMode` at `:157`), with `NowPlayingItem` (`:18` to `:26`) carrying the variants.

**Q2/Q3 open UNKNOWN specifics for this instance.** The en-AU voice the owner named "Isla" (corrected toward the real en-AU name "Lisa") must be resolved to its exact `id` off the Foundry playground before it goes in `brand.json`.

**Q3 image locations.** Gunner images live in the site repo `gunnerthelab.github.io/public/images/`: `covers/` (`story-NN.png`, about 1264x848), `stories/` (`story-NN-scene-*.png`), `illustrations/` (`illus-*.png`, 1024x1024), plus `brand/`, `hero/`, `social/`, `ui/`. Story frontmatter carries `coverImage: "/images/covers/story-01.png"` and `artStyle: "graphite"` or `"colored-pencil"`; scene art is inline body markdown, for example `![alt](/images/stories/story-01-scene-01-the-orchard.png)` (`src/content/stories/01-the-voyage-home-going-east.md:10`, `:39`, `:47`). Covers resolve via `publish.mjs` `coverSourceFor` (`:181` to `:216`); scenes are rewritten by `tools/lib/md.mjs` `resolveSrc` (`:59` to `:63`, `:115`) to `siteOrigin` (`https://gunnerthelab.com`), and `blockPlainText` returns `''` for image blocks (`:190`). The 1264x848 covers (1,071,872 px) exceed the MAI 1,048,576-pixel cap, so the nearest valid 3:2 landscape is 1248x832. The prompt library is in a separate repo `gunner-studio/resources/` (`Illustration_Prompts_All_Stories.md`, `Branding_Illustration_Prompts.md`, `Character_Bible.md`); `gunnerthelab.github.io` has no `resources/` directory, so a plan citing `gunnerthelab.github.io/resources/...` is stale. The proposed tool is `gunnerthelab.github.io/tools/mai-image.mjs`; genericize trademarked terms (for example drop "Dickies") in prompts per SPIKE-04. Secrets by name in `kv-hcs-vault-01`.

**Q5 concrete file list.** Voice, in both `storyreader-holdfast` and `storyreader-gunner`: `tools/publish.mjs`, `tools/tts.mjs`, `brands/holdfast/brand.json` and `brands/gunner/brand.json` (four files total), `app/src/lib/{types,state,player,downloads}.ts`, `app/src/screens/{NowPlaying,Settings}.tsx`, `docs/content-pipeline.md`; runtime `tools/.state/<brand>.json`. No change: `tools/stitch.mjs`, `tools/r2-upload.mjs`, `app/src/reader/AudioController.ts`, `app/src/reader/SpeechFallback.ts`, the worker. Image, Gunner only: new `gunnerthelab.github.io/tools/mai-image.mjs`, `gunnerthelab.github.io/public/images/{stories,covers}/*.png`, `gunnerthelab.github.io/public/images/provenance.json`, `gunnerthelab.github.io/src/content/stories/*.md` frontmatter; read-only prompt source `gunner-studio/resources/Illustration_Prompts_All_Stories.md`.

<!-- safety-scan-worked-example:end -->

---

## Sources

- What is MAI-Voice (preview)? (same Speech SDK/APIs; voice name in SSML `<voice name>`; `mstts:express-as` style/styledegree; prebuilt voice names; region prerequisite; preview, no SLA): <https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices>
- High-definition voices (WordBoundary support matrix, for the read-along gate): <https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices>
- Deploy and use MAI image models in Microsoft Foundry (preview) (generations/edits endpoints; parameters model/prompt/image/width/height; min 768, max 1,048,576 px; PNG output; Entra scope; 400/404/429 troubleshooting): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
- Foundry Models sold by Azure (MAI-Image-2.5 capability and size limits; example valid 768x1365): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure>
- Local grounding (read-only): the consumer repos' pipeline modules and live state (the synth, stitch, publish, and object-storage upload modules plus the markdown lib; both brand config files in each repo; the per-brand state files; the app player), the site images tree and a story file, and the studio prompt library including the character bible. The exact real paths for the production instance are listed in the "Worked example" appendix above.
- Sibling spikes: `ai/research/SPIKE-04-identity-security.md` (auth, RBAC, secret names, responsible AI), `ai/plans/source/ai-voice-mai-voice-2.md`, `ai/plans/source/mai-image-2-5-art-match.md`
