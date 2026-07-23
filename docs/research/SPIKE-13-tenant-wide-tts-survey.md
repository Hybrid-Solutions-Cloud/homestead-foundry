# SPIKE-13: Tenant-wide voice/TTS survey (alternatives anywhere in the tenant)

Status: research spike. Read-only. No Azure resources were created, updated, or deleted; no deployments.
Date: 2026-07-22
Author: foundry-researcher (Opus)
Depends on: `docs/research/SPIKE-03-tenant-readiness.md` (established subscription and tenant inventory), `ai/verification/environment-readiness.md` (existing Cognitive Services accounts per subscription), `docs/research/SPIKE-02-voice-model.md` (MAI-Voice-2 access pattern and region facts), `docs/adr/ADR-0004-foundry-topology-and-region.md` (single-shared-resource topology this spike tests for fragmentation risk)
Companion: `docs/research/SPIKE-07-speech-models.md` (the vendor and open/self-host comparison this spike deliberately does not duplicate)

Scope: the owner asked whether a better-fit voice/TTS path exists on any Azure subscription or region already accessible in the tenant, rather than being locked to the one subscription that hosts the Foundry account. This spike is the "elsewhere in the tenant" angle only. It does not re-run SPIKE-07's third-party vendor matrix (ElevenLabs, Cartesia, and so on) and it does not re-discover the subscription inventory SPIKE-03 already established. It answers one question: given the subscriptions and regions this owner already has, is there any Speech/TTS capability that the primary Foundry resource does not already offer, and if so, is reaching for it worth splitting away from the single-account topology ADR-0004 chose. Every Azure mechanic is cited to Microsoft Learn. Anything not verifiable read-only is marked UNKNOWN.

---

## Question

1. What subscriptions and tenants does this owner actually have access to, and which of them already hold Speech/TTS-capable resources (taken from the established inventory, not re-discovered)?
2. Across those subscriptions and their regions, does any Speech/TTS capability exist that the primary Foundry resource does not already offer: a different voice catalog, a preview style, a custom or personal voice, a region-only feature?
3. How does the "elsewhere in the tenant" answer relate to SPIKE-07's cloud and open/self-host findings, without duplicating that spike's vendor comparison?
4. What are the cost and quota implications of using a different subscription or region than the one hosting the Foundry account, and would doing so fragment the single-account topology ADR-0004 deliberately chose? If so, is the tradeoff worth it?

---

## Findings

### 1. The established inventory: three subscriptions across two tenants, two Speech-capable resources

SPIKE-03 and the environment check already inventoried the subscriptions reachable read-only by the logged-in owner identity, spanning two tenants. This spike takes that inventory as given rather than re-enumerating it ([SPIKE-03](./SPIKE-03-tenant-readiness.md); [environment-readiness](../verification/environment-readiness.md)):

| Subscription (by name) | Tenant | Speech-capable resource already present | Kind / tier / region |
|---|---|---|---|
| This Is My Demo - MVP Subscription | This Is My Demo | the existing legacy narrator Speech account (see Worked example) | SpeechServices / F0 / eastus |
| azlz-cmp-lz-core-001 | azurelocal.cloud | `azl-ai-demo-resource` (rg-azl-ai-demo) | AIServices / S0 / eastus2 |
| azurelocalcloud-prodtech-eus-management | azurelocal.cloud | none | n/a |

So there are exactly two pre-existing Speech-capable resources anywhere in the surveyed tenant: the legacy F0 narrator account (see Worked example, eastus, kind SpeechServices) and a demo AIServices S0 account (`azl-ai-demo-resource`, eastus2, a different tenant). Neither is a new or better TTS discovery in its own right: the legacy F0 account is the exact pre-Foundry narrator resource the plans already keep for read-along, and the eastus2 demo account is analyzed below.

**Boundary caveat.** This is the inventory of subscriptions SPIKE-03 established as reachable; whether an exhaustive `az account list --all` across every tenant the identity can reach returns any additional subscription is not re-verified here (see UNKNOWN). It does not change the conclusion, because of finding 2: any additional Speech resource, wherever it lived, would draw from its region's catalog, not from a subscription-private voice set.

### 2. Azure TTS voice availability is region-scoped, not subscription-scoped, so no subscription hides a "better" voice set

This is the load-bearing finding, and it is what makes the "elsewhere in the tenant" search largely moot for the native Azure path.

- **The set of voices a Speech resource can synthesize is a function of its region, not its subscription.** Microsoft Learn's "Supported regions for Azure Speech" publishes a single per-region capability matrix (columns: Neural text to speech, MAI voices, Batch synthesis API, HD voices, Azure OpenAI voices, Custom voice, Custom voice training, Custom voice high-performance endpoint, Custom voice HD endpoint, Personal voice, Voice conversion, Voices and styles in preview). Capability is listed against the region, with no subscription dimension ([Supported regions for Azure Speech](https://learn.microsoft.com/azure/ai-services/speech-service/regions#regions)). MAI-Voice-2's own prerequisite is simply "a Speech resource in a region that supports MAI-Voice-2," with no per-subscription condition ([What is MAI-Voice (preview)?](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)). So two resources in the same region expose the same prebuilt voice catalog regardless of which subscription or tenant owns them; a resource in a different region differs only by that region's row in the table.
- **What actually varies between resources is therefore narrow:** region (which selects the catalog), kind (SpeechServices vs AIServices, which decides whether the same resource can also host the MAI-Image-2.5 Foundry deployment and take the Entra path), tier (F0 vs S0), per-resource quota (adjustable), and any custom/personal voice endpoints trained on that specific resource (finding 3). None of these is a hidden "better voice" living in another subscription.
- **Applying the region matrix to the two candidate regions the owner already touches:**
  - **eastus** (where the primary Foundry resource and the legacy narrator live) is checked for Neural, MAI voices, Batch, HD, Custom voice (+ training, high-performance, HD endpoints), Personal voice, Voice conversion, and Voices and styles in preview. It is one of only three regions carrying the preview-styles flag (with southeastasia and westeurope) ([regions](https://learn.microsoft.com/azure/ai-services/speech-service/regions#regions)). This is the richest TTS region available to the owner and it is where ADR-0004 already places the resource.
  - **eastus2** (where the azurelocal.cloud demo account lives) is checked for Neural, MAI voices, Batch, HD, Custom voice (+ training, high-performance, HD endpoints), and Personal voice, but is **not** checked for Voice conversion and is **not** checked for Voices and styles in preview ([regions](https://learn.microsoft.com/azure/ai-services/speech-service/regions#regions)). That single gap is decisive: the owner's locked voice cast renders Ethan with the `excited` style, and the `excited`/expressive styles the cast depends on ride the preview-styles surface that eastus2 does not carry (SPIKE-02 finding 1 established the same three-region preview-styles list). MAI-Voice-2 base voices would synthesize in eastus2, but the expressive-style path the owner chose is not confirmed there. On top of that, eastus2 is not on the seven-region MAI-Image-2.5 Global Standard list (SPIKE-03 finding 4), so the demo account cannot host the image half at all.
- **No Azure OpenAI TTS voices in either region.** Only northcentralus, swedencentral (and the Foundry Models regions) carry the "Azure OpenAI voices" column; neither eastus nor eastus2 does ([regions](https://learn.microsoft.com/azure/ai-services/speech-service/regions#regions)). The distinct Azure-OpenAI TTS family (a separate 12-voice set surfaced through Azure Speech) is therefore not an "already-in-my-tenant" advantage in the regions the owner uses, and it belongs to SPIKE-07's and SPIKE-10's vendor scope in any case ([OpenAI text to speech voices](https://learn.microsoft.com/azure/ai-services/speech-service/openai-voices)).

Net: there is no subscription elsewhere in the tenant that exposes a voice the primary eastus Foundry resource cannot. The only region the owner touches that even differs (eastus2) is strictly poorer for this workload, not richer.

### 3. Custom / personal / professional voice is the one "capability elsewhere" worth naming, and it is Limited Access gated, not a spin-up

The one thing a resource can hold that genuinely is resource-specific (not just region-specific) is a trained custom or personal voice endpoint. If the owner had already trained a bespoke narrator voice on some other subscription, that would be a real "elsewhere in the tenant" asset. Two facts close this:

- **The inventory shows no such trained voice.** The only Speech-capable resources are the F0 legacy narrator and the eastus2 demo AIServices account (finding 1); neither is documented as carrying a custom/professional or personal voice model, and the F0 tier is not a custom-voice host.
- **Custom neural voice and personal voice are Limited Access features, gated by registration, not something that can simply be created on another subscription.** Access "requires registration ... Only customers managed by Microsoft ... are eligible," via the intake form at aka.ms/customneural, and use is restricted to the specific approved use cases ([Limited Access, custom neural voice](https://learn.microsoft.com/azure/foundry/responsible-ai/speech-service/text-to-speech/limited-access#registration-process); [What is custom voice?](https://learn.microsoft.com/azure/ai-services/speech-service/custom-neural-voice)). Personal voice (including MAI-Voice-2 voice prompting / cloning) carries the same gate ([MAI-Voice voice prompting, gated access](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices#voice-prompting-gated-access)). Professional custom voice further requires 300+ recorded lines minimum (about 30 minutes), 2,000 recommended for production, plus voice-talent consent and synthetic-disclosure obligations ([Transparency note, limitations](https://learn.microsoft.com/azure/foundry/responsible-ai/speech-service/text-to-speech/transparency-note#limitations)).

So a custom voice is not "already available elsewhere in the tenant" to be reused; it is a separate, gated, consent-heavy project the owner would have to register for and train. That is a legitimate future option (a bespoke brand narrator), but it is a new initiative with its own ADR, not an existing tenant asset this survey can hand over. It also does not solve the SPIKE-07 word-sync/lip-sync gap on its own.

### 4. Relationship to SPIKE-07 (complementary axes, no overlap)

SPIKE-07 and SPIKE-13 answer two different "is there something better" questions and should be read together, not merged ([SPIKE-07](./SPIKE-07-speech-models.md)):

- **SPIKE-07 asks: is there a better voice/TTS *model or vendor*, inside or outside Azure, than the native path, specifically to close the word-sync (word timestamps) and lip-sync (viseme/phoneme) gap that blocks read-along and future avatar work?** Its candidate set is third-party cloud APIs (ElevenLabs, Cartesia, PlayHT, Hume, Deepgram, OpenAI TTS, Rime) and open/self-host models (Kokoro, F5-TTS, Chatterbox, Coqui/XTTS, Piper), scored on naturalness, word/viseme timing, latency, licensing, self-host feasibility, cost, and Azure fit.
- **SPIKE-13 asks: is there a better *home* for the native Azure path among the subscriptions and regions the owner already has?** Its answer (findings 2 and 3): no, because native voice availability is region-scoped and the owner's richest region (eastus) is already the chosen home; the only other region in play (eastus2) is strictly poorer.

The two do not overlap. Concretely: if SPIKE-07 concludes a third-party or self-hosted model is needed for lip-sync, that model runs on an *entirely separate hosting path* (a container app or GPU VM), which the tenant survey neither helps nor hinders; the subscription that hosts a GPU VM is an infrastructure-placement question, not a voice-catalog question. If SPIKE-07 concludes the native Azure path is good enough (or "nothing beats the existing narrator track for word-sync yet"), then SPIKE-13 confirms the best native home is the primary eastus Foundry resource ADR-0004 already selected. Either way, this survey does not change SPIKE-07's recommendation; it removes "just use a better subscription/region" as an option that could have quietly undercut it.

### 5. Cost, quota, and topology-fragmentation implications of using a different subscription or region

Using anything other than the primary eastus Foundry resource for voice would fragment the single-account topology ADR-0004 deliberately chose. The costs, grounded in that ADR and SPIKE-03:

- **Billing and credit fragmentation.** The primary is the This Is My Demo MVP credit subscription; the only other Speech-capable resource (`azl-ai-demo-resource`) is in the azurelocal.cloud tenant, a different billing and identity boundary. Moving voice there would spend outside the MVP monthly credit the initiative is deliberately front-loading, and would split spend across two tenants, defeating the single budget scope ADR-0006 relies on ([SPIKE-03 finding 2](./SPIKE-03-tenant-readiness.md); [ADR-0004](../adr/ADR-0004-foundry-topology-and-region.md)).
- **Identity and secret-surface fragmentation.** ADR-0004's whole positive case is one resource giving one identity/role surface (ADR-0005) and one secret set. A second Speech resource in another tenant means a second key path and a cross-tenant identity, exactly the operational split the ADR rejected under "two separate resources."
- **Quota is not a reason to move.** Speech real-time TTS quota is enforced per resource and is adjustable (F0 = 20 transactions/60s; S0 = 200 TPS default, up to 1,000), not a subscription-level cap that another subscription would relieve ([Speech quotas and limits](https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits); SPIKE-02 finding 5). The primary S0 resource already has the throughput the pilot and backfill need.
- **Region asymmetry makes eastus2 a hard no for the shared resource.** Even setting billing aside, eastus2 lacks the preview-styles flag the voice cast needs (finding 2) and cannot host MAI-Image-2.5 at all (SPIKE-03 finding 4). Splitting voice to eastus2 would therefore not just fragment topology; it would drop the expressive style and force a second resource for image regardless.

There is one legitimate scenario where a split is worth it, and it is not a "better TTS elsewhere" scenario: if SPIKE-07 recommends a self-hosted open model for lip-sync, that model needs GPU hosting (a container app or GPU VM) that the AIServices resource cannot provide, so it lives on its own infrastructure by necessity. That is a SPIKE-07-driven hosting decision with its own ADR, not a reason to move the native voice work off the primary resource. The abuse-monitoring, residency, and content-safety posture for children's content stays on the primary resource path either way (see ADR-0007), and a self-hosted model would have to meet that bar separately.

---

## What is still UNKNOWN

- **Whether an exhaustive `az account list --all` across every tenant the identity can reach returns any subscription beyond the three SPIKE-03 inventoried.** Not re-verified here (the brief directs using the established inventory, not re-discovery). It does not change the recommendation: finding 2 means any additional Speech resource would still draw only from its region's public catalog, so no undiscovered subscription can hold a voice the primary eastus resource lacks. The resolving check is a read-only `az account list --all` followed by `az cognitiveservices account list` per new subscription.
- **Whether either existing resource (the legacy narrator account, `azl-ai-demo-resource`) carries a trained custom or personal voice endpoint.** The inventory does not show one and the tiers/kinds argue against it, but a definitive read is `az cognitiveservices account list` plus the Custom Voice project/endpoint list on each resource. Assumed none.
- **Whether MAI-Voice-2 expressive styles (the `excited` style the cast uses) actually synthesize in eastus2.** The regions table shows eastus2 without the preview-styles flag, which is why eastus2 is treated as unqualified; a definitive answer is a throwaway synthesis test against an eastus2 resource, but there is no reason to run it because eastus2 also cannot host the image model, so it is disqualified for the shared resource regardless.
- **The current Limited Access approval status of this account for custom/personal voice.** Whether the owner is already a registered Limited Access customer (which would make a future bespoke narrator a smaller lift) is an account-management fact not visible read-only. Resolves via the customneural intake status or the account team.

---

## Recommendation

**Keep all native voice work on the primary shared eastus Foundry (AIServices, S0) resource that ADR-0004 selected. Nothing elsewhere in the tenant beats it.** The survey's central finding is that Azure TTS voice availability is region-scoped, not subscription-scoped, so no other subscription can expose a voice the primary resource cannot, and the only other region the owner already touches (eastus2) is strictly poorer: it lacks the preview-styles surface the owner's `excited`-style cast depends on and cannot host MAI-Image-2.5 at all. Moving voice to the one other Speech-capable resource (`azl-ai-demo-resource`, eastus2, azurelocal.cloud tenant) would fragment billing across the MVP-credit boundary, split the identity and secret surface, drop the expressive style, and still force a second resource for image. This is the expected "nothing elsewhere wins" outcome the brief anticipated.

**Do not treat this as competing with SPIKE-07.** SPIKE-13 rules out "just use a better subscription or region" for the native path; SPIKE-07 decides whether a better model or vendor (native or third-party) is needed for the word-sync and lip-sync gap. If SPIKE-07 lands on a self-hosted open model for lip-sync, that model needs its own GPU hosting path and its own ADR; that is a deliberate, capability-driven split, not the accidental topology fragmentation this spike warns against. Read the two spikes together before any voice ADR.

**One future option to record, not act on now:** a bespoke brand narrator via custom neural voice or personal voice is a real capability, but it is Limited Access gated (aka.ms/customneural), consent-heavy, and a new initiative with its own ADR; it is not an existing tenant asset and it does not by itself close the word-sync/lip-sync gap. Flag it for the owner as a separate track if a signature narrator voice ever becomes a goal.

**No design tension to escalate.** Because the best native home and the topology ADR already agree, there is no ADR-0004 split to weigh here; the single-account topology stands.

---

&lt;!-- safety-scan-worked-example:start -->
## Worked example: Gunner the Lab / Holdfast Press

> This subsection records the concrete tenant facts this survey was first run against (the same inventory SPIKE-03 and the environment check established, read-only, for the Gunner the Lab and Holdfast Press StoryReader media backbone). The findings and recommendation above are the reusable methodology; the names and regions below are the historical facts of that build.

- **Primary voice home (unchanged):** the shared `aif-studioai-prod-eus-01` (AIServices, S0) in `rg-studioai-prod-eus-01`, East US, serving MAI-Voice-2 through its Speech endpoint and hosting the MAI-Image-2.5 deployment. It is the richest TTS region available to the owner (MAI voices plus the preview-styles flag) and co-locates with the Key Vault and legacy narrator.
- **Legacy narrator, left in place:** `storyreader-tts` (SpeechServices, F0, East US, rg-storyreader) keeps the existing read-along narrator track. It is not a new TTS discovery; it is the pre-Foundry account the plans already retain.
- **The one other Speech-capable resource in the surveyed tenant:** `azl-ai-demo-resource` (AIServices, S0, eastus2, azlz-cmp-lz-core-001, azurelocal.cloud tenant). Rejected as a voice home: eastus2 lacks the preview-styles flag Ethan's `excited` style needs, cannot host MAI-Image-2.5, and sits in a different tenant (outside the MVP credit and identity boundary).
- **Voice cast (owner-locked in the voice plan):** Harper (en-US), Lisa (en-AU), Ethan (en-US, `excited` style). All confirmed in the eastus catalog by SPIKE-02; the `excited` style rides the eastus preview-styles surface, which is exactly the surface eastus2 lacks.
- **Outcome:** nothing elsewhere in the This Is My Demo or azurelocal.cloud tenants beat the primary East US resource; the SPIKE-07 vendor/self-host question (word-sync and lip-sync) remains the only open "is there something better" thread, on a separate hosting path if it lands on a self-hosted model.
&lt;!-- safety-scan-worked-example:end -->

## Sources

- Established inventory (this repo): `docs/research/SPIKE-03-tenant-readiness.md`, `ai/verification/environment-readiness.md`
- Topology decision this spike tests for fragmentation (this repo): `docs/adr/ADR-0004-foundry-topology-and-region.md`, `docs/adr/ADR-0006-cost-governance.md`, `docs/adr/ADR-0005-identity-and-secrets.md`, `docs/adr/ADR-0007-content-safety-and-responsible-ai.md`
- Voice-model facts reused, not re-derived (this repo): `docs/research/SPIKE-02-voice-model.md`
- Companion vendor/self-host survey, deliberately not duplicated (this repo): `docs/research/SPIKE-07-speech-models.md`
- Supported regions for Azure Speech (per-region TTS capability matrix, no subscription dimension; eastus carries preview-styles and voice-conversion, eastus2 does not; Azure OpenAI voices only in select regions): <https://learn.microsoft.com/azure/ai-services/speech-service/regions#regions>
- What is MAI-Voice (preview)? (prerequisite is only "a Speech resource in a region that supports MAI-Voice-2"; voice prompting/cloning is gated): <https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices>
- MAI-Voice voice prompting, gated access (personal voice cloning requires Limited Access approval): <https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices#voice-prompting-gated-access>
- Limited Access for custom neural voice (registration-gated, Microsoft-managed customers only, use-case restricted): <https://learn.microsoft.com/azure/foundry/responsible-ai/speech-service/text-to-speech/limited-access#registration-process>
- What is custom voice? (custom voice access is limited by eligibility and usage criteria): <https://learn.microsoft.com/azure/ai-services/speech-service/custom-neural-voice>
- Transparency note, text to speech, limitations (custom neural voice training-data minimums, consent, disclosure): <https://learn.microsoft.com/azure/foundry/responsible-ai/speech-service/text-to-speech/transparency-note#limitations>
- OpenAI text to speech voices (the distinct Azure OpenAI TTS voice family, region availability): <https://learn.microsoft.com/azure/ai-services/speech-service/openai-voices>
- Quotas and limits for Azure Speech (real-time TTS quota is per-resource and adjustable: F0 20 tx/60s, S0 200 TPS default up to 1,000): <https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits>
