# As-Built: Azure AI Foundry Studio (Phase 8 deploy)

**Deployed:** 2026-07-11 by the repo owner, gated, each Azure write confirmed.
**Subscription:** This Is My Demo - MVP Subscription. **Region:** East US. **Status:** deployed and healthy; smoke test pending (Phase 9).

## What was created

| Resource | Name | Detail |
|---|---|---|
| Resource group | `rg-studioai-prod-eus-01` | East US. Tags: initiative=studio-foundry, env=prod, owner="<owner alias>", project=studio-foundry (verified). |
| AI Foundry account | `aif-studioai-prod-eus-01` | kind AIServices, SKU S0, custom subdomain, system-assigned managed identity, public network + Entra + RBAC. Provisioning Succeeded. Endpoint host `aif-studioai-prod-eus-01.cognitiveservices.azure.com`. |
| Model deployment | `mai-image-25` | MAI-Image-2.5, version 2026-06-02 (live-queried, not hardcoded), format Microsoft, SKU GlobalStandard. State Succeeded. |
| Security group | `sg-studioai-image-users-prod-eus-01` | Role Cognitive Services User on the account. Member: the repo owner. For MAI-Image inference. |
| Security group | `sg-studioai-speech-users-prod-eus-01` | Role Cognitive Services Speech User on the account. Member: the repo owner. For MAI-Voice TTS. |
| Key Vault secret | `kv-hcs-vault-01` / `studio-foundry-speech-key` | The Speech account key (enabled). Value never printed or committed. Image path uses keyless Entra, so no image key is stored. |
| Budget | `budget-studioai-prod-eus-01` | 100 USD per month, resource-group scope. Alerts at 50/75/90/100 percent actual plus a 100 percent forecast alert, email sent to the owner alias. Azure spending limit left ON. |

## Endpoints for the pipeline

- **Image (MAI-Image-2.5):** `https://aif-studioai-prod-eus-01.services.ai.azure.com/mai/v1/images/generations` and `.../images/edits`. Auth: keyless Entra (DefaultAzureCredential, scope `https://cognitiveservices.azure.com/.default`); the signed-in identity gets access via `sg-studioai-image-users-prod-eus-01`.
- **Voice (MAI-Voice-2):** Azure Speech endpoint `https://eastus.tts.speech.microsoft.com/cognitiveservices/v1`, voice name in SSML (for example `en-US-Harper:MAI-Voice-2`). Auth: the key in `kv-hcs-vault-01` / `studio-foundry-speech-key`; membership of `sg-studioai-speech-users-prod-eus-01` also grants Entra access.

## Deviations from the implementation guide (all owner-authorized)

1. **Account name is `aif-` not `ais-`.** Owner directive to follow current CAF (aif is the Learn abbreviation for the AIServices/Foundry kind). The design docs and 11 diagrams still say `ais-`; a repo-wide `ais-studioai` to `aif-studioai` rename is a follow-up.
2. **RBAC via Entra security groups**, amending ADR-0005 (which specified direct assignment). Same least-privilege data-plane roles, group-assigned for maintainability, owner as member. Owner-authorized.
3. **`project=studio-foundry` tag added** to the RG and account, per owner.
4. **Role assignments hit an Entra replication delay** on the first attempt (PrincipalNotFound) and were retried successfully; both are confirmed present.
5. **No action group created.** The budget uses `contactEmails` directly for the alerts. The proposed `ag-studioai-prod-eus-01` action group is an optional future add.
6. **Optional subscription-level credit budget skipped.** The MVP credit is about 1000 USD per month; this project is capped at 100 for round one.

## Follow-ups (non-blocking)

- Repo-wide `ais-studioai` to `aif-studioai` rename in `ai/` docs; update the 11 Lucid diagrams' labels in a follow-up pass.
- Add a dedicated CI service principal to the two `sg-` groups when a CI pipeline exists.
- Sign off Lisa en-AU voice id (`en-AU-Lisa:MAI-Voice-2`) and the exact `excited` style token at the voice smoke test.
- Decide the Speech-key rotation cadence.
- Reconcile the image-catalog size (SPIKE-01 ~680 vs 340) before authorizing the bulk backfill; the pipeline `--mai-budget-usd` ledger is the hard cap (the Azure budget is alert-only).
