# ADR-0003: MAI-Voice-2 voice model and listen voice set

- Status: Proposed
- Date: 2026-07-11
- Decider: Owner

> This ADR records a reusable decision for MAI-Voice-2 voice-model builds on
> this platform. The concrete detail of the first proven build (real voice
> names, style token, resource name, and narrator tracks) is preserved under
> the "Worked example" section at the end, clearly separated from the
> reusable decision above it.

## Context

A voice-model build on this platform adds multi-voice "AI Listen" narration to
a reader app that already ships a single narrator track per brand. SPIKE-02
(`ai/research/SPIKE-02-voice-model.md`) verified availability, the prebuilt
voice and style tables, the tier and pricing, and the read-along risk against
first-party Microsoft sources. The owner locks the spend, the voice set, the
accent question, the preview risk, and the budget cap in the source voice plan
(`ai/plans/source/ai-voice-mai-voice-2.md`); those are recorded here as decided
inputs, not reopened.

The forces this decision must reconcile:

- **Access shape.** MAI-Voice-2 is available in a supported region and needs no
  Foundry model deployment; a voice is selected at call time by its SSML
  `<voice name>` (for example `en-US-<VoiceName>:MAI-Voice-2`) against the same
  Azure Speech endpoint and SDK the pipeline already uses. The shared
  AIServices resource (ADR-0002) also serves Speech, so one resource covers
  both modalities.
- **The owner-locked voice set.** Keep each brand's existing narrator as the
  default listen track and the read-along voice; add a small set of listen-only
  voices, the same set for every brand, with at least one male and one female
  voice. Any picked voice whose natural register reads flat is rendered with a
  supported expressive style. SPIKE-02 confirmed the picked voices are published
  prebuilt voices and that each supports the chosen expressive style.
- **No accent-matched MAI voice for some narrators.** MAI-Voice-2 does not
  cover every accent today, so a brand whose narrator uses an accent with no MAI
  equivalent (for example an en-GB HD narrator) gets listen options in other
  accents next to that narrator. The owner accepted this tradeoff.
- **The one real product risk: read-along.** WordBoundary events drive the
  word-sync highlight, and MAI-Voice-2 WordBoundary support is undocumented and
  inconsistent across sibling model families, so it cannot be assumed. This is
  the single fact that decides whether MAI voices could ever drive read-along or
  must stay listen-only.
- **Tier and price.** F0 eligibility for MAI voices is unverified, and the
  shared resource must be AIServices S0 for the image deployment regardless.
  MAI-Voice-2 bills at 22 USD per 1M characters.

## Decision

Adopt **MAI-Voice-2** via the Azure Speech endpoint on the shared
**AIServices** resource (ADR-0002) in a single supported region, tier **S0**.
No Foundry deployment step is required; voices are selected by the SSML
`<voice name>` attribute.

1. **Default voice equals each brand's existing narrator**, which keeps both
   read-along and listen working on the proven track. A brand keeps its own
   narrator (including a non-MAI HD narrator) as the default.
2. **Add listen-only voices** (the same set for every brand): at least one man
   and one woman per brand, drawn from published prebuilt MAI voices. Any voice
   whose natural register reads flat is rendered with a supported expressive
   style via `mstts:express-as`.
3. **Ship listen-only in v1** because WordBoundary is unconfirmed for
   MAI-Voice-2. Read-along stays on the narrator track (which has proven
   WordBoundary output), and variant tracks render with empty word arrays. The
   highlight always follows the narrator.
4. **Use S0** and treat every MAI character as billable at 22 USD per 1M
   characters; do not rely on any F0 free allotment for MAI voices.
5. **Confirm two token forms at spike time** before either goes into
   `brand.json`: the exact regional identifier for any accented voice (read off
   the Foundry playground voice list) and the exact accepted spelling of the
   chosen expressive style (the prebuilt table lists the adjective form while
   SSML examples on the same page use noun forms).

## Consequences

**Positive.**
- Delivers the owner's exact voice set with at least one male and one female
  voice per brand.
- No read-along regression: the highlight stays on the narrator's proven
  WordBoundary track.
- One shared resource serves both voice and image work, and Option A pre-render
  (ADR-0008) keeps the Speech key off the worker and browser.
- Uses the same Speech SDK path the pipeline already runs, so the only real
  `tts.mjs` change is the expressive-style wrapper.

**Negative.**
- Preview status means no SLA; voices could change, move regions, or be renamed
  before GA (mitigated because audio is pre-rendered into R2, so a live outage
  never reaches listeners).
- A brand's listen voices may not accent-match its narrator (owner accepted).
- Any style-rendered voice needs an `mstts:express-as` wrapper plus the `mstts`
  namespace, the one genuine `tts.mjs` code change.
- Every MAI character is paid S0 usage.
- A future read-along migration to an MAI narrator is blocked until WordBoundary
  is proven.

**Follow-ups.**
- A roughly 30-minute throwaway spike against the new resource answers: does
  WordBoundary fire with sane offsets; does F0 also synthesize MAI voices (a
  nice-to-know, not a blocker); is `Audio48Khz96KBitRateMonoMp3` accepted; does
  an AIServices-kind key authenticate against the regional
  `<region>.tts.speech.microsoft.com` endpoint; and the exact accented-voice
  identifier and expressive-style token.
- If WordBoundary returns clean offsets, a later version can migrate a
  read-along voice to MAI; if not, the listen-only split is confirmed rather
  than assumed.

## Alternatives considered

- **Ship MAI voices for read-along in v1.** Rejected: WordBoundary is
  unconfirmed for MAI-Voice-2 and inconsistent across sibling families, so this
  would gamble the highlight on unproven timing.
- **Alternate voice picks within the approved set.** Not chosen: the owner
  selected the v1 set and deferred other candidates (may revisit with styles
  later). Recorded as decided.
- **Hold a brand until an accent-matched MAI voice ships.** Rejected: the owner
  accepted cross-accent listen options now, with each brand's own narrator
  staying default.
- **Dragon HD Omni voices on the GA surface for multi-voice.** Rejected as the
  v1 path: the owner accepted preview risk, and pre-rendered audio insulates
  listeners from any preview outage. Retained as the documented fallback if
  preview risk becomes unacceptable.
- **F0 (free) tier.** Rejected and not relied upon: F0 eligibility for MAI
  voices is unverified, and the shared resource must be S0 for the image
  deployment in any case.

<!-- safety-scan-worked-example:start -->

## Worked example: the Gunner the Lab and Holdfast Press media backbone

> Everything in this section is what was actually built with the reusable
> decision above, on the first proven build of this platform. It is historical
> fact, not part of the general methodology.

Feature A2 added multi-voice AI Listen to both StoryReader apps
(app.gunnerthelab.com and app.holdfastpress.com), served by the shared
AIServices resource `aif-studioai-prod-eus-01` in East US, tier S0.

- **Default (narrator) voices, kept as read-along and default listen:** Gunner
  `en-US-AndrewMultilingualNeural`; Holdfast `en-GB-Ryan:DragonHDLatestNeural`.
  Holdfast kept its British narrator as the default.
- **Listen-only voices added, the same set for both brands:** **Harper**
  (en-US, female), **Lisa** (en-AU, female), and **Ethan** (en-US, male,
  rendered with the `excited` style because his natural register reads flat).
  SPIKE-02 confirmed all three are published prebuilt voices, that every one of
  them supports the `excited` style, and that Ethan is the only style-capable
  en-US male.
- **The accent gap:** there is no en-GB MAI-Voice-2 voice today, so Holdfast's
  listen options are American and Australian next to a British narrator. The
  owner accepted this.
- **The two token forms to confirm at spike time:** the exact en-AU identifier
  for "Lisa" (read off the Foundry playground voice list) and the exact accepted
  spelling of the `excited` style (the prebuilt table lists the adjective form
  `excited`, while SSML examples on the same page use noun forms).
- **Deferred alternates:** Olivia in place of or alongside Harper (owner picked
  Harper as "more upbeat" and skipped Olivia for v1, may revisit with styles
  later).

<!-- safety-scan-worked-example:end -->

## Sources

- `ai/research/SPIKE-02-voice-model.md` (availability, prebuilt voice and style tables, WordBoundary risk, tier, pricing, SSML style controls)
- `ai/plans/source/ai-voice-mai-voice-2.md` (owner-locked decisions: spend, voice set, accent, preview risk, 100 USD/month cap)
- `ai/verification/environment-readiness.md` (MAI-Voice-2 confirmed for the target region; AIServices S0 offerable; the pre-existing single-purpose Speech resource is F0 SpeechServices, the wrong kind)
- What is MAI-Voice (preview)? (prebuilt voices, styles, `mstts:express-as`, same Speech SDK path): <https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices>
- Supported regions for Azure Speech (MAI voices column, East US): <https://learn.microsoft.com/azure/ai-services/speech-service/regions>
- How to synthesize speech, subscribe to synthesizer events (WordBoundary semantics): <https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis#subscribe-to-synthesizer-events>
- High-definition voices (WordBoundary support splits across the HD family): <https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices>
- Quotas and limits for Azure Speech (F0 and S0 limits, 10-minute audio cap, 64 KB SSML): <https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits>
- MAI-Voice-2 model page (22 USD per 1M characters): <https://microsoft.ai/models/mai-voice-2/>
