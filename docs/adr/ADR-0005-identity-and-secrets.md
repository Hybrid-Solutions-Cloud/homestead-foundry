# ADR-0005: Identity, roles, and secret handling

- Status: Proposed
- Date: 2026-07-11
- Revised 2026-07-23: identity pass (managed identity over service principal). The identity model is reframed to be managed-identity-first per the CAF/WAF default of "managed identity is the default; avoid stored credentials; use a service principal only where managed identity genuinely cannot reach." The Entra keyless image path and the Speech key fallback are unchanged in substance; the credential type behind them is now stated as a managed identity wherever the workload runs on Azure or Arc compute.

## Context

The publish pipeline (`tools/publish.mjs`, `tools/tts.mjs`, and a future image tool such as `tools/image.mjs`) runs at publish time on a developer workstation or in CI, not on Azure-hosted compute, and the consuming apps are offline-first so no key ever reaches the worker or the browser. SPIKE-04 (`docs/research/SPIKE-04-identity-security.md`) grounds the auth, RBAC, and secret decisions; SPIKE-06 (`docs/research/SPIKE-06-pipeline-integration.md`) confirms the pipeline shape. The forces:

- **Both surfaces support Entra and key.** A Foundry image REST endpoint and the Speech surface both accept a Microsoft Entra bearer token with scope `https://cognitiveservices.azure.com/.default`, or a resource key.
- **Managed identity is the default credential wherever the workload can reach one.** CAF/WAF puts managed identity first and avoids stored credentials, and the support surface depends on where the pipeline runs. `DefaultAzureCredential` resolves accordingly: to a managed identity when the job runs on Azure compute (VM, App Service, Functions, Container Apps, and similar) or on an Azure Arc-enabled server (via the server's system-assigned managed identity through the Arc HIMDS endpoint); to a user-assigned managed identity via OIDC workload-identity federation when the job runs in off-Azure CI such as a GitHub-hosted runner with no IMDS; and to the signed-in `az login` user token on a developer workstation. A stored-secret service principal (app registration) is not used on any of these paths. User-assigned managed identity is Microsoft's recommended managed identity type (reusable across resources, independent lifecycle), and on Azure Arc-enabled servers the runtime identity is system-assigned only (user-assigned managed identity is not supported on Arc machines).
- **Entra is trivial for image, costly for Speech.** The image calls are raw REST, so Entra is a one-line `Authorization: Bearer` change with zero stored secret. Entra for the Speech SDK requires a custom subdomain, does not work on regional endpoints, and needs the SDK to be given and refresh an `aad#<resourceId>#<token>` authorization token rather than a simple key. A key-auth Speech client is what Microsoft itself calls the recommended starting path for Speech.
- **Control plane and data plane are disjoint.** Holding an administrative role does not grant data-plane inference, and the split differs between the image and Speech surfaces: Cognitive Services Contributor can deploy a model but cannot make Entra inference calls; Cognitive Services User can make Entra image inference calls but cannot deploy; and for Speech the generic Cognitive Services / Owner / Contributor roles grant no data-plane access at all, so a Speech-named role is required.
- **No-secrets hard rule.** No secrets, keys, or connection strings in any committed file. The pipeline's `.dev.vars` is gitignored in the consuming repos.

## Decision

**Identity model: Microsoft Entra ID (keyless) via `DefaultAzureCredential`, scope `https://cognitiveservices.azure.com/.default`, for any image REST calls (generations and edits), resolving to a managed identity wherever one is reachable.** The credential type is chosen by where the job runs, managed-identity-first: on Azure compute or an Azure Arc-enabled server the chain resolves to that compute's managed identity (user-assigned on Azure compute as the recommended type; the box's system-assigned managed identity on Arc, where user-assigned is not supported); in off-Azure CI (a GitHub-hosted runner with no IMDS) it resolves to a user-assigned managed identity via OIDC workload-identity federation, so no long-lived secret is stored and no app-registration service principal is created; and on a developer workstation it resolves to the signed-in `az login` user token. This satisfies the no-secrets rule outright for the image path on every one of those paths.

**Speech / neural TTS: key auth as the pragmatic path, with the key sourced from Key Vault.** Store the Speech key in the initiative's platform Key Vault (CAF pattern `kv-<workload>-<env>-<instance>`) as a named secret such as `<workload>-speech-key`, read it at build time, and inject it as an environment variable such as `SPEECH_KEY` through a gitignored `.dev.vars` (region as `SPEECH_REGION`, which is not a secret). The key is never committed. Enable the resource custom subdomain regardless (it is the prerequisite for a later Entra-for-Speech move and is harmless otherwise), and disable local authentication on any surface once its Entra path is proven. The key-versus-Entra choice for Speech is orthogonal to the managed-identity-versus-service-principal choice: it is a Speech SDK data-plane limitation (regional endpoints do not accept Entra, and the SDK needs the `aad#<resourceId>#<token>` form), not a credential-type decision. Where this pipeline runs on Azure or Arc compute, the credential behind any Entra-based call, including a future Entra-for-Speech call, is the compute's managed identity, and the Key Vault read that fetches the Speech key is itself performed with that managed identity rather than a stored secret.

**Least-privilege roles, granted on the Foundry resource scope:**

- **Pipeline identity, inference only:** Cognitive Services User (image data plane) plus Cognitive Services Speech User (TTS data plane). Neither can list keys or change the resource. The Speech-named role is used deliberately because the generic Cognitive Services / Owner / Contributor roles grant no Speech data-plane access. This pipeline identity should be a managed identity wherever the workload can reach one (the compute's managed identity on Azure or Arc; a user-assigned managed identity via OIDC federation in off-Azure CI), so the least-privilege roles are held by a credential-free identity rather than a stored secret. Where the roles are granted through an Entra security group, the group's members are those managed identities.
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
- The design phase confirms the CI identity (a user-assigned managed identity with a GitHub Actions federated identity credential, no stored secret) and writes the exact role assignments against the resource scope.
- Network posture and responsible-AI defaults are recorded in SPIKE-04 and are out of scope for this ADR: for the record, public network access stays enabled (the pipeline runs outside Azure, so private endpoints would break the build and are overkill), with an optional service-level IP-firewall allowlist as the only proportionate hardening.

## Alternatives considered

- **API key for both surfaces.** Rejected for image: the calls are raw REST, so Entra is a one-liner with zero stored secret, and the no-secrets rule prefers no stored key. Accepted only for Speech as a pragmatic fallback because Entra-for-Speech carries real wiring cost.
- **Entra for Speech now.** Deferred rather than rejected: it requires a custom subdomain plus SDK `aad#` token acquisition and refresh, which is more code than a publish-time job warrants today. The subdomain is enabled now so the move stays cheap later.
- **Managed identity.** Preferred, not rejected: it is the CAF/WAF default and is used wherever the workload can reach one. On Azure compute the pipeline identity is a managed identity (user-assigned preferred, per Microsoft's recommendation, for its reusability and independent lifecycle); on an Azure Arc-enabled server it is the box's system-assigned managed identity (user-assigned is not supported on Arc); in off-Azure CI it is a user-assigned managed identity with a GitHub Actions OIDC federated identity credential, which is a managed identity and not an app-registration service principal. The only path with no managed identity is a publish job run directly on a developer workstation, and even that uses the `az login` user token, not a service principal. A stored-secret service principal is retained only as a last resort where a managed identity genuinely cannot reach the workload.
- **Pipeline identity holds Cognitive Services Contributor.** Rejected: over-privileged (it can list and regenerate keys and reshape the resource), and per the docs Contributor cannot even make Entra inference calls, so it would not serve the data-plane path anyway.
- **Generic Owner or Contributor for the Speech data plane.** Rejected: for Speech these grant no data-plane access; the Speech-named role is required.
- **Cognitive Services Speech Contributor for the pipeline.** Rejected: it adds create, edit, and delete on custom voice projects that a prebuilt-voice pipeline never needs; Speech User is the least-privilege synthesis role.

&lt;!-- safety-scan-worked-example:start -->
## Worked example

The first proven build of this methodology serves scene art via MAI-Image-2.5 and neural narration via MAI-Voice-2 from a single Azure AI Foundry (AIServices) resource, feeding a publish pipeline (`tools/publish.mjs`, `tools/tts.mjs`, and a future `tools/mai-image.mjs`) that runs at publish time outside Azure.

- **Image path:** Entra keyless via `DefaultAzureCredential`, scope `https://cognitiveservices.azure.com/.default`, for the MAI image REST generations and edits. No stored secret.
- **Speech path:** the MAI-Voice-2 / Speech key is stored in the tenant platform vault `kv-hcs-vault-01` as the named secret `studio-foundry-speech-key` (name only; the value lives only in the vault), read at build time, and injected as `MAI_SPEECH_KEY` through a gitignored `.dev.vars`, with `MAI_SPEECH_REGION` alongside it (region is not a secret).
- **Tenant risk:** in the fallback tenant recorded in ADR-0001, a management-group "disable local authentication" Deny would break this Speech key path; it is a fallback-tenant-only risk in this build.
- Endpoint and region for both surfaces live in each brand's `brand.json` or the vault for one-stop retrieval; the consuming repos' `.dev.vars` is already gitignored.
&lt;!-- safety-scan-worked-example:end -->

## Sources

- `docs/research/SPIKE-04-identity-security.md` (Entra versus key trade-off per surface, RBAC control-plane versus data-plane split, secret naming, network posture)
- `docs/research/SPIKE-06-pipeline-integration.md` (pipeline runs at publish time outside Azure; two-resource key split; Speech key and region env vars)
- `ai/verification/environment-readiness.md` (auth decision carried from the source plans; platform Key Vault co-located with the Foundry resource)
- Configure keyless authentication with Microsoft Entra ID (DefaultAzureCredential; Cognitive Services User for inference): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/configure-entra-id>
- Role-based access control for Speech resources (Speech-named roles; generic roles give no Speech data-plane access): <https://learn.microsoft.com/azure/ai-services/speech-service/role-based-access-control>
- Role-based access control for Azure OpenAI (Contributor cannot make Entra inference calls): <https://learn.microsoft.com/azure/ai-foundry/openai/how-to/role-based-access-control>
- Microsoft Entra authentication with the Speech SDK (custom subdomain required; regional endpoints unsupported): <https://learn.microsoft.com/azure/ai-services/speech-service/how-to-configure-azure-ad-auth>
- Authenticate requests to Foundry Tools (Entra needs a custom subdomain; disable local auth once Entra is in place): <https://learn.microsoft.com/azure/ai-services/authentication>
- Deploy and use MAI image models in Microsoft Foundry (Cognitive Services Contributor to deploy; Entra scope for the image endpoint): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
- What is managed identities for Azure resources? (system-assigned versus user-assigned; user-assigned is the recommended type for Microsoft services, reusable with an independent lifecycle): <https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview>
- Managed identity best practice recommendations (user-assigned preferred in most scenarios; decouples identity administration from resource lifecycle): <https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/managed-identity-best-practice-recommendations>
- Configure a federated identity credential on a user-assigned managed identity (GitHub Actions OIDC onto a user-assigned managed identity, keyless CI with no stored service-principal secret): <https://learn.microsoft.com/entra/workload-id/workload-identity-federation-create-trust-user-assigned-managed-identity>
- Access Azure resources by using managed identity on Azure Arc-enabled servers (the Arc runtime identity is system-assigned; token via the HIMDS endpoint): <https://learn.microsoft.com/azure/azure-arc/servers/managed-identity-authentication>
- Identity and access management for Azure Arc-enabled servers (system-assigned managed identity, least-privilege Azure RBAC on Arc machines): <https://learn.microsoft.com/azure/cloud-adoption-framework/scenarios/hybrid/arc-enabled-servers/eslz-identity-and-access-management>
