# Multi-voice AI Listen: MAI-Voice-2 build plan

Status: PLAN (feature A2). No implementation and no Azure resources have been created for this work. This document is the deliverable of the planning session (2026-07-11).

This is a methodology plan for adding a multi-voice "Listen" feature, rendered with Microsoft's MAI-Voice-2 neural text-to-speech, to an Azure AI Foundry voice-model build in this repo. It is written to apply to any `<brand>` reader/narration surface served from a shared Azure AI Foundry (AIServices) Speech resource. A concrete first build is carried at the end as a Worked example.

---

## 1. Current-state architecture (the pattern this plan extends)

The reference build is a set of per-brand reader PWAs that share one architecture: a Vite + Preact app, a Cloudflare Worker (Hono + D1 + R2), and a `tools/` publish pipeline. Audio is pre-rendered at publish time and never synthesized at runtime. Any brand added to the platform inherits the same shape.

| Piece | Pattern |
|---|---|
| Narrator voice | Each brand pins one narrator voice in `brands/<brand>/brand.json` under `tts.voice`. Voices differ per brand (for example one en-US multilingual neural narrator, one en-GB HD narrator). Voice-aware audio hashing plus a `--force` republish flag let a brand switch narrator voices cleanly. |
| Synthesis | `tools/tts.mjs`: Azure Speech SDK, one request per block, SSML `<voice>` wrapper, collects `WordBoundary` events into `[charStart, charEnd, startMs, endMs]` word tuples. Output format for example `Audio48Khz96KBitRateMonoMp3`. |
| Stitching | `tools/stitch.mjs`: ffmpeg concat of per-block MP3 chunks, ffprobe-measured offsets, 900 ms silence for scene breaks. Produces one MP3 plus a timings JSON per chapter. |
| Publish | `tools/publish.mjs`: parses site markdown, synthesizes changed chapters, uploads to an R2 bucket under content-hashed immutable keys, regenerates `manifest.json`, fires push notify. Holds a hard monthly character budget (below the F0 500k free neural limit) tracked in `tools/.state/<brand>.json` `charLedger`. |
| Speech resource | One shared Azure Speech resource (region and tier per the build) used across brands. |
| App listen path | `app/src/lib/player.ts` owns playback; fetches `chapter.content` and `chapter.timings` from `contentOrigin`, feeds `app/src/reader/AudioController.ts` (single `<audio>` element plus rAF word-highlight loop). `app/src/screens/NowPlaying.tsx` renders transport, rate, seek, chapter picker. `app/src/reader/SpeechFallback.ts` covers items with no audio using the device voice. |
| Modes | `ConsumptionMode = 'listen' | 'read' | 'both'`; global default in `Settings.defaultMode`, per-item overrides in `state.ts` `itemModes` (IndexedDB). Read + Listen (`both`) drives the word/block highlight off the timings JSON. |
| Offline | `app/src/lib/downloads.ts` caches content + audio + timings per chapter via the Cache API; `DownloadRecord` in IndexedDB. Manifest and artifacts are also served from R2 behind `content.<brand>.com`. The worker serves only `/api/*` (auth, progress, bookmarks, push, admin); content never flows through the worker. |
| Catalog size | Read from publish state per brand: story/chapter counts, total minutes, and extrapolated character counts drive the cost model in section 9. |

Grounding note: a real publish with an HD-class narrator voice produced real per-word timings in practice (the majority of prologue blocks carried word tuples), so the current read-along pipeline is healthy with an HD-class voice. See the Worked example for the exact figures.

## 2. What MAI-Voice-2 is (as of July 2026)

Verified against Microsoft Learn and Microsoft's own model page. Where the docs are silent the item is marked UNKNOWN rather than guessed.

- **Family and status.** MAI-Voice is a family of neural text-to-speech models built on Microsoft's in-house speech foundation models, surfaced through Azure Speech in Foundry Tools. It is in **public preview**: no SLA, "isn't recommended for production workloads." Source: [What is MAI-Voice (preview)?](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)
- **MAI-Voice-2 specifically.** High-fidelity, expressive, prompted TTS; multilingual across 10+ (Microsoft's model page says 15) languages; long-form generation; multi-speaker generation; voice prompting from a 10 to 120 second reference clip is **gated** behind the Custom Neural Voice limited-access review. Sources: [mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices), [microsoft.ai/models/mai-voice-2](https://microsoft.ai/models/mai-voice-2/), [June 2026 Foundry announcement](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/new-mai-models-in-microsoft-foundry-across-text-image-voice-and-speech/4524632)
- **API shape.** Uses the **same Azure Speech APIs and SDKs** as other neural and HD voices. You put the voice name in the SSML `<voice name="...">` element and call the regional `https://<region>.tts.speech.microsoft.com/cognitiveservices/v1` endpoint (REST) or the Speech SDK (`microsoft-cognitiveservices-speech-sdk`, which `tools/tts.mjs` already uses). No Foundry model deployment step is documented; the prerequisite is simply "a Speech resource in a region that supports MAI-Voice-2." SSML `mstts:express-as` with `style` and `styledegree` is supported for expressive control. Source: [mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)
- **Voices (male and female both available).** The published en-US prebuilt voices: Ethan (M), Grant (M), Jasper (M), Harper (F), Iris (F), Olivia (F), plus en-AU Lisa (F) and roughly 40 voices across de, es, fr, hi, hu, it, ko, nl, pt, ro, ru, th, tr, zh locales. Ethan, Harper, and Olivia list rich style sets (happy, sad, excited, whispering, and so on); Grant, Iris, and Jasper list none. **There is no en-GB MAI-Voice-2 voice today**, which matters for any brand whose current narrator is en-GB (British). Microsoft says more locales are added as they become generally available. Source: [mai-voices prebuilt voice table](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices) (Microsoft's consumer model page also names playground voices Acacia, Elm, Birch, Grove; those are not the Azure Speech prebuilt names)
- **Regions.** The Speech regions table marks "MAI voices" available in: canadacentral, centralindia, **eastus**, eastus2, francecentral, southeastasia, swedencentral, westeurope, westus2. An existing resource in eastus is supported, and eastus is also one of only three regions flagged for "Voices and styles in preview." Source: [Speech regions](https://learn.microsoft.com/azure/ai-services/speech-service/regions#regions)
- **Pricing.** Microsoft's model page states **$22 per 1M characters**; press coverage corroborates ($22 per 1M was also MAI-Voice-1's price). The exact Azure meter should be confirmed on the [Azure Speech pricing page](https://azure.microsoft.com/pricing/details/speech/) at provisioning time. For comparison, standard neural voices bill at a lower rate and F0 includes 500k free neural chars per month. Sources: [microsoft.ai/models/mai-voice-2](https://microsoft.ai/models/mai-voice-2/), [pricing page](https://azure.microsoft.com/pricing/details/speech/)
- **Rate limits and input caps.** MAI voices inherit the general Speech real-time TTS limits unless stated otherwise: F0 = 20 transactions per 60 seconds (why `tts.mjs` spaces requests 3.1 s apart), S0 = 200 TPS default; maximum 10 minutes of audio per request; 64 KB SSML per turn. MAI-specific overrides: UNKNOWN (none documented). Source: [Speech quotas and limits](https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits)
- **Word/timestamp metadata: UNKNOWN.** The MAI-Voice docs do not mention `WordBoundary` events at all. Among HD-class voices, Dragon HD Omni explicitly supports word boundary events while base DragonHD documentation does not list them (yet a DragonHD publish in the Worked example did emit them in practice, so docs and behavior can differ). Until a spike proves MAI-Voice-2 emits usable word boundaries, **treat MAI-Voice-2 tracks as listen-only**, which matches the feature spec. If the spike shows good boundaries, read-along could later migrate to an MAI narrator; if not, this plan's listen-only split is confirmed. Sources: [mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices), [HD voices](https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices)
- **Latency posture.** Learn says the model "prioritizes naturalness and expressivity over latency-critical scenarios" (the consumer page markets low latency for long generations). Either way it fits pre-render better than interactive synthesis. Source: [mai-voices key features](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)
- **F0 (free tier) eligibility: UNKNOWN.** Nothing documents whether MAI voices synthesize on an F0 resource. The plan assumes a Standard (S0) resource and treats every MAI character as billable at the $22 per 1M rate.
- **Batch synthesis support for MAI voices: UNKNOWN** (batch is S0-only in any case). The plan keeps the real-time SDK path the pipeline already uses.

## 3. Goal and non-goals

Goal: in **Listen mode only**, let the reader pick from multiple AI narrator voices, at least one man and one woman per brand, rendered with MAI-Voice-2 from one shared Azure AI Foundry resource in the target tenant/subscription.

- **Read + Listen (read-along) keeps the existing per-brand narrator voice.** The word-sync highlight depends on the proven WordBoundary pipeline; MAI-Voice-2 timing metadata is unverified. Rule of thumb for v1: the highlight always follows the narrator track.
- Non-goal: on-demand/runtime synthesis in the worker or browser (see architecture below for why).
- Non-goal: voice cloning / voice prompting (gated access; not needed).
- Non-goal: per-item voice memory in v1 (one global "Listen voice" setting; per-item can come later via the existing `itemModes` pattern).
- Non-goal: changing SpeechFallback (device voice remains the no-audio fallback).

## 4. Architecture options

### Option A: publish-time pre-render per voice to R2 (recommended)

Extend `publish.mjs` to synthesize each chapter once per configured listen voice and upload the extra MP3s alongside today's artifacts. The manifest lists the variants; the app picks a track.

- Storage cost = stories x voices, at about 0.72 MB per audio-minute at 96 kbps mono. Typical reader catalogs with two extra voices stay well inside R2's 10 GB free tier, and R2 egress is free (see Worked example for concrete catalog figures).
- Predictable dollar cost, enforced by extending the existing char-ledger budget guard.
- Offline downloads keep working: a voice variant is just one more immutable-hashed file for `downloads.ts` to cache.
- No key at runtime: the Speech key stays in `.dev.vars` on the publishing machine, exactly like today. The worker and app never see it.
- Con: back-catalog backfill costs synth time and money up front, and a new voice added later means a full re-render for that voice.

### Option B: on-demand synthesis via worker proxy with R2 caching

A new worker route synthesizes on first listen, caches to R2, streams to the client.

- Con (disqualifying): long chapters exceed the **10 minutes of audio per request** service cap (the reference catalog's longest chapters run well past 10 minutes; see Worked example), so the worker would need to synthesize per block and stitch, and **Cloudflare Workers cannot run ffmpeg/ffprobe**, which is exactly how the pipeline stitches today. Raw MP3 concatenation without re-encode inside a worker is fragile and would fork the audio path.
- Con: first-listen latency of minutes for long chapters, against a model documented as not latency-optimized.
- Con: the Speech key becomes a runtime secret in the worker, and unbounded per-request cost replaces the current fixed publish-time budget.
- Pro: zero backfill cost for voices nobody listens to.

### Option C: hybrid (pre-render top voices for new content, on-demand for back catalog)

Inherits Option B's worker-stitching and key problems for the back catalog, and adds two code paths to maintain for a catalog that costs only a few dollars per voice to backfill outright.

### Recommendation: Option A

The deciding facts: the stitcher requires ffmpeg (publish machine only), typical chapters blow past the 10-minute-per-request cap, the apps are offline-first by design, and the pipeline already runs a strict publish-time character budget. Pre-render is the only option that keeps all four properties. At reader-catalog sizes the entire two-voice backfill costs less than a hardcover book.

## 5. Provisioning runbook (no resources created yet; confirm before any az write)

Per repo policy, creating Azure resources requires explicit confirmation first. Placeholder names below follow CAF; substitute the workload/env/region for the real build. Steps once approved:

1. **Tenant/subscription**: the target tenant/subscription (same place as the platform Key Vault).
2. **Resource group**: `rg-<workload>-voice-01` (or fold into an existing shared workload RG if the governance MCP prefers; run `validate` against the naming standard before creating).
3. **Resource**: one **Azure AI Foundry resource** (kind `AIServices`, which includes Speech) named `aif-<workload>-voice-01`, or a plain Speech resource `spch-<workload>-voice-01` if Foundry-resource keys prove awkward with the regional `tts.speech.microsoft.com` endpoint. Region **eastus** (MAI voices supported there, matches a common existing resource region, and eastus carries the "voices and styles in preview" flag). Tier **S0** (F0 support for MAI voices is unverified, and the MAI meter has no documented free allotment).
4. **Foundry project** (optional but matches the standard Foundry layout): `<workload>-voice`, used mainly for the playground when auditioning voices.
5. **Spike before any code** (about 30 minutes): a throwaway `tools/spike-mai.mjs` in one repo that synthesizes two paragraphs with `en-US-Ethan:MAI-Voice-2` against the new key and records: (a) does an existing F0 key also work for MAI voices, (b) is `Audio48Khz96KBitRateMonoMp3` accepted (docs examples use 24 kHz 160 kbps; if 48/96 is rejected, standardize variants on `Audio24Khz160KBitRateMonoMp3` and accept about 1.7x file size), (c) do `WordBoundary` events fire with sane offsets, (d) rough per-block latency. The word-boundary answer goes back into this doc.
6. **Secrets**: key and region go to the platform Key Vault as `<workload>-mai-speech-key` and `<workload>-mai-speech-region`, then into each repo's local `.dev.vars` as `MAI_SPEECH_KEY` / `MAI_SPEECH_REGION` (never committed; `.dev.vars` is already gitignored). The worker needs no new secret (Option A keeps synthesis at publish time).
7. **Cost guard**: set a budget alert on the resource group so a runaway publish loop cannot surprise anyone.

## 6. Pipeline changes (both repos; port the voice-aware hash and `--force` to any brand lacking them first)

1. **brand.json**: add a `tts.listenVoices` array alongside the existing `tts.voice` narrator, for example:

   ```json
   "tts": {
     "voice": "<brand-narrator-voice>",
     "outputFormat": "Audio48Khz96KBitRateMonoMp3",
     "listenVoices": [
       { "id": "en-US-Ethan:MAI-Voice-2",  "slug": "ethan",  "label": "Ethan",  "gender": "m" },
       { "id": "en-US-Olivia:MAI-Voice-2", "slug": "olivia", "label": "Olivia", "gender": "f" }
     ]
   }
   ```

2. **tts.mjs**: accept an options bag with `key`/`region` per call (narrator keeps `AZURE_SPEECH_KEY`/`AZURE_SPEECH_REGION`; variants use `MAI_SPEECH_KEY`/`MAI_SPEECH_REGION`). Tolerate empty `words` arrays (variants do not need timings). Keep request spacing configurable (3.1 s for F0, can drop for S0).
3. **publish.mjs**:
   - New flag `--voices <all|slug[,slug]|none>` (default `none`, today's behavior unchanged).
   - Variant synthesis is keyed by its own voice-aware hash (`contentHash({blocks, title, voice})`, the mechanism the voice-aware hashing commit introduced), stored per chapter in state as `variants: { [slug]: { hash, durationMs } }`, so a `--voices all` run backfills only missing or stale variants **without re-synthesizing the narrator track** of unchanged chapters.
   - Upload variants to `books/<bookId>/audio/<chapterId>.<slug>.<voiceHash>.mp3` (immutable, safe with the existing caching).
   - **Ledger**: add `state.maiLedger[month] = { chars, estUsd }` (chars x 22 / 1,000,000) printed at the end of every run, plus a `--mai-budget-usd <n>` hard stop mirroring the existing F0 stop. Note in the runbook that the F0 `charLedger` is per brand-state but the underlying F0 resource is shared across brands, so real F0 usage is the sum.
   - **Manifest** (additive, schemaVersion stays 1, matching the UI v2 precedent of optional fields): each chapter entry gains

     ```json
     "audioVariants": [
       { "voice": "en-US-Ethan:MAI-Voice-2", "slug": "ethan", "label": "Ethan", "gender": "m",
         "audio": "books/<bookId>/audio/<chapterId>.<slug>.<hash>.mp3", "durationMs": 1234567 }
     ]
     ```

     `audio`/`timings`/`hasAudio`/`audioDurationMs` keep meaning the narrator track, so older app builds ignore variants entirely.
4. **stitch.mjs**: no changes (runs once per voice).
5. **docs/content-pipeline.md** in both repos: document the variant flow and the two-resource key split.

## 7. App changes (both apps; the code is intentionally near-identical)

1. **types.ts**: `AudioVariant { voice; slug; label; gender; audio; durationMs }`; `ChapterEntry.audioVariants?: AudioVariant[]`; `Settings.listenVoice?: string` (slug, default `'narrator'`).
2. **state.ts**: default `listenVoice: 'narrator'` in the settings signal (persisted via the existing `saveSettings` path). `itemModes` logic is untouched; only the `listen` consumption mode consults the voice setting.
3. **player.ts**:
   - Track resolution in `startPlayback`: mode `both` (or `readAlong` active) always loads the narrator `chapter.audio` + `chapter.timings`. Pure listen mode loads the variant whose slug matches `settings.listenVoice` when present, else the narrator. Variants load with `timings = null`, which `AudioController` already handles (no highlight).
   - New `setListenVoice(slug)` that captures `position/duration` as a fraction, swaps `audio.src` to the new track, seeks to `fraction x newDuration`, and resumes. Seeking by fraction (not ms) because narration pace differs per voice.
   - `NowPlayingItem` gains the available variants so the UI can render the picker.
4. **NowPlaying.tsx**: a voice chip row under the mode chip (`Narrator`, `Ethan`, `Olivia`), rendered only when `audioVariants` exist; tapping a chip calls `setListenVoice`. The read-along button keeps navigating to `mode=both`, which by the rule above switches audio back to the narrator track at the equivalent fraction.
5. **Settings.tsx** (PlaybackSection): a `Listen voice` select (Narrator plus each variant) with the note "Read + Listen always uses the narrator so the highlight stays in sync."
6. **downloads.ts**: when downloading a chapter, also fetch the variant matching the current `listenVoice` (if any). Extend `DownloadRecord` with `voices: string[]`. Removal already deletes by URL prefix so variants are covered.
7. **SpeechFallback.ts / AudioController.ts / worker**: no changes.

## 8. Rollout order

1. Spike (section 5 step 5) and voice audition in the Foundry playground. Decisions land in this doc.
2. Provision the shared resource (after explicit confirmation), store secrets.
3. Port the voice-aware hash + `--force` to any brand's `publish.mjs` that lacks them (small, standalone commit).
4. Pipeline changes behind `--voices` (both repos, smaller brand first).
5. **Pilot on the smallest catalog**: `node tools/publish.mjs --brand <brand> --voices all`. A couple of chapters, a dollar or two for two voices. Verify variants in R2 and the manifest.
6. Pilot brand app UI (types, player, NowPlaying, Settings, downloads), deploy, **verify on the installed PWA** (voice picker appears, switch mid-chapter holds position, read-along still highlights on the narrator).
7. Larger brand: same app changes; backfill the full catalog x each voice. Run overnight; publish state makes it resumable.
8. Update `docs/content-pipeline.md` + runbooks in both repos; add the MAI ledger to the publish output.

Migration for existing audio: none. Narrator tracks, timings, URLs, and old manifests are untouched; variants are purely additive, and app builds that predate the schema ignore them.

## 9. Cost model

Drivers, general to any brand (verify the meter at provisioning):

- **Synthesis**: $22 per 1M characters x (catalog characters) x (number of listen voices). One-time for a back-catalog backfill; per new chapter thereafter.
- **Storage**: about 0.72 MB per audio-minute at 96 kbps mono MP3, x voices. R2's 10 GB free tier and free egress absorb typical reader catalogs.
- **Ongoing**: each new chapter costs (its characters x 22 / 1,000,000) per voice.
- **Non-costs**: R2 egress is free, the worker is unchanged, and the narrator/read-along path stays on the existing F0 free allotment. A third voice later adds another full catalog-render's synthesis and storage.

Filled-in figures for the reference catalog are in the Worked example.

## 10. Risks and open questions

Risks, briefly:

- **Public preview, no SLA.** Voices could change, move regions, or be renamed before GA. Mitigation: audio is pre-rendered into R2, so listeners are never exposed to a live outage; a retired voice just means one re-render.
- **Word-boundary support is unverified** for MAI-Voice-2 (docs silent). v1 is listen-only by design, so this only limits a future read-along migration.
- **No en-GB MAI voice** yet; a brand with an en-GB narrator would offer American/Australian listen voices next to a British narrator.
- **F0 compatibility unknown**; budget assumes every MAI character is paid S0 usage.

Decisions needed for any build (short list):

1. **Approve the spend**: the one-time backfill plus a small monthly ongoing cost, on a new shared S0 resource with a monthly budget alert. Yes or no?
2. **Pick the voices** (about 10 minutes in the Foundry playground, aka.ms/foundry-text-to-speech). Favor style-capable voices with at least one man and one woman.
3. **Accent handling**: for a brand with an en-GB narrator, accept en-US/en-AU listen voices next to it, or hold that brand until Microsoft ships en-GB MAI voices and pilot on another brand first?
4. **Preview risk**: comfortable shipping preview-model audio? Fallback if not: Dragon HD Omni voices (word boundaries documented, HD pricing reduced in March 2026) deliver multi-voice today on the GA-track surface.
5. **Budget cap default** for the publish guard (`--mai-budget-usd`).

## Sources

- What is MAI-Voice (preview)? Microsoft Learn: <https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices>
- Speech service supported regions (MAI voices column): <https://learn.microsoft.com/azure/ai-services/speech-service/regions#regions>
- Speech service quotas and limits (F0/S0 TPS, 10 min audio cap, 64 KB SSML): <https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits>
- High-definition voices (word boundary support matrix): <https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices>
- What's new in Azure Speech (March 2026: MAI-Voice-1 preview in East US; HD price cut): <https://learn.microsoft.com/azure/ai-services/speech-service/releasenotes>
- MAI-Voice-2 model page ($22 per 1M characters, 15 languages): <https://microsoft.ai/models/mai-voice-2/>
- New MAI models in Microsoft Foundry (June 2026 announcement): <https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/new-mai-models-in-microsoft-foundry-across-text-image-voice-and-speech/4524632>
- Azure Speech pricing: <https://azure.microsoft.com/pricing/details/speech/>
- Foundry model catalog entry: <https://ai.azure.com/catalog/models/MAI-Voice-2>

<!-- safety-scan-worked-example:start -->
## Worked example: Brand A / Brand B

This is the concrete first build this plan was written for (planning session 2026-07-11). It carries the real brands, apps, resource names, catalog figures, and the owner's locked decisions. Everything above is the reusable methodology; everything here is the instance.

### Brands and reader apps

- **Brand A**: Brand A's reader app, Brand A's publish pipeline.
- **Brand B**: Brand B's reader app, Brand B's publish pipeline.

Both are the reader apps on the shared Vite + Preact / Cloudflare Worker (Hono + D1 + R2) / `tools/` pipeline architecture described in section 1.

### Real current state

| Piece | Real value |
|---|---|
| Narrator voice | Brand A: `en-US-AndrewMultilingualNeural`. Brand B: `en-GB-Ryan:DragonHDLatestNeural` (switched in commit `820a05f`, which also added the `--force` republish flag and voice-aware audio hashing). Configured in `brands/<brand>/brand.json` under `tts.voice`. |
| Output format | `Audio48Khz96KBitRateMonoMp3`. |
| Speech resource | One shared Azure Speech key (region `eastus`, F0 tier) used by both brands (verified: both repos' `.dev.vars` carry the identical key). July 2026 ledger: Brand B 95,085 + Brand A 27,503 = 122,588 chars of the shared 500k. |
| Content origin | An R2 bucket per brand, served behind each brand's content domain (no url). |
| Catalog size (from publish state) | Brand A: 42 stories, all with audio, about 463 minutes total (roughly 450k characters extrapolated from story 01's 976 chars/min). Brand B: 2 chapters (prologue + chapter one), about 31 minutes, 31,630 characters. |

Grounding note (the section 1 grounding note, with real figures): the July 6 Brand B publish with the Dragon HD voice produced real per-word timings (78 of 84 prologue blocks carry word tuples), so the current read-along pipeline is healthy with an HD-class voice.

### Real provisioning targets

- **Tenant/subscription**: the target tenant/subscription (same place as the platform Key Vault).
- **Resource group**: `rg-<workload>-voice-01` (or fold into an existing shared workload RG).
- **Resource**: Azure AI Foundry resource (kind `AIServices`) named `aif-<workload>-voice-01`, or plain Speech resource `spch-<workload>-voice-01`. Region `eastus`, tier S0.
- **Foundry project**: `<workload>-voice`.
- **Secrets**: `<workload>-mai-speech-key` and `<workload>-mai-speech-region` in the platform Key Vault, then into each repo's `.dev.vars` as `MAI_SPEECH_KEY` / `MAI_SPEECH_REGION`.
- Section 6 pipeline note: the voice-aware hash + `--force` port targets Brand A first (Brand B already carries them from commit `820a05f`).

### Real architecture-option figures

- Option A storage: Brand A about 334 MB per extra voice, Brand B about 22 MB (at 96 kbps mono). Two extra voices for both brands is under 0.8 GB against R2's 10 GB free tier.
- Option B disqualifier: chapters exceed the 10-minutes-per-request cap (Brand A story 01 is 28 minutes; Brand B's longest chapter is 21.6 minutes).
- Option C: the catalog costs about $10 per voice to backfill outright.

### Real cost estimate

Assumes $22 per 1M characters, two listen voices per brand, current catalog sizes, 96 kbps mono MP3 (about 0.72 MB/min).

| Item | Characters | One-time cost | Storage added |
|---|---|---|---|
| Brand A backfill, per voice | ~450,000 | ~$9.90 | ~334 MB |
| Brand A backfill, 2 voices | ~900,000 | ~$19.80 | ~668 MB |
| Brand B backfill (2 chapters), per voice | 31,630 | ~$0.70 | ~22 MB |
| Brand B backfill, 2 voices | 63,260 | ~$1.40 | ~44 MB |
| **Total initial (both brands, 2 voices each)** | ~963,000 | **~$21** | ~0.7 GB |

| Ongoing | Characters | Cost per voice | Cost at 2 voices |
|---|---|---|---|
| New Brand A story (~11 min) | ~11,000 | ~$0.24 | ~$0.48 |
| New Brand B chapter (~15 min) | ~16,000 | ~$0.35 | ~$0.70 |
| Typical month (1 story + 1 chapter) | ~27,000 | ~$0.59 | ~$1.19 |
| Brand B's full novel eventually (~400k chars) | ~400,000 | ~$8.80 | ~$17.60 |

A third voice later adds roughly $10.60 (both catalogs) plus ~356 MB. R2 usage stays inside the 10 GB free tier (about 7% consumed by the full two-voice build-out).

### Real rollout specifics

- **Brand B pilot**: `node tools/publish.mjs --brand brand-b --voices all`. Two chapters, about $1.40 for two voices, about 30 minutes at F0 pacing.
- **Brand A backfill**: 42 stories x 2 voices (about $20, roughly 2 hours per voice at F0 pacing, faster if the MAI resource is S0 and spacing is reduced). Run overnight; publish state makes it resumable.

### Owner decisions (2026-07-11)

1. **Spend: APPROVED.** Owner has substantial Azure credit in the target subscription that resets soon; burn what is needed ASAP ("the sooner the better").
2. **Voices (same set for BOTH brands):** keep each brand's current narrator as the default listen track AND the read-along voice (Brand A `en-US-AndrewMultilingualNeural`, Brand B `en-GB-Ryan:DragonHDLatestNeural`). Add listen-only options: **Harper** (F, en-US, owner's pick over Olivia: "more upbeat"), **Lisa** (F, en-AU; owner said "Isla," corrected to the actual en-AU voice name), **Ethan** (M, en-US, rendered with the `excited` style since his natural register reads flat; Ethan is the only style-capable male). Olivia: skipped for v1, may revisit with styles.
3. **Brand B accent:** accepted. British narrator stays default; en-US/en-AU listen options ship alongside.
4. **Preview risk: ACCEPTED** (owner: "number 4, option a").
5. **Budget:** no per-run cap until the owner's subscription credit resets (move fast now); thereafter **$100/month** cap (supersedes the $15 proposal; set `--mai-budget-usd` default and the Azure budget alert to 100).
6. **Future wish:** a custom Celtic voice via MAI-Voice-2 voice prompting; gated behind the Custom Neural Voice limited-access review. Apply later; not v1.
<!-- safety-scan-worked-example:end -->
