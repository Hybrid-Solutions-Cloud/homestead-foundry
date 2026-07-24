# ADR-0003: Voice-model selection methodology and voice set for Azure AI Foundry builds

- Status: Proposed
- Date: 2026-07-11
- Revised 2026-07-24: generalized from a single-model pick into a selection methodology; the voice list now lives in the model catalog (`docs/reference/model-catalog.md`).
- Decider: Owner

## Context

An Azure AI Foundry build in this repo needs a repeatable, defensible way to
select and access a narration (text-to-speech) voice model, and to add,
evaluate, and swap voice models and individual voices as the catalog and the
workload evolve. This is a methodology repo: it must support choosing among many
voice models and voices over time, not enshrine one pick. This ADR therefore
decides the **selection methodology, the evaluation criteria, and the access
model**, and it delegates the actual list of deployed, available, evaluated, and
rejected voice options to the living model catalog
(`docs/reference/model-catalog.md`), which is the single source of truth for
status. Adding a voice model or a voice is a catalog row plus a model-registry
entry against this methodology, not a new ADR.

Three research spikes ground the criteria below against first-party sources.
SPIKE-02 (`docs/research/SPIKE-02-voice-model.md`) verified the MAI-Voice-2
family: availability, the prebuilt voice and style tables, tier and pricing, the
read-along (word-boundary) risk, and SSML style controls. SPIKE-07
(`docs/research/SPIKE-07-speech-models.md`) surveyed voice models beyond MAI and
the native Azure neural voices for word-sync and lip-sync (native Azure baseline,
external cloud vendors, and open/self-host models). SPIKE-13
(`docs/research/SPIKE-13-tenant-wide-tts-survey.md`) established that Azure voice
availability is region-scoped, not subscription-scoped. The environment
readiness check (`ai/verification/environment-readiness.md`) confirms which
Speech-capable resources are live in the target subscription.

The forces this decision reconciles generalize to any Azure AI Foundry
voice-model selection:

- **Expressiveness and naturalness are workload-specific, not a single
  ranking.** A calm long-form narrator, an animated character read, and a
  neutral utility voice are different problems. A model's marketing "natural"
  claim or a leaderboard MOS does not tell you whether a given voice fits a
  specific catalog; only a short blind A-B listening test on representative
  passages does. Where a chosen voice's natural register reads flat, a supported
  expressive style (`mstts:express-as` with `style` and `styledegree`) is the
  lever, and style support is per-voice, not per-family.
- **Word-boundary / word-timestamp support is a hard capability axis for
  read-along.** Word-sync highlighting needs the Speech SDK `WordBoundary` event
  (word text, audio offset in ticks, character position in the input). Support
  is documented per model and splits within families: standard Azure neural and
  Dragon HD Omni emit it, base DragonHD does not document it, and MAI-Voice-2's
  REST path does not document it at all, so it cannot be assumed and must be
  measured. A voice that cannot emit usable word boundaries cannot drive
  read-along unless word timing is retrofitted by forced alignment (WhisperX or
  Montreal Forced Aligner) over the rendered audio.
- **Viseme / phoneme timing is a hard capability axis for lip-sync.** Future
  avatar or video mouth animation needs viseme IDs or phoneme timestamps.
  Native Azure emits `mstts:viseme` viseme IDs plus 60 FPS 55-value blend shapes
  (`en-US` only for `redlips_front`; `en-US`/`zh-CN` for blend shapes); among
  external vendors only Cartesia and Hume Octave 2 emit phoneme timestamps
  natively. As with word-sync, lip-sync can also be added as a decoupled
  post-processing step (Rhubarb Lip Sync, or a phoneme-to-viseme map fed by a
  forced aligner), which keeps voice selection free of the timing requirement.
- **Region availability gates the whole choice, and it is region-scoped.** A
  voice is only synthesizable where its region's Azure Speech capability matrix
  supports it; the voice set a resource can produce is a function of its region,
  not its subscription. Regions differ by MAI-voices support, the
  voices-and-styles-in-preview flag (only a few regions carry it), HD voices,
  Azure OpenAI voices, and custom/personal voice. No subscription elsewhere in a
  tenant hides a "better" native voice set; only a different region does.
- **Subscription-tier and quota eligibility set access and throughput.** Real-time
  TTS quota is per-resource and adjustable (F0 = 20 transactions / 60 s; S0 =
  200 TPS default, up to 1,000); the batch synthesis path is S0-only. Whether a
  preview voice model synthesizes on F0 can be UNKNOWN and must not be assumed.
  Custom neural voice and personal voice (including voice prompting / cloning)
  are Limited Access features, registration-gated and consent-heavy, not a
  spin-up.
- **Cost is per-character and the meter differs by voice class.** TTS bills per
  character of the text field (letters, numbers, spaces, punctuation, and markup,
  excluding the `<speak>` and `<voice>` tags), whether or not audio is produced;
  Chinese, Japanese kanji, and Korean hanja each count as two characters. Voice
  classes meter differently (standard neural is documented near 15 USD per 1M
  characters; MAI voices bill at 22 USD per 1M characters). The exact billing
  meter name and any F0 free allowance can be UNKNOWN until read live.
- **Accent / locale coverage can leave a narrator without an equivalent voice.**
  A voice family may not cover every accent a workload already ships (for example
  no `en-GB` voice in a family whose only English locales are `en-US` and
  `en-AU`). When it does not, listen options in other accents sit next to that
  narrator, or the narrator stays on its own family.
- **Responsible-AI and synthetic-voice disclosure are mandatory.** Microsoft
  requires disclosing synthetic voices; the TTS code of conduct lists audiobooks
  and fictional entertainment as appropriate uses. When the audience is minors
  or otherwise sensitive, the disclosure must be clear enough for a parent,
  guardian, or other responsible party to make an informed decision. This duty is
  decided in ADR-0007 (`docs/adr/ADR-0007-content-safety-and-responsible-ai.md`)
  and applies to every voice model in the catalog. Custom or personal voice adds
  voice-talent consent and Limited Access obligations on top.
- **Lifecycle and preview churn force a re-check discipline.** Preview voice
  models carry no SLA and can change, move regions, or be renamed before GA;
  pre-rendering audio to durable storage insulates listeners from a live preview
  outage. Tokens such as an exact regional voice identifier or an expressive-style
  spelling must be confirmed at spike time, never hardcoded from documentation
  that is internally inconsistent (the prebuilt table lists adjective style forms
  while SSML examples on the same page use noun forms).

## Decision

**Select and access voice models and voices by the methodology below, evaluated
against a fixed set of criteria, with the concrete deployed / available /
evaluated / rejected list maintained in the model catalog
(`docs/reference/model-catalog.md`) and its machine-readable counterpart the
model registry.** No single model is the decision here. MAI-Voice-2 (Preview) is
the current baseline example (first-party, in-region, expressive, listen-only in
v1 because its word boundaries are unconfirmed); the catalog records which voice
options are primary, which are candidates, and which were passed over, and why.

### Selection criteria (score every candidate against these)

1. **Expressiveness / naturalness for the specific workload**, proven by a short
   blind A-B listening test on representative passages, not by a leaderboard or a
   marketing "natural" claim; include the expressive-style fit where a voice's
   natural register reads flat.
2. **Word-boundary / word-timestamp support** for read-along (native
   `WordBoundary`, else retrofit by self-hosted forced alignment over the
   rendered audio).
3. **Viseme / phoneme-timing support** for lip-sync (native viseme/phoneme,
   else decoupled audio-to-viseme post-processing), where avatar or video work
   is in scope.
4. **Region availability** in the target region (the region, not the
   subscription, selects the voice catalog and the preview-styles surface).
5. **Subscription-tier and quota eligibility** (F0 vs S0, batch S0-only, any
   Limited Access gate for custom/personal voice).
6. **Cost model** (per-character metering confirmed; exact meter and any F0 free
   allowance treated as UNKNOWN until read live).
7. **Accent / locale coverage** against the narrators and languages the workload
   already ships.
8. **Responsible-AI posture and synthetic-voice disclosure** per ADR-0007,
   including the parent-facing bar for a sensitive audience and any voice-talent
   consent for custom/personal voice.
9. **Lifecycle / preview-churn risk** (Preview vs GA; pre-render to durable
   storage to insulate listeners from a preview outage).

### Access and identity

Voice synthesis uses the same Azure Speech endpoint and SDK path the pipeline
already runs, on the shared **AIServices** resource (ADR-0004) that also serves
the image models, so one resource covers both modalities. A voice is selected at
call time by its SSML `<voice name="...">` attribute (for example
`en-US-<VoiceName>:<Model>`); native and MAI voices need **no Foundry model
deployment step**. Control-plane and any endpoint-secret access follow ADR-0005
(`docs/adr/ADR-0005-identity-and-secrets.md`): Microsoft Entra ID (keyless) via
`DefaultAzureCredential`, managed-identity-first, resolving to the compute's
managed identity on Azure or Arc, to a user-assigned managed identity via OIDC
federation in off-Azure CI, or to the signed-in `az login` user on a
workstation. Any Speech key a consuming pipeline still requires lives only in the
tenant Key Vault, never in a committed file, and Option A pre-render (ADR-0008)
keeps that key off the worker and browser. This access model is model-agnostic
and applies to every voice model in the catalog.

### How to add, evaluate, A-B, and swap a voice model or voice

1. **Add** a candidate voice model or voice as a catalog row (status `evaluated`
   or `available`) plus a registry entry, citing the spike or the first-party
   voice/region table. No new ADR is required unless adoption changes a decision
   the methodology cannot express (a new region, a new resource, a self-hosted
   GPU hosting path, or a new access-governance posture such as Limited Access
   custom voice).
2. **Evaluate** it against the nine criteria above, and run a short blind A-B
   listening test on representative passages for the expressiveness criterion,
   which documentation cannot settle. Confirm the exact regional voice identifier
   and any expressive-style token at spike time before either goes into a brand
   config.
3. **A-B** a candidate against the current baseline on the same passages and,
   where read-along or lip-sync is in scope, verify the timing signal (measure
   `WordBoundary`, or the forced-alignment offset drift, or the viseme quality)
   before promotion; keep the incumbent until the challenger wins the decisive
   criterion.
4. **Swap** by promoting the winner to `deployed` (primary) in the catalog and
   registry and demoting the incumbent to fallback or `rejected` with a reason;
   never delete a rejected row, so the decision is not re-researched later.

### Deployment discipline (applies to whichever voice is selected)

- **Confirm tokens at spike time, never hardcode from the docs.** Read the exact
  regional voice identifier off the Foundry playground voice list, and confirm
  the accepted spelling of any expressive style (adjective vs noun form), before
  writing it into a brand config.
- **Ship listen-only until word boundaries are proven.** Keep read-along on a
  voice with proven `WordBoundary` output; a new voice whose word-boundary
  behavior is unconfirmed ships listen-only, and read-along migrates to it only
  after clean offsets are measured or forced alignment is wired in.
- **Cost measured, not guessed.** Treat every synthesized character as billable
  at the voice class's per-character rate; set a resource-group budget alert
  before any batch backfill (ADR-0006) and read the live meter rather than any
  unverified figure.
- **Minimize retention and disclose synthesis** per ADR-0007: prefer the
  real-time synthesis path (stores no text or audio) over Long Audio / batch
  (which store the script and audio), and publish the synthetic-voice disclosure
  in every surface that ships the audio.
- **Pre-render to durable storage** so a preview-model outage never reaches
  listeners, and so the only live dependency at read time is static audio.

## Consequences

**Positive.**
- The repo can evaluate and choose among many voice models and voices against one
  stable methodology; adding a voice is a catalog row plus a registry entry, not a
  new ADR.
- The decision does not go stale when the catalog changes: the living list lives
  in the catalog, and this ADR keeps deciding how to choose.
- The criteria make the read-along (word-boundary) and lip-sync (viseme/phoneme)
  capability gaps, region and tier eligibility, per-character cost, RAI
  disclosure, and preview churn explicit and comparable across candidates.
- Keyless Entra access, the shared Speech endpoint, the SSML voice-selection
  path, and pre-render-to-storage carry across every voice uniformly.

**Negative.**
- The methodology defers the concrete answer to the catalog, so a reader must
  follow the link to learn which voices are primary today.
- Preview voice models carry no SLA and periodic churn; the token confirmation
  and re-verification is mandatory ongoing work.
- Read-along on a new voice is blocked until its word boundaries are proven or
  forced alignment is wired in; any style-rendered voice needs an
  `mstts:express-as` wrapper plus the `mstts` namespace.
- Per-character cost and naturalness are UNKNOWN until measured per voice, so a
  listening test and a cost check are required before any batch on a new voice.
- Maintaining a multi-voice roster spreads cost tracking and pipeline
  voice-selection logic across more surface area than a single pick.

**Follow-ups.**
- Keep the model catalog and registry current as voices are added, promoted, or
  rejected; this ADR is the methodology, the catalog is the state.
- Run the throwaway spike (about 30 minutes against the resource) before writing
  pipeline code, to answer, for any new voice: does `WordBoundary` fire with sane
  offsets; does the chosen output format synthesize; does the AIServices key
  authenticate against the regional TTS endpoint; and the exact regional voice
  identifier and expressive-style token.
- Re-verify Preview voice models at and after any published inference or
  retirement date, and re-check region and tier facts at deploy time.

## Alternatives considered

- **One ADR per voice model.** Rejected: it enshrines specific picks and forces a
  new ADR for every catalog change. The methodology-plus-catalog split lets many
  voices be evaluated and swapped against one decision. (The prior single-model
  framing of this ADR is the history this revision generalizes.)
- **Ship a new voice for read-along before word boundaries are proven.**
  Rejected: word-boundary support splits within families and can be undocumented
  (as it is for MAI-Voice-2), so this would gamble the highlight on unproven
  timing. Ship listen-only, then migrate once measured or forced-aligned.
- **Choose a voice on a marketing "natural" claim or a leaderboard MOS alone.**
  Rejected: those do not predict fit on the specific catalog; a short blind A-B
  listening test on real passages is the decisive test.
- **Adopt an external speech vendor solely for word timestamps.** Rejected on
  current evidence (SPIKE-07): the native Azure baseline already emits
  `WordBoundary` from the same resource, and self-hosted forced alignment can
  retrofit timing onto any voice's audio without a new vendor, billing
  relationship, or egress hop. Revisit only if naturalness alone justifies the
  move.
- **Move voice to a different subscription or region for a "better" voice set.**
  Rejected (SPIKE-13): native voice availability is region-scoped, not
  subscription-scoped, so no other subscription exposes a voice the primary
  region cannot, and splitting fragments billing, identity, and the
  preview-styles surface.
- **Custom neural voice or personal voice as the v1 path.** Not chosen now:
  it is a real future capability (a bespoke brand narrator) but Limited Access
  gated, consent-heavy, and a separate initiative with its own ADR; it does not by
  itself close the word-sync or lip-sync gap. Recorded as a watch item.
- **F0 (free) tier.** Rejected and not relied upon: F0 eligibility for a preview
  voice model can be unverified, and the shared resource must be S0 for the image
  deployment in any case.

<!-- safety-scan-worked-example:start -->

## Worked example: the Brand A and Brand B media backbone

> Everything in this section is what was actually built with the reusable
> decision above, on the first proven build of this platform. It is historical
> fact, not part of the general methodology.

Feature A2 added multi-voice AI Listen to both brands' reader apps
(Brand A's reader app and Brand B's reader app), served by the shared
AIServices resource `aif-<workload>-<env>-<region>-01` in East US, tier S0. The
baseline voice model was MAI-Voice-2 (Preview).

- **Default (narrator) voices, kept as read-along and default listen:** Brand A
  `en-US-AndrewMultilingualNeural`; Brand B `en-GB-Ryan:DragonHDLatestNeural`.
  Both are Azure neural / HD voices that emit `WordBoundary`, so the read-along
  highlight stays on the proven narrator track. Brand B kept its British narrator
  as the default.
- **Listen-only voices added, the same set for both brands:** **Harper**
  (en-US, female), **Lisa** (en-AU, female), and **Ethan** (en-US, male,
  rendered with the `excited` style because his natural register reads flat).
  SPIKE-02 confirmed all three are published prebuilt MAI-Voice-2 voices, that
  every one of them supports the `excited` style, and that Ethan is the only
  style-capable en-US male.
- **Applying the read-along criterion (criterion 2):** MAI-Voice-2's REST path
  does not document `WordBoundary`, so the three AI voices ship listen-only in
  v1 and render with empty word arrays; the highlight always follows the
  narrator. If a later version wants the AI voices to drive the highlight, the
  low-risk path is self-hosted forced alignment (WhisperX or Montreal Forced
  Aligner) over the already-rendered audio, since the block text is known at
  publish time (SPIKE-07).
- **Applying the lip-sync criterion (criterion 3):** no avatar work is on the
  roadmap yet; when it starts it is kept as audio-to-viseme post-processing
  (Rhubarb, or a phoneme-to-viseme map) so it works over whichever voice a
  chapter used, including the British narrator that Azure's native
  `redlips_front` visemes (en-US only) would not cover.
- **The accent gap (criterion 7):** there is no en-GB MAI-Voice-2 voice today,
  so Brand B's listen options are American and Australian next to a British
  narrator. The owner accepted this.
- **The two token forms to confirm at spike time:** the exact en-AU identifier
  for "Lisa" (read off the Foundry playground voice list) and the exact accepted
  spelling of the `excited` style (the prebuilt table lists the adjective form
  `excited`, while SSML examples on the same page use noun forms).
- **Owner-locked inputs (decided, not reopened):** the spend was approved; the
  voice set is Harper, Lisa (en-AU), and Ethan (excited style); a 100 USD/month
  cap applies; and the preview risk was accepted, insulated by pre-rendering the
  audio to durable storage.
- **Deferred alternates:** Olivia in place of or alongside Harper (owner picked
  Harper as "more upbeat" and skipped Olivia for v1, may revisit with styles
  later).

<!-- safety-scan-worked-example:end -->

## Sources

- `docs/reference/model-catalog.md` (the living deployed / available / evaluated / rejected voice list this methodology maintains)
- `docs/research/SPIKE-02-voice-model.md` (MAI-Voice-2 availability, prebuilt voice and style tables, WordBoundary risk, tier, pricing, SSML style controls)
- `docs/research/SPIKE-07-speech-models.md` (native Azure word-sync and lip-sync baseline, external vendors, open/self-host, forced alignment and Rhubarb post-processing)
- `docs/research/SPIKE-13-tenant-wide-tts-survey.md` (Azure voice availability is region-scoped, not subscription-scoped; custom/personal voice is Limited Access gated)
- `docs/adr/ADR-0004-foundry-topology-and-region.md` (single shared AIServices resource and region)
- `docs/adr/ADR-0005-identity-and-secrets.md` (keyless Entra, managed-identity-first access; Key Vault for any secret)
- `docs/adr/ADR-0007-content-safety-and-responsible-ai.md` (synthetic-voice disclosure duty, retention minimization, parent-facing bar for a sensitive audience)
- `docs/adr/ADR-0008-publish-pipeline-integration.md` (Option A pre-render keeps the Speech key off the worker and browser)
- `ai/plans/source/ai-voice-mai-voice-2.md` (owner-locked inputs for the worked example: spend, voice set, accent, preview risk, 100 USD/month cap)
- `ai/verification/environment-readiness.md` (MAI-Voice-2 confirmed for the target region; AIServices S0 offerable; the pre-existing single-purpose Speech resource is F0 SpeechServices, the wrong kind)
- What is MAI-Voice (preview)? (prebuilt voices, styles, `mstts:express-as`, same Speech SDK path): <https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices>
- Supported regions for Azure Speech (MAI voices, voices-and-styles-in-preview, batch, HD, Azure OpenAI voices columns): <https://learn.microsoft.com/azure/ai-services/speech-service/regions>
- How to synthesize speech, subscribe to synthesizer events (WordBoundary semantics): <https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis#subscribe-to-synthesizer-events>
- High-definition voices (Dragon HD Omni word-boundary support; base DragonHD does not document it): <https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices>
- Customize voice and sound with SSML, viseme element (`mstts:viseme`, `redlips_front` en-US only, blend shapes en-US/zh-CN): <https://learn.microsoft.com/azure/ai-services/speech-service/speech-synthesis-markup-voice#viseme-element>
- Quotas and limits for Azure Speech (F0 and S0 limits, 10-minute audio cap, 64 KB SSML, batch S0-only): <https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits>
- What is text to speech?, pricing note (per-character billing basis; CJK counts as two characters): <https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech#pricing-note>
- Transparency note: text to speech (mandatory synthetic-voice disclosure; minors and parent disclosure; custom-voice consent and limitations): <https://learn.microsoft.com/azure/foundry/responsible-ai/speech-service/text-to-speech/transparency-note>
- MAI-Voice-2 model page (22 USD per 1M characters): <https://microsoft.ai/models/mai-voice-2/>
