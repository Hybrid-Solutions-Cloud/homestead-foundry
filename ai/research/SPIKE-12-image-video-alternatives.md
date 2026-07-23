# SPIKE-12: broader image, animation, and video generation alternatives

Role: foundry-researcher (Opus). Status: research spike complete. No Azure resources created, no spend, no images or video generated.
Date: 2026-07-22
Scope: survey image, animation, and video generation models beyond the roster this repo already deploys or rejected (MAI-Image-2.5, FLUX.2-pro, FLUX.1-Kontext-pro, FLUX-1.1-pro for stills; Sora rejected for the core hand-drawn graphite look). Confirm whether the current roster is still the best available, or whether any new candidate offers a genuinely different capability the roster lacks. Grounds every claim in a first-party Microsoft source, cited inline. Anything Microsoft has not published, or that lives off-Azure, is marked UNKNOWN or flagged as a governance departure.

This spike is written generically so its findings apply to any Azure AI Foundry image or video build in this repo (`<initiative>`), for any consuming brand (`<brand>`). The concrete first build it was run for (the East US Foundry account serving two children's-book publishing brands) is preserved in the marked "Worked example" section at the end.

Grounding read first: `pmo/BACKLOG.md` (the deployed image/video roster and the Sora rejection), `ai/research/SPIKE-01-image-model.md` (MAI-Image-2.5 baseline and the style-lock requirement), and the memory roster note. This spike widens SPIKE-01 from one model to the full current catalog and to non-Azure video.

---

## Q1. What image-generation models exist in the current Foundry catalog beyond the deployed roster

**Question.** Beyond the four stills models already deployed (MAI-Image-2.5, FLUX.2-pro, FLUX.1-Kontext-pro, FLUX-1.1-pro), what image models does the Foundry catalog now offer, in which regions, behind what access gates, and does any offer a genuinely different capability (better multi-reference conditioning, better character-lock, mask control, native animation) that the roster lacks?

**Findings.**

- **The catalog's image families are: Azure OpenAI GPT-image, Black Forest Labs FLUX, and Microsoft MAI-Image.** Source: [Foundry Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure) and [Deploy and use FLUX models in Microsoft Foundry](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux). No other first-party image-generation family is listed in "Foundry Models sold by Azure."

- **New since the roster was last set: the GPT-image family (gpt-image-1, gpt-image-1-mini, gpt-image-1.5, gpt-image-2).** The roster memory recorded GPT-Image models as "out-of-region / limited access." That is now only partly true:
  - `gpt-image-2` (version `2026-04-21`) is **Generally Available** (no access application). `gpt-image-1.5`, `gpt-image-1`, and `gpt-image-1-mini` remain **limited access preview** (apply at aka.ms/oai/gptimage1.5access or aka.ms/oai/gptimage1access). Source: [Azure OpenAI image generation models, Models and capabilities](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e#models-and-capabilities).
  - **Region gate matters for an East US account.** In the Americas, the whole GPT-image family (including GA `gpt-image-2`) is available only in **eastus2** and **westus3**, NOT in **eastus**. Source: [Region availability for Foundry Models sold by Azure, Global Standard, Americas](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard). So an East US Foundry resource cannot deploy any GPT-image model in-region; it would need a second resource in eastus2 or westus3.
  - **Capability that the FLUX/MAI roster genuinely lacks:** GPT-image-2 supports **mask-based inpainting and variations** (edit a masked region with a prompt), **arbitrary resolutions up to 4K** (long edge to 3,840 px, aspect up to 3:1, both edges multiples of 16), and **1 to 10 images per request** via the `n` parameter. MAI-Image has no mask and returns one image per call (per SPIKE-01); FLUX returns one image per call. Source: [Models and capabilities](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e#models-and-capabilities).
  - **Why it is still not a style-match win:** every GPT-image variant is documented as **"realism-optimized"** with **"advanced face preservation."** That is the opposite of the non-photorealistic graphite house style the roster requires, and it is the same realism bias that made MAI-Image-2.5 fail on text-only prompts. Source: same Models-and-capabilities table.

- **Correction to the roster: FLUX.2-flex is available, not "NOT AVAILABLE."** The roster memory marked `FLUX.2-flex` as "NOT AVAILABLE (not in East US catalog)." The current region table lists **FLUX.2-flex, FLUX.2-pro, FLUX.1-Kontext-pro, and FLUX-1.1-pro all available in every Americas region including eastus** under Global Standard, and all four are **GA** (no retirement date). Sources: [Region availability, Global Standard, Americas](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard) and [Model retirement schedule, Black Forest Labs](https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirement-schedule#foundry-models-sold-by-azure).
  - FLUX.2-flex accepts **text plus up to 10 reference images** (vs 8 for FLUX.2-pro), exposes `guidance` and `steps` for fine control, and is positioned as best for **text-heavy layouts and text overlay** with more graceful throughput as image size grows. Max output 4 MP. Source: [Deploy and use FLUX models, FLUX.2 flex](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux#available-flux-models).
  - This is an incremental extension of the same FLUX family already carrying the style-lock load, not a new capability class: 10 vs 8 reference images and explicit guidance/steps knobs. Its distinguishing strength (text rendering / text overlay) is marginal for a wordless scene-art pipeline where captions are composited later.

- **Net for Q1.** The only genuinely new capabilities in the catalog since the roster was set are (a) GPT-image-2's mask inpainting and 4K arbitrary aspect, which are out-of-region for East US and realism-biased, and (b) FLUX.2-flex, which is now deployable and adds two reference-image slots plus guidance/steps but stays within the FLUX approach the roster already relies on for style-lock.

## Q2. What animation and video-generation options exist beyond Sora

**Question.** Beyond the Sora that was rejected for the core look, what video or animation options exist in the Foundry catalog and, if a first-party Azure path does not fit, among credible non-Azure vendors (in the spirit of SPIKE-07's cloud-plus-open candidate set for speech)?

**Findings.**

- **First-party Foundry video generation is Sora and Sora 2 only.** The catalog lists exactly `sora` and `sora-2` under video generation; no other first-party video or animation model exists in "Foundry Models sold by Azure." Source: [Foundry Models sold by Azure, Video generation models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure).

- **Sora 2 is newer than the model the roster rejected, and it adds image-to-video, audio, and remix.** Modalities: text to video, image to video, and generated-video to video; it generates output audio and supports targeted remix edits; it is realism, physics, and temporal-consistency tuned. Source: [Video generation with Sora 2 (preview)](https://learn.microsoft.com/azure/foundry/openai/concepts/video-generation).
  - **Region gate: sora-2 (versions `2025-10-06` and `2025-12-08`) is available only in eastus2 in the Americas**, not eastus. Source: [Region availability, Global Standard, Americas](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard). This confirms the roster's "region-blocked to East US 2, a separate resource from the East US Foundry account."
  - **Two Sora 2 restrictions independently rule it out for the core children's-illustration use case**, over and above the style problem:
    1. **Sora 2 blocks all IP and photorealistic content, and "input images with faces of humans are currently rejected,"** along with real people, copyrighted characters, and copyrighted music; only content suitable for audiences under 18 is allowed. Source: [Video generation with Sora 2, Responsible AI](https://learn.microsoft.com/azure/foundry/openai/concepts/video-generation#responsible-ai-and-video-generation). For a brand with children in scenes, feeding a character illustration that contains a human face into image-to-video is documented to be rejected, which removes the one Sora-2 path (animate an existing locked still) that could have preserved the house style.
    2. **Sora is realism and physics tuned** ("enhanced realism, physics, and temporal consistency"), the same bias that led the roster to conclude it will not hold a hand-drawn graphite look. Source: same Sora 2 page.
  - **Conclusion for the core look: the roster's Sora-rejected-for-core decision holds and is strengthened by Sora 2.** Sora 2 is a better realism engine, not a solution to the illustrated-style requirement, and its face-rejection rule specifically blocks the image-to-video route for child-present art.

- **Credible non-Azure image-to-video vendors do preserve illustrated style better, but they are an off-Azure governance departure.** For the non-core, "maybe-later" video use case the roster keeps open, the strongest current image-to-video tools that hold a stylized source look are **Runway (Gen-4 / Gen-4.5), Luma, Kling, and Pika**. Runway's documented strength is image-to-video that keeps motion inside a heavily stylized source style with character consistency and camera control; Pika is called out for stylized clips. Source (secondary, vendor and roundup coverage, not first-party Microsoft): [Runway Gen-4 overview (invideo.io)](https://invideo.io/blog/runway-gen-4-ai-video-generator/), [Kling vs Runway vs Luma 2026 (atlascloud.ai)](https://www.atlascloud.ai/blog/guides/kling-ai-vs-runway-vs-luma), [Best image-to-video AI tools 2026 (morphed.app)](https://morphed.app/blog/best-image-to-video-ai-tools). These claims are vendor / roundup grade, not first-party, and are marked accordingly (see UNKNOWN). Adopting any of them means: off the Claude Code harness and off Azure, a separate billing relationship, a separate and non-Azure responsible-AI and content-safety posture for children's content, and no coverage by the repo's HCS Governance MCP. That is a material departure from this repo's Azure-first, harness-only, children's-content-safe posture and is not recommended without an explicit owner decision.

## Q3. Style-match risk for any new candidate

**Question.** For each new candidate, does first-party documentation or the vendor's own material suggest it can hold a consistent, non-photorealistic illustrated look (the requirement MAI-Image-2.5 failed on text-only prompts), or is style-lock only achievable via the image-conditioning approaches the FLUX deployments already cover?

**Findings.**

- **GPT-image family: documented realism bias, so higher style-match risk than FLUX, not lower.** All GPT-image variants are "realism-optimized" with "advanced face preservation." There is no documented style-reference or style-strength control that would beat FLUX's multi-reference conditioning for holding a graphite house style. Style-lock, if attempted, would still rely on image conditioning, which FLUX.2-pro (8 refs) and FLUX.2-flex (10 refs) already do. Source: [Models and capabilities](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e#models-and-capabilities).

- **FLUX.2-flex: same conditioning approach as the deployed FLUX models, so same (already accepted) style-lock method.** It is within the family the roster already validated for character and style locking; the only style-relevant addition is two more reference-image slots. Source: [Deploy and use FLUX models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux#available-flux-models).

- **Sora 2 (video): style-lock is unproven for a graphite look and the one conditioning route (image-to-video) is blocked for faces.** It is realism tuned, and image-to-video (the only way to feed it a locked still) rejects human faces. Source: [Video generation with Sora 2](https://learn.microsoft.com/azure/foundry/openai/concepts/video-generation#responsible-ai-and-video-generation).

- **Non-Azure video (Runway et al.): vendors claim illustrated-style preservation, but unverified against this specific graphite house style.** No first-party demonstration on the target style exists; only the pilot-equivalent (a real test on real house-style stills) would resolve it. Marked UNKNOWN.

## Q4. Cost and access gating for any credible new candidate

**Question.** Cost mechanics and access gates for each new candidate.

**Findings.**

- **FLUX.2-flex.** GA, no access application, deployable via Global Standard in all regions including East US. Deploying requires the **Cognitive Services Contributor** role on the Foundry resource. Billing follows the Foundry token-metering model (billed per token for inputs and outputs, no charge for the resource or deployment itself), consistent with the other FLUX and MAI image models in SPIKE-01. Sources: [Deploy and use FLUX models, Prerequisites](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux), [Foundry Models FAQ](https://learn.microsoft.com/azure/foundry-classic/foundry-models/faq). **Exact per-token rates for FLUX.2-flex: UNKNOWN from a rendered first-party page during this spike;** read live in the Foundry portal at deploy time (same discipline as SPIKE-01 Q2).

- **GPT-image-2.** GA (no application), but **not available in East US** (eastus2 / westus3 only in the Americas), so it needs a separate resource outside the primary account. Realism-biased. Billing is Azure OpenAI token / image metering; **exact rates UNKNOWN here**, read live before any use. `gpt-image-1.5`, `gpt-image-1`, and `gpt-image-1-mini` additionally require a limited-access application. Sources: [Models and capabilities](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e#models-and-capabilities), [Region availability, Global Standard, Americas](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard).

- **Sora 2.** Preview, **eastus2 only** in the Americas (separate resource), per-second billing, and gated by the RAI restrictions in Q2 (faces, IP, photorealism, under-18-only). Sources: [Video generation with Sora 2](https://learn.microsoft.com/azure/foundry/openai/concepts/video-generation), [Region availability](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard). **Exact per-second price UNKNOWN here;** read live at deploy time.

- **Non-Azure video vendors.** Separate commercial contracts and pricing outside Azure Cost Management, separate RAI. Not costed here because adoption is not recommended (Q2). Marked UNKNOWN by design.

---

## What is still UNKNOWN

1. **Exact per-token / per-image / per-second prices** for FLUX.2-flex, GPT-image-2, and Sora 2. Not verifiable from a rendered first-party pricing page during this spike (same limitation SPIKE-01 hit for MAI). Resolve by reading the price shown in the Foundry portal at deploy time.
2. **Whether GPT-image-2 or FLUX.2-flex can hold the specific graphite house style** better than the deployed FLUX.2-pro. Documentation gives realism bias (GPT-image) or the same conditioning approach (FLUX.2-flex), but only a real test on house-style stills resolves it.
3. **Whether any non-Azure image-to-video vendor (Runway, Luma, Kling, Pika) actually preserves this graphite style** and clears a children's-content safety bar. Vendor and roundup claims only; no first-party or on-style demonstration. A gated, owner-approved test would be required.
4. **Whether GPT-image or Sora regional coverage changes** (for example GPT-image reaching East US, or Sora reaching a region co-located with the primary account). Re-check the region availability table at any future deploy attempt.
5. **Whether Sora 2's "input images with faces of humans are currently rejected" restriction is lifted** (the docs say a bypass setting "will be available in the future" only for the under-18 rule, not the face rule). Re-check the Sora 2 RAI section before considering any image-to-video route.

## Recommendation

1. **Keep the current stills roster. It is still the best available for the core look.** No catalog model beats the deployed FLUX.2-pro / FLUX.1-Kontext-pro / FLUX-1.1-pro (with MAI-Image-2.5 as the first-party fallback / A-B baseline) for locking a non-photorealistic graphite house style. GPT-image is realism-biased and out-of-region for East US; FLUX.2-flex is an incremental extension of the same family, not a new capability class. This is the expected, evidence-supported outcome; no new adoption is forced.
2. **Optionally add FLUX.2-flex as a low-risk roster extension, gated behind an ADR.** It is GA, deployable in East US, and adds two reference-image slots (10 vs 8) plus explicit `guidance`/`steps` control. Value is marginal for wordless scene art, so treat it as a "nice to have" A-B arm, not a priority. If adopted, follow the gate: this spike, then a follow-up ADR (spike to ADR to design to deploy), then the Azure-write confirmation the repo requires.
3. **Do not deploy GPT-image models for the core stills look.** Realism-optimized and face-preservation-tuned is the wrong bias, and every variant is out-of-region for an East US account (needs a second resource in eastus2 / westus3). Its only unique capability, mask inpainting, is not required by the current prompt-plus-multi-reference pipeline. Revisit only if a masked-edit workflow becomes a real need.
4. **Confirm the Sora-rejected-for-core decision stands, now against Sora 2.** Sora 2 is a stronger realism engine but still will not hold the graphite look, is eastus2-only (separate resource), and specifically rejects image-to-video inputs containing human faces, which blocks the only style-preserving route for child-present art. Keep the core video path as locked graphite stills plus Ken Burns pan/zoom plus MAI-Voice narration via ffmpeg.
5. **Treat non-Azure image-to-video vendors (Runway, Luma, Kling, Pika) as a known-but-not-recommended option** for the non-core, maybe-later video use case only. They preserve illustrated style better than Sora, but adopting any of them leaves the harness, leaves Azure, and creates a separate RAI and billing posture for children's content. Do not pursue without an explicit owner decision and its own ADR.

## Sources

- Foundry Models sold by Azure (image and video model families, Sora/Sora 2, GPT-image list): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure>
- Region availability for Foundry Models sold by Azure, Global Standard, Americas (FLUX.2-flex in eastus; GPT-image and sora-2 in eastus2/westus3 only; MAI-Image in eastus): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability#global-standard>
- Deploy and use FLUX models in Microsoft Foundry (FLUX.2-flex 10 refs, guidance/steps, 4 MP, GA, all regions, Contributor role): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux>
- Model retirement schedule, Black Forest Labs (all four FLUX models GA, no retirement date): <https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirement-schedule#foundry-models-sold-by-azure>
- Azure OpenAI image generation models, Models and capabilities (GPT-image-2 GA and 4K/mask; realism-optimized and face preservation; 1.x limited access): <https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e#models-and-capabilities>
- Video generation with Sora 2 (preview) (modalities, audio, remix, realism tuning): <https://learn.microsoft.com/azure/foundry/openai/concepts/video-generation>
- Video generation with Sora 2, Responsible AI (blocks IP/photorealistic, rejects human faces in input images, under-18-only, no real people): <https://learn.microsoft.com/azure/foundry/openai/concepts/video-generation#responsible-ai-and-video-generation>
- Foundry Models FAQ (token billing, no resource/deployment charge): <https://learn.microsoft.com/azure/foundry-classic/foundry-models/faq>
- Non-Azure image-to-video vendors (secondary, vendor/roundup grade, not first-party): Runway Gen-4 overview <https://invideo.io/blog/runway-gen-4-ai-video-generator/>; Kling vs Runway vs Luma 2026 <https://www.atlascloud.ai/blog/guides/kling-ai-vs-runway-vs-luma>; Best image-to-video AI tools 2026 <https://morphed.app/blog/best-image-to-video-ai-tools>

---

<!-- safety-scan-worked-example:start -->
## Worked example: Gunner the Lab / Holdfast Press

This section carries the concrete application this spike was first run against: the East US Foundry account `aif-studioai-prod-eus-01` (RG `rg-studioai-prod-eus-01`, "This Is My Demo - MVP Subscription") serving the Gunner the Lab and Holdfast Press (StoryReader) children's-book brands. Everything above is model-general.

**Roster confirmed (Q1, Q3).** The deployed stills roster (`flux-2-pro`, `flux-1-kontext-pro`, `flux-1-1-pro`, with `mai-image-25` as first-party fallback) remains the best available for the graphite hand-drawn house style. GPT-image-2 is realism-biased and, critically for this account, not deployable in East US (eastus2 / westus3 only), so it would require a second resource outside the primary account. No change to the deployed roster is required.

**Roster correction (Q1).** The prior note that FLUX.2-flex was "NOT AVAILABLE" in the East US catalog is now out of date: FLUX.2-flex is GA and listed as available in eastus under Global Standard. If the owner wants a 10-reference-image A-B arm alongside FLUX.2-pro's 8, FLUX.2-flex is deployable in-account behind a follow-up ADR. Value is marginal for wordless scene art.

**Video decision confirmed (Q2, Q4).** The core video path stays locked graphite stills plus Ken Burns plus `mai-voice-2` narration via ffmpeg. Sora 2 does not change this: it is eastus2-only (a separate resource from this East US account), realism tuned, and its image-to-video route rejects input images containing human faces, which specifically blocks animating a child-present house-style still. Non-Azure vendors (Runway et al.) preserve illustrated style better but would leave the harness and Azure and create a separate children's-content RAI posture; not recommended without an explicit owner decision.

**Gate reminder.** Any adoption (FLUX.2-flex arm, or a gated non-Azure video test) needs a follow-up ADR before deployment, and any Azure write is confirmed with the owner first, consistent with this repo's hard rules.
<!-- safety-scan-worked-example:end -->
