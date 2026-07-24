# Design: identity and security

- Status: Proposed (phase 4 design)
- Date: 2026-07-11 (rewritten brand-neutral 2026-07-21, per D-03)
- Author: foundry-architect
- WAF pillar: **Security** (with the responsible-AI posture that ADR-0007 attaches to it)
- Grounded in: **ADR-0005** (identity, roles, secrets), **ADR-0007** (content safety and responsible AI), plus ADR-0001 (tenant), ADR-0004 (topology and custom subdomain); research base SPIKE-04 and SPIKE-06
- Designs only what the ADRs decided; anything an ADR left open is listed under "ADR gaps" at the end

## Scope

This document is the general identity and security pattern for an Azure AI Foundry (AIServices) build that hosts MAI-Image-2.5 and MAI-Voice-2 behind a publish-time pipeline, whether that pipeline serves one brand or several. It covers how the pipeline authenticates to the shared Foundry resource, which roles each principal holds, where the one permitted secret lives, the network posture, data residency, and the content-safety rules the pipeline must bake in. The pattern assumes the pipeline runs on a developer workstation or CI runner, outside Azure, and that the consuming app or apps are offline-first, so no key ever reaches a downstream worker or browser (ADR-0005 context, verified in code by SPIKE-06). A concrete, already-deployed instance of this pattern is restated at the end under "Worked example."

## Canonical name pattern

| Item | CAF-shaped placeholder |
| --- | --- |
| Resource group | `rg-<workload>-<env>-<region>-<instance>` |
| Azure AI Foundry (AIServices) account | `ais-<workload>-<env>-<region>-<instance>` |
| Foundry project | `proj-<workload>-<purpose>-<instance>` |
| Image model deployment | `<image-deployment-name>` (a deployment slug for the MAI-Image-2.5 model, for example `mai-image-<version>`) |
| Monthly budget | `budget-<workload>-<env>-<region>-<instance>` |
| Key Vault (an existing platform vault, reused, never recreated) | `<vault>` |
| Region | `<region>` (pin this to a real region based on data residency and model availability; this design uses East US as its illustrative example throughout) |
| Tags | `initiative=<initiative>`, `env=<env>`, `owner=<alias>`, `costCenter=<value>` |

CAF naming note: each name is `<caf-type-abbreviation>-<workload>-<environment>-<region>-<instance>`: `rg` (resource group), `ais` (Azure AI Services / Foundry account), `proj` (Foundry project). Pick one `<workload>` token and hold it fixed across every resource in the build. That token, plus the `env` and `region` tokens, should be locked once for the whole design phase (an ADR is the right place to do it), rather than leaving each design doc to invent its own shape. The `initiative` tag should carry whatever token the owning repo or program already uses, so cost rollups match wherever the work is tracked.

## 1. Identity architecture

### 1.1 Two auth models, chosen per surface (ADR-0005 decision)

| Surface | Auth model | Mechanism | Stored secret |
| --- | --- | --- | --- |
| MAI image REST (`/mai/v1/images/generations`, `/mai/v1/images/edits`) | **Microsoft Entra ID, keyless** | `DefaultAzureCredential`, token scope `https://cognitiveservices.azure.com/.default`, sent as `Authorization: Bearer <token>` | **None** |
| MAI-Voice-2 via the Speech SDK | **Resource key, vault-sourced** | Key Vault secret `<workload>-speech-key` in `<vault>`, injected as env var `MAI_SPEECH_KEY` through a gitignored `.dev.vars` | One (the Speech key) |

Both surfaces accept either Entra or key; the split is deliberate. The image calls are raw REST, so Entra is a one-line bearer-token header with zero stored secret, satisfying the no-secrets hard rule outright. Entra for the Speech SDK costs real wiring (custom subdomain, the `aad#<resourceId>#<token>` authorization-token form, and token refresh inside the pipeline's TTS tool), so ADR-0005 keeps the key path there as the pragmatic choice, deferred not rejected.

### 1.2 Image path: keyless Entra ID

- On the developer workstation, `DefaultAzureCredential` resolves to the signed-in `az login` user token. Nothing is stored anywhere.
- In CI (if the publish pipeline ever moves there), use a service principal with OIDC workload-identity federation so no long-lived client secret exists. If no CI job runs this pipeline yet, the design records the pattern and provisions nothing (see ADR gaps).
- Managed identity is not applicable: it authenticates Azure-hosted compute only, and this pipeline runs outside Azure. It becomes the preferred option only if the pipeline is later rehosted onto Azure compute (ADR-0005 alternative).
- Token scope for every request: `https://cognitiveservices.azure.com/.default`.
- Endpoint host: the account custom subdomain, `https://<foundry-account>.services.ai.azure.com` (the subdomain defaults to the account name at create time; verify at deploy). The `model` field in the request body is the chosen image deployment name.

### 1.3 Speech path: one vault-sourced key

| Item | Value |
| --- | --- |
| Key Vault secret name | `<workload>-speech-key` (values never in git; names only) |
| Vault | `<vault>` (an existing platform vault, reused per ADR-0005) |
| Injected as | `MAI_SPEECH_KEY` in the gitignored `.dev.vars` (or the CI secret store) |
| Companion (not a secret) | `MAI_SPEECH_REGION=<region>` |
| Endpoint | The regional Speech endpoint for `<region>` (the SDK derives it from `fromSubscription(key, region)`) |

Provisioning flow: the human holding Cognitive Services Contributor retrieves the account key once and writes it straight into `<vault>` as `<workload>-speech-key`; the developer reads it from the vault at build time into `.dev.vars`. The key never appears in a committed file, a log line, or a chat transcript.

Forward path (ADR-0005 follow-up): the account keeps its custom subdomain (the AIServices default) so an Entra-for-Speech migration stays cheap. A later implementation spike tests the Node Speech SDK `fromAuthorizationToken` path with the `aad#` token form and refresh; if it integrates cleanly into the pipeline's TTS tool, Speech moves to Entra, the `<workload>-speech-key` secret is retired, and local (key) authentication is disabled on the account so any leaked key is inert.

### 1.4 The two-resource key split (ADR-0004)

The new account is additive to any pre-existing per-brand Speech resource. If a brand already runs a narrator or read-along track on an older resource, that resource stays untouched; only new listen-voice variants and image calls hit the shared Foundry account.

| Track | Resource | Env vars | Auth |
| --- | --- | --- | --- |
| Narrator + read-along (existing, untouched, where one predates this build) | A brand's pre-existing Speech resource | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Key (existing arrangement) |
| MAI listen-voice variants (new) | `<foundry-account>` (S0) | `MAI_SPEECH_KEY`, `MAI_SPEECH_REGION` | Key from `<vault>` |
| MAI image generations and edits (new) | `<foundry-account>` (S0) | none required (`MAI_IMAGE_ENDPOINT` optional, not a secret) | Entra bearer token |

Because the image path is Entra, the equivalent `<workload>-image-key` secret is **never created** (ADR-0005 rule: if a surface uses Entra, its `*_KEY` secret simply does not exist).

## 2. Authorization: least-privilege RBAC

Control plane and data plane are disjoint on these services, and the split differs per surface: Cognitive Services Contributor can deploy a model but cannot make Entra inference calls; Cognitive Services User can make Entra image inference calls but cannot deploy; and for Speech the generic Owner, Contributor, and Cognitive Services roles grant no data-plane access at all, so the Speech-named role is required (ADR-0005).

| Role | Principal | Scope | Purpose | Can list keys |
| --- | --- | --- | --- | --- |
| **Cognitive Services User** | Pipeline identity (the owner's `az login` user today; a federated CI principal later if CI is added) | `<foundry-account>` | Entra data-plane calls to the image generations and edits endpoints | No |
| **Cognitive Services Speech User** | Same pipeline identity | `<foundry-account>` | Speech data plane (TTS synthesis). Active once Entra-for-Speech lands; granted now per ADR-0005 so the migration needs no new grant, and so synthesis keeps working if local auth is later disabled | No |
| **Cognitive Services Contributor** | Human owner only, one time | `<foundry-account>` | The single `az cognitiveservices account deployment create` for the image model, plus the one-time key retrieval into `<vault>` | Yes |

Notes:

- Creating the resource group and the account itself is an owner action under the owner's existing subscription rights (gated per repo policy); the Contributor grant in this table covers only the model-deployment step that ADR-0005 names.
- Reading `<workload>-speech-key` at build time requires data-plane read on `<vault>` (Key Vault Secrets User under RBAC, or the vault's existing access model). The ADRs assume the owner already holds this on the platform vault; if any non-owner principal ever needs the secret, grant Key Vault Secrets User on the specific secret, nothing broader (see ADR gaps).
- Explicitly rejected by ADR-0005 and not to be granted: Contributor to the pipeline identity (over-privileged, and cannot Entra-inference anyway), generic Owner or Contributor for Speech data plane (no effect), Cognitive Services Speech Contributor (adds custom-voice project rights the prebuilt-voice pipeline never needs).
- `<foundry-project>` is a portal working surface (voice audition, image playground, and the auto-applied `project` cost tag; see the cost design). The human owner uses it through the portal; the pipeline identity needs no project-scoped role because it calls the account data plane directly.

## 3. Secret-handling rules (hard rule applied)

1. **Names only in git.** Secret names, vault names, resource names, and region strings may be committed. Values may not, ever.
2. **One secret total.** `<workload>-speech-key` in `<vault>` is the only stored secret in this design. The image path has none.
3. **Values live in exactly two places:** the vault, and the gitignored `.dev.vars` (or CI secret store) on the publish machine.
4. **Endpoint and region are not secrets.** `MAI_SPEECH_REGION`, and the image endpoint host, may live in `.dev.vars`, a brand config file, or the vault for one-stop retrieval, at the implementer's convenience.
5. **Rotation:** the key is regenerated on any suspicion of exposure (Contributor holder regenerates, re-writes the vault secret, developers re-pull `.dev.vars`). The key retires entirely at the Entra-for-Speech migration. No fixed cadence is set by any ADR (see ADR gaps).
6. **Disable local auth per surface once its Entra path is proven** (ADR-0005), so keys stop being an attack surface at all.

## 4. Network posture (ADR-0005 follow-up, SPIKE-04 Q5)

**Public network access stays enabled. The security spine is Entra plus least-privilege RBAC plus no stored keys.**

- The pipeline runs outside Azure. Disabling public access and exposing only a private endpoint would make the endpoint unreachable from the publish workstation without a VNet plus VPN, ExpressRoute, or Bastion. For an external publish pipeline emitting pre-rendered, benign, offline-first assets, that is disproportionate cost and friction for no exposure reduction the identity controls do not already provide. **Private endpoints are overkill here** and are revisited only if the pipeline is rehosted onto Azure compute.
- These services do not support VNet injection or NSGs in any case; the supportable controls are Private Link, a service-level IP firewall, and the public-access toggle.
- **Optional, proportionate hardening** (off by default to keep the publish loop simple): a service-level IP-firewall allowlist holding the developer's egress IP and any CI runner ranges. This is the only network hardening this design endorses.
- Local (key) authentication remains enabled while the Speech key path is in use; it is disabled per surface as Entra lands (section 1.3).

## 5. Data residency

| Surface | Processing | At rest |
| --- | --- | --- |
| MAI-Voice-2 (real-time TTS) | Regional endpoint in `<region>`; synthesis happens in-region | Nothing stored: real-time synthesis retains neither input text nor output audio (per the equivalent of ADR-0007). The batch and Long Audio APIs, which do store content, are excluded by design |
| MAI-Image-2.5 (Global Standard) | Transient processing may occur outside `<region>`, in any region where the model is offered; there is no regional deployment option for this model today | All data stored at rest, including the abuse-monitoring store for flagged prompts, stays in the customer-designated geography (verify your own tenant's residency requirement against the model's geography options) |

Accepted for benign generated content and recorded here per the equivalent of ADR-0004. Both models are preview: privacy practices may differ from the documented steady state, so residency and retention findings should be re-verified at GA (an ADR-0007-style follow-up).

## 6. Content safety and responsible AI (ADR-0007, applied to the pipeline)

The workload should operate entirely inside the default guardrails. No modified abuse monitoring, no content-filter opt-out, no zero-data-retention request: all are gated approvals, and none should be necessary for benign, non-photorealistic generated content.

Pipeline-enforced habits (these become acceptance checks on the image-generation tool and the prompt sources):

1. **Genericize trademarked terms in every image prompt.** A prompt referencing a specific trademarked product or logo is rewritten as a generic visual description instead (for example, a named clothing brand becomes a plain description of its visual features). The canonical prompt files for each brand or use case are edited accordingly, and the image tool warns if a known trademark token survives in a prompt.
2. **Keep whatever non-photorealistic framing the art style calls for present in every image prompt** (for example, "hand-drawn illustration" plus a medium descriptor). This holds the art style and, for any child-directed use case, keeps the workload clearly clear of the photorealistic-minors gate, which is documented for Azure OpenAI image models and UNKNOWN for MAI; treat any content-filter refusal as a prompt-engineering signal and log it.
3. **Disclose AI generation and synthetic narration wherever the output reaches an audience** (for example "illustrations and some narration are AI-generated"), satisfying both the image transparency ask and, for any child-directed use case, the mandatory synthetic-voice disclosure for that audience.
4. **Minimize retention.** TTS stays on the real-time synthesis path (stores nothing). Do not switch to batch or Long Audio without reopening the equivalent of ADR-0007.
5. **Record provenance for every generated asset** (generator, model version, endpoint, prompt hash, size, timestamp, source image for edits, seed recorded as none if the API has no seed) in a committed provenance index. The record shape and file location are specified in `pipeline-integration-design.md`; independence from any C2PA embedding (UNKNOWN for MAI) is the point.

## 7. Security build checklist (deploy-phase gate)

- [ ] `<foundry-account>` created with its custom subdomain (the AIServices default); confirm the subdomain equals the account name
- [ ] RBAC assignments exactly as the section 2 table; nothing broader
- [ ] `<workload>-speech-key` written to `<vault>` by the Contributor holder; value never echoed or committed
- [ ] `.dev.vars` on the publish machine holds `MAI_SPEECH_KEY` and `MAI_SPEECH_REGION`; `.dev.vars` confirmed gitignored in every consuming app repo
- [ ] No `<workload>-image-key` secret exists (image path is keyless)
- [ ] Public network access enabled; IP allowlist only if the owner opts in
- [ ] Any needed AI-disclosure note scheduled into every consuming app, phrased for its audience
- [ ] Trademark genericization applied to the prompt sources before the first generation
- [ ] Entra-for-Speech spike on the follow-up list; on success, migrate, retire the key, disable local auth

## ADR gaps found (not invented here, flagged for the owner or reviewer)

1. **CI identity is a pattern, not a provision.** ADR-0005 defers the CI identity to the design phase; while no CI job runs the publish pipeline, this design documents OIDC workload-identity federation as the required pattern and provisions nothing. Create the federated credential only when publish actually moves to CI.
2. **Speech-key rotation cadence is undecided.** ADR-0005 requires rotation but sets no schedule. This design specifies rotate-on-suspicion plus retire-at-Entra-migration; a calendar cadence is an owner call.
3. **Key Vault read access is assumed, not designed.** No ADR states who holds data-plane read on `<vault>`. The design assumes the owner's existing platform-vault access and names Key Vault Secrets User as the least-privilege grant if another principal ever needs the secret.
4. **Environment token.** An early ADR's naming sketch may use an illustrative token (for example `demo`) while a later decision locks a different token (for example `prod`) for a live build. Treat that as a lock made deliberately in the design phase, not a conflict, and record it so the reviewer sees it was intentional.
5. **IP-allowlist decision.** ADR-0005 marks the service-level IP firewall as optional and proportionate; this design leaves it off by default. The owner may opt in at deploy time.

&lt;!-- safety-scan-worked-example:start -->

## Worked example: Brand A / Brand B

This methodology is deployed today for two live public brands, Brand A and Brand B (the reader apps), proving the pattern above in production. Every section above (RBAC table, network posture, residency findings, content-safety habits) applies to this instance without modification; only the concrete names differ from the placeholders.

| Placeholder | Worked-example value |
| --- | --- |
| `<workload>` | `<workload>` |
| `<env>` | `prod` |
| `<region>` | East US (`eastus`) |
| `<instance>` | `01` |
| Resource group | `rg-<workload>-<env>-<region>-01` |
| `<foundry-account>` | `aif-<workload>-<env>-<region>-01` |
| `<foundry-project>` | `proj-<workload>-media-01` |
| Image model deployment | `mai-image-25` |
| Monthly budget | `budget-<workload>-<env>-<region>-01` |
| `<vault>` | `kv-<workload>-<env>-01` (existing platform vault, reused) |
| `<initiative>` tag | `<workload>` (the initiative's tag token, kept so cost rollups still match historical records) |
| Speech secret name | `<workload>-speech-key` |
| Legacy per-brand Speech resource (the reader apps' narrator/read-along track, untouched) | the legacy narrator Speech resource (kind SpeechServices, F0), its own resource group |
| Prompt sources | the studio prompt repo, edited to genericize trademarked terms (for example, rewriting a named clothing brand as "denim bib overalls with a red rectangular chest patch") |
| Consuming app repos | Both reader-app repos; `.dev.vars` confirmed gitignored at line 4 in each |
| Art style guardrail | "hand-drawn storybook illustration" plus a graphite or colored-pencil descriptor, holding this child-directed content clear of the photorealistic-minors gate |
| Audience disclosure | Each app ships a parent-facing note (for example "illustrations and some narration are AI-generated") |
| Pipeline tools | `tools/publish.mjs`, `tools/tts.mjs`, `tools/mai-image.mjs` |
| Code verification performed this phase | `.gitignore` line 4 (`.dev.vars`) in both reader-app repos; `tools/tts.mjs` key auth via `fromSubscription` (both repos, identical content) |

&lt;!-- safety-scan-worked-example:end -->

## Sources

- `docs/adr/ADR-0005-identity-and-secrets.md` (identity model, roles, secret handling, network posture)
- `docs/adr/ADR-0007-content-safety-and-responsible-ai.md` (guardrails, prompts, disclosure, retention, provenance)
- `docs/adr/ADR-0004-foundry-topology-and-region.md` (custom subdomain, two-resource split, Global Standard residency)
- `docs/adr/ADR-0001-target-tenant.md` (tenant and region; co-location with the platform vault)
- `docs/research/SPIKE-04-identity-security.md` (Entra versus key per surface, RBAC asymmetries, secret naming, network reasoning, RAI baseline)
- `docs/research/SPIKE-06-pipeline-integration.md` (pipeline runs outside Azure; env-var names; `.dev.vars` handling)
- Code verification for the worked-example instance: see the table above
