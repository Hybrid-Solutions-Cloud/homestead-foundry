# Post-deployment verification methodology: Azure AI Foundry

Status: methodology reference. This describes the general post-deployment
verification pass any Azure AI Foundry build in this repo should run after a
deployment. It is not tied to a single deployment's specific results; those
live in the "Worked example" section at the end of this document.

Scope: confirm a deployment is healthy end to end, prove authentication
works, and run a small number of bounded data-plane smoke calls (one
generation call per modality is usually enough) to close out any
still-unmeasured cost or capability unknowns left open by the design docs.

---

## Checks

| # | Check | What "pass" looks like |
|---|---|---|
| 1 | Account `<account-name>` provisioning state | `Succeeded`, kind `AIServices`, expected SKU |
| 2 | Model deployment `<model-deployment-name>` state | `Succeeded`, expected model id, expected version, expected SKU (for example `GlobalStandard`) |
| 3 | Role assignment: `<image-users-group>` -> Cognitive Services User | Present at the account scope |
| 4 | Role assignment: `<speech-users-group>` -> Cognitive Services Speech User | Present at the account scope |
| 5 | Key Vault secret `<secret-name>` exists (name only) | Present in `<key-vault-name>`, enabled; do not read the value for this check |
| 6 | Budget `<budget-name>` exists | Monthly, expected cap amount, cost category configured |
| 7 | Entra auth token mint, scope `https://cognitiveservices.azure.com/.default` | Bearer token acquired via the signed-in identity; never print or store the token value |
| 8 | Smoke: one image-generation call | HTTP 200 on the first attempt against the primary host; note whether a documented fallback host was needed |
| 9 | Smoke: one speech-synthesis call | HTTP 200, valid audio returned |

If any check fails, stop and diagnose before running the smoke calls. Do not
run a smoke call against a deployment whose provisioning state, role
assignments, or budget guard have not already passed.

## Smoke test 1: image generation

- Endpoint: `https://<account-name>.services.ai.azure.com/mai/v1/images/generations` (or the equivalent path for the deployed model family)
- Request: a short, brand-neutral test prompt, a modest resolution (roughly 1 megapixel is a reasonable target), one image
- Response: HTTP 200, JSON body with fields such as `created`, `data` (base64 image), `model`, `size`, `usage`
- Save the decoded artifact locally and verify it is a genuine image of the expected format, dimensions, and color mode before treating the check as passed

### Tokens-per-image

Design docs for image models often carry a working assumption for output
tokens per megapixel, because the real number is unpublished until a
deployment measures it. This step resolves that unknown: read the `usage`
object from the smoke response (output tokens, input text tokens, input
image tokens if any) and compare it against the design doc's assumed range.

### Per-image cost estimate

Using the model family's published rate card (cost per 1M output tokens,
cost per 1M input tokens):

- Output cost = output tokens x (output rate / 1,000,000)
- Input cost = input tokens x (input rate / 1,000,000)
- Total measured cost = output cost + input cost

A single short-prompt data point should be adjusted upward for the real
pipeline's typical prompt length before being used as the per-image budget
figure. Treat it as a floor, not the expected average.

## Smoke test 2: voice synthesis

- Endpoint: the relevant text-to-speech REST endpoint for the deployed voice model
- Request: SSML, a short test sentence (a handful of words is enough), the chosen voice id, a standard output format
- Response: HTTP 200, audio content type, a plausible byte count for the sentence length
- Save the decoded artifact and verify it is a genuine audio file of the expected sample rate, channel count, and bitrate

### Word-boundary finding

If the design depends on word-boundary, timing, or bookmark metadata (for
example a read-along feature), confirm whether the call shape actually used
returns it. A plain synchronous REST endpoint typically returns audio bytes
only, with no side channel for timing events. Obtaining word-boundary events
usually requires the streaming SDK path (a websocket-based synthesizer with
the timing event subscribed), which is a different integration than a single
REST smoke call exercises. Record this as open and unconfirmed rather than
assuming it works until the SDK-level path has actually been tested.

## Spend

Total the measured cost of every smoke call run during the verification
pass and confirm it is well under the deployment's budget cap. No bulk
generation should run during this pass; a handful of single-unit smoke
calls is the goal, not throughput testing.

## Deviations from the script

Record any deviation from the checks above, for example a fallback host
that had to be exercised, a retry that was needed, or a check that could
not be completed exactly as specified.

## Overall verdict

State a clear READY / NOT READY verdict. "Ready" means: resource and
deployment state are both `Succeeded`, every least-privilege role
assignment is in place, every referenced secret exists and is enabled, the
budget guard is active, auth works, and every data-plane surface exercised
answered a real request successfully. Note any still-open, non-blocking
items separately so they are not confused with a blocking failure. Per this
repo's gated-write rules, a verification pass like this does not itself
authorize bulk generation; that remains a separate, explicit owner decision.

<!-- safety-scan-worked-example:start -->
## Worked example: Brand A / Brand B

This is an anonymized example verification record for the methodology's real
worked example (two publishing brands, referred to here as Brand A and Brand
B), with resource names genericized to the CAF placeholder pattern. It is not
a live private inventory.

Status: verification complete. No Azure resources were created, updated, or
deleted during this check. Two bounded data-plane smoke calls were made (one
image generation, one speech synthesis).
Date: 2026-07-11
Author: foundry-env-verifier
Phase: 9 (`docs/implementation/as-built.md`)

### Checks

| # | Check | Result |
|---|---|---|
| 1 | Account `aif-<workload>-<env>-<region>-01` provisioningState | **PASS**, `Succeeded`, kind `AIServices`, SKU `S0` |
| 2 | Model deployment `mai-image-25` state | **PASS**, `Succeeded`, model `MAI-Image-2.5`, version `2026-06-02`, format `Microsoft`, SKU `GlobalStandard` |
| 3 | Role assignment: `sg-<workload>-image-users-<env>-<region>-01` -> Cognitive Services User | **PASS**, present on the account scope |
| 4 | Role assignment: `sg-<workload>-speech-users-<env>-<region>-01` -> Cognitive Services Speech User | **PASS**, present on the account scope |
| 5 | Key Vault secret `<workload>-speech-key` exists (name only) | **PASS**, present in `kv-<workload>-<env>-01`, enabled, value not read for this check |
| 6 | Budget `budget-<workload>-<env>-<region>-01` exists | **PASS**, monthly, amount 100.0, cost category |
| 7 | Entra auth token mint, scope `https://cognitiveservices.azure.com/.default` | **PASS**, Bearer token acquired via the signed-in identity, token value not printed or stored |
| 8 | Smoke: one MAI-Image-2.5 generation | **PASS**, HTTP 200 on the first attempt against the primary host, no fallback host needed |
| 9 | Smoke: one MAI-Voice-2 synthesis | **PASS**, HTTP 200, valid audio returned |

No check failed. No 401 or 403 was encountered on the image call, so the
documented fallback host (`aif-<workload>-<env>-<region>-01.cognitiveservices.azure.com`)
was not needed; it was exercised in code but not triggered.

### Smoke test 1: image generation

- Endpoint: `https://aif-<workload>-<env>-<region>-01.services.ai.azure.com/mai/v1/images/generations`
- Request: model `mai-image-25`, prompt "a soft graphite-pencil drawing of a friendly labrador sitting in a sunny garden, gentle childrens-book style", width 1248, height 832
- Response: HTTP 200, JSON body with fields `created`, `data` (base64 PNG), `model`, `size`, `usage`
- Saved artifact: `ai/verification/smoke/image-smoke.png` (decoded from the response, verified as a genuine PNG, 1248 x 832, RGB, about 1.73 MB)

Tokens-per-image (previously unpublished, now measured): the source plan
(`ai/plans/source/mai-image-2-5-art-match.md`) flagged tokens-per-image as
UNKNOWN and used a working assumption of roughly 1,000 to 4,200 output
tokens per megapixel image. This call measured the real number:

| Usage field | Value |
|---|---|
| `num_output_tokens` | 1014 |
| `num_input_text_tokens` | 21 |
| `num_input_image_tokens` | 0 |

That lands at the low end of the working assumption, which is good news for
the cost model.

Per-image cost estimate, using the published Foundry Models rate card cited
in the source plan (MAI-Image-2.5: image output 47 USD / 1M tokens, text
input 5 USD / 1M tokens):

- Output: 1014 tokens x (47 / 1,000,000) = 0.0477 USD
- Input: 21 tokens x (5 / 1,000,000) = 0.0001 USD
- Total measured cost for this image: approximately 0.048 USD (about 4.8 cents)

This is a single data point at 1248x832 with a roughly 400 to 600 token
prompt (this test prompt was shorter, 21 tokens). Scene prompts in the real
pipeline are longer (400 to 600 tokens per the source plan), which adds
under a cent per image at the 5 USD/1M input rate. A realistic
full-length-prompt image should still land in the 0.05 to 0.06 USD band,
consistent with the low end of the source plan's original 0.05 to 0.20 USD
estimate. Recommend replacing the source plan's placeholder range with this
measured figure.

### Smoke test 2: voice synthesis

- Endpoint: `https://eastus.tts.speech.microsoft.com/cognitiveservices/v1`
- Request: SSML, voice `en-US-Harper:MAI-Voice-2`, about nine words ("This is a short verification test of the voice."), output format `audio-16khz-32kbitrate-mono-mp3`
- Response: HTTP 200, `Content-Type: audio/mpeg`, 11,376 bytes
- Saved artifact: `ai/verification/smoke/voice-smoke.mp3` (verified as a genuine MPEG layer III audio file, 16 kHz, mono, 32 kbps)

Word-boundary finding: no word-boundary, timing, or bookmark metadata is
available from this call shape. The plain synchronous REST endpoint
(`/cognitiveservices/v1`) returns audio bytes only; there is no side channel
for `WordBoundary` events in this response (checked the full response
header set, nothing timing-related present). Getting `WordBoundary` events
requires the Speech SDK's streaming synthesis path (websocket-based
`SpeechSynthesizer` with the word-boundary event subscribed), which is a
different integration than this REST smoke test exercised. This matches the
open question already on record in `docs/implementation/as-built.md` ("whether
MAI-Voice-2 emits usable WordBoundary events") and in
`ai/verification/environment-readiness.md`; it remains UNCONFIRMED and is
correctly scoped as read-along (the feature that needs word-boundary)
staying on the existing voice for now, per task A2's plan, while listen-only
uses MAI-Voice-2. Resolving it needs an SDK-level spike, not a REST call.

### Spend

Measured image cost (about 0.048 USD) plus a roughly nine-word Speech
synthesis call (a small fraction of a cent at standard neural TTS metering)
totals well under 1 USD for this entire verification pass, inside the
mandated cap. No bulk generation was run.

### Deviations from the script

None. The primary image host answered 200 on the first call, so the
fallback host path was not exercised live. Both artifacts were produced as
specified.

### Overall verdict

READY. The deployment is healthy end to end: resource and deployment state
are both `Succeeded`, both least-privilege role assignments are in place,
the Speech secret exists and is enabled, the budget guard is active, Entra
auth works, and both data-plane surfaces (image and voice) answered real
requests successfully on the first try. The previously open
tokens-per-image unknown is now resolved with a measured value and a
tightened cost estimate.

This cleared Phase 9's technical checks. Per `ai/TASKS.md`, Phase 9 still
ended on "HOLD for owner double-check (no bulk generation)": this report
was that checkpoint. The two smoke artifacts
(`ai/verification/smoke/image-smoke.png`, `ai/verification/smoke/voice-smoke.mp3`)
were reviewed by the owner before any bulk image or audio generation was
authorized. Non-blocking items already tracked in
`docs/implementation/as-built.md` remained open at the time (Lisa en-AU voice
id and the exact "excited" style token sign-off, the `ais-` to `aif-` naming
cleanup in older docs and diagrams, image-catalog size reconciliation,
Speech-key rotation cadence) and were unaffected by this verification.
<!-- safety-scan-worked-example:end -->
