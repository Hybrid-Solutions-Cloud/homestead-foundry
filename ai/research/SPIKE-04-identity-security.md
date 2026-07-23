# SPIKE-04: identity, secrets, security, and responsible AI

Status: research complete. No Azure resources created, no spend, no keys issued or stored.
Date: 2026-07-11
Author: foundry-researcher (Opus)
Scope: how the publish-time build pipeline authenticates to and safely uses the shared Azure AI Foundry (AIServices) resource in East US that hosts the MAI-Image-2.5 model deployment and serves MAI-Voice-2 through Azure Speech. Grounds the auth, RBAC, secret-handling, responsible-AI, and network-posture decisions the two source plans deferred to this spike (`ai/plans/source/mai-image-2-5-art-match.md`, `ai/plans/source/ai-voice-mai-voice-2.md`) and the deployment step in `ai/verification/environment-readiness.md`.

Grounding fact that drives every answer below: the pipeline (`tools/publish.mjs`, `tools/tts.mjs`, and a future `tools/*image*.mjs`) runs at publish time on a developer workstation or in CI, **not** on Azure-hosted compute, and the consuming apps are offline-first so no key ever reaches the worker or the browser. This is stated in both source plans (voice plan section 4 Option A "No key at runtime"; image plan section 6).

*This spike's findings and recommendation are written to apply to any Azure AI Foundry (AIServices) setup that pairs a Foundry image model with a Foundry TTS model behind an external, publish-time pipeline. Concrete resource, vault, and secret names use `<workload>` / `<brand>` placeholders in the body; the real names this recommendation was first applied to are recorded in the "Worked example" section at the end.*

---

## Question

Five questions for the shared East US Foundry resource and the external publish pipeline that calls it:

1. **Authentication.** Microsoft Entra ID (managed identity or user token, scope `https://cognitiveservices.azure.com/.default`) versus API key, for both the MAI image endpoints (`/mai/v1/images/generations` and `/edits` under `services.ai.azure.com`) and the MAI-Voice-2 Speech surface. Which is right for a publish-time build that runs on a developer machine or in CI, not inside Azure? What are the practical trade-offs?
2. **RBAC.** The least-privilege role for the pipeline identity. Compare Cognitive Services Contributor, Cognitive Services User, and any Speech-specific role. What is the minimum to (a) deploy the model and (b) call inference?
3. **Key handling.** If a key is used, storing it in the platform Key Vault by name and reading it at build time (env var or `.dev.vars`, never committed). A secret naming convention (names only).
4. **Responsible AI for children's content.** Content-safety and RAI policy for image generation involving children and for TTS; prompt handling for trademarked terms (the source image plan flags a trademarked garment brand to genericize); text and image moderation defaults; whether prompts or generated assets are retained or used for training and how to opt out; data residency for East US.
5. **Network posture.** Are private endpoints or disabled public network access feasible or overkill for this workload? A proportionate recommendation.

---

## Findings

### Q1. Authentication: Entra ID versus API key, for both surfaces

**Both surfaces support both methods.** The MAI image how-to documents an `api-key` header and, equivalently, a `DefaultAzureCredential` bearer token; the exact scope for the image endpoint is `https://cognitiveservices.azure.com/.default` (stated both in the Entra ID code sample and in the Troubleshoot table: "For Entra ID authentication, ensure the token scope is `https://cognitiveservices.azure.com/.default`"). [MAI image how-to](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai) The Azure Speech surface likewise supports either a subscription key or a Microsoft Entra token acquired with the same scope `https://cognitiveservices.azure.com/.default`. [Speech Entra auth](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-configure-azure-ad-auth) So the scope named in the task is correct for both.

**Managed identity is not available to this pipeline as written.** Managed identity authenticates workloads that run on Azure compute (VMs, Functions, App Service, container jobs). [Azure OpenAI managed identity](https://learn.microsoft.com/azure/ai-foundry/openai/how-to/managed-identity) The publish pipeline runs on a developer workstation or CI runner outside Azure, so the practical Entra options are:
- **Developer workstation:** `DefaultAzureCredential` resolves to the signed-in `az login` user token (AzureCliCredential in the chain). No secret is stored anywhere. [Foundry keyless auth](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/configure-entra-id)
- **CI:** a service principal, ideally via OIDC workload-identity federation (for example GitHub Actions federated credentials) so no long-lived client secret is stored. A client-secret service principal (client-credentials flow, same `.../.default` scope) also works. [Entra client-credentials flow](https://learn.microsoft.com/azure/ai-services/translator/how-to/microsoft-entra-id-auth)
- Managed identity (user-assigned) becomes the best option only if the pipeline is later moved onto Azure compute.

**Practical trade-offs:**
- **MAI image (Entra is easy here).** The image calls are raw REST (`requests`/`fetch`), so Entra means one extra step: get a bearer token from `DefaultAzureCredential` and set `Authorization: Bearer <token>`. No SDK friction. [MAI image how-to](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai)
- **Speech / MAI-Voice-2 (Entra has real wiring cost).** Entra auth for Speech requires a **custom subdomain** on the resource, and regional endpoints do not support Entra auth; the SDK must be given an authorization token (in the Speech `aad#<resourceId>#<token>` form) and refresh it, rather than a simple key. [Speech Entra auth](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-configure-azure-ad-auth) The current `tools/tts.mjs` uses the Node Speech SDK with a subscription key and F0 request pacing; moving it to Entra is more code than the image path. Microsoft's own Speech quickstart calls key auth "recommended for getting started" and Entra "recommended for production." [LLM Speech env vars](https://learn.microsoft.com/azure/ai-services/speech-service/llm-speech)
- **Key auth trade-off (both surfaces).** Simpler to wire (a header/env var), but the key is a long-lived bearer secret that grants full data-plane use of the resource; it must be stored, rotated, and kept out of git. The repo's hard rule is no secrets in committed files, and Microsoft recommends disabling local (key) auth entirely once Entra is in place so keys cannot be used. [Authenticate to Foundry Tools](https://learn.microsoft.com/azure/ai-services/authentication)

### Q2. RBAC: least-privilege roles for deploy versus inference

Azure separates **administration (control-plane)** access from **developer (data-plane)** access; holding one does not grant the other. [Foundry keyless auth: roles in context](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/configure-entra-id) This split is the crux of the answer, and it differs between the image surface and the Speech surface.

**(a) Deploy the MAI-Image-2.5 model (control plane): Cognitive Services Contributor.** The MAI how-to states the prerequisite plainly: "Cognitive Services Contributor role on the Azure AI Foundry resource to deploy models." [MAI image how-to](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai) The Foundry RBAC concept doc agrees: "Deploy and operate managed compute deployments: assign Cognitive Services Contributor on the Foundry account scope." [RBAC for Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/rbac-foundry) MAI-Voice-2 has **no deploy step** (it is selected by voice name at call time, not deployed), so no deploy role is needed for the voice path. [environment-readiness.md; MAI-Voice model page](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)

**(b) Call MAI image inference with Entra ID (data plane): Cognitive Services User.** The keyless-auth troubleshooting guidance is explicit: assign **Cognitive Services User** to the principal on the Foundry resource; "**Cognitive Services OpenAI User** grants only access to OpenAI models"; and "**Owner** or **Contributor** don't provide access either." [Foundry keyless auth: troubleshooting](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/configure-entra-id) The Azure OpenAI RBAC summary table confirms the asymmetry: Cognitive Services Contributor can create deployments and copy keys but shows a red X for "Make inference API calls with Microsoft Entra ID." [Azure OpenAI RBAC summary](https://learn.microsoft.com/azure/ai-foundry/openai/how-to/role-based-access-control) Net: **Contributor can deploy but cannot do Entra inference; User can do Entra inference but cannot deploy.** They are disjoint, so an identity that both deploys and calls inference needs both roles, or (cleaner) the model is deployed once by an admin/Contributor and the pipeline identity holds only **Cognitive Services User**.

**(b) Call MAI-Voice-2 TTS synthesis (data plane): Cognitive Services Speech User.** Speech is a special case and the generic Cognitive Services roles are misleading here. The Speech RBAC doc warns: "*Cognitive Services User* provides in effect the Contributor rights, while *Cognitive Services Contributor* provides no access at all. The same is true for generic *Owner* and *Contributor* roles, which have no data plane rights and therefore provide no access to Speech resource." It recommends the Speech-named roles. [Speech RBAC](https://learn.microsoft.com/azure/ai-services/speech-service/role-based-access-control) The least-privilege synthesis role is **Cognitive Services Speech User** (access to real-time synthesis and long-audio APIs, view-only on custom models, and cannot list resource keys). **Cognitive Services Speech Contributor** adds create/edit/delete on custom projects, which the prebuilt-voice pipeline does not need. [Azure built-in roles: AI + machine learning](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/ai-machine-learning), [Speech RBAC](https://learn.microsoft.com/azure/ai-services/speech-service/role-based-access-control)

**Least-privilege summary for the pipeline identity:**

| Action | Surface | Least-privilege role | Notes |
|---|---|---|---|
| Deploy the model | Image (control plane) | Cognitive Services Contributor | One-time; ideally an admin, not the pipeline identity. Also lets Entra inference-only roles be granted, and can list/regenerate keys. |
| Call image generations/edits (Entra) | Image (data plane) | Cognitive Services User | Contributor cannot do this; needs custom subdomain for Entra. |
| Call TTS synthesis (Entra) | Speech (data plane) | Cognitive Services Speech User | Generic Contributor/Owner give no Speech access; use the Speech-named role. Cannot list keys. |
| Retrieve a key from the resource | Either | Cognitive Services Contributor (or Owner) | Only needed if the key path is chosen and the key is pulled from the resource rather than Key Vault. The Speech-User/Cognitive-Services-User roles cannot list keys. |

### Q3. Key handling if a key is used

The preferred posture is **no key at all** (Entra), which removes this problem. If a key is used (most likely for the Speech path, where Entra wiring is heavier), the compliant handling is:

- Store the key in the platform Key Vault (the vault named in the source plans and `environment-readiness.md`) as a named secret. Never place it in any committed file; `.dev.vars` is already gitignored in the consuming repo(s). [voice plan section 5 step 6]
- At build time, read it from Key Vault into the session (or the CI secret store) and expose it to the pipeline as an environment variable / `.dev.vars` entry, matching the pattern the pipeline already uses (`MAI_SPEECH_KEY` / `MAI_SPEECH_REGION`). [voice plan section 6 step 2]
- Once Entra works for a surface, **disable local authentication** (key auth) on the resource so a leaked key is inert. [Authenticate to Foundry Tools](https://learn.microsoft.com/azure/ai-services/authentication)

**Recommended Key Vault secret naming (names only, no values).** The resource is shared across consumers and both modalities, so a workload-scoped, brand-neutral convention is cleaner than per-brand names. Suggested (`<workload>` is the deployment's workload token):

| Key Vault secret name | Holds | Used only if |
|---|---|---|
| `<workload>-speech-key` | Speech resource key | Speech uses key auth (Entra not adopted for TTS) |
| `<workload>-speech-region` | Speech region (`eastus`) | always (region is not a secret, but co-locating it is convenient) |
| `<workload>-image-endpoint` | `https://<resource>.services.ai.azure.com` | always (endpoint host, not a secret) |
| `<workload>-image-key` | Foundry resource key for the image endpoint | image uses key auth (Entra not adopted for image) |

Corresponding gitignored `.dev.vars` / CI env names (keep the pipeline's existing spelling): `MAI_SPEECH_KEY`, `MAI_SPEECH_REGION`, `MAI_IMAGE_ENDPOINT`, `MAI_IMAGE_KEY`. If a surface uses Entra, its `*_KEY` secret is simply never created. Region and endpoint are not secrets; they are stored in the vault only for one-stop retrieval and may equally live in `brand.json`.

### Q4. Responsible AI for children's content

**Image generation, RAI baseline (MAI, Models sold by Azure).** The MAI how-to's Responsible AI section names the risk areas directly relevant here: "violent or gory content, sexual content or nudity, depictions of public figures, and **replication of trademarked or other protected material**," applied through "data filtering and content classifiers ... at the system level," and it instructs customers to "be transparent: disclose that content is AI-generated." [MAI image how-to: Responsible AI](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai) Input and output moderation runs on image models by default, alongside content filtering and abuse monitoring. [Azure OpenAI image generation: RAI](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e)

**Minors in every scene.** The documented default that exists is for Azure OpenAI image models: "**Photorealistic images of minors are blocked by default.** Customers can request access ... Enterprise-tier customers are automatically approved." [Azure OpenAI image generation: minors](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e) Two important qualifications for this workload: (1) that rule is written for Azure OpenAI DALL-E, and whether the identical default applies to MAI image models is **not separately documented (UNKNOWN)**; (2) the trigger is *photorealistic*, and where the target art uses a non-photorealistic style (for example hand-drawn graphite / colored-pencil illustration) that is the safer category. The mitigation the source image plan proposes (keep a "hand-drawn storybook illustration" framing in every prompt) is the right hedge; expect occasional filter refusals and treat them as prompt-engineering signals, not blockers.

**Trademark handling.** "Replication of trademarked or other protected material" is a named risk area, so genericizing any trademarked brand term in a prompt (for example a named-brand garment to a plain descriptive equivalent such as "denim bib overalls with a red rectangular chest patch") both reduces refusal risk and is the responsible choice; it changes no visible detail of the art. [MAI image how-to: Responsible AI](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai), [image plan section 8]

**Text-to-speech RAI.** Microsoft **requires** customers to disclose the synthetic nature of TTS voices to users. [TTS transparency note](https://learn.microsoft.com/azure/foundry/responsible-ai/speech-service/text-to-speech/transparency-note) For a children's audience there is an explicit added expectation: "Consider proper disclosure to parents ... If your use case is intended for minors or children, you'll need to ensure that your disclosure is clear and transparent so that parents or legal guardians can ... make an informed decision." [TTS transparency note](https://learn.microsoft.com/azure/foundry/responsible-ai/speech-service/text-to-speech/transparency-note) The TTS code of conduct lists "To exploit or manipulate children" as prohibited, and lists "audio books" and "entertainment media ... for fictional content" as appropriate uses, which is exactly this workload. [TTS disclosure and code of conduct](https://learn.microsoft.com/azure/foundry/responsible-ai/speech-service/text-to-speech/disclosure-voice-talent) Using **prebuilt** MAI-Voice-2 voices needs no Limited Access registration; only custom neural voice / voice prompting (the parked Celtic-voice idea) is gated. [MAI-Voice](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices), [TTS transparency note](https://learn.microsoft.com/azure/foundry/responsible-ai/speech-service/text-to-speech/transparency-note)

**Retention and training (image).** For Models sold by Azure: "The models are stateless: no prompts or completions are stored in the model. ... prompts and completions are not used to train, retrain, or improve the base models," and inputs/outputs are "NOT used to train any generative AI foundation models without your permission or instruction." [Data, privacy, and security for Models sold by Azure](https://learn.microsoft.com/azure/foundry/responsible-ai/openai/data-privacy) The one place data is retained is **abuse monitoring**: prompts and completions flagged as potentially harmful may be stored (logically separated by resource ID) for automated and, if needed, human review. [Abuse monitoring](https://learn.microsoft.com/azure/foundry/openai/concepts/abuse-monitoring) Turning that storage/human-review off (**modified abuse monitoring**) is gated: "available only to customers and partners managed by a Microsoft account team or under an eligible program." [Limited access for Models sold by Azure](https://learn.microsoft.com/azure/foundry/responsible-ai/openai/limited-access) All customers can tune Guardrail severity thresholds, but turning Guardrails partially or fully off needs the same gated approval. [Limited access](https://learn.microsoft.com/azure/foundry/responsible-ai/openai/limited-access) Full zero-data-retention is limited to EA/MCA (not pay-as-you-go) customers via a support request. [Microsoft Q&A: zero data retention (accepted answer)](https://learn.microsoft.com/answers/a/8264379) Practically, for a benign children's-content workload the default abuse monitoring is low-friction and there is little reason to seek an opt-out.

**Retention and training (TTS).** Cleaner than the image path. For prebuilt neural voices via the **real-time** synthesis API (the path the pipeline uses): "Neither input text nor output audio content is stored in Microsoft logs," and "Microsoft doesn't retain or store the text ..." and "doesn't store audio ... generated with the real-time synthesis API." [TTS data, privacy, and security](https://learn.microsoft.com/azure/ai-foundry/responsible-ai/speech-service/text-to-speech/data-privacy-security) Caveat: the **Long Audio / batch** API *does* store the submitted script and output audio in Azure storage (deletable via API); the source voice plan deliberately keeps the real-time SDK path, so the no-storage property holds as long as the pipeline does not switch to batch. [TTS data, privacy, and security](https://learn.microsoft.com/azure/ai-foundry/responsible-ai/speech-service/text-to-speech/data-privacy-security)

**Data residency for East US.** Two different pictures for the two surfaces:
- **Speech / TTS:** the real-time endpoint is regional (`eastus.tts.speech.microsoft.com`), so processing is in East US, and by the finding above nothing is stored. Cleanest residency of the two.
- **MAI image:** MAI-Image-2.5 deploys as **Global Standard**. For "Global" deployment types, "prompts and responses may be processed in any geography where the relevant model ... is deployed"; MAI image is offered in West Central US, East US, West US, West Europe, Sweden Central, South India, and UAE North, so live processing may occur outside the US. However, "any data stored at rest ... including the abuse monitoring data store created for Global and DataZone deployments, is stored in the customer-designated geography." [Data, privacy, and security for Models sold by Azure](https://learn.microsoft.com/azure/foundry/responsible-ai/openai/data-privacy), [MAI image how-to](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai) So for an East US resource: at-rest data (including any flagged-content abuse store) stays in the US geography, but transient image processing under Global Standard can happen in other regions. This is worth noting for a children's-content workload even though the content is benign; there is no regional (non-Global) deployment option for MAI image today.

**Preview caveat (applies to both models).** Both MAI-Image-2.5 and MAI-Voice-2 are in preview, and Microsoft warns that "Azure Preview features, including Models sold by Azure in preview, may employ different privacy practices, including with respect to abuse monitoring," subject to the Azure Previews supplemental terms. [Data, privacy, and security for Models sold by Azure](https://learn.microsoft.com/azure/foundry/responsible-ai/openai/data-privacy) Treat the retention/residency findings above as the documented steady-state and re-verify at GA.

### Q5. Network posture

Foundry Tools (Cognitive Services) support **Azure Private Link / private endpoints**, a service-level **IP firewall**, and a **Disable public network access** toggle; they do **not** support VNet injection or NSGs (the service cannot be deployed into a customer VNet, and NSG rules do not apply to it). [Azure security baseline for Foundry Tools](https://learn.microsoft.com/security/benchmark/azure/baselines/cognitive-services-security-baseline), [Cognitive Services virtual networks](https://learn.microsoft.com/azure/ai-services/cognitive-services-virtual-networks) Private endpoints are the platform recommendation for sensitive AI workloads that live inside a VNet. [Secure networking for AI platform services](https://learn.microsoft.com/azure/cloud-adoption-framework/ai/platform/networking)

The decisive fact for *this* workload: the pipeline runs **outside Azure**. If public network access is disabled and only a private endpoint is exposed, an external developer machine or CI runner cannot reach the endpoint at all without extra plumbing (VPN gateway, ExpressRoute, or an Azure Bastion jump box in the VNet). [Configure private link for Foundry](https://learn.microsoft.com/azure/foundry/how-to/configure-private-link) For a two-app publishing pipeline that emits pre-rendered, benign, offline-first assets to R2, standing up a VNet + private endpoint + VPN/Bastion is disproportionate and would actively slow the publish loop, for no data-exposure reduction that the identity controls do not already provide. Private endpoints would be the right call only if the pipeline were later hosted on Azure compute inside a VNet.

Proportionate middle ground if any network hardening is wanted: leave public access enabled and add a **service-level IP firewall allowlist** (the developer's egress IP and/or the CI runner ranges), which Foundry Tools support without a VNet. [Cognitive Services virtual networks: IP rules](https://learn.microsoft.com/azure/ai-services/cognitive-services-virtual-networks) The primary controls remain Entra + least-privilege RBAC + no stored keys.

---

## What is still UNKNOWN

- **Whether MAI image models apply the same "photorealistic minors blocked by default" gate as Azure OpenAI DALL-E.** The default is documented for Azure OpenAI image models; the MAI how-to describes only general system-level classifiers. The pilot (hand-drawn, non-photorealistic prompts) is the cheap way to observe the actual filter behavior. [dall-e minors](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e), [MAI image how-to](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai)
- **The exact default Guardrail/content-filter severity thresholds for the MAI image and MAI-Voice-2 preview surfaces.** All customers can configure severity thresholds, but the shipped defaults for these specific preview models are not separately published; the general Guardrails behavior is the best available reference. [Limited access](https://learn.microsoft.com/azure/foundry/responsible-ai/openai/limited-access), [Guardrails / content filter](https://learn.microsoft.com/azure/ai-foundry/openai/concepts/content-filter)
- **Whether MAI image output embeds C2PA / Content Credentials provenance** (as DALL-E does). Not stated on the MAI page, which asks the customer to disclose AI generation manually. UNKNOWN. [MAI image how-to](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai)
- **Preview privacy divergence.** Microsoft explicitly reserves that preview Models sold by Azure "may employ different privacy practices" than the documented steady state; the abuse-monitoring/residency findings should be re-verified at GA. [Data, privacy, and security for Models sold by Azure](https://learn.microsoft.com/azure/foundry/responsible-ai/openai/data-privacy)
- **Whether the Node Speech SDK Entra path (`fromAuthorizationToken` with the `aad#...` token form and refresh) integrates cleanly into `tools/tts.mjs`** without disrupting the F0 request-pacing logic. This is an implementation spike, not a documentation gap; the key fallback exists if it proves awkward.
- **Modified-abuse-monitoring eligibility for this subscription.** Opt-out is gated to account-team-managed customers or eligible programs; whether the subscription qualifies is a commercial question, not a documented technical one. Not needed for the benign content here. [Limited access](https://learn.microsoft.com/azure/foundry/responsible-ai/openai/limited-access)

---

## Recommendation

**Identity model: Microsoft Entra ID (keyless), with `DefaultAzureCredential`.** On the developer workstation the credential chain resolves to the `az login` user token; in CI use a service principal via OIDC workload-identity federation so no long-lived secret is stored. Managed identity is not applicable while the pipeline runs outside Azure, but becomes the preferred option if it is ever moved onto Azure compute. Use scope `https://cognitiveservices.azure.com/.default` for both surfaces.

- **MAI image: adopt Entra now.** The calls are raw REST, so Entra is a one-line `Authorization: Bearer` change with zero stored secret. This satisfies the no-secrets rule outright.
- **MAI-Voice-2 / Speech: Entra preferred, key permitted as a pragmatic fallback.** Entra for Speech requires a custom subdomain and SDK token wiring; if that friction is not worth it for a publish-time job, keep the current key path but source the key from the platform Key Vault (secret name `<workload>-speech-key`, region in `<workload>-speech-region`), inject it as `MAI_SPEECH_KEY` / `MAI_SPEECH_REGION` via gitignored `.dev.vars` or the CI secret store, and never commit it. Enable the custom subdomain regardless (it is a prerequisite for Entra and harmless otherwise), and disable local auth on any surface once its Entra path is proven.

**Least-privilege roles (grant on the Foundry resource scope):**
- Pipeline identity for inference: **Cognitive Services User** (image data plane) + **Cognitive Services Speech User** (TTS data plane). Neither can list keys or change the resource.
- Model deployment: **Cognitive Services Contributor**, held by a human/admin for the one-time `az cognitiveservices account deployment create`, ideally *not* the pipeline identity. Remember the two asymmetries the docs call out: Cognitive Services Contributor cannot make Entra inference calls, and for Speech the generic Cognitive Services / Owner / Contributor roles grant no data-plane access at all, which is why the Speech-named role is required.

**Responsible-AI posture:** keep the workload inside the default guardrails rather than seeking any opt-out. Do not pursue modified abuse monitoring or content-filter opt-out (gated, unnecessary for benign children's content, and the default retention is minimal: nothing stored for real-time TTS, and only flagged image prompts stored under abuse monitoring). Bake three habits into the pipeline: (1) **genericize trademarked terms** (drop any trademarked brand name, describe the item generically) in every image prompt; (2) keep the **"hand-drawn storybook illustration"** framing so the non-photorealistic, non-minors-photorealism path is explicit; (3) **disclose AI generation and synthetic narration** to users, with parent-facing clarity given the child audience (a short "illustrations and some narration are AI-generated" note in each app satisfies both the image transparency ask and the mandatory TTS synthetic-voice disclosure). Record generator, model version, and prompt hash per asset (the image plan's provenance point) so provenance is never unknown again. Note for the record that MAI image runs as Global Standard, so transient processing may leave East US even though at-rest data stays in the US geography; TTS real-time stays in-region and stores nothing.

**Network posture:** private endpoints and disabled public network access are **overkill** for an external, offline-first publish pipeline emitting benign assets, and would break or slow the build without a VNet + VPN/Bastion. Leave public network access enabled; rely on Entra + least-privilege RBAC + no stored keys as the security spine. If any hardening is desired, add a service-level IP-firewall allowlist for the developer and CI egress ranges (supported without a VNet). Revisit private endpoints only if the pipeline is relocated onto Azure compute.

---

## Sources

- Deploy and use MAI image models in Microsoft Foundry (preview) (endpoints, api-key vs Entra, scope, Cognitive Services Contributor to deploy, RAI considerations): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
- Configure keyless authentication with Microsoft Entra ID (DefaultAzureCredential; Cognitive Services User for inference; admin vs developer access): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/configure-entra-id>
- Role-based access control for Microsoft Foundry (Cognitive Services Contributor to deploy; User to read): <https://learn.microsoft.com/azure/foundry/concepts/rbac-foundry>
- Role-based access control for Azure OpenAI (summary table: Contributor cannot Entra-inference; keys under Contributor): <https://learn.microsoft.com/azure/ai-foundry/openai/how-to/role-based-access-control>
- Role-based access control for Speech resources (Speech-named roles; Cognitive Services User = effective contributor, Cognitive Services Contributor = no access): <https://learn.microsoft.com/azure/ai-services/speech-service/role-based-access-control>
- Azure built-in roles: AI + machine learning (Cognitive Services Speech User / Speech Contributor definitions): <https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/ai-machine-learning>
- Microsoft Entra authentication with the Speech SDK (custom subdomain required; scope cognitiveservices.azure.com/.default; regional endpoints unsupported): <https://learn.microsoft.com/azure/ai-services/speech-service/how-to-configure-azure-ad-auth>
- Authenticate requests to Foundry Tools (Entra needs custom subdomain; disable local auth): <https://learn.microsoft.com/azure/ai-services/authentication>
- Azure OpenAI managed identity (managed identity is for Azure-hosted compute): <https://learn.microsoft.com/azure/ai-foundry/openai/how-to/managed-identity>
- Data, privacy, and security for Models sold by Azure in Microsoft Foundry (stateless models; not used to train; abuse-monitoring store per-geography; Global processing location; preview caveat): <https://learn.microsoft.com/azure/foundry/responsible-ai/openai/data-privacy>
- Abuse monitoring (components; modified abuse monitoring): <https://learn.microsoft.com/azure/foundry/openai/concepts/abuse-monitoring>
- Limited access for Foundry Models sold by Azure (modified Guardrails / abuse monitoring gated to account-team-managed customers; severity thresholds configurable by all): <https://learn.microsoft.com/azure/foundry/responsible-ai/openai/limited-access>
- Azure OpenAI image generation models: Responsible AI and minors (photorealistic minors blocked by default; input/output moderation; opt-out form): <https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e>
- Transparency note: text to speech (mandatory synthetic-voice disclosure; minors/parent disclosure; editorial control): <https://learn.microsoft.com/azure/foundry/responsible-ai/speech-service/text-to-speech/transparency-note>
- Disclosure for voice and avatar talent / TTS code of conduct (prohibited: exploit or manipulate children; appropriate: audiobooks, fictional entertainment): <https://learn.microsoft.com/azure/foundry/responsible-ai/speech-service/text-to-speech/disclosure-voice-talent>
- Data, privacy, and security for text to speech (real-time synthesis stores no text or audio; Long Audio/batch stores in Azure storage; prebuilt not used to train): <https://learn.microsoft.com/azure/ai-foundry/responsible-ai/speech-service/text-to-speech/data-privacy-security>
- What is MAI-Voice (preview)? (no deploy step; prebuilt voices; Custom Neural Voice gating): <https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices>
- Guardrails / content filtering (moderation defaults, configurable thresholds): <https://learn.microsoft.com/azure/ai-foundry/openai/concepts/content-filter>
- Azure security baseline for Foundry Tools (VNet injection and NSG not supported; Private Link and disable-public-access supported): <https://learn.microsoft.com/security/benchmark/azure/baselines/cognitive-services-security-baseline>
- Configure secure networking for Azure AI platform services (private endpoints for sensitive AI workloads): <https://learn.microsoft.com/azure/cloud-adoption-framework/ai/platform/networking>
- How to configure network isolation for Microsoft Foundry (VPN/ExpressRoute/Bastion needed to reach a private-only resource): <https://learn.microsoft.com/azure/foundry/how-to/configure-private-link>
- Cognitive Services virtual networks (service-level IP firewall rules): <https://learn.microsoft.com/azure/ai-services/cognitive-services-virtual-networks>
- Microsoft Q&A: zero data retention with Azure OpenAI (EA/MCA only, via support request): <https://learn.microsoft.com/answers/a/8264379>
- Local grounding: `ai/plans/source/mai-image-2-5-art-match.md`, `ai/plans/source/ai-voice-mai-voice-2.md`, `ai/verification/environment-readiness.md`

---

<!-- safety-scan-worked-example:start -->
## Worked example: Gunner the Lab / Holdfast Press

The recommendation above was first applied to the two publishing brands this repo was originally built for, Gunner the Lab and Holdfast Press (StoryReader). The concrete names below map onto the `<workload>` / `<brand>` / placeholder wording used in the body. None of these are secret values, only names.

**Resource, vault, and secret names**

| Body placeholder | Real name in the first proven build |
|---|---|
| Foundry (AIServices) resource | `aif-studioai-prod-eus-01` (East US) |
| platform Key Vault | `kv-hcs-vault-01` |
| `<workload>-speech-key` | `studio-foundry-speech-key` |
| `<workload>-speech-region` | `studio-foundry-speech-region` |
| `<workload>-image-endpoint` | `studio-foundry-image-endpoint` |
| `<workload>-image-key` | `studio-foundry-image-key` |
| subscription | This Is My Demo |

The gitignored `.dev.vars` / CI env names are unchanged from the body: `MAI_SPEECH_KEY`, `MAI_SPEECH_REGION`, `MAI_IMAGE_ENDPOINT`, `MAI_IMAGE_KEY`. The `hcs` fragment in the vault name is the platform org token, not a secret.

**Content specifics for the two brands**

- The Gunner the Lab art is hand-drawn graphite / colored-pencil illustration, which is the non-photorealistic (safer) category for the minors-photorealism filter discussed in Q4.
- The trademark the source image plan flags is "Dickies brand overalls with a red logo patch," genericized to "denim bib overalls with a red rectangular chest patch." No visible detail of the art changes.
- Both apps (Gunner the Lab and Holdfast Press StoryReader) are offline-first, so no key reaches the worker or the browser, which is the grounding fact for the keyless / no-secret-at-runtime posture.
<!-- safety-scan-worked-example:end -->
