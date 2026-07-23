# ADR-0005: Identity, roles, and secret handling

- Status: Proposed
- Date: 2026-07-11

## Context

The publish pipeline (`tools/publish.mjs`, `tools/tts.mjs`, and a future image tool such as `tools/image.mjs`) runs at publish time on a developer workstation or in CI, not on Azure-hosted compute, and the consuming apps are offline-first so no key ever reaches the worker or the browser. SPIKE-04 (`ai/research/SPIKE-04-identity-security.md`) grounds the auth, RBAC, and secret decisions; SPIKE-06 (`ai/research/SPIKE-06-pipeline-integration.md`) confirms the pipeline shape. The forces:

- **Both surfaces support Entra and key.** A Foundry image REST endpoint and the Speech surface both accept a Microsoft Entra bearer token with scope `https://cognitiveservices.azure.com/.default`, or a resource key.
- **Managed identity is not available to this pipeline as written.** Managed identity authenticates workloads on Azure compute; this pipeline runs outside Azure. So `DefaultAzureCredential` resolves to the signed-in `az login` user token on a workstation, or to a service principal (ideally OIDC workload-identity federation) in CI.
- **Entra is trivial for image, costly for Speech.** The image calls are raw REST, so Entra is a one-line `Authorization: Bearer` change with zero stored secret. Entra for the Speech SDK requires a custom subdomain, does not work on regional endpoints, and needs the SDK to be given and refresh an `aad#<resourceId>#<token>` authorization token rather than a simple key. A key-auth Speech client is what Microsoft itself calls the recommended starting path for Speech.
- **Control plane and data plane are disjoint.** Holding an administrative role does not grant data-plane inference, and the split differs between the image and Speech surfaces: Cognitive Services Contributor can deploy a model but cannot make Entra inference calls; Cognitive Services User can make Entra image inference calls but cannot deploy; and for Speech the generic Cognitive Services / Owner / Contributor roles grant no data-plane access at all, so a Speech-named role is required.
- **No-secrets hard rule.** No secrets, keys, or connection strings in any committed file. The pipeline's `.dev.vars` is gitignored in the consuming repos.

## Decision

**Identity model: Microsoft Entra ID (keyless) via `DefaultAzureCredential`, scope `https://cognitiveservices.azure.com/.default`, for any image REST calls (generations and edits).** On a developer workstation the credential chain resolves to the `az login` user token; in CI use a service principal via OIDC workload-identity federation so no long-lived secret is stored. This satisfies the no-secrets rule outright for the image path.

**Speech / neural TTS: key auth as the pragmatic path, with the key sourced from Key Vault.** Store the Speech key in the initiative's platform Key Vault (CAF pattern `kv-<workload>-<env>-<instance>`) as a named secret such as `<workload>-speech-key`, read it at build time, and inject it as an environment variable such as `SPEECH_KEY` through a gitignored `.dev.vars` (region as `SPEECH_REGION`, which is not a secret). The key is never committed. Enable the resource custom subdomain regardless (it is the prerequisite for a later Entra-for-Speech move and is harmless otherwise), and disable local authentication on any surface once its Entra path is proven.

**Least-privilege roles, granted on the Foundry resource scope:**

- **Pipeline identity, inference only:** Cognitive Services User (image data plane) plus Cognitive Services Speech User (TTS data plane). Neither can list keys or change the resource. The Speech-named role is used deliberately because the generic Cognitive Services / Owner / Contributor roles grant no Speech data-plane access.
- **Model deploy, one-time (control plane):** Cognitive Services Contributor, held by a human or admin for the single `az cognitiveservices account deployment create`, ideally not the pipeline identity.

**Secret handling rule:** names only in git; secret values only in the platform Key Vault and in the gitignored `.dev.vars` (or the CI secret store). If a surface later moves to Entra, its `*_KEY` secret is simply never created. Endpoint and region are not secrets and may live in a per-brand config (for example `brand.json`) or the vault for one-stop retrieval.

## Consequences

**Positive:**
- The image path stores no secret at all, meeting the no-secrets rule directly, and needs only a one-line bearer-token change.
- Roles are least-privilege and disjoint: the pipeline identity can call inference but cannot list keys or reshape the resource, and Contributor (which can list and regenerate keys) is held by a human for a one-time deploy rather than by the automation.
- The single stored secret (the Speech key) is vault-sourced and gitignored, so a leaked repo never exposes it.
- Keeping the custom subdomain on now means the Entra-for-Speech door stays open without rework.

**Negative:**
- Until Entra-for-Speech is wired, the Speech key is a long-lived bearer secret that must be rotated and kept out of git, and it grants full data-plane use of the resource.
- Two auth models coexist (Entra for image, key for voice), which is slightly more surface to document in the two-resource key split.
- The key path means that, in a tenant where a management-group "disable local authentication" Deny policy is in force (see ADR-0001 for the tenant-selection trade-off), the Speech key path would break; noted as a tenant-dependent risk.

**Follow-ups:**
- Run the implementation spike for the Node Speech SDK Entra path (`fromAuthorizationToken` with the `aad#` form and token refresh) to see whether it integrates cleanly into the Speech pipeline script without disrupting request pacing; if it does, migrate Speech to Entra and disable local auth.
- The design phase confirms the CI identity (OIDC federation) and writes the exact role assignments against the resource scope.
- Network posture and responsible-AI defaults are recorded in SPIKE-04 and are out of scope for this ADR: for the record, public network access stays enabled (the pipeline runs outside Azure, so private endpoints would break the build and are overkill), with an optional service-level IP-firewall allowlist as the only proportionate hardening.

## Alternatives considered

- **API key for both surfaces.** Rejected for image: the calls are raw REST, so Entra is a one-liner with zero stored secret, and the no-secrets rule prefers no stored key. Accepted only for Speech as a pragmatic fallback because Entra-for-Speech carries real wiring cost.
- **Entra for Speech now.** Deferred rather than rejected: it requires a custom subdomain plus SDK `aad#` token acquisition and refresh, which is more code than a publish-time job warrants today. The subdomain is enabled now so the move stays cheap later.
- **Managed identity.** Rejected: it applies only to Azure-hosted compute, and this pipeline runs on a workstation or CI runner. It becomes the preferred option only if the pipeline is later moved onto Azure compute.
- **Pipeline identity holds Cognitive Services Contributor.** Rejected: over-privileged (it can list and regenerate keys and reshape the resource), and per the docs Contributor cannot even make Entra inference calls, so it would not serve the data-plane path anyway.
- **Generic Owner or Contributor for the Speech data plane.** Rejected: for Speech these grant no data-plane access; the Speech-named role is required.
- **Cognitive Services Speech Contributor for the pipeline.** Rejected: it adds create, edit, and delete on custom voice projects that a prebuilt-voice pipeline never needs; Speech User is the least-privilege synthesis role.

<!-- safety-scan-worked-example:start -->
## Worked example

The first proven build of this methodology serves scene art via MAI-Image-2.5 and neural narration via MAI-Voice-2 from a single Azure AI Foundry (AIServices) resource, feeding a publish pipeline (`tools/publish.mjs`, `tools/tts.mjs`, and a future `tools/mai-image.mjs`) that runs at publish time outside Azure.

- **Image path:** Entra keyless via `DefaultAzureCredential`, scope `https://cognitiveservices.azure.com/.default`, for the MAI image REST generations and edits. No stored secret.
- **Speech path:** the MAI-Voice-2 / Speech key is stored in the tenant platform vault `kv-hcs-vault-01` as the named secret `studio-foundry-speech-key` (name only; the value lives only in the vault), read at build time, and injected as `MAI_SPEECH_KEY` through a gitignored `.dev.vars`, with `MAI_SPEECH_REGION` alongside it (region is not a secret).
- **Tenant risk:** in the fallback tenant recorded in ADR-0001, a management-group "disable local authentication" Deny would break this Speech key path; it is a fallback-tenant-only risk in this build.
- Endpoint and region for both surfaces live in each brand's `brand.json` or the vault for one-stop retrieval; the consuming repos' `.dev.vars` is already gitignored.
<!-- safety-scan-worked-example:end -->

## Sources

- `ai/research/SPIKE-04-identity-security.md` (Entra versus key trade-off per surface, RBAC control-plane versus data-plane split, secret naming, network posture)
- `ai/research/SPIKE-06-pipeline-integration.md` (pipeline runs at publish time outside Azure; two-resource key split; Speech key and region env vars)
- `ai/verification/environment-readiness.md` (auth decision carried from the source plans; platform Key Vault co-located with the Foundry resource)
- Configure keyless authentication with Microsoft Entra ID (DefaultAzureCredential; Cognitive Services User for inference): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/configure-entra-id>
- Role-based access control for Speech resources (Speech-named roles; generic roles give no Speech data-plane access): <https://learn.microsoft.com/azure/ai-services/speech-service/role-based-access-control>
- Role-based access control for Azure OpenAI (Contributor cannot make Entra inference calls): <https://learn.microsoft.com/azure/ai-foundry/openai/how-to/role-based-access-control>
- Microsoft Entra authentication with the Speech SDK (custom subdomain required; regional endpoints unsupported): <https://learn.microsoft.com/azure/ai-services/speech-service/how-to-configure-azure-ad-auth>
- Authenticate requests to Foundry Tools (Entra needs a custom subdomain; disable local auth once Entra is in place): <https://learn.microsoft.com/azure/ai-services/authentication>
- Deploy and use MAI image models in Microsoft Foundry (Cognitive Services Contributor to deploy; Entra scope for the image endpoint): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
