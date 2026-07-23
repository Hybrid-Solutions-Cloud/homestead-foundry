# SPIKE-07: speech models beyond MAI and native Azure (word-sync and lip-sync)

Role: foundry-researcher (Opus). Status: research spike complete (2026-07-22). No Azure resources were created, read, or modified, and no vendor API was called; this is a first-party documentation review only.

Scope: survey natural-sounding text-to-speech models, outside MAI-Voice and outside the native Azure Speech neural voices, for two capabilities the current MAI-Voice-2 deployment cannot supply:

- **Word-sync**: word-level timestamps for read-along word highlighting.
- **Lip-sync**: viseme or phoneme-level timing for future avatar/video mouth animation.

The candidate set spans cloud vendor APIs and open/self-hostable models (per the decision log D-05). This spike is written model-general; the concrete build context (the read-along track, the brands) that motivated it is isolated in the marked worked-example section at the end.

Grounding rule: every load-bearing factual claim is tied to a first-party source (Microsoft Learn or the vendor's own docs) with an inline URL. Anything a first-party source does not state is marked UNKNOWN with the test that resolves it. No figure here is invented. Where only a third-party integration doc (LiveKit, Pipecat) could be found for a vendor feature, that is called out so it can be confirmed against the vendor's own reference before adoption.

Companion documents: `docs/research/SPIKE-02-voice-model.md` (the MAI-Voice-2 word-boundary gap this spike responds to), this spike's brief (the tasking brief), and `docs/design/pipeline-integration-design.md` (the publish pipeline any adopted model would feed).

---

## Question

Given that MAI-Voice-2's REST synthesis path does not emit `WordBoundary` events (SPIKE-02, UNKNOWN #1), which natural-sounding speech models outside MAI can supply (a) word-level timestamps for read-along and (b) viseme/phoneme timing for lip-sync, and how do they compare on naturalness, latency, licensing, self-host feasibility, cost, and Azure integration fit? Report one recommended path for word-sync and one for lip-sync, or state plainly that nothing beats the existing narrator track yet.

---

## Findings

### 0. The reframing: the "native Azure" baseline already solves both

The brief names native Azure Speech voices as "the baseline to beat, not a new discovery." The critical first-party fact is that this baseline already supplies **both** capabilities natively, and does so from the same Speech resource the pipeline already authenticates against:

- **Word-sync.** The Speech SDK `WordBoundary` event fires at the start of each word, punctuation mark, and sentence, giving the word text, the audio offset (in ticks), and the character position in the input. That is exactly the read-along data needed. ([how-to-speech-synthesis, synthesizer events](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis#subscribe-to-synthesizer-events)) Among advanced voices, Dragon HD Omni explicitly supports word boundary events. ([high-definition-voices](https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices))
- **Lip-sync.** The `mstts:viseme` SSML element plus the SDK `VisemeReceived` event produce, for the same synthesis: viseme IDs with audio offsets (type `redlips_front`, for 2D), and 3D `FacialExpression` blend shapes as a 60 FPS matrix of 55 facial positions per frame (jawOpen, mouthPucker, and so on). ([speech-synthesis-markup-voice, viseme element](https://learn.microsoft.com/azure/ai-services/speech-service/speech-synthesis-markup-voice#viseme-element), [how-to-speech-synthesis-viseme](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis-viseme#get-viseme-events-with-the-speech-sdk))
- **Locale caveat on visemes.** `redlips_front` currently supports only `en-US` neural voices; `FacialExpression` blend shapes support `en-US` and `zh-CN` neural voices. ([speech-synthesis-markup-voice, viseme element](https://learn.microsoft.com/azure/ai-services/speech-service/speech-synthesis-markup-voice#viseme-element))

So the gap is narrow and specific: it is not that "Azure cannot do word-sync or lip-sync," it is that the **MAI-Voice-2 preview model** does not emit these events while the standard Azure neural and HD voices do. Any external vendor therefore has to beat a baseline that is already inside the resource, already free of an extra egress hop, and already emitting both signals for `en-US`. This shapes the recommendation: the bar is naturalness good enough to justify leaving that baseline, not merely "has timestamps."

### 1. Cloud vendor APIs

| Vendor / model | Native word timestamps | Native phoneme/viseme timing | Streaming | Licensing for commercial publishing | Azure integration fit |
|---|---|---|---|---|---|
| **Azure native neural / Dragon HD Omni** (baseline) | Yes, `WordBoundary` event | Yes, viseme ID + blend shapes (en-US; blend shapes also zh-CN) | Yes (SDK) | Standard Azure terms | Native: same Speech/AIServices resource |
| **ElevenLabs** | Yes, character-level (word derivable); plus a hosted Forced Alignment endpoint | No phoneme/viseme output documented | Yes (WebSocket char alignment) | Commercial use included on paid plans | External SaaS, separate API and billing |
| **Cartesia (Sonic)** | Yes, `add_timestamps` (word) | Yes, `add_phoneme_timestamps` (IPA phonemes) | Yes (WebSocket, real-time) | Commercial (verify plan terms) | External SaaS |
| **Hume (Octave 2)** | Yes, word timestamps (ms) | Yes, phoneme timestamps in IPA (eSpeak NG inventory), Octave 2 only | Yes (interleaved stream) | Commercial (verify plan terms) | External SaaS |
| **Rime** | Yes, via WebSocket (HTTP path lacks them) | Not documented first-party | Yes (WebSocket) | Commercial (verify plan terms) | External SaaS |
| **Deepgram Aura / Aura-2** | UNKNOWN for TTS (STT has word timing) | Not documented | Yes (WebSocket) | Commercial (verify plan terms) | External SaaS |
| **OpenAI TTS (`gpt-4o-mini-tts`, `tts-1`)** | No (timestamps are a speech-to-text feature, not TTS) | No | Yes | Commercial | External SaaS; also via Azure OpenAI, but the timestamp gap is unchanged |
| **PlayHT** | UNKNOWN (no first-party timestamp doc located) | UNKNOWN | Yes | Commercial (verify plan terms) | External SaaS |

Per-vendor detail:

- **ElevenLabs.** The `POST /v1/text-to-speech/:voice_id/with-timestamps` endpoint returns `alignment` and `normalized_alignment` objects, each with parallel arrays `characters`, `character_start_times_seconds`, `character_end_times_seconds`. It is **character-level only**; word timestamps are derived by grouping characters at whitespace. ([create speech with timing](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)) The streaming WebSocket path also returns per-character alignment in milliseconds. ([TTS endpoints with timestamps](https://elevenlabs.io/blog/new-text-to-speech-endpoints-with-timestamps)) A separate **Forced Alignment** endpoint takes audio plus a transcript and returns a time-aligned transcript, aimed at subtitles and audiobook timing. ([forced alignment](https://elevenlabs.io/docs/overview/capabilities/forced-alignment)) No phoneme or viseme output is documented, so lip-sync from ElevenLabs would require a downstream forced-alignment/phoneme step (see section 3).
- **Cartesia (Sonic).** The TTS WebSocket accepts `add_timestamps` and `add_phoneme_timestamps` (both boolean, default false). Word output is `word_timestamps: {words[], start[], end[]}`; phoneme output is `phoneme_timestamps: {phonemes[], start[], end[]}` with IPA-style symbols and per-phoneme start/end in seconds. It is real-time streaming. ([Cartesia TTS WebSocket](https://docs.cartesia.ai/api-reference/tts/websocket)) This is the only cloud vendor besides Azure that emits phoneme timing natively, which makes it directly usable for phoneme-to-viseme lip-sync.
- **Hume (Octave 2).** With `"version": "2"` in the request, the API returns `OctaveOutputTimestamp` objects for both `word` and `phoneme` types (`text`, `time` with begin/end in ms), streamed interleaved with the audio chunks. Phoneme timestamps use IPA symbols consistent with the eSpeak NG inventory. ([Hume timestamps guide](https://dev.hume.ai/docs/text-to-speech-tts/timestamps)) Like Cartesia, this gives a native phoneme track for lip-sync, plus emotionally expressive delivery as the product's headline feature. ([Octave](https://www.hume.ai/octave))
- **Rime.** Word-level timestamps are emitted on the WebSocket path (the HTTP path does not carry them); grapheme-to-phoneme prediction is used internally for out-of-dictionary words. The clearest statements found are in third-party integration docs (LiveKit, Pipecat), not Rime's own API reference, so treat word-sync support as "documented by integrators, confirm first-party." ([LiveKit Rime TTS](https://docs.livekit.io/agents/models/tts/rime/), [Pipecat Rime](https://docs.pipecat.ai/server/services/tts/rime))
- **Deepgram Aura / Aura-2.** The Aura TTS WebSocket streams audio with token-by-token input for low latency, but the first-party TTS docs located do not state that it returns word-level timestamps; Deepgram's word timing is documented for its speech-to-text product, not TTS. ([Aura WebSocket](https://deepgram.com/learn/aura-text-to-speech-adds-websocket-support-for-input-streaming), [Aura-2](https://deepgram.com/learn/introducing-aura-2-enterprise-text-to-speech)) TTS word timestamps are therefore UNKNOWN for Aura.
- **OpenAI TTS.** `gpt-4o-mini-tts` and the `tts-1` family convert text to speech and expose delivery controls via an `instructions` field, but the TTS endpoint does not return timestamps. The `timestamp_granularities[]` word/segment option belongs to the transcription (speech-to-text) API, not TTS. ([OpenAI TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech), [OpenAI STT guide](https://developers.openai.com/api/docs/guides/speech-to-text)) OpenAI TTS is also offered through Azure OpenAI, but that does not add a timestamp path, so it does not close the gap.
- **PlayHT.** No first-party document establishing native word or phoneme timestamps was located during this spike; capability is UNKNOWN pending the vendor's own API reference.

### 2. Open / self-hostable models

| Model | License | Commercial-safe | Native timing output | Self-host profile |
|---|---|---|---|---|
| **Kokoro-82M** | Apache 2.0 | Yes | Phoneme-based (misaki G2P, IPA); no documented word-timestamp API | 82M params, CPU-capable, small |
| **Piper** | MIT | Yes | Phoneme-based (eSpeak NG); no native word timestamps | Fastest on CPU (real-time on a Raspberry Pi 5) |
| **Chatterbox (Resemble AI)** | MIT | Yes | Not documented | ~0.5B Llama backbone; GPU preferred |
| **Coqui XTTS v2** | CPML (non-commercial) | No | n/a | Blocked by license (see below) |
| **F5-TTS** | CC-BY-NC-4.0 (non-commercial) | No | n/a | Blocked by license (see below) |

- **Kokoro-82M.** Apache 2.0 weights, trained on permissive audio with IPA phoneme labels; uses the `misaki` grapheme-to-phoneme library. At 82M parameters it is small and runnable on CPU. ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)) It does not expose a word-timestamp API, but because it is phoneme-driven, per-word timing is recoverable via forced alignment (section 3). Commercially the safest open option.
- **Piper.** MIT licensed, phoneme-based via eSpeak NG, and the fastest CPU option (documented real-time on a Raspberry Pi 5, no GPU). ([Piper, via comparison writeups](https://localaimaster.com/blog/best-local-tts-models)) No native word timestamps; pair with forced alignment. Naturalness is a step below the top cloud voices, which matters for a listening product.
- **Chatterbox (Resemble AI).** MIT licensed, ~0.5B-parameter Llama-backbone model with emotion control and zero-shot cloning, explicitly permissive for commercial products. ([Chatterbox, Resemble AI](https://www.resemble.ai/learn/models/chatterbox)) GPU-preferred for latency. Native timing output is not documented; forced alignment applies.
- **Coqui XTTS v2 - excluded.** Released under the Coqui Public Model License (CPML), which restricts commercial use, and Coqui Inc. wound down in early 2024, so no commercial license can be bought. ([Coqui XTTS v2 license discussion](https://www.promptquorum.com/power-local-llm/local-tts-voice-cloning-piper-coqui-xtts)) Not viable for a commercial publishing pipeline.
- **F5-TTS - excluded.** CC-BY-NC-4.0 weights, non-commercial without separate licensing from the authors. ([F5-TTS license](https://localaimaster.com/blog/f5-tts-setup-guide)) Not viable for commercial publishing.

### 3. The decoupling insight: sync is a post-processing step, not only a model feature

The most important architectural finding is that **word-sync and lip-sync can be added to any TTS audio after synthesis**, which decouples "pick the best-sounding voice" from "get timestamps." Two mature, self-hostable companion approaches exist:

- **Forced alignment for word (and phoneme) timing.** Given the audio and the known input text, a forced aligner emits word-level and phoneme-level timestamps. Options include WhisperX, the Montreal Forced Aligner, NVIDIA NeMo Forced Aligner, and aeneas; WhisperX is reported to give better timing than NeMo in comparative tests, and Montreal Forced Aligner produces phoneme-level timing usable for visemes. ([WhisperX](https://www.researchgate.net/publication/368923066_WhisperX_Time-Accurate_Speech_Transcription_of_Long-Form_Audio), [Montreal Forced Aligner state-of-the-art review](https://arxiv.org/pdf/2606.18466)) ElevenLabs also offers this as a hosted service. ([forced alignment](https://elevenlabs.io/docs/overview/capabilities/forced-alignment))
- **Audio-to-viseme for lip-sync.** Rhubarb Lip Sync generates a frame-aligned viseme timeline directly from an audio file (documented at a 16 kHz sample rate, 25 ms window, 10 ms hop), independent of which TTS produced the audio. ([Rhubarb viseme dataset writeup](https://huggingface.co/datasets/aavi21458/rhubarb-visemes/blob/main/README.md)) Alternatively, a phoneme timeline (native from Cartesia/Hume, or from a forced aligner) maps to visemes via a standard phoneme-to-viseme table.

Consequence: for a **batch publish pipeline** (which this initiative runs, not a live conversational agent), the timing requirement does not force a particular vendor. It is entirely feasible to synthesize with the best-sounding model and run forced alignment plus Rhubarb over the output. This makes latency and streaming a low-priority axis here, and makes naturalness plus licensing plus Azure fit the deciding axes.

### 4. Naturalness evidence (the deciding axis) is largely vendor-claimed

Every candidate is marketed as "natural" or "expressive." Independent, apples-to-apples MOS numbers across this exact candidate set were not found in a first-party source during this spike, so naturalness is treated as UNKNOWN at the level of a hard score. What can be said from first-party positioning: ElevenLabs, Cartesia Sonic, and Hume Octave 2 are all positioned as top-tier expressive cloud voices; Octave 2's differentiator is emotional/acting control ([Octave](https://www.hume.ai/octave)); Kokoro is a small model that punches above its size but is not claimed to match the top cloud voices; Piper is explicitly optimized for speed on constrained hardware, not for maximum naturalness. A short blind A/B listening test on the actual content is the only reliable way to rank naturalness, and that belongs in the follow-up ADR's pilot, not in this documentation spike.

---

## What is still UNKNOWN

| # | Unknown | Why it is not resolved here | What resolves it |
|---|---|---|---|
| 1 | **Relative naturalness on the target content** across ElevenLabs, Cartesia, Hume, Kokoro, and the Azure baseline | No first-party independent MOS across this exact set; naturalness is content-dependent | A short blind A/B listening test on representative passages in the follow-up ADR pilot |
| 2 | **Does Deepgram Aura/Aura-2 return word timestamps on the TTS path?** | First-party Aura TTS docs describe streaming audio but not word timing; word timing is a Deepgram STT feature | Read the Aura TTS API reference or run one WebSocket synthesis and inspect for a timing message |
| 3 | **Does PlayHT expose native word or phoneme timestamps?** | No first-party PlayHT timestamp doc located | Check PlayHT's API reference directly |
| 4 | **First-party confirmation of Rime word timestamps** | Only integrator docs (LiveKit, Pipecat) found, not Rime's own reference | Read Rime's own WebSocket API reference |
| 5 | **Exact per-character / per-second pricing** for the cloud candidates | Vendor pricing pages are client-rendered and were not fetched as first-party text in this spike; no number is invented here | Read each vendor's live pricing page at ADR time and model against expected monthly character volume |
| 6 | **Forced-alignment accuracy on synthetic (TTS) audio** for read-along-grade word highlighting | Aligners are benchmarked on human speech; TTS audio is cleaner but untested here | Run WhisperX/MFA over a sample of the chosen model's output and spot-check offset drift |
| 7 | **Phoneme-to-viseme quality** from Cartesia/Hume phoneme streams vs Azure's native viseme IDs | No side-by-side documented | Compare a phoneme-mapped clip against Azure `redlips_front` output in the ADR pilot |

None of these block writing the recommendation; they are pilot-time confirmations for the follow-up ADR.

---

## Recommendation

Two paths, split as the brief requested, because word-sync and lip-sync are best served differently.

**Word-sync (read-along highlighting): stay on the native Azure baseline for v1; do not adopt an external vendor yet.**

- The existing narrator track already runs on an Azure neural voice that emits `WordBoundary` events, which is the exact data read-along needs, from the same resource, with no extra vendor, no data egress, and no new billing relationship. The MAI-Voice-2 gap does not require an external vendor to close; it requires using a word-boundary-capable Azure voice for the highlighted track (which is what v1 already does per SPIKE-02).
- If a future version wants the AI voices themselves to drive highlighting, the lowest-risk upgrade is **forced alignment** (WhisperX or Montreal Forced Aligner, self-hostable, no license cost) over the already-rendered MAI/AI-voice audio, since the input text is known. That closes the gap for any voice, including MAI, without changing the synthesis vendor.
- Among external vendors, if one is ever adopted for other reasons, **ElevenLabs (character timestamps), Cartesia (word + phoneme), and Hume Octave 2 (word + phoneme)** all supply native word timing and would not need the alignment step. But none of them clears the "beat a baseline that is already inside the resource" bar on word-sync alone.

**Lip-sync (future avatar/video): do not commit to a TTS vendor for this yet; keep it a post-processing capability.**

- The native Azure viseme output (viseme IDs plus 60 FPS, 55-value blend shapes) is the strongest first-party lip-sync signal found, but it is `en-US`/`zh-CN` only and, like word boundaries, is not emitted by MAI-Voice-2.
- Because avatar work is not yet on the critical path and this is a batch pipeline, the durable choice is to treat lip-sync as **audio-to-viseme post-processing** (Rhubarb Lip Sync, or a phoneme-to-viseme map fed by a forced aligner). That keeps voice selection free: any model's audio can be lip-synced later.
- If a single vendor is ever wanted to serve both narration and native phoneme timing in one call, **Cartesia (Sonic)** and **Hume (Octave 2)** are the two cloud options that emit phoneme timestamps natively, and are the ones to shortlist for a lip-sync-driven pilot.
- **Managed alternative that needs no client visemes at all:** Azure's first-party **Text to speech avatar** renders a talking-head video (batch or real-time WebRTC) server-side. Its pipeline is text analyzer to phoneme sequence to audio synthesizer to a video renderer that predicts the lip-sync image, so lip-sync is produced internally and is voice/locale-agnostic across all standard and custom voices, sidestepping the `en-US`/`zh-CN` viseme-locale caveats above. The trade-off is that it returns a rendered video (or stream), not a viseme/blend-shape track for a custom renderer, and it pairs with standard or custom neural voices rather than the MAI-Voice-2 preview model. If the avatar work wants a managed talking head rather than a bespoke rig, this is the path; if it wants a custom in-app character driven by blend shapes, use the native viseme signal (en-US only) or the decoupled Rhubarb/forced-aligner path. This is developed in SPIKE-16 (virtual-trainer avatar), Finding 4. ([What is Text to speech avatar?](https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar), [custom avatar component sequence](https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech-avatar/what-is-custom-text-to-speech-avatar#components-sequence))

**Net.** Nothing in the surveyed set beats the native Azure baseline strongly enough to justify adopting a new external speech vendor for word-sync today, and lip-sync is best kept as a decoupled post-processing step rather than a vendor lock-in. The one genuinely new, low-risk capability worth piloting is **self-hosted forced alignment** (WhisperX / Montreal Forced Aligner) to retrofit word (and phoneme) timing onto the existing AI-voice audio, plus **Rhubarb** for visemes when avatar work begins.

**Gate.** This spike does not authorize any deployment. If the follow-up work adopts a model or a companion tool, a follow-up ADR is required first (spike then ADR then design then deploy), and any candidate reaching at least `status: planned` should be added to `BACKLOG.md`'s model roster and eventually `models/registry.example.json` per `MODEL-REGISTRY-DESIGN.md`. On current evidence the two items that reach `planned` are the companion tools (forced alignment; Rhubarb), not a replacement narration model.

---

## Sources

First-party Microsoft (reviewed 2026-07-22):

- How to synthesize speech, Subscribe to synthesizer events (`WordBoundary` semantics): <https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis#subscribe-to-synthesizer-events>
- Customize voice and sound with SSML, Viseme element (`mstts:viseme`, `redlips_front` en-US only, `FacialExpression` en-US/zh-CN): <https://learn.microsoft.com/azure/ai-services/speech-service/speech-synthesis-markup-voice#viseme-element>
- Get facial position with viseme (viseme IDs, 2D SVG, 3D blend shapes 55 positions at 60 FPS): <https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis-viseme#get-viseme-events-with-the-speech-sdk>
- High-definition voices (Dragon HD Omni word boundary support): <https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices>
- What is Text to speech avatar? (managed talking-head video, batch and real-time, server-side lip-sync): <https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar>
- What is custom text to speech avatar?, component sequence (text analyzer to phoneme sequence to audio synthesizer to video renderer): <https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech-avatar/what-is-custom-text-to-speech-avatar#components-sequence>

First-party vendor docs (reviewed 2026-07-22):

- ElevenLabs, Create speech with timing (character-level `alignment`/`normalized_alignment`): <https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps>
- ElevenLabs, TTS endpoints with timestamps (WebSocket character alignment in ms): <https://elevenlabs.io/blog/new-text-to-speech-endpoints-with-timestamps>
- ElevenLabs, Forced Alignment (audio + transcript to time-aligned transcript): <https://elevenlabs.io/docs/overview/capabilities/forced-alignment>
- Cartesia, TTS WebSocket (`add_timestamps` word, `add_phoneme_timestamps` phoneme): <https://docs.cartesia.ai/api-reference/tts/websocket>
- Hume, Timestamps guide (Octave 2 word + phoneme IPA, streamed): <https://dev.hume.ai/docs/text-to-speech-tts/timestamps>
- Hume, Octave (emotional/acting control positioning): <https://www.hume.ai/octave>
- OpenAI, Text to speech guide (no timestamp output): <https://developers.openai.com/api/docs/guides/text-to-speech>
- OpenAI, Speech to text guide (`timestamp_granularities` is STT-only): <https://developers.openai.com/api/docs/guides/speech-to-text>
- Deepgram, Aura WebSocket TTS: <https://deepgram.com/learn/aura-text-to-speech-adds-websocket-support-for-input-streaming>
- Deepgram, Aura-2: <https://deepgram.com/learn/introducing-aura-2-enterprise-text-to-speech>
- Rime TTS (word timestamps via WebSocket, integrator-documented): <https://docs.livekit.io/agents/models/tts/rime/>, <https://docs.pipecat.ai/server/services/tts/rime>
- Kokoro-82M (Apache 2.0, misaki G2P, IPA): <https://huggingface.co/hexgrad/Kokoro-82M>
- Chatterbox, Resemble AI (MIT, 0.5B, commercial-safe): <https://www.resemble.ai/learn/models/chatterbox>
- Coqui XTTS v2 license (CPML non-commercial, Coqui defunct): <https://www.promptquorum.com/power-local-llm/local-tts-voice-cloning-piper-coqui-xtts>
- F5-TTS license (CC-BY-NC-4.0 non-commercial): <https://localaimaster.com/blog/f5-tts-setup-guide>
- Piper (MIT, CPU real-time), comparison writeup: <https://localaimaster.com/blog/best-local-tts-models>
- WhisperX (time-accurate forced alignment): <https://www.researchgate.net/publication/368923066_WhisperX_Time-Accurate_Speech_Transcription_of_Long-Form_Audio>
- Montreal Forced Aligner (phoneme-level alignment): <https://arxiv.org/pdf/2606.18466>
- Rhubarb Lip Sync (audio-to-viseme timeline): <https://huggingface.co/datasets/aavi21458/rhubarb-visemes/blob/main/README.md>

Note on sourcing quality: Rime, Piper, XTTS, and F5-TTS claims lean on integrator docs or secondary writeups rather than the vendor's/author's own reference (UNKNOWN #4 and the license lines); confirm against the primary source before any adoption. Cloud pricing is deliberately omitted rather than guessed (UNKNOWN #5).

---

&lt;!-- safety-scan-worked-example:start -->
## Worked example: Gunner the Lab / Holdfast Press StoryReader

This spike was run for the StoryReader reader app serving the Gunner the Lab and Holdfast Press children's-book brands, where the concrete trigger was the read-along feature.

- **Current state.** Per SPIKE-02 and the voice decisions, MAI-Voice-2 ships listen-only, and read-along word-highlighting stays on the pre-existing narrator track (`en-US-AndrewMultilingualNeural`), an Azure neural voice that does emit `WordBoundary` events. The AI voices (Harper en-US, Lisa en-AU, Ethan en-US with the excited style) cannot drive highlighting because MAI-Voice-2's REST path emits no word boundaries.
- **Applied recommendation (word-sync).** Keep read-along on the narrator track for v1; if a later version wants the AI voices to drive the highlight, retrofit word timing with self-hosted forced alignment (WhisperX or Montreal Forced Aligner) over the already-rendered AI-voice audio, since the block text is known at publish time. Do not add an external speech vendor solely for word timestamps: the narrator track already supplies them and the pipeline already stitches per-block audio.
- **Applied recommendation (lip-sync).** No avatar/video work is on the StoryReader roadmap yet. When it starts, keep lip-sync as audio-to-viseme post-processing (Rhubarb, or a phoneme-to-viseme map) so it works over whichever voice a chapter used, including the British narrator (`en-GB-Ryan:DragonHDLatestNeural`), which Azure's native `redlips_front` visemes would not cover (en-US only).
- **Pipeline touchpoint.** Any adopted companion tool runs as a post-synthesis step in the existing `tools/tts.mjs` -> stitch -> publish flow; ask the operator for the current path of that consumer repo rather than assuming one, since it lives outside this repo.
&lt;!-- safety-scan-worked-example:end -->
