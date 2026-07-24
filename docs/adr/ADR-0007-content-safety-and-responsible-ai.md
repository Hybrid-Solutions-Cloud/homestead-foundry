# ADR-0007: Content safety and responsible AI for generated images and narration

- Status: Accepted (owner approved 2026-07-24)
- Date: 2026-07-11

## Context

This decision covers any Azure AI Foundry build in this repo that generates images and/or synthetic narration: MAI-Image-2.5 scene art (ADR-0002) and MAI-Voice-2 synthetic narration (ADR-0003). SPIKE-04 (`docs/research/SPIKE-04-identity-security.md`) and SPIKE-01 (`docs/research/SPIKE-01-image-model.md`) ground the responsible-AI posture in first-party Microsoft sources.

The responsible-AI forces below apply to every such build regardless of audience. A minors or otherwise sensitive audience is treated as one illustrative case that tightens a few specific habits, not as the framing of the whole decision. The concrete detail from this repo's first proven build is preserved under anonymized "Worked example" callouts so the reusable methodology stays separable from any one workload.

The forces this decision must reconcile:

- **Image RAI baseline.** The MAI image how-to names its risk areas as violent or gory content, sexual content or nudity, depictions of public figures, and replication of trademarked or protected material, applied through system-level classifiers, and instructs customers to disclose that content is AI-generated. There is no MAI-specific minors policy published.
- **The photorealistic-minors gate.** The "photorealistic images of minors are blocked by default" rule is documented for Azure OpenAI image models (DALL-E, GPT-image), not for MAI, so whether MAI enforces an equivalent gate is UNKNOWN. The trigger is photorealism, so a hand-drawn, non-photorealistic illustration style is the safer category. This force binds only when a workload actually depicts minors.
- **Trademark in the prompts.** When a prompt, character description, or style bible names a real trademarked product or logo, that collides with the named "replication of trademarked or protected material" risk area. This applies to any workload whose source material references real brands.
- **Retention and residency.** MAI image models are stateless and not used to train the base models; only abuse monitoring stores flagged prompts, at rest in the customer-designated geography, while transient Global Standard processing may occur outside East US. Real-time TTS stores neither input text nor output audio. Modified abuse monitoring and guardrail opt-outs are gated to account-team-managed or eligible customers and are unnecessary for benign content.
- **Disclosure duty.** Microsoft requires disclosing synthetic voices. The TTS code of conduct lists audiobooks and fictional entertainment as appropriate uses. When the audience is minors or otherwise sensitive, the disclosure must additionally be clear enough for a parent, guardian, or other responsible party to make an informed decision.
- **Provenance.** Whether MAI image output carries C2PA Content Credentials is UNKNOWN (documented only for Azure OpenAI images), so provenance must be recorded independently.

<!-- safety-scan-worked-example:start -->

> **Worked example (first proven build).** The originating build served a sensitive-audience catalog that placed minors in every scene, and its character tokens specified a named apparel brand's overalls with its logo patch, drawn from the build's character and style bible. That named-trademark detail is exactly the collision the "Trademark in the prompts" force above describes in general terms, and the minors-in-scene content is what activated the photorealistic-minors and parent-disclosure habits below.

<!-- safety-scan-worked-example:end -->

## Decision

Operate the whole workload **within the default responsible-AI guardrails**, and bake the following habits into the pipeline for any Foundry image or narration build.

1. **Stay inside default guardrails.** Do not seek modified abuse monitoring, content-filter opt-out, or zero-data-retention. They are gated, and they are unnecessary for benign content whose default retention is already minimal (nothing stored for real-time TTS; only flagged image prompts stored under abuse monitoring, at rest in the US geography).
2. **Genericize trademarked terms in every image prompt.** Replace any named trademark with a generic physical description. This reduces refusal risk and changes no visible detail of the art.
3. **Record provenance for every generated asset.** Capture generator service, model and version, endpoint, prompt hash, size, timestamp, and (for edits) the source image, with seed recorded as "none (not supported)", written to the committed provenance index defined in ADR-0008, independent of whether MAI embeds C2PA.
4. **Disclose AI generation and synthetic narration.** Add a short audience-facing note in each surface that publishes the assets, satisfying both the image transparency ask and the mandatory TTS synthetic-voice disclosure.
5. **Minimize retention.** Keep the real-time TTS synthesis path, which stores no text or audio; do not switch to the Long Audio or batch API (which stores the submitted script and output audio) without revisiting this decision. Rely on default abuse monitoring for images.

**When the workload targets a sensitive audience such as minors, additionally:**

6. **Keep hand-drawn, non-photorealistic framing in every image prompt** (for example "hand-drawn storybook illustration" plus a graphite or colored-pencil style phrase), both to hold the style and to stay clearly clear of the photorealistic-minors gate. That gate is documented for Azure OpenAI and is UNKNOWN for MAI, so treat this as a hedge and log any content-filter refusals as prompt-engineering signals rather than blockers.
7. **Make the disclosure responsible-party-facing.** Word the AI-generation and synthetic-narration note so a parent, guardian, or other responsible party can make an informed decision, satisfying the heightened transparency ask for a minors audience.

<!-- safety-scan-worked-example:start -->

> **Worked example (concrete detail from the first build).**
> - **Prompt genericization (rule 2):** the named-apparel-brand token was replaced with "denim bib overalls with a red rectangular chest patch". Same visible art, no named trademark.
> - **Provenance fields (rule 3):** the recorded fields were generator service, model and version, endpoint, prompt hash, size, timestamp, source image (for edits), and seed = "none (not supported)".
> - **Sensitive-audience disclosure (rule 7):** the app note read "illustrations and some narration are AI-generated", worded for a parent-facing read.

<!-- safety-scan-worked-example:end -->

## Consequences

**Positive.**
- Low-friction posture appropriate to benign generated content, with no gated approvals to chase.
- Trademark risk is mitigated proactively at the prompt layer, and the photorealistic-minors risk is mitigated for any workload that opts into the sensitive-audience habits.
- The audience-facing disclosure meets the transparency requirement, and scales up to the parent-facing bar for a minors audience.
- The provenance record closes the "which AI made this art" gap permanently and satisfies the transparency ask at the data layer.

**Negative.**
- Occasional content-filter refusals must be handled during generation.
- The minors-gate behavior for MAI is unverified until a pilot observes real filter behavior on prompts that depict minors.
- MAI image runs as Global Standard, so transient processing may leave East US even though at-rest data (including any flagged-content store) stays in the US geography; real-time TTS stays in-region and stores nothing.
- Preview privacy practices may differ from the documented steady state and must be re-verified at GA.

**Follow-ups.**
- For sensitive-audience builds, observe filter behavior on hand-drawn prompts that depict minors during the pilot and log refusals.
- Verify empirically whether MAI outputs carry C2PA Content Credentials (contentcredentials.org verify, c2patool, PNG metadata).
- Re-verify retention and residency findings at GA, given the preview-privacy caveat.

## Alternatives considered

- **Pursue modified abuse monitoring, content-filter opt-out, or zero data retention.** Rejected: gated to account-team-managed or EA and MCA customers, and unnecessary for benign content whose default retention is already minimal.
- **Keep a named trademark token in prompts.** Rejected: trademark replication is a named risk area, and genericizing changes nothing visible in the art. (In the first build this was a named-apparel-brand token; see the Worked example above.)
- **Use a photorealistic style for a minors-depicting workload.** Rejected: it would risk the documented photorealistic-minors gate; a hand-drawn style is both safer and, for the originating build, the intended look.
- **Rely only on MAI-embedded provenance.** Rejected: C2PA on MAI output is UNKNOWN, so an independent sidecar record is recorded regardless.
- **Use the batch or Long Audio TTS path.** Rejected for the retention-minimizing default: it stores the script and audio in Azure storage, whereas the real-time path stores nothing.

## Sources

- `docs/research/SPIKE-04-identity-security.md` (RAI baseline, minors gate, trademark, retention and residency, disclosure duty, network posture)
- `docs/research/SPIKE-01-image-model.md` (image RAI risk areas, non-photorealistic hedge, provenance sidecar)
- Deploy and use MAI image models, responsible AI considerations: <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
- Azure OpenAI image generation, responsible AI and minors (photorealistic minors blocked by default, Azure OpenAI only): <https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e>
- Data, privacy, and security for Models sold by Azure (stateless, not used to train, abuse-monitoring store per geography, Global processing, preview caveat): <https://learn.microsoft.com/azure/foundry/responsible-ai/openai/data-privacy>
- Limited access for Foundry Models sold by Azure (modified abuse monitoring and guardrail opt-out are gated): <https://learn.microsoft.com/azure/foundry/responsible-ai/openai/limited-access>
- Transparency note: text to speech (mandatory synthetic-voice disclosure; minors and parent disclosure): <https://learn.microsoft.com/azure/foundry/responsible-ai/speech-service/text-to-speech/transparency-note>
- Data, privacy, and security for text to speech (real-time stores no text or audio; Long Audio and batch store in Azure storage): <https://learn.microsoft.com/azure/ai-foundry/responsible-ai/speech-service/text-to-speech/data-privacy-security>
- Content Credentials (C2PA for Azure OpenAI images only): <https://learn.microsoft.com/azure/ai-foundry/openai/concepts/content-credentials>
