# SPIKE-14: tenant-wide model and region survey

Role: foundry-researcher (Opus). Status: research spike complete. No Azure resources created, read, or modified; this is a first-party documentation review only.
Date: 2026-07-22
Scope: build a model-by-region availability matrix for the full current-and-planned roster on the model roster (MAI-Image-2.5, the FLUX family, MAI-Voice-2, and the gpt-5.6-terra / grok-4-1-fast-reasoning reviewer pair) and confirm whether East US still hosts every one of them. Region availability for preview models changes over time, so this spike re-verifies the region facts directly against the Microsoft Learn catalog rather than trusting the region findings in `ai/research/SPIKE-01-image-model.md` and `ai/research/SPIKE-02-voice-model.md` as still current.

Grounding documents read first: the model roster (the authoritative roster), `ai/adr/ADR-0004-foundry-topology-and-region.md` (the topology-and-region decision this spike tests), `ai/research/SPIKE-01-image-model.md`, and `ai/research/SPIKE-02-voice-model.md`.

Grounding rule: every region claim below is tied to a first-party Microsoft source with an inline URL. Anything the sources do not state is marked UNKNOWN with the test that resolves it. No figure is invented.

---

## Question

1. What is each roster model's actual region availability today, re-verified against the live Foundry model catalog and the Speech regions table rather than assumed from prior spikes.
2. Does East US still cover the full roster. If yes, say so plainly.
3. If East US does not cover everything, what is the best single-region alternative, or has the single-region posture become unachievable.
4. Quota and capacity: what region-level throughput constraint matters most, image generation rate limits especially (per SPIKE-01 Q5).

The roster surveyed (from the model roster): MAI-Image-2.5 (image, deployed), FLUX.2-pro, FLUX.1-Kontext-pro, FLUX-1.1-pro (image, deployed), MAI-Voice-2 (voice, deployed), gpt-5.6-terra and grok-4-1-fast-reasoning (reasoning / review, planned-gated). Sora is deliberately excluded: it is rejected-for-core and, per ADR-0004, carries its own East US 2 exception; this survey does not re-open it.

---

## Findings

### 1. Model-by-region availability matrix (re-verified 2026-07-22)

The two image-and-reasoning axes are Foundry "Models sold by Azure", surveyed on the Global Standard region-availability page (the deployment type all these models use). The voice axis is the Azure Speech text-to-speech regions table (MAI-Voice-2 has no Foundry deployment step; it is a Speech-surface capability selected by voice name). Columns show the Americas region set; "East US" is the load-bearing cell for this repo.

| Model | Kind | Deployment axis | East US | Other Americas regions | Cited region source |
|---|---|---|---|---|---|
| MAI-Image-2.5 (`2026-06-02`) | image | Global Standard | Yes | West US, West Central US only | [region availability, Americas](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability) |
| MAI-Image-2.5-Flash (`2026-06-02`) | image | Global Standard | Yes | West US, West Central US only | same |
| FLUX.2-pro (`1`) | image | Global Standard | Yes | all Americas regions | same |
| FLUX.1-Kontext-pro (`1`) | image | Global Standard | Yes | all Americas regions | same |
| FLUX-1.1-pro (`1`) | image | Global Standard | Yes | all Americas regions | same |
| MAI-Voice-2 | voice | Speech TTS | Yes (plus preview-styles flag) | Canada Central, East US 2, West US 2 (no preview-styles flag) | [Speech regions, Text to speech tab](https://learn.microsoft.com/azure/ai-services/speech-service/regions) |
| gpt-5.6-terra (`2026-07-09`) | reasoning / review | Global Standard | Yes | all Americas regions | [region availability, Americas](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability) |
| grok-4-1-fast-reasoning (`1`) | reasoning / review | Global Standard | Yes | all Americas regions | same |

Every roster model is present in East US on its correct deployment axis. Specific confirmations:

- **MAI-Image-2.5 and 2.5-Flash, East US: Yes.** The MAI image how-to lists the exact Global Standard region set as West Central US, East US, West US, West Europe, Sweden Central, South India, and UAE North (seven regions). ([Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai-image)) The region-availability page's Americas Global Standard table shows MAI-Image-2.5 checked for `eastus`, `westcentralus`, and `westus`, and not checked for `eastus2`, `centralus`, `brazilsouth`, or the Canada regions. ([region availability](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability)) This re-confirms SPIKE-01's finding and ADR-0004's note that East US 2 does not offer MAI-Image-2.5.
- **FLUX.2-pro, FLUX.1-Kontext-pro, FLUX-1.1-pro, East US: Yes.** The FLUX how-to states FLUX models are available for Global Standard deployment "in all regions", and the Americas Global Standard table shows all three checked for every Americas region including `eastus`. ([Deploy and use FLUX models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux), [region availability](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability))
- **MAI-Voice-2, East US: Yes, and it is one of only three regions carrying the preview-styles flag.** The Speech Text-to-speech regions table shows the `eastus` row checked for the "MAI voices" column, the "Batch synthesis API" column, and the "Voices and styles in preview" column. Across the whole table only `eastus`, `southeastasia`, and `westeurope` carry that preview-styles flag. ([Speech regions](https://learn.microsoft.com/azure/ai-services/speech-service/regions)) The preview-styles flag is load-bearing: it is what the owner-locked Ethan "excited" style depends on (ADR-0003, SPIKE-02 Finding 2).
- **gpt-5.6-terra and grok-4-1-fast-reasoning, East US: Yes.** Both are checked for every Americas Global Standard region including `eastus` (gpt-5.6-terra `2026-07-09`; grok-4-1-fast-reasoning version `1`). ([region availability](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability)) Both reviewer models resolve cleanly in the current catalog, so neither is an UNKNOWN. Their access gates (GPT-5 limited-access registration, xAI terms acceptance, TPM/TPM quota per the model roster) are access controls, not region controls, and are unchanged by this survey.

### 2. Does East US cover the full roster: yes, confirmed

East US hosts all eight roster deployments on their correct axes, including the MAI-voice preview-styles flag that the expressive style pick depends on. No roster model forces a region other than East US. This is a confirmation, not a change. ADR-0004's East US decision holds unchanged and does not need reopening.

### 3. Single-region alternative (for the record, not needed)

Since East US already covers everything, no alternative is required. Recorded for completeness in case a future capacity or quota constraint forces a move: the binding constraint on any single region is the intersection of the MAI-Image-2.5 region set and the MAI-voice-with-preview-styles region set, because those are the two narrowest lists.

- MAI-Image-2.5 Global Standard: {East US, West US, West Central US, West Europe, Sweden Central, South India, UAE North}.
- MAI-Voice-2 with the preview-styles flag: {East US, Southeast Asia, West Europe}.
- Intersection: **{East US, West Europe}**.

So **West Europe is the only other single region that could host the entire roster** (image, voice with preview styles, and both reviewer LLMs, all of which are also available in West Europe Global Standard per the Europe tables). Every other region fails on either MAI image (for example Southeast Asia has the voice preview flag but not MAI image) or the voice preview-styles flag (for example West US and Sweden Central have MAI image but not the preview-styles flag). A single-region posture remains fully achievable; the multi-region exception pattern ADR-0004 carved out for Sora does not need to become the norm.

### 4. Quota and capacity

- **Region availability is necessary but not sufficient.** A model being listed for East US Global Standard means it can be deployed there; it does not by itself guarantee capacity or per-subscription quota at deploy time. Actual throughput is governed by the subscription's tier and the model's rate-limit ladder, not by the region-availability table.
- **Image generation rate limits are the throughput constraint that matters most, and they are per-model-and-tier, not per-region.** SPIKE-01 Q5 confirmed the MAI image Global Standard RPM ladder (Tier 5 = 10 RPM for both MAI-Image-2.5 and 2.5-Flash; Tier 6 = 12 RPM), and observed the East US MVP subscription sitting at Tier 5. ([MAI image quotas and limits](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai-image), `ai/research/SPIKE-01-image-model.md`) Nothing in the region survey changes that ladder. Higher throughput is requested through the quota form at [aka.ms/oai/stuquotarequest](https://aka.ms/oai/stuquotarequest), and Microsoft advises distributing calls evenly and handling 429s with backoff.
- **MAI-Voice-2 real-time throughput** is the S0 default of 200 transactions per second (adjustable to 1,000), documented for standard and custom voices; preview MAI voice TPS behaviour is not separately documented and should be observed during any backfill (SPIKE-02 unknown #7). This is a tier attribute, not a region attribute.
- **Net:** the choice of East US does not constrain quota beyond what SPIKE-01 and SPIKE-02 already recorded. Confirm live capacity and quota in the target subscription at deploy time (a `foundry-env-verifier` read-only check), not from the region table.

### 5. Changes observed since SPIKE-01 and SPIKE-02 (worth flagging)

Re-verification surfaced two catalog changes since the earlier spikes. Neither alters the East US answer:

- **FLUX.2-flex is now in the East US Global Standard catalog.** the model roster records FLUX.2-flex as NOT AVAILABLE ("not in the East US catalog as of last check, verify again at any future deploy attempt"). It is now listed for all Americas Global Standard regions including `eastus`, and the FLUX how-to describes it (FLUX.2 [flex], up to 10 reference images, 4 MP). ([region availability](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability), [Deploy and use FLUX models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux)) FLUX.2-flex is not on the adopted roster, so this is a status refresh for the backlog, not a roster change; flag to the owner that the "verify again" note can be closed as "now available in East US".
- **Newer models that SPIKE-10 to SPIKE-13 may surface are also East US Global Standard.** The same catalog shows `gpt-5.6-luna`, `gpt-5.6-sol`, `grok-4.3`, `grok-4-20-reasoning`, `DeepSeek-V4-Pro`, and `Kimi-K2.7-Code` all checked for `eastus`. ([region availability](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability)) This means a likely roster addition from those in-flight spikes would not break the single-region posture. This is a forward-looking convenience only; each candidate must still be re-verified when its own spike scopes it, and this survey does not pre-decide those recommendations.

---

## What is still UNKNOWN

1. **Live per-subscription capacity and quota in East US at deploy time.** The region table confirms deployability, not headroom. Resolve with a read-only `az cognitiveservices` capacity and quota check in the target subscription immediately before any create (env-verifier scope). Not a blocker; it is the standard deploy-time gate.
2. **Whether MAI-Image-2.5's East US region set stays stable through GA.** All MAI image models are Preview, and preview region lists move. Resolve by re-querying the region-availability page and `az cognitiveservices model list --location eastus` at deploy time and at the model's GA. This is why the survey was re-run rather than trusting SPIKE-01.
3. **Preview MAI-voice real-time TPS behaviour in East US.** The 200 TPS S0 default is documented for standard and custom voices, not specifically for preview MAI voices. Resolve by observing throttling during backfill (carried over from SPIKE-02 unknown #7). Region-independent.

None of these are go/no-go for the region decision; East US availability for the full roster is confirmed by first-party sources today.

## Recommendation

1. **Keep East US as the single region. No change needed, confirmed.** Every roster model (MAI-Image-2.5 and its Flash sibling, FLUX.2-pro, FLUX.1-Kontext-pro, FLUX-1.1-pro, MAI-Voice-2 with the preview-styles flag, gpt-5.6-terra, grok-4-1-fast-reasoning) is available in East US on its correct axis as of 2026-07-22. ADR-0004's topology-and-region decision stands unchanged; there is no material change to flag to the owner and no reason to reopen the ADR.
2. **Record West Europe as the sole single-region fallback.** If East US capacity or quota ever forces a move, West Europe is the only other single region that satisfies the whole roster including the voice preview-styles flag. Any other region drops either MAI image or the preview styles. This does not change ADR-0004; it is a documented contingency.
3. **Do not promote the Sora multi-region exception to the norm.** A single region still covers the entire non-Sora roster. Sora remains rejected-for-core with its own East US 2 carve-out per ADR-0004 and is out of scope here.
4. **Treat region availability and quota as separate gates.** Confirm live East US capacity and quota in the target subscription at deploy time (env-verifier, read-only); the image RPM ladder from SPIKE-01 (Tier 5 = 10 RPM) is the binding throughput number and is tier-based, not region-based.
5. **Housekeeping for the owner and backlog:** close the the model roster FLUX.2-flex "NOT AVAILABLE, verify again" note as "now available in East US Global Standard" (status refresh only, not a roster adoption). When SPIKE-10 to SPIKE-13 scope any newer GPT / Grok / image / voice model, note that the leading candidates are already East US Global Standard, so a single-region posture is very likely to survive those additions, subject to each spike's own verification.

## Sources

All first-party (Microsoft Learn), reviewed 2026-07-22:

- Region availability for Foundry Models sold by Azure (standard), Americas and Europe Global Standard tables (MAI-Image-2.5 in East US / West US / West Central US only; FLUX family and both reviewer LLMs in all Americas regions; gpt-5.6-terra and grok-4-1-fast-reasoning East US confirmed; FLUX.2-flex now listed for East US): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability>
- Deploy and use MAI image models in Microsoft Foundry (preview) (Global Standard region set: West Central US, East US, West US, West Europe, Sweden Central, South India, UAE North; RPM quotas and limits): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai-image>
- Deploy and use FLUX models in Microsoft Foundry (FLUX models available for Global Standard deployment in all regions; FLUX.2 [flex] and [pro] capabilities): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-flux>
- Supported regions for Azure Speech, Text to speech tab (East US checked for MAI voices, Batch synthesis API, and Voices-and-styles-in-preview; preview-styles flag limited to East US, Southeast Asia, West Europe): <https://learn.microsoft.com/azure/ai-services/speech-service/regions>
- What is MAI-Voice (preview)? (MAI-Voice-2 prerequisite is a Speech resource in a supporting region; prebuilt voice and style table): <https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices>
- Manage Azure OpenAI quota (even distribution, 429 handling; quota request path): <https://learn.microsoft.com/azure/foundry/openai/how-to/quota>
- In-repo, re-verified against the above: `ai/research/SPIKE-01-image-model.md` (image RPM ladder, Tier 5 = 10 RPM in East US), `ai/research/SPIKE-02-voice-model.md` (MAI voice East US and preview-styles flag), `ai/adr/ADR-0004-foundry-topology-and-region.md` (the East US topology decision this spike confirms), the model roster (the authoritative roster).
