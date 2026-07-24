# Model catalog

This catalog is the living, human-readable list of the models this repo's
Azure AI Foundry methodology has deployed, evaluated, or rejected. It is the
single source of truth for "which models are on the table and where each one
stands." The machine-readable counterpart is the model registry
(`models/registry.schema.json` and `models/registry.example.json`), which a
consuming project resolves at runtime; this catalog is the prose record a
human reads to understand the why behind each row.

Adding a new model to the evaluation set is a **catalog row plus a registry
entry, not a new ADR**. The general selection methodology lives in one place,
[ADR-0002](../adr/ADR-0002-image-model-and-access.md) for image models and
[ADR-0003](../adr/ADR-0003-voice-model-and-voice-set.md) for voice, and each
new candidate is evaluated against that methodology and recorded here. A
model gets its own ADR only when adopting it changes a decision the
methodology cannot already express (for example a new region, a new resource,
or a new access-governance posture). The FLUX adoption is the worked example:
it was originally captured as its own record (ADR-0010) and is now folded back
into the general image-selection ADR plus these catalog rows, so a future
image model does not need a new ADR to be added.

## Status vocabulary

| Status | Meaning | Registry mapping |
|---|---|---|
| `deployed` | Live on a Foundry resource and callable by the pipeline. | `status: deployed` |
| `available` | In the catalog and deployable in-region with no blocker, but not adopted (a candidate held for a future A-B arm or backfill). | `status: planned` |
| `evaluated` | Researched against the methodology and passed over for the current workload, but not a hard reject (region, access gate, or style bias made it wrong for now; revisit if the constraint changes). | `status: planned` or omitted |
| `rejected` | Ruled out and kept on the record so the decision is not re-researched later (retired, off-catalog, or structurally unfit). | `status: rejected` (never deleted) |

The registry enum is deliberately narrower (`deployed` / `planned` /
`rejected`); this catalog splits the middle into `available` and `evaluated`
for human clarity. Never delete a `rejected` row: the point is to record why a
candidate was passed over so it is not re-litigated.

## Image models

Selection methodology and access model:
[ADR-0002](../adr/ADR-0002-image-model-and-access.md). Historical FLUX adoption
record: [ADR-0010](../adr/ADR-0010-flux-image-model-adoption.md) (superseded).
Research behind these rows:
[SPIKE-01](../research/SPIKE-01-image-model.md) (MAI image family) and
[SPIKE-12](../research/SPIKE-12-image-video-alternatives.md) (broader catalog
and video alternatives).

| Model | Provider | Status | Region(s) | Key traits | Notes / why or why not | Source |
|---|---|---|---|---|---|---|
| MAI-Image-2.5 | Microsoft | `deployed` (baseline) | East US (also West Central US, West US, West Europe, Sweden Central, South India, UAE North) | Preview. Text-to-image plus image-to-image edits. Thin documented API: `model`, `prompt`, `image` (edits), `width`, `height` only, so no seed, mask, negative prompt, style-reference, or candidate-count. One image per call. Canvas min 768x768, max total 1,048,576 px. | First-party in-region baseline and A-B comparison point. Driven text-only it drifted on a consistent non-photorealistic house style and on character identity (no reference-image conditioning on the generation path), which is exactly what drove adding the FLUX roster. Retained as fallback, not removed. | [MAI image how-to](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai), [Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure) |
| MAI-Image-2.5-Flash | Microsoft | `available` | Same as MAI-Image-2.5 | Preview. Same two endpoints and same parameter set as 2.5; positioned as faster and lower cost per token. Same RPM ceiling as 2.5 (buys latency and cost, not throughput). | Candidate for a cheaper high-volume backfill arm once 2.5 wins a style pilot. Not adopted yet; it is a cost lever, not a capability gain. | [MAI image how-to](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai) |
| MAI-Image-2.5-Pro | Microsoft | `evaluated` | Sold by Azure (per region-availability matrix) | Preview. Newly listed in the sold-by-Azure catalog, positioned for more photo-realistic imagery than MAI-Image-2.5. | Surfaced during this catalog build; not yet covered by a research spike. Candidate for a dedicated spike plus registry entry before adoption; the photo-realistic positioning is likely the wrong direction for a non-photorealistic house style, to be confirmed. | [Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#microsoft-models-sold-by-azure) |
| FLUX.2-pro | BlackForestLabs | `deployed` (primary) | East US (all Americas regions, Global Standard) | GA, no retirement date. Multi-reference conditioning up to 8 reference images. Output up to 4 MP. Highest fidelity of the FLUX family. | Primary scene-art generator. Supplies the multi-reference character-and-style lock the MAI text-only surface structurally lacked (feed locked character sheets plus a style anchor into each generation). Adopted in ADR-0010, now carried by ADR-0002 plus this row. | [Deploy FLUX models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux), [Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure) |
| FLUX.1-Kontext-pro | BlackForestLabs | `deployed` (single-reference companion) | East US (all Americas regions, Global Standard) | GA. In-context editing anchored to one reference image (text and 1 image, 1 MP). Documented for character consistency and advanced editing. | Single-reference companion: hold one identity or look stable across an edit where composing from many references is not the point. | [Deploy FLUX models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux), [Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure) |
| FLUX-1.1-pro | BlackForestLabs | `deployed` (fast exploration) | East US (all Americas regions, Global Standard) | GA. Text-to-image, fast inference, strong prompt adherence, competitive pricing. No multi-reference lock. | Fast, cheap exploration and low-stakes passes, not locked-character final frames. | [Deploy FLUX models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux), [Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure) |
| FLUX.2-flex | BlackForestLabs | `available` | East US (all Americas regions, Global Standard) | GA. Text plus up to 10 reference images (2 more than FLUX.2-pro). Exposes `guidance` and `steps` for fine control. Output up to 4 MP. Positioned for text-heavy layouts and text overlay. | Deployable in-region today, but an incremental extension of the same FLUX approach already carrying the style-lock load, not a new capability class. Its text-overlay strength is marginal for wordless scene art where captions are composited later. Would be added as an A-B arm behind its own ADR if wanted. | [Deploy FLUX models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux), [Region availability](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard) |
| GPT-image-2 | OpenAI (Azure OpenAI) | `evaluated` | East US 2 and West US 3 only in the Americas (NOT East US) | GA, no access application. Mask-based inpainting and variations, arbitrary resolutions up to 4K (long edge up to 3,840 px, aspect up to 3:1), 1 to 10 images per request via `n`. Realism-optimized with advanced face preservation. | Passed over for the non-photorealistic house style: realism and face-preservation bias is the wrong direction, and it is out of region for an East US account (would need a second resource in eastus2 or westus3). Its unique capability (mask inpainting) is not required by the prompt-plus-multi-reference pipeline. Revisit only if a masked-edit workflow becomes a real need. | [Image models and capabilities](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e#models-and-capabilities), [Region availability](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard) |
| gpt-image-1.5 | OpenAI (Azure OpenAI) | `evaluated` | East US 2 and West US 3 only in the Americas | Limited-access preview (apply at aka.ms/oai/gptimage1.5access). Realism-optimized, face preservation, improved speed and cost over gpt-image-1. Inpainting and variations with mask plus prompt. | Same realism bias and same out-of-region problem as GPT-image-2, plus a limited-access application gate. Not fit for the non-photorealistic style. | [Image models and capabilities](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e#models-and-capabilities) |
| gpt-image-1 | OpenAI (Azure OpenAI) | `evaluated` | East US 2 and West US 3 only in the Americas | Limited-access preview (apply at aka.ms/oai/gptimage1access). Realism-optimized, face preservation. Inpainting and variations with mask plus prompt. | Older GPT-image variant. Same realism bias, out-of-region, and access-gate issues; no advantage over the newer variants for this workload. | [Image models and capabilities](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e#models-and-capabilities) |
| gpt-image-1-mini | OpenAI (Azure OpenAI) | `evaluated` | East US 2 and West US 3 only in the Americas | Limited-access preview (apply at aka.ms/oai/gptimage1access). Cost-efficient and faster for bulk or iterative generation. No dedicated face preservation, better for non-portrait general creative imagery. | Cheapest GPT-image tier, but still out of region for an East US account and behind an access application; the FLUX roster already covers cheap exploration in-region. | [Image models and capabilities](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e#models-and-capabilities) |
| DALL-E 3 (`dall-e-3`) | OpenAI (Azure OpenAI) | `rejected` | Retired (previously East US, Australia East, Sweden Central) | Retired on 2026-03-04. No longer available for new deployments; existing deployments are non-functional. Replaced by the GPT-image series. | Not selectable. Kept on the record so it is not re-proposed. Its official replacement path (GPT-image) is the `evaluated` set above, which is itself out of region and realism-biased for this workload. | [Image generation how-to (retirement note)](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e) |
| Stable Diffusion (Stability AI: Stable Diffusion 3.5 Large, Stable Image Core, Stable Image Ultra) | Stability AI | `rejected` | Foundry model catalog serverless (partner) deployment; not in "Foundry Models sold by Azure" | Available in the broader Foundry model catalog as a Stability AI serverless (pay-as-you-go) deployment, NOT as a first-party sold-by-Azure model. Realism and photorealism tuned (Stable Image Ultra is positioned for photorealism and product imagery). | Rejected for this build, not because it is absent from Azure (it is present as a partner serverless model) but because it is off the shared sold-by-Azure AIServices resource this methodology deploys onto (a separate serverless endpoint and governance path) and carries a realism bias, not the non-photorealistic illustrated style required. Revisit only if a separate serverless deployment is justified. | [Stability AI in Foundry catalog](https://learn.microsoft.com/azure/machine-learning/concept-models-featured?view=azureml-api-2#stability-ai), [Deploy Stability AI models](https://learn.microsoft.com/azure/ai-foundry/how-to/deploy-stability-models) |
| Imagen | Google | `rejected` | Not offered in the Azure AI Foundry catalog (Google Cloud Vertex AI only) | Google's image family (Imagen) is a Google Cloud Vertex AI offering. It was not found in the Azure AI Foundry model catalog during research: the first-party image families sold by Azure are only MAI-Image, FLUX, and GPT-image. | Rejected as an off-Azure departure: adopting it would leave the Azure AI Foundry catalog, the shared resource, and this repo's Azure-first, harness-only governance posture. Not deployable on the shared resource. | [Models sold by Azure (image families)](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure) |

### Cost note for image models (applies to every deployed and available row)

All Foundry image models bill on the token-metering model (per token in and
out, no charge for the resource or the deployment itself). The exact
per-token rate for the MAI and FLUX image models could not be verified from a
rendered first-party pricing page during SPIKE-01 and SPIKE-12, and
tokens-per-generated-image is not published by Microsoft for any MAI image
model. Treat per-image cost as **UNKNOWN until measured**: read the live rate
in the Foundry portal at deploy time and run a two-call cost probe before any
batch. See [SPIKE-01, Q2](../research/SPIKE-01-image-model.md) and
[ADR-0006](../adr/ADR-0006-cost-governance.md) for the budget guardrail.

## Voice models

Selection methodology and locked voice set:
[ADR-0003](../adr/ADR-0003-voice-model-and-voice-set.md). Research:
[SPIKE-02](../research/SPIKE-02-voice-model.md) and the speech-model survey in
[SPIKE-07](../research/SPIKE-07-speech-models.md).

| Model | Provider | Status | Region(s) | Key traits | Notes / why or why not | Source |
|---|---|---|---|---|---|---|
| MAI-Voice-2 | Microsoft (MAI) | deployed (baseline) | East US | Expressive prebuilt voices plus `mstts:express-as` styles; same Speech SDK/endpoint, no Foundry deploy | Listen-only in v1 (no documented WordBoundary); 22 USD per 1M characters; Preview | https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices |
| Azure neural / Dragon HD Omni (native) | Microsoft (Azure Speech) | available | East US (per-region matrix) | Emits `WordBoundary`; native visemes (`redlips_front` en-US, blend shapes en-US/zh-CN) | The read-along and lip-sync baseline; standard neural documented near 15 USD per 1M characters | https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices |
| ElevenLabs | ElevenLabs | evaluated | External SaaS (off-Azure) | Character-level timestamps (word derivable) plus a hosted Forced Alignment endpoint; no phoneme/viseme | Does not beat the in-resource baseline for word-sync; separate billing and egress | https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps |
| Cartesia (Sonic) | Cartesia | evaluated | External SaaS | Native word plus phoneme timestamps (`add_timestamps` / `add_phoneme_timestamps`), streaming | One of only two non-Azure vendors emitting native phoneme timing; lip-sync candidate | https://docs.cartesia.ai/api-reference/tts/websocket |
| Hume Octave 2 | Hume AI | evaluated | External SaaS | Native word plus phoneme (IPA) timestamps; emotional delivery control | Native phoneme track for lip-sync; external SaaS | https://dev.hume.ai/docs/text-to-speech-tts/timestamps |
| Rime | Rime | evaluated | External SaaS | Word timestamps on the WebSocket path (HTTP path lacks them) | Word-sync only, integrator-documented; confirm first-party before adoption | https://docs.livekit.io/agents/models/tts/rime/ |
| Deepgram Aura / Aura-2 | Deepgram | evaluated | External SaaS | Streaming TTS with token-by-token input | TTS word timestamps UNKNOWN (word timing is a Deepgram STT feature); not confirmed for read-along | https://deepgram.com/learn/aura-text-to-speech-adds-websocket-support-for-input-streaming |
| OpenAI TTS (`gpt-4o-mini-tts`, `tts-1`) | OpenAI | rejected | External SaaS (also via Azure OpenAI) | Delivery control via `instructions`; no timestamp output | Timestamps are STT-only; fails the word-sync bar | https://developers.openai.com/api/docs/guides/text-to-speech |
| PlayHT | PlayHT | evaluated | External SaaS | Streaming TTS | Native word/phoneme timestamps UNKNOWN (no first-party timestamp doc located); capability unverified | https://play.ht/ |
| Kokoro-82M | hexgrad (open weights) | evaluated | Self-host (CPU-capable) | Apache 2.0; phoneme-based (misaki G2P, IPA); 82M params | Commercial-safe open option; no native word-timestamp API (word timing via forced alignment) | https://huggingface.co/hexgrad/Kokoro-82M |
| Piper | Rhasspy (open weights) | evaluated | Self-host (CPU real-time) | MIT; eSpeak NG phoneme-based; fastest on CPU | No native word timestamps (pair with forced alignment); dev moved to OHF-Voice/piper1-gpl (GPL) | https://github.com/rhasspy/piper |
| Chatterbox | Resemble AI (open weights) | evaluated | Self-host (GPU preferred) | MIT; ~0.5B Llama backbone; emotion control, zero-shot cloning | Commercial-safe; native timing not documented (forced alignment applies) | https://www.resemble.ai/learn/models/chatterbox |
| Coqui XTTS v2 | Coqui (open weights) | rejected | Self-host | CPML non-commercial license; Coqui wound down early 2024 | Excluded on license for commercial publishing | https://huggingface.co/coqui/XTTS-v2 |
| F5-TTS | SWivid (open weights) | rejected | Self-host | CC-BY-NC-4.0 weights (non-commercial) | Excluded on license for commercial publishing | https://huggingface.co/SWivid/F5-TTS |

## Video models

Research: [SPIKE-12](../research/SPIKE-12-image-video-alternatives.md) (Sora,
Sora 2, and non-Azure image-to-video vendors). The core video path is locked
graphite stills plus Ken Burns pan and zoom plus narration via ffmpeg; Sora
and Sora 2 are rejected for the core illustrated look (realism-tuned,
eastus2-only, and Sora 2 rejects image-to-video inputs containing human
faces).

| Model | Provider | Status | Region(s) | Key traits | Notes / why or why not | Source |
|---|---|---|---|---|---|---|
| Sora | OpenAI (sold by Azure) | rejected | eastus2 only (Americas) | Text-to-video / image-to-video; realism and physics tuned | Rejected for the core illustrated look: realism bias will not hold a stylized look; separate resource from an East US account | https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure |
| Sora 2 | OpenAI (sold by Azure) | rejected | eastus2 only (Americas) | text/image/video-to-video, output audio, remix; realism/physics/temporal tuned; Preview | RAI blocks IP/photorealistic and rejects input images with human faces (blocks image-to-video for people-present art); eastus2-only | https://learn.microsoft.com/azure/foundry/openai/concepts/video-generation#responsible-ai-and-video-generation |
| Off-Azure (Runway Gen-4/4.5, Luma, Kling, Pika) | Runway / Luma / Kling / Pika | rejected | Off-Azure | Preserve a stylized source look better than Sora (character consistency, camera control) | Governance departure: off the harness, off Azure, separate RAI and billing, no HCS Governance MCP coverage; capability claims are roundup-grade, not first-party | https://runwayml.com/ |

## Reasoning / review models

Research: [SPIKE-10](../research/SPIKE-10-latest-gpt-model.md) (latest GPT),
[SPIKE-11](../research/SPIKE-11-newer-grok-model.md) (newer Grok), and
[SPIKE-15](../research/SPIKE-15-niche-reviewer-models.md) (niche reviewers).
Vision-capable reviewer candidates are tracked as planned and gated, not
deployed.

| Model | Provider | Status | Region(s) | Key traits | Notes / why or why not | Source |
|---|---|---|---|---|---|---|
| gpt-5.6-terra | OpenAI (sold by Azure) | planned | East US (Global Standard) | Vision; reasoning; 1.05M-token context; GA | OpenAI half of the vision content-reviewer pair; quota-gated only (Tier 5 has quota by default) | https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure |
| grok-4-1-fast-reasoning | xAI (sold by Azure) | planned | East US (Global Standard) | Vision; reasoning; 128K in / 128K out; GA | xAI half of the reviewer pair; gate is xAI terms acceptance plus quota | https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure |
| grok-4.3 | xAI (sold by Azure) | evaluated | East US | Text-only; Preview; 200K in / 8K out | Newer-numbered but text-only, so fails the vision requirement for image review | https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure |
| grok-4-20-reasoning / non-reasoning | xAI (sold by Azure) | evaluated | East US | Text-only; Preview; 262K in / 8K out | Newer-numbered but text-only; rejected for the vision reviewer role | https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure |
| Kimi-K2.7-Code | Moonshot AI (sold by Azure) | evaluated (lead candidate) | East US (Global Standard) | Coding-specialized; text+image 262K; tool calling; Preview | Lead candidate for a code/document reviewer role distinct from the image-review pair | https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure |
| Kimi K3 (2026-07-16 flagship) | Moonshot AI | evaluated (watch item) | Not in Foundry catalog | ~2.8T MoE, 1M-token context (third-party reported) | NOT in the Azure catalog yet; track for a future `Kimi-K3` entry | https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure |
| DeepSeek-V4-Pro / V4-Flash | DeepSeek (sold by Azure) | evaluated | East US (Global Standard) | Strong code/reasoning, text-focused | Sold-by-Azure A/B counterpart for the code/document reviewer | https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability |
| Llama-4-Maverick-17B-128E | Meta (sold by Azure) | evaluated | East US (Global Standard) | Text+image up to 1M-token context; general reviewer | Good for long-document comprehension; not code-specialized | https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure |
| Mistral-Large-3 | Mistral AI (sold by Azure) | evaluated | East US (Global Standard) | Credible general reviewer | Sold-by-Azure alternative reviewer | https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability |
| Phi-4-reasoning / Phi-4-mini-reasoning | Microsoft (sold by Azure) | evaluated | East US (Global Standard) | Small, cheap, first-party reasoning | Optional low-cost pre-filter that escalates only nontrivial findings | https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability |
| FW-GLM-4.x, FW-Qwen3.6, FW-MiniMax-M2.5, FW-GPT-OSS-120B | via Fireworks | evaluated | East US (Fireworks partner path) | Strong coding/agentic options | Heavier governance caveats (Fireworks data-sharing, no EU Data Boundary/FedRAMP); prefer the sold-by-Azure path | https://learn.microsoft.com/azure/foundry/how-to/fireworks/enable-fireworks-models |

## See also

- Machine-readable registry: `models/registry.schema.json`,
  `models/registry.example.json`, and the consumption contract in
  [the model registry guide](../guide/model-registry.md).
- Image selection methodology and access:
  [ADR-0002](../adr/ADR-0002-image-model-and-access.md).
- Historical FLUX adoption record (superseded):
  [ADR-0010](../adr/ADR-0010-flux-image-model-adoption.md).
