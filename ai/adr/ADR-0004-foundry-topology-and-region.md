# ADR-0004: Foundry resource topology and region

- Status: Proposed
- Date: 2026-07-11

> This ADR records a reusable topology-and-region decision for Azure AI Foundry
> builds on this platform. The concrete detail of the first proven build (real
> resource names, the legacy narrator Speech account, the chosen region, and the
> voice and style picks) is preserved under the "Worked example" section at the
> end, clearly separated from the reusable decision above it.

## Context

The source plans and the environment check converge on a single shared
resource, and the kind of resource is forced by the two models' access
patterns. The forces, grounded in `ai/verification/environment-readiness.md`,
`ai/research/SPIKE-03-tenant-readiness.md`, `ai/research/SPIKE-04-identity-security.md`,
and `ai/research/SPIKE-06-pipeline-integration.md`:

- **One kind serves both modalities.** MAI-Image-2.5 is a Foundry model deployment (Global Standard, model format Microsoft) and therefore requires an `AIServices`-kind account. MAI-Voice-2 has no deployment step at all; its prerequisite is simply a Speech resource in a supporting region, and voices are selected by name at synthesis time (for example `en-US-<VoiceName>:MAI-Voice-2`) in the SSML `<voice>` element. Because the `AIServices` kind also serves the Speech surface, one resource can host the image deployment and serve the voice work, exactly as both plans proposed.
- **The existing legacy Speech account cannot host this.** The build inherits an existing narrator Speech account of kind `SpeechServices` (single-service) at the F0 tier, so it cannot take a Foundry model deployment, and F0 eligibility for MAI voices is unverified. A new `AIServices` resource is required regardless of what any spike finds; this is confirmation, not new risk.
- **The narrator track stays where it is.** The pipeline keeps the existing narrator and read-along audio on the current Speech resource (`AZURE_SPEECH_*`), and points only the new MAI listen-voice variants and the image calls at the new resource (`MAI_SPEECH_*`, `MAI_IMAGE_*`). So the new resource is additive; it does not replace the legacy account.
- **Tier.** S0 is required: F0 eligibility for MAI voices is undocumented, and the MAI meter has no documented free allotment. S0 also gives the higher Speech throughput (200 transactions per second default).
- **Region.** Choose the single region (per ADR-0001) that is on the seven-region MAI-Image-2.5 Global Standard list, is marked for MAI voices, and carries the Speech "voices and styles in preview" flag that the chosen expressive style relies on. That intersection resolves to one region for this model pair.
- **Custom subdomain.** An `AIServices` account is created with a custom subdomain by default; this is also the prerequisite for a later Microsoft Entra path on the Speech surface (ADR-0005), so it is kept.
- **Global Standard residency note.** MAI-Image-2.5 deploys as Global Standard, so transient image processing may occur outside the chosen region, while any data stored at rest (including the abuse-monitoring store) stays in the customer-designated geography. TTS real-time synthesis stays in-region and stores nothing.

## Decision

**Provision one shared Azure AI Foundry resource, kind `AIServices`, SKU `S0`, in the single qualifying region, in one dedicated resource group.** It hosts the MAI-Image-2.5 deployment and serves MAI-Voice-2 through its Speech endpoint. This one-resource topology is recorded per the owner-locked MASTER-PLAN target and is not reopened.

On that resource:

- **Deploy MAI-Image-2.5 as Global Standard.** `az cognitiveservices account deployment create` with `--model-name "MAI-Image-2.5" --model-format Microsoft --model-version 2026-06-02 --sku-name GlobalStandard --sku-capacity 1`, verifying the version string is still current at deploy time (see ADR-0001 follow-up). Image calls hit the resource endpoints `https://<resource>.services.ai.azure.com/mai/v1/images/generations` and `/edits`.
- **Serve MAI-Voice-2 with no deployment.** Voices are selected by name in SSML against the resource's Speech synthesis endpoint. No model deployment, no Foundry project, and no per-voice provisioning is required for the voice path.
- **Enable the custom subdomain** (the `AIServices` default) and keep it, as a harmless prerequisite for a future Entra-for-Speech move.

**Naming intent (exact CAF strings finalized in the design phase).** One resource group and one Foundry account, named CAF-aligned and neutral to the initiative rather than to any consumer, because the resource is shared by all consumers and both modalities. The intended shape is a resource-type prefix, a brand-neutral initiative token (an approved short name for the media backbone), an environment token, the region token, and an instance index (for example a resource group like `rg-<initiative>-<env>-<region>-01` and a Foundry account with the current CAF abbreviation for an Azure AI Foundry / AI Services account). The final resource-type abbreviations and token choices are confirmed against the naming standard in the design phase (governance MCP `validate`) before any create.

**Do not reuse the existing legacy Speech account.** The inherited F0 SpeechServices account keeps serving the narrator and read-along track; the new S0 AIServices resource serves the MAI listen voices and the image model.

## Consequences

**Positive:**
- One resource means one resource group, one budget scope (ADR-0006), one identity and role surface (ADR-0005), and one set of secrets, which is the simplest posture for a multi-consumer, two-modality workload.
- The `AIServices` kind serves image and voice together, so no second resource is needed and the two source plans share infrastructure as designed.
- The chosen region satisfies both models and the preview-styles flag, and co-locates with the existing Key Vault and Speech resource.
- The existing narrator and read-along pipeline is untouched, so read-along stays on the proven WordBoundary track while the MAI voices are added additively.

**Negative:**
- A new resource must be created (the existing F0 Speech account is deliberately not upgraded or reused), so there are now two Speech-capable resources in the subscription (the old narrator F0 and the new S0), and the pipeline carries a two-resource key split.
- Global Standard means transient image processing may leave the chosen region even though at-rest data stays in the customer-designated geography; acceptable for benign hand-drawn children's content but recorded for the record.
- One shared resource means Azure meters aggregate all consumers; per-consumer cost attribution comes from the pipeline ledger, not Azure tags (ADR-0006).
- Both models are preview; retention and residency findings are the documented steady state and should be re-verified at GA.

**Follow-ups:**
- Run the roughly 30-minute voice spike against the new resource before layering variant code: confirm whether MAI-Voice-2 emits usable WordBoundary events, whether `Audio48Khz96KBitRateMonoMp3` is accepted (fall back to `Audio24Khz160KBitRateMonoMp3` if not), and read the exact regional voice id for any accented listen voice off the Foundry playground.
- The design phase locks the final CAF names and decides whether to create the optional Foundry project (useful mainly for the playground audition).
- Deployment is gated on explicit owner confirmation per repo policy.

## Alternatives considered

- **Reuse the existing legacy Speech account (SpeechServices, F0).** Rejected: wrong kind (a single-service Speech account cannot host a Foundry model deployment), and F0 eligibility for MAI voices is unverified with no documented free allotment.
- **Two separate resources, one for image and one for voice.** Rejected: the `AIServices` kind serves both, and one resource collapses identity, budget, and secret handling into a single surface; both plans and the environment check call for one shared resource.
- **A plain Speech resource (kind `SpeechServices`, S0) for voice plus a separate Foundry resource for image.** Rejected for the same reason: it defeats the shared-resource goal and doubles the operational surface for no benefit, since `AIServices` already includes Speech.
- **F0 tier.** Rejected: MAI-voice F0 eligibility is undocumented and the MAI meter has no free allotment, so S0 is assumed and every MAI character and image is treated as billable.
- **A region that does not satisfy all three constraints.** Rejected here and in ADR-0001: the qualifying region must appear on the image model's Global Standard list, be marked for the voice model, and carry the preview-styles flag; a region missing any one of these (as the first build's nearest alternative region was) is rejected.

<!-- safety-scan-worked-example:start -->

## Worked example: the Gunner the Lab and Holdfast Press media backbone

> Everything in this section is what was actually built with the reusable
> decision above, on the first proven build of this platform. It is historical
> fact, not part of the general methodology.

The first proven build stood up one shared media backbone for two StoryReader
publishing brands (Gunner the Lab and Holdfast Press), served by a single
AIServices resource.

- **Shared resource:** `aif-studioai-prod-eus-01` (AIServices, S0) in resource group `rg-studioai-prod-eus-01`, region East US. It hosts the MAI-Image-2.5 deployment (`mai-image-25`, Global Standard) and serves MAI-Voice-2 through its Speech endpoint. No deployment step exists for the voice path.
- **Legacy narrator account, left untouched:** `storyreader-tts` (resource group `rg-storyreader`), kind `SpeechServices`, tier F0. It keeps serving the existing narrator and read-along track (`AZURE_SPEECH_*`), while the new resource serves only the MAI listen voices and image calls (`MAI_SPEECH_*`, `MAI_IMAGE_*`). The new resource is additive; it does not replace `storyreader-tts`.
- **Region:** East US was the one region satisfying all three constraints (on the MAI-Image-2.5 Global Standard list, marked for MAI voices, and carrying the preview-styles flag). `eastus2` did not offer MAI-Image-2.5, which is why it was rejected in ADR-0001. East US also co-located with the existing Key Vault and the legacy Speech resource.
- **Voice and style picks:** the listen-voice set was Harper (en-US), Lisa (en-AU), and Ethan (en-US, rendered with the `excited` style); the SSML `<voice>` example above resolves to, for example, `en-US-Harper:MAI-Voice-2`.
- **Naming:** the CAF names `rg-studioai-prod-eus-01` and `aif-studioai-prod-eus-01` are neutral to both brands, because the one resource is shared across both brands and both modalities.

<!-- safety-scan-worked-example:end -->

## Sources

- `ai/verification/environment-readiness.md` (the existing legacy Speech account is SpeechServices F0 and cannot host the deployment; one resource can serve both; deployment command shape)
- `ai/research/SPIKE-03-tenant-readiness.md` (region and tier confirmation; the qualifying region satisfies both models)
- `ai/research/SPIKE-04-identity-security.md` (custom subdomain; Global Standard residency; no deploy step for voice)
- `ai/research/SPIKE-06-pipeline-integration.md` (two-resource key split; narrator stays on the existing resource; canvas sizes and endpoints)
- Deploy and use MAI image models in Microsoft Foundry (Global Standard, endpoints, parameters, size cap): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
- What is MAI-Voice (preview)? (no deploy step; voice name in the SSML `<voice>` element; region prerequisite): <https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices>
- Foundry Models sold by Azure (capability and size limits): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure>
- Data, privacy, and security for Models sold by Azure (Global processing location; at-rest data in the customer geography): <https://learn.microsoft.com/azure/foundry/responsible-ai/openai/data-privacy>
