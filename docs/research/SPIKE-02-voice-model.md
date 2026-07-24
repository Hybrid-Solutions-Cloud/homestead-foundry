# SPIKE-02: MAI-Voice-2 text-to-speech model

Status: research spike complete (2026-07-11). Author: foundry-researcher (Opus). No Azure resources were created, read, or modified for this spike; it is a documentation and first-party source review only.

Scope: resolve the voice-model unknowns behind a multi-voice AI listen feature (here, the source plan's feature A2) before any resource is provisioned. The findings below are general to any Azure AI Foundry MAI-Voice-2 build in this repo; the concrete voice cast, narrator tracks, and brand context this spike was first run for are isolated in the worked-example section at the end. Companion to the source plan `ai/plans/source/ai-voice-mai-voice-2.md` and the infrastructure check `ai/verification/environment-readiness.md`.

Grounding rule: every factual claim below is tied to a first-party Microsoft source with an inline URL. Anything the sources do not state is marked UNKNOWN with the test that would resolve it. No figure here is invented.

---

## Question

Seven questions from the tasking, answered against Microsoft Learn and Microsoft's own model page:

1. Availability and access in East US; AIServices vs SpeechServices resource; SDK/endpoint pattern.
2. Prebuilt voice names (en-US Ethan, Grant, Jasper, Harper, Iris, Olivia; en-AU Lisa), which support expressive styles, whether Ethan has an "excited" style, and whether any en-GB MAI-Voice-2 voice exists.
3. Read-along feasibility: does MAI-Voice-2 emit `WordBoundary` / word-timestamp events through the Speech SDK.
4. Tier: does MAI-Voice-2 work on Speech F0 (free) or require S0.
5. Pricing and limits: 22 USD per 1M characters; rate limits; max audio per request; SSML size per turn.
6. Batch synthesis: is there a batch path that speeds backfill, and does it cover MAI-Voice-2.
7. Style controls: how style and style degree are expressed in SSML.

---

## Findings

### 1. Availability and access (East US, resource kind, endpoint pattern)

- **Status is public preview.** The MAI-Voice landing page carries the standard preview banner: "This feature is currently in public preview. This preview is provided without a service-level agreement, and isn't recommended for production workloads." ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices))
- **East US is a supported region for MAI voices.** The live Speech regions table (Text to speech tab) has a dedicated "MAI voices" column; the `eastus` row is checked for it, alongside `canadacentral`, `centralindia`, `eastus2`, `francecentral`, `southeastasia`, `swedencentral`, `westeurope`, and `westus2`. The `eastus` row is also checked for "Voices and styles in preview" (only `eastus`, `southeastasia`, and `westeurope` carry that flag). ([regions](https://learn.microsoft.com/azure/ai-services/speech-service/regions))
- **No Foundry model deployment step.** The only prerequisite listed for MAI-Voice-2 is "A Speech resource in a region that supports MAI-Voice-2." There is no `az cognitiveservices account deployment create` step. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)) This matches the infrastructure check, which found MAI-Voice-2 is absent from `az cognitiveservices model list` for East US by design, because it is selected at call time by voice name rather than deployed. ([environment-readiness.md](../verification/environment-readiness.md))
- **An AIServices (Foundry) resource can serve it; a standalone SpeechServices resource is not required.** MAI-Voice "uses the same Azure Speech APIs and SDKs as other Azure neural and HD voices" and authenticates with a Speech resource key and region against the regional TTS endpoint. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)) The `AIServices` kind includes Speech, and the environment check independently confirmed an `AIServices` S0 account is offerable in `eastus` and is the correct kind to also host the MAI-Image-2.5 deployment, so one shared resource covers both initiatives. ([environment-readiness.md](../verification/environment-readiness.md)) An existing SpeechServices F0 TTS account (the prior, pre-Foundry resource) is the wrong kind for the image work, which is why a new `AIServices` S0 resource is being provisioned regardless.
- **SDK / endpoint pattern (documented, first-party):**
  - REST: `POST https://<region>.tts.speech.microsoft.com/cognitiveservices/v1` with headers `Content-Type: application/ssml+xml`, `X-Microsoft-OutputFormat` (the doc example uses `audio-24khz-160kbitrate-mono-mp3`), and `Ocp-Apim-Subscription-Key: <key>`; body is the SSML. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices))
  - Speech SDK (Python example on the page): `speechsdk.SpeechConfig(subscription="<key>", region="eastus")`, then set the output format and submit SSML via `speak_ssml_async(...)`. This is the same `microsoft-cognitiveservices-speech-sdk` path `tools/tts.mjs` already uses. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices))
  - Voice selection is purely the SSML `<voice name="...">` attribute, for example `en-US-Harper:MAI-Voice-2`. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices))

### 2. Voices, styles, "excited" on Ethan, and no en-GB voice

The MAI-Voice-2 prebuilt-voice table on Microsoft Learn lists exact names, locales, genders, and supported styles. The relevant rows, quoted from that table ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)):

| Voice name (ShortName) | Locale | Gender | Supported styles (as published) |
|---|---|---|---|
| `en-US-Ethan:MAI-Voice-2` | en-US | Male | angry, confused, determined, disgusted, embarrassed, **excited**, fearful, happy, hopeful, jealous, joyful, regretful, relieved, sad, shouting, softvoice, surprised, whispering |
| `en-US-Grant:MAI-Voice-2` | en-US | Male | (none listed) |
| `en-US-Jasper:MAI-Voice-2` | en-US | Male | (none listed) |
| `en-US-Harper:MAI-Voice-2` | en-US | Female | angry, confused, determined, embarrassed, **excited**, happy, hopeful, joyful, regretful, relieved, sad, shouting, softvoice, whispering |
| `en-US-Iris:MAI-Voice-2` | en-US | Female | (none listed) |
| `en-US-Olivia:MAI-Voice-2` | en-US | Female | angry, confused, determined, disgusted, embarrassed, **excited**, fearful, happy, hopeful, jealous, joyful, regretful, relieved, sad, shouting, softvoice, surprised, whispering |
| `en-AU-Lisa:MAI-Voice-2` | en-AU | Female | angry, confused, determined, disgusted, embarrassed, **excited**, fearful, happy, hopeful, jealous, joyful, regretful, relieved, sad, shouting, softvoice, surprised, whispering |

- **All six proposed en-US names and en-AU Lisa are confirmed as published prebuilt voices**, with the exact genders the source plan assumed. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices))
- **The owner's three locked voices all support expressive styles:** Harper (en-US, F), Lisa (en-AU, F), and Ethan (en-US, M) each list a style set, and **"excited" is in every one of those three sets**, so the owner's plan to render Ethan with the `excited` style is supported by the published styles. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices))
- **Ethan is the only style-capable en-US male.** Grant and Jasper list no styles; Ethan is the sole en-US male voice with a published style set. This confirms the plan's reasoning for choosing Ethan as the male listen voice. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices))
- **There is no en-GB MAI-Voice-2 voice today.** The prebuilt table's only English locales are en-AU (Lisa) and en-US (the six above). No en-GB row exists. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)) This is why a build whose existing British narrator uses `en-GB-Ryan:DragonHDLatestNeural` has no MAI equivalent for it, so that build's AI listen voices would be American (en-US) and Australian (en-AU) next to the British narrator (see the worked example). Microsoft notes more locales are added as they become generally available.

### 3. Read-along feasibility: WordBoundary / word timestamps

- **The MAI-Voice documentation does not mention `WordBoundary` events at all.** The page lists key features (high-fidelity synthesis, multilingual, expressive SSML, voice prompting, long-form, multi-speaker) with no reference to word boundaries or word-level timing. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices))
- **`WordBoundary` is the standard Speech SDK synthesizer event that read-along needs.** It "is raised at the beginning of each new spoken word, punctuation, and sentence," reporting the word's time offset in ticks from the start of the audio and the character position in the input text or SSML immediately before the word. That is exactly the `[charStart, charEnd, startMs, endMs]` data `tools/tts.mjs` collects. ([how-to-speech-synthesis](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis#subscribe-to-synthesizer-events))
- **Among advanced voice families, WordBoundary support is inconsistent and is documented per model, which is the crux of the risk:**
  - Dragon HD Omni **explicitly supports word boundary events**, with a worked Python example showing `synthesis_word_boundary` firing and returning Text, AudioOffset (ms), and TextOffset. ([high-definition-voices](https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices))
  - Base DragonHD does **not** document word boundary events (the HD page calls them out only under Dragon HD Omni). ([high-definition-voices](https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices))
  - For personal voice, the SDK feature matrix shows Word boundary "Supported in Phoenix: Yes, Supported in Dragon: No." ([personal-voice-how-to-use](https://learn.microsoft.com/azure/ai-services/speech-service/personal-voice-how-to-use#supported-and-unsupported-sdk-features-for-personal-voice))
- MAI-Voice-2 is described as "Similar to Azure Neural HD voices," but the docs do not say which HD family's event behavior it inherits. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)) Because word-boundary support splits within the HD and personal-voice families, it **cannot be assumed for MAI-Voice-2 and must be measured empirically.** This is UNKNOWN (see below) and is the single fact that decides whether MAI voices could ever drive read-along highlighting or must stay listen-only. It directly supports the plan's v1 rule: the read-along highlight follows the existing narrator track, and MAI voices ship listen-only.

### 4. Tier: F0 (free) vs S0 (standard)

- **No Microsoft source states whether MAI-Voice-2 synthesizes on an F0 (Free) resource.** The MAI-Voice page's only resource prerequisite is "a Speech resource in a region that supports MAI-Voice-2," with no tier statement. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)) This is UNKNOWN.
- Two documented signals bound the question without resolving it:
  - The real-time TTS quota row that defines the F0 throttle (20 transactions / 60 seconds) is written "for standard voices and custom voices." It does not name MAI or HD voices, so it neither confirms nor denies F0 eligibility for MAI voices. ([speech-services-quotas-and-limits](https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits))
  - The batch synthesis path is explicitly "Not available for F0" (S0 only), so any batch-assisted backfill is S0-only regardless of the real-time answer. ([speech-services-quotas-and-limits](https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits))
- **This is not on the critical path.** The new shared resource is `AIServices` S0 (required for the MAI-Image-2.5 deployment anyway), so the build proceeds on S0 and treats every MAI character as billable. ([environment-readiness.md](../verification/environment-readiness.md)) Whether the old F0 SpeechServices key also happens to synthesize MAI voices is a nice-to-know the spike script can probe, not a blocker.

### 5. Pricing and limits

- **Price: 22 USD per 1M characters.** Microsoft's own model page states "$22 per 1M characters" for MAI-Voice-2 (and the same for MAI-Voice-1). ([microsoft.ai/models/mai-voice-2](https://microsoft.ai/models/mai-voice-2/)) For scale, the Learn quota-increase example prices standard neural voices at "$15 per million characters," so the MAI meter sits above standard neural, consistent with the plan's assumption. ([speech-services-quotas-and-limits](https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits)) The exact Azure billing-meter name for the MAI voice charge is UNKNOWN (see below).
- **Real-time rate limits (per resource):** F0 = "20 transactions per 60 seconds" (not adjustable); S0 = "200 transactions per second (TPS)" default, adjustable up to 1,000 TPS. ([speech-services-quotas-and-limits](https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits)) The F0 figure is why `tools/tts.mjs` spaces requests about 3.1 s apart; S0 removes that constraint.
- **Max audio length per request: 10 minutes**, for both F0 and S0. ([speech-services-quotas-and-limits](https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits)) This is the cap that forces per-block synthesis plus stitching for long chapters and rules out the plan's on-demand worker option.
- **SSML size per turn: 64 KB** ("Maximum SSML message size per turn for WebSocket," F0 and S0). Also relevant: a single SSML request may contain at most 50 distinct `<voice>` and `<audio>` tags. ([speech-services-quotas-and-limits](https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits))
- **Billing basis:** text-to-speech is billed per character including letters, numbers, spaces, punctuation, and markup within the text field (excluding the `<speak>` and `<voice>` tags themselves), whether or not audio is produced; each Chinese character, Japanese kanji, and Korean hanja counts as two characters. ([text-to-speech pricing note](https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech#pricing-note)) The catalog here is English, so the 1:1 character count in the plan's cost table holds.

### 6. Batch synthesis

- **A batch synthesis API exists and is generally available.** It "can synthesize a large volume of text input (long and short) asynchronously" and "can create synthesized audio longer than 10 minutes," which is the one hard limit the real-time path cannot cross in a single request. It is asynchronous: submit text, poll status, download output. ([batch-synthesis](https://learn.microsoft.com/azure/ai-services/speech-service/batch-synthesis))
- **East US supports the Batch synthesis API** (the regions Text-to-speech tab checks "Batch synthesis API" for `eastus`). ([regions](https://learn.microsoft.com/azure/ai-services/speech-service/regions))
- **Batch constraints:** S0 only ("Not available for F0"); 100 requests per 10 seconds; JSON payload up to 2 MB per job; up to 10,000 text inputs per job; no cap on concurrent active jobs; history kept up to 31 days. ([speech-services-quotas-and-limits](https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits))
- **Whether batch covers MAI-Voice-2 specifically is UNKNOWN.** The migration guide states "Batch synthesis API supports all text to speech voices and styles," linking to the general language-support list. ([migrate-to-batch-synthesis](https://learn.microsoft.com/azure/ai-services/speech-service/migrate-to-batch-synthesis)) That is suggestive but not explicit for a preview model, and there is clear precedent for advanced voice classes being excluded from batch: Azure Speech HD voices are documented as "Real-time only," not batch. ([high-definition-voices](https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices)) Since MAI-Voice-2 is positioned "similar to HD voices," batch eligibility should be verified before relying on it.
- **Practical note:** batch is an optimization, not a requirement. The pipeline already synthesizes per block with the real-time SDK and stitches with ffmpeg, and Microsoft documents the same SDK "synthesize in chunks" approach as the alternative to batch for audio over 10 minutes. ([batch-synthesis](https://learn.microsoft.com/azure/ai-services/speech-service/batch-synthesis)) Batch would mainly cut wall-clock time on the one-time back-catalog backfill if it turns out to accept MAI voices.

### 7. Style controls in SSML

- **MAI-Voice-2 supports `mstts:express-as` with `style` and `styledegree`** for fine-grained expressive control. ([mai-voices key features](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)) The documented example, verbatim from the page:

  ```xml
  <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
    <voice name="en-US-Harper:MAI-Voice-2">
      <mstts:express-as style="happiness" styledegree="1.2">
        Welcome to Microsoft Build. MAI Voice 2 supports multilingual expressive synthesis.
      </mstts:express-as>
    </voice>
  </speak>
  ```

  ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices))
- **`styledegree`** is a positive multiplier on style intensity (the example uses `1.2`); Microsoft documents style-degree adjustment as supported for some voices depending on locale, via the `mstts:express-as` tag. ([faq-tts](https://learn.microsoft.com/azure/ai-services/speech-service/faq-tts), [speech-synthesis-markup-voice](https://learn.microsoft.com/azure/ai-services/speech-service/speech-synthesis-markup-voice)) For the Ethan "excited" case the SSML would be `<mstts:express-as style="excited" styledegree="...">...</mstts:express-as>` inside the `en-US-Ethan:MAI-Voice-2` voice element, using the token as published in the prebuilt table.
- **One token-form discrepancy to validate:** the prebuilt-voice table lists style tokens in adjective form (`excited`, `happy`), while the SSML examples on the same page use noun forms (`style="happiness"` for MAI-Voice-2, `style="excitement"` for MAI-Voice-1). The exact accepted string for Ethan's excited style should be confirmed in the spike; the prebuilt table value (`excited`) is treated as authoritative here. ([mai-voices](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices))

---

## What is still UNKNOWN

| # | Unknown | Why it is not in the docs | What resolves it |
|---|---|---|---|
| 1 | **Does MAI-Voice-2 emit usable `WordBoundary` events?** (governs any future read-along on AI voices) | The MAI-Voice page never mentions word boundaries; support splits within the HD and personal-voice families, so it cannot be inferred. | The spike script subscribes to `synthesis_word_boundary` on a short MAI-Voice-2 synthesis and checks that events fire with sane audio and text offsets. Until then, keep MAI voices listen-only (matches v1 spec). |
| 2 | **Does MAI-Voice-2 synthesize on an F0 (Free) resource?** | No tier statement on the MAI-Voice page; the F0 quota row names only "standard voices and custom voices." | Call an MAI voice with the existing F0 SpeechServices key; a success or an explicit tier error settles it. Not a blocker: the build uses S0 either way. |
| 3 | **Exact Azure billing-meter name/line for the MAI voice charge** | The Azure Speech pricing page ([azure.microsoft.com/pricing/details/speech](https://azure.microsoft.com/pricing/details/speech/)) is a client-rendered page that did not return text to the fetch tool during this spike; the 22 USD per 1M figure is sourced from Microsoft's model page instead. | Open the Speech pricing page in a browser at provisioning time, or read the resource's billing meters after a small test synthesis, to confirm the meter and the F0 monthly free-character allowance. |
| 4 | **Does the batch synthesis API accept MAI-Voice-2?** | The "supports all TTS voices" claim is general and predates broad preview-model coverage; HD voices are explicitly real-time-only, showing advanced classes can be excluded. | Submit one batch job referencing an MAI voice and confirm it reaches "Succeeded." Only needed if batch is chosen to speed the backfill; the real-time plus ffmpeg path does not depend on it. |
| 5 | **Is output format `Audio48Khz96KBitRateMonoMp3` accepted for MAI-Voice-2?** (the pipeline's current format) | MAI-Voice docs show only `audio-24khz-160kbitrate-mono-mp3` in examples; 48 kHz is generally supported for TTS but not shown for MAI specifically. | The spike requests 48/96 and checks for acceptance; if rejected, standardize variants on `Audio24Khz160KBitRateMonoMp3` (about 1.7x file size), as the plan already anticipates. |
| 6 | **Does an `AIServices` (Foundry) resource key authenticate cleanly against `eastus.tts.speech.microsoft.com/cognitiveservices/v1`?** | Docs describe the regional endpoint with a generic "Speech resource key"; they do not separately walk through the AIServices-kind key against the classic TTS host. | The spike authenticates the new AIServices key/region against the regional endpoint; the plan already lists a plain SpeechServices resource as the fallback if the Foundry key proves awkward. |
| 7 | **Real-time TPS behavior for MAI (preview) voices** | The 200 TPS S0 default is documented "for standard voices and custom voices"; preview MAI voices may throttle differently or hit backend-capacity 429s. | Observe throttling during the backfill run; handle 429s with retry or backoff, which Microsoft recommends regardless of quota. |

None of these are go/no-go for provisioning; they are behavior confirmations the throwaway spike script (source plan, section 5, step 5) is designed to answer in about 30 minutes against the new resource.

---

## Recommendation

- **Proceed on the plan's Option A (publish-time pre-render per voice to R2), listen-only, on a shared `AIServices` S0 resource in East US.** Every load-bearing fact is confirmed: MAI-Voice-2 is available in `eastus`, needs no Foundry deployment, and uses the exact Speech SDK path a character-timed TTS pipeline already runs. Before a build locks its voice cast, confirm each chosen voice exists in the prebuilt catalog (Finding 2) with any expressive style it depends on (for example an `excited` male read, which among en-US males only Ethan publishes); do not assume a style is available for a given voice.
- **Keep read-along on the existing narrator track for v1.** The word-boundary answer for MAI-Voice-2 is genuinely undocumented and support is inconsistent across sibling model families, so do not gamble the highlight on it. If spike unknown #1 comes back positive with clean offsets, a future version can migrate a read-along voice to MAI; if negative, the listen-only split is confirmed rather than assumed.
- **Run the throwaway spike script before writing pipeline code**, and have it answer, in one session against the new key, unknowns #1 (word boundary), #2 (F0 probe), #5 (48/96 format), and #6 (AIServices key against the regional endpoint). Fold the word-boundary result back into the source plan.
- **Treat every MAI character as billable S0 at 22 USD per 1M** and keep the plan's ledger and budget guard; do not rely on any F0 free allotment for MAI voices until unknown #2 or #3 is confirmed.
- **Do not design the backfill around batch synthesis.** Use the proven real-time SDK plus ffmpeg stitching path; only reach for batch (unknown #4) if backfill wall-clock time becomes a problem and a quick batch test with an MAI voice succeeds.
- **Confirm the exact `excited` style token** (adjective vs noun form, unknown, minor) during the spike or the Foundry playground audition, since the docs are internally inconsistent on style token spelling.

Net: the voice model is ready for a pilot in East US on S0; the only real product risk (word boundaries) is contained by shipping listen-only, and the remaining unknowns are cheap to close with the planned spike before any code lands.

The concrete voice cast, narrator tracks, and brand context this recommendation was applied to are recorded in the worked example below.

---

&lt;!-- safety-scan-worked-example:start -->
## Worked example: Brand A / Brand B

This spike was first run for the initiative's two publishing brands, Brand A and Brand B, whose reader app needed a multi-voice AI listen feature. The generic recommendation above was applied as follows:

- **Voice cast locked by the owner:** Harper (en-US, female), Lisa (en-AU, female), and Ethan (en-US, male, rendered with the `excited` style). All three are confirmed in Microsoft's prebuilt MAI-Voice-2 catalog (Finding 2) with the `excited` style each requires. Ethan is the only style-capable en-US male, which is why it was chosen as the male listen voice.
- **Existing narrator track:** Brand B's British narrator uses `en-GB-Ryan:DragonHDLatestNeural`. Because there is no en-GB MAI-Voice-2 voice (Finding 2), that brand's AI listen voices are American (en-US) and Australian (en-AU) alongside the British narrator, and read-along highlighting stays on the existing narrator track for v1.
- **Prior resource:** the legacy narrator Speech resource (kind `SpeechServices`, tier F0) was the wrong kind for the shared image plus voice work, which is why a new `AIServices` S0 resource is being provisioned regardless.
- **Pipeline:** the existing `tools/tts.mjs` Speech SDK path (per-block synthesis, ffmpeg stitching) drives the pre-render; MAI voices ship listen-only until spike unknown #1 (word boundaries) is measured.
&lt;!-- safety-scan-worked-example:end -->

---

## Sources

All first-party (Microsoft Learn or Microsoft's own model page), reviewed 2026-07-11:

- What is MAI-Voice (preview)? (status, prerequisites, prebuilt-voice and style table, SSML and SDK/REST examples, "same Azure Speech APIs and SDKs", `mstts:express-as` with `style`/`styledegree`): <https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices>
- Supported regions for Azure Speech (Text-to-speech tab: MAI voices, Batch synthesis API, and Voices-and-styles-in-preview columns; `eastus` confirmed): <https://learn.microsoft.com/azure/ai-services/speech-service/regions>
- Quotas and limits for Azure Speech (F0 20 tx/60s, S0 200 TPS to 1,000, 10-minute audio cap, 64 KB SSML per turn, 50 voice/audio tags, batch not-on-F0 and batch limits, $15/1M standard-neural reference): <https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits>
- High-definition voices in Azure Speech (Dragon HD Omni word-boundary support with example; base DragonHD does not document it; HD voices are real-time only): <https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices>
- How to synthesize speech from text, Subscribe to synthesizer events (WordBoundary event semantics: word-start, audio offset in ticks, text/SSML character position): <https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis#subscribe-to-synthesizer-events>
- Use personal voice, supported/unsupported SDK features (Word boundary: Phoenix Yes, Dragon No): <https://learn.microsoft.com/azure/ai-services/speech-service/personal-voice-how-to-use#supported-and-unsupported-sdk-features-for-personal-voice>
- Batch synthesis API for text to speech (GA, async, audio longer than 10 minutes, SDK chunking alternative): <https://learn.microsoft.com/azure/ai-services/speech-service/batch-synthesis>
- Migrate code from Long Audio API to Batch synthesis API ("supports all text to speech voices and styles", 2 MB JSON payload): <https://learn.microsoft.com/azure/ai-services/speech-service/migrate-to-batch-synthesis>
- What is text to speech?, Pricing note (billable-characters definition; Chinese/kanji/hanja count as two): <https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech#pricing-note>
- Text to speech FAQ (style-degree supported for some voices via `mstts:express-as`): <https://learn.microsoft.com/azure/ai-services/speech-service/faq-tts>
- Speech Synthesis Markup Language, voice/styles reference (`mstts:express-as`, style and styledegree): <https://learn.microsoft.com/azure/ai-services/speech-service/speech-synthesis-markup-voice>
- MAI-Voice-2 model page (22 USD per 1M characters; 15 languages; long-form positioning; markets low latency): <https://microsoft.ai/models/mai-voice-2/>
- Azure Speech pricing (exact MAI meter and F0 free allotment not retrievable by the fetch tool during this spike; see UNKNOWN #3): <https://azure.microsoft.com/pricing/details/speech/>
- Companion infrastructure check in this workspace (AIServices S0 offerable in East US; MAI-Voice-2 confirmed for East US via docs, not the model catalog; existing legacy TTS account is F0 SpeechServices, wrong kind): [../verification/environment-readiness.md](../verification/environment-readiness.md)
