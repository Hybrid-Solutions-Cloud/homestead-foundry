# SPIKE-19: Where the ARM and Kubernetes seam sits for Foundry Local on Azure Local

Role: foundry-researcher (Opus). Status: research spike complete. No Azure resources created, no spend, no software installed, no cluster touched. First-party documentation review only.
Date: 2026-07-25
Scope: resolve the open decision ADR-0011 left for track 3 ("where the ARM to Kubernetes seam sits is still an open decision"), refresh SPIKE-09 against a documentation set that has changed substantially since it was written, and re-test ADR-0009's three preconditions against current first-party sources. Every factual claim is grounded in a first-party (Microsoft Learn) source, cited inline. Anything Microsoft has not published is marked UNKNOWN with the test or doc that would resolve it. This spike feeds ADR-0014; it authorizes no deployment and no spend.

Grounding read first: `SPIKE-09` (the original Azure Local assessment), `ADR-0009` (the on-prem reviewer track and its three preconditions), `ADR-0011` (which decided track 3's automation form and flagged the seam as open), `ADR-0005` (governing identity ADR), and track 1's Bicep in `infra/` as the pattern track 3 was told to mirror. This spike verifies and corrects against Microsoft Learn; it does not restate those documents.

**Headline: the seam is not a clean two-layer split, and Microsoft's own install sequence proves it.** The deployment interleaves Kubernetes, Helm, and ARM layers in a fixed order, with mandatory Kubernetes-layer prerequisites *underneath* the ARM extension. ADR-0011's track 3 decision 2 describes a stack; the reality is a sandwich. Separately, **a GPU is no longer a hard gate**, which materially loosens ADR-0009 precondition (a).

---

## Question

Seven questions, three carried forward and four new:

1. What is the current product state: preview status, regions, and connected versus disconnected paths?
2. **Where does the ARM to Kubernetes seam actually sit?** (ADR-0011's explicitly open decision)
3. Is a GPU genuinely required, as ADR-0009 precondition (a) assumes?
4. What are the real cluster and node sizing requirements?
5. What is the identity, authentication, and secret surface, and is there a Key Vault path? (SPIKE-09 UNKNOWN #3)
6. How are models actually deployed, and how registry-driven can track 3 be?
7. What should ADR-0014 decide?

---

## Findings

### Q1. Still preview, still by request, but now with a published region list and two distinct deployment paths

- **Preview, by request.** Every current page carries the same notice, and access is gated by a request form: "Foundry Local on Azure Local is available by request during preview. Submit an access request at `https://aka.ms/FoundryLocalAzure_PreviewRequest`." No GA date and no SLA is published. Sources: [Deployment overview for Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-overview), [What is Foundry Local on Azure Local?](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/overview).
- **Eighteen supported regions are now published**, which SPIKE-09 could not cite: Australia East, Canada Central, Central India, Central US, Central US EUAP, East US, East US 2, East US 2 EUAP, Japan East, Korea Central, North Europe, South Central US, Southeast Asia, UK South, West Europe, West US, West US 2, West US 3. Source: [Overview, Supported regions](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/overview#supported-regions). **East US is on the list**, which matters because ADR-0001 and ADR-0004 already put this repo's cloud footprint in East US, so track 3 can be regionally consistent with track 1 with no new region decision.
- **Three deployment paths, not one.** Connected via the Azure Arc extension; connected via a Helm onboarding path "provided during preview onboarding"; and disconnected via Azure Local Disconnected Operations, minimum version `2604.3.0`, where dependencies arrive as expansion packs imported into a local `edgeartifacts` registry rather than pulled from the internet. Source: [Deployment overview](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-overview), [Requirements, Requirements by environment](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#requirements-by-environment).
- **One consequential asymmetry between paths:** Entra ID authentication "isn't available for the Helm chart deployment channel." Source: [Requirements, Resource requirements](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#resource-requirements). Since this repo's identity posture is Entra and managed identity first, the Helm onboarding channel is effectively disqualified for anything but throwaway evaluation. That is a decision ADR-0014 can make cleanly.

### Q2. The seam, resolved: Kubernetes and Helm sit underneath the ARM extension, not only above it

ADR-0011 track 3 decision 2 states: "Bicep owns the Azure-projected resources up to and including the extension install. The in-cluster model intent ... is applied through Kubernetes-native tooling." The first half of that is wrong in an important way. Microsoft's documented install sequence is four ordered steps, and two Kubernetes-layer steps come **before** the extension ARM resource can be created:

| Step | What it installs | Layer | Tooling | Bicep-authorable? |
|---|---|---|---|---|
| 1 | Gateway API CRDs v1.4.0+, then Gateway API Inference Extension CRDs v1.5.0+ | Kubernetes | `kubectl apply --server-side` | No |
| 2 | Istio `istio-base` and `istiod` as the Gateway API provider | Helm | `helm install` | No |
| 3 | cert-manager and trust-manager, as extension `azure-cert-manager`, extensionType `Microsoft.CertManagement` | ARM | `az k8s-extension create` | Yes |
| 4 | Foundry Local, as extension `inference-operator`, extensionType `Microsoft.Foundry` | ARM | `az k8s-extension create` or portal | Yes |
| 5 | `ModelDeployment` (and optionally `Model`) custom resources | Kubernetes | `kubectl apply` | No |

Source for all five: [Deploy Foundry Local as an Azure Arc extension](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-foundry-local-arc-extension).

The ordering is not incidental, and Microsoft calls out the failure mode:

> Install the Gateway API CRDs first, then install Istio as the Gateway API provider. Istio's istiod discovers the CRDs at startup and registers the istio GatewayClass once it sees them. **Installing the CRDs and Istio in the reverse order forces an istiod restart and is reported as flaky on some clusters.**

Source: same page, Step 1. The Inference Extension CRDs must likewise go in "before istiod so istiod picks up InferencePool support at startup," and istiod must be installed with `pilot.env.ENABLE_GATEWAY_API_INFERENCE_EXTENSION=true`, which Microsoft calls "the recommended default" because Endpoint Picker routing is on by default for multi-replica vLLM deployments. There is a documented gate before proceeding: `kubectl get gatewayclass istio` must show `ACCEPTED=True`.

Two further points that sharpen the seam:

- **Foundry Local uses the Gateway API, not an Ingress controller.** "Foundry Local routes model traffic through the Kubernetes Gateway API instead of an Ingress controller. The supported provider is Istio (istio-base + istiod, version 1.29 or later) running as a Gateway API controller." Mesh features are explicitly optional: "sidecar injection, ambient mode, and mesh mTLS are optional and aren't required by the inference operator." Source: same page. This means track 3 inherits a real Istio dependency but not a full service-mesh adoption, which is a much smaller operational commitment than "we now run Istio" would imply, and ADR-0014 should say so.
- **Both ARM steps are `Microsoft.KubernetesConfiguration/extensions` against `--cluster-type connectedClusters`**, so ADR-0011's claim that the extension is Bicep-authorable is correct. What ADR-0011 missed is that authoring it in Bicep does not make the deployment declarative end to end, because steps 1, 2, and 5 cannot be expressed as ARM resources at all.

**Therefore the seam sits in two places, not one.** ADR-0014 should record the honest shape: a Kubernetes and Helm *prerequisite* layer, then an ARM layer of exactly two extensions, then a Kubernetes *intent* layer for models. Bicep owns the middle. A wrapper (script or pipeline) owns the ordering across all three, because nothing in ARM can express "these CRDs must exist and this GatewayClass must be Accepted before this extension is created." The disconnected path changes the mechanism but not the shape: the expansion pack bundles Istio and both CRD sets into the `edgeartifacts` registry, so step 1 and 2 still happen, just from a local source.

### Q3. A GPU is not a hard gate. This loosens ADR-0009 precondition (a)

ADR-0009 precondition (a) requires "GPU-validated Azure Local hardware with a supported NVIDIA card actually present" before any design or deploy work begins, and ADR-0011 inherits that gate unchanged. Current documentation does not support treating it as an absolute prerequisite:

- "Foundry Local on Azure Local supports **CPU-backed and GPU-backed** deployments." And the guidance is explicitly conditional: "Use CPU-backed deployments when the selected model supports CPU inference and meets your performance expectations." Source: [Requirements, Cluster and hardware requirements](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#cluster-and-hardware-requirements).
- "You need a GPU node pool **only** for GPU model variants such as `*-cuda-gpu` and deployments that use `vLLM`." Source: same page.
- The `ModelDeployment` spec takes `compute: cpu` or `compute: gpu` as a first-class required field, and the default runtime `onnx-genai` "Supports both CPU and GPU." Only "vLLM requires `compute: gpu`." Sources: [ModelDeployment and operator configuration reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator), [Inference runtimes in Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes).
- Concrete CPU catalog entries exist, sized reasonably: `Phi-4-mini-instruct-generic-cpu`, roughly 4.8 GB, `CPUExecutionProvider`. Source: [Model catalog and sourcing](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog#image-selection).

Where the GPU requirement remains real:

- **vLLM is GPU-only**, and it is the high-throughput engine. Source: [Inference runtimes](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes).
- **Agentic Retrieval's recommended model needs a GPU.** "The recommended model is **GPT-OSS-20B** via Foundry Local on Azure Local **which requires its own GPU**." Source: [What you need for Agentic Retrieval in Foundry Local](https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/requirements#resource-requirements). So if the RAG half of ADR-0009's ambition is in scope, the GPU gate returns.
- **NVIDIA only, via DDA passthrough.** Supported SKUs are `Standard_NC*_A2`, `Standard_NC*_L4_*`, `Standard_NC*_L40_*`, `Standard_NC*_L40S_*`, `Standard_NC*_RTX6000Pro_*`, and Tesla T4 `Standard_NK*`. "AMD GPUs aren't supported." CUDA drivers must be on the nodes and the NVIDIA Kubernetes device plugin must be configured. Source: [Requirements, GPU requirements](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#cluster-and-hardware-requirements). SPIKE-09's DDA-not-GPU-partitioning finding stands.
- Useful operational detail: "Foundry Local validates GPU compatibility at deployment time and returns a clear error if resources are insufficient." Source: same page.

**Net on Q3:** ADR-0009 precondition (a) should be re-scoped from a blanket gate to a per-workload one. A CPU-only AKS Arc cluster can host a text reviewer on `onnx-genai` today. A GPU is required for vLLM throughput, for `*-cuda-gpu` variants, and for the Agentic Retrieval path. This is the single biggest practical change since SPIKE-09, because it means track 3 can be proven on hardware that does not yet have a GPU installed.

### Q4. Cluster and node sizing, with one trap worth naming

| Requirement | Minimum | Recommended |
|---|---|---|
| Worker node VM size | `Standard_D4s_v3` (4 vCPU / 16 GiB) | `Standard_D8s_v3` (8 vCPU / 32 GiB) |
| Allocatable memory per node | >= 14 GiB | >= 28 GiB |
| Worker node count | 1 | 2 or more (high availability or GPU pool separation) |
| Kubernetes | AKS Arc cluster running 1.29 or later | |

Source: [Requirements, Worker node capacity](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#cluster-and-hardware-requirements) and [Requirements, Software requirements](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#software-requirements).

Explicit warning, worth carrying into ADR-0014 verbatim in substance: "**Don't use the `az aksarc create` default worker size `Standard_A4_v2` (8 GiB). Use at least `Standard_D4s_v3`.**" Source: same page. A default-shaped cluster creation will produce a cluster that cannot run the product.

Two capacity items that are easy to miss:

- **The model cache job is memory-hungry by default.** "The StoreModel cache job is configured with default memory values of **16Gi for requests and 32Gi for limits**," because "downloading and caching them requires substantial memory to prevent out-of-memory (OOM) issues." It is tunable at install time via `storeModel.cacheJob.resources.requests.memory` and `.limits.memory` for small-model or constrained environments. Source: [Deploy as an Azure Arc extension, Additional installation parameters](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-foundry-local-arc-extension). Note the tension: a 32 GiB limit against a recommended 32 GiB node.
- **Multi-replica vLLM adds a per-deployment pod.** "Reserve extra capacity for one Endpoint Picker (EPP) pod per ModelDeployment (about 512 MiB request and 2 GiB limit)." Source: [Requirements](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#cluster-and-hardware-requirements).

**The trap:** `ModelDeployment` default resource values are far too small for a real model. Defaults are `resources.requests.cpu: 100m`, `requests.memory: 256Mi`, `limits.cpu: 1000m`, `limits.memory: 1Gi`. Source: [ModelDeployment reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator). A roughly 4.8 GB CPU model against a 1 GiB memory limit will not run. Any registry-driven generator for track 3 must set resources explicitly per model rather than relying on CRD defaults, and that is exactly the kind of thing a generated manifest gets right and a hand-edited one gets wrong.

### Q5. Identity and secrets: Entra ID is the good path, and there is still no documented Key Vault route

SPIKE-09 UNKNOWN #3 asked for "a documented Azure Key Vault path for the Foundry Local extension's own secrets (API keys)." The answer is now clear enough to close the unknown as **answered in the negative, with a better alternative**:

- **Two auth modes.** API key authentication ("bearer-token style API keys") and Entra ID authentication, which "validates Azure Active Directory JSON web tokens through the Microsoft identity sidecar engine for identity-based access control, as an alternative to API keys." Source: [Overview, How it works](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/overview#how-it-works).
- **API keys live in a Kubernetes Secret, not Key Vault.** "The inference operator generates API keys stored in a Kubernetes Secret. Pass the key as a Bearer token," retrieved from `<your-model>-api-keys` in the `foundry-local-operator` namespace at `.data.primary-key`. Sources: [Inference operator and model lifecycle](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-operator#generative-models), [Run inference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/how-to-run-inference#run-inference-with-a-bring-your-own-byo-model). No Key Vault or CSI secret-store integration is documented anywhere in the current set.
- **Entra ID authorization resolves to Azure RBAC, and uses a managed-identity adapter.** With Entra auth enabled, "the Entra Auth SDK sidecar and **msi-adapter** sidecar are injected into inference pods for JWT validation and **ARM RBAC authorization**," and authorization "is then evaluated by using Azure role-based access control (Azure RBAC)." Sources: [Deploy as an Azure Arc extension, Additional installation parameters](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-foundry-local-arc-extension), [Glossary](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/glossary#i).

**The clean conclusion for ADR-0014:** choose Entra ID authentication and the question of where to store an API key disappears, which satisfies ADR-0005's managed-identity-first stance far better than any Key Vault workaround would. Entra auth is the default (`entraAuth.enabled` default `true`) and requires an app registration plus `entraAuth.tenantId` and `entraAuth.clientId` at install. It is also a **forward-compatibility gate**: "If you plan to use Foundry Local models with Agentic Retrieval, you must keep Entra ID authentication enabled," and disabling it "prevent[s] Agentic Retrieval from connecting to your deployed models." Sources: [Requirements, Resource requirements](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#resource-requirements), [Deploy as an Azure Arc extension](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-foundry-local-arc-extension). Since ADR-0009 contemplates RAG, disabling Entra auth would foreclose that option later. Enable it from the start.

Also required, and not mentioned in SPIKE-09 or ADR-0011: a **TLS termination certificate** "signed by a company-specific certification authority (CA) or a well-known public CA," with self-signed explicitly discouraged for production. Each `ModelDeployment` pod also carries an NGINX sidecar for TLS termination and request proxying. Sources: [Requirements, Resource requirements](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#resource-requirements), [Glossary](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/glossary#i).

### Q6. Model deployment is genuinely declarative and genuinely registry-friendly

This is the part of ADR-0011 that ages best. Track 3's model layer maps cleanly onto track 1's registry-driven pattern.

- **Three CRDs, two user-facing.** `Model` (short name `mdl`) defines a BYO model source and metadata; `ModelDeployment` (`mdep`) "creates a running inference endpoint with all child resources"; `StoreModel` (`sm`) is internal and tracks caching state. Source: [Inference operator and model lifecycle](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-operator).
- **Catalog models need no `Model` CR at all.** "For quick deployments, you can skip creating a Model resource. The ModelDeployment can reference catalog models directly, and the operator resolves them from the catalog ConfigMap." This is "lazy registration," enabled by default. Sources: same page, [Glossary](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/glossary#i). So a registry-driven generator for track 3 needs to emit only `ModelDeployment` manifests for catalog models, which is a very small surface.
- **The catalog is a ConfigMap kept current by a sync component.** `foundry-local-catalog` in the operator namespace, maintained by catalog-sync against the Foundry catalog API. Source: [Glossary](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/glossary#i).
- **Runtime is inferred from the catalog, not hand-set.** "The model you choose determines the runtime ... the operator reads the framework from the catalog and automatically selects the correct container image and configuration. You don't need to set the runtime manually for catalog models." For BYO models, set `spec.runtime`. Source: [Inference runtimes](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes).
- **The spec fields a generator would need** are modest: `model.catalog.name` and optional `.version` (default `latest`), `workloadType` (`generative` or `predictive`), `compute` (`cpu` or `gpu`), `replicas` (1 to 100, default 1), `port` (default 8080), the four `resources` values, `resources.limits.gpu` (0 to 8), `runtime`, and for GPU nodes `skipGpuResource`, `nodeSelector`, and `tolerations`. Source: [ModelDeployment reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator), [Inference operator, GPU deployment options](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-operator#predictive-models).
- **Endpoints are OpenAI-compatible.** `/v1/chat/completions` for generative, `/v1/predict` for predictive. The operator runs a reconciliation loop with a 30-second health timer. Sources: [Inference operator](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-operator).
- **Exposure is a deliberate two-level choice.** `api.exposure` controls the operator's own Inference API control-plane endpoint (`internal` default, `external`, or `none`); `spec.endpoint.exposure` controls individual model data-plane endpoints. Source: [Deploy as an Azure Arc extension](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-foundry-local-arc-extension).
- **Predictive workloads are BYO-only.** "The preview doesn't include a broad catalog of predictive models," and "Predictive workloads don't support catalog models." Sources: [Inference operator, Predictive models](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-operator#predictive-models), [Model catalog, Image selection](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog#image-selection). Not relevant to this repo's reviewer use case, but it bounds what "registry-driven" can mean here.

SPIKE-09's UNKNOWN #1 (a vision-capable catalog model for image grading) is **not** resolved by the current docs. The supported-workload list remains generative text and predictive/classification, with no named vision LLM for grading generated art. It stays open.

### Q7. What ADR-0014 has to decide

Five things, in rough order of consequence:

1. The three-layer deployment shape and who owns ordering (Q2).
2. Whether GPU is a gate for the first increment or only for the vLLM and RAG increments (Q3).
3. Entra ID authentication as the auth mode, which also settles the secret question and preserves the RAG option (Q5).
4. Whether track 3's first increment is CPU-only text reviewer inference, deferring GPU and Agentic Retrieval.
5. That the model layer is registry-driven via generated `ModelDeployment` manifests with explicit resource values, never CRD defaults (Q6).

---

## The three ADR-0009 gates, stated explicitly

The tasking asks for pass or fail on each. Here it is, with the honest status of each and what would settle it. **Two of the three cannot be closed from documentation and need a check against the live environment, which this spike did not perform and does not claim to have performed.**

| # | ADR-0009 gate | Status | Why |
|---|---|---|---|
| a | GPU-validated Azure Local hardware with a supported NVIDIA card present | **PASS by amendment, not by hardware** | The gate itself is no longer required for the first increment. Current documentation makes CPU-backed deployments a first-class path and confines the GPU requirement to `*-cuda-gpu` variants, vLLM, and Agentic Retrieval. If the scope later includes any of those, this gate returns as a hard **FAIL until hardware is confirmed**, because whether a supported NVIDIA card is physically installed has not been checked. |
| b | AKS Arc cluster with a GPU-enabled Linux node pool using DDA passthrough | **UNVERIFIED, and partly relaxed** | The GPU-enabled part is relaxed by the same amendment: the first increment needs a non-GPU worker pool at `Standard_D8s_v3` or better. The cluster itself is still required and is **not confirmed to exist**. Kubernetes 1.29 or later is now also required, which ADR-0009 predates. Settled by querying the environment for an AKS Arc cluster and its version and node sizes. |
| c | Preview access approval for the Foundry Local Arc extension | **FAIL, not requested** | Still public preview by request at `aka.ms/FoundryLocalAzure_PreviewRequest`, with no SLA and no published GA date. No request has been submitted. This is the only gate that is unambiguously not met, and it is also the cheapest to fix: the request is free and reversible. |

**Net on the gates: one is retired for the first increment, one is unverified and needs an environment check, and one is simply not requested yet.** Only gate (c) blocks unconditionally, and it blocks on an email rather than on hardware or budget. That is a materially better position than ADR-0009 implies, where all three read as hard hardware-and-approval gates in series.

The two unverified items (does an AKS Arc cluster exist, and is supported GPU hardware physically present) are environment questions, not research questions. They are listed in the UNKNOWN table below rather than guessed at here.

## What is still UNKNOWN

| # | Unknown | Why it is not in the docs | What resolves it |
|---|---|---|---|
| 1 | **A vision-capable catalog model for the image-grading reviewer role.** Carried unchanged from SPIKE-09 UNKNOWN #1. | Supported workloads are generative text and predictive/classification; no vision LLM is named. | Read the live catalog ConfigMap (`kubectl get configmap foundry-local-catalog -n foundry-local-operator -o yaml`) once a cluster exists, or the catalog API, for a multimodal entry, then test image input on `/v1/chat/completions`. |
| 2 | **Preview-to-GA timeline and SLA.** | Public preview by request, no GA date published. | Watch the overview and deployment pages. Any production reliance waits on GA or an explicitly accepted preview-risk decision, the same posture already accepted for the cloud MAI models. |
| 3 | **Exact current per-physical-core price for Azure Local.** Carried from SPIKE-09 UNKNOWN #2. | The per-core model is first-party; the dollar figures came from secondary sources. | Read `azure.microsoft.com/pricing/details/azure-local/` live or get a rep quote at design time. |
| 4 | **Whether the owner's actual Azure Local release supports the GPU SKUs in scope.** Carried from SPIKE-09 UNKNOWN #4. | GPU support is release-gated. | Check the owner's Azure Local build number against the current GPU SKU matrix at design time. Deferrable if the first increment is CPU-only, per Q3. |
| 5 | **Whether an AKS Arc cluster plus node pools can be fully expressed in Bicep, or whether `az aksarc` is required in practice.** | ADR-0011 asserts Bicep for the cluster; the current Foundry Local docs consistently use `az aksarc` and `az k8s-extension` in every example and never show Bicep. | Author a minimal Bicep template for the AKS Arc cluster and a node pool and run `what-if` against a real Azure Local custom location. This is the one remaining piece of ADR-0011's declarative claim that is untested. |
| 6 | **Whether the `Microsoft.CertManagement` extension conflicts with an existing cert-manager on the cluster.** | The docs give the install command but do not discuss coexistence with a pre-existing cert-manager. | Check for an existing cert-manager before installing; test on a non-production cluster, which the docs recommend generally. |
| 6a | **Does an AKS Arc cluster actually exist in the target environment, and at what Kubernetes version and node size?** (gate b) | An environment question, not a documentation one. This spike performed no live environment check. | `az aksarc list` and `az connectedk8s list` against the target subscription, then compare the Kubernetes version against the 1.29 minimum and the worker size against `Standard_D4s_v3` minimum / `Standard_D8s_v3` recommended. Read-only. |
| 6b | **Is supported NVIDIA GPU hardware physically present on the Azure Local nodes?** (gate a, if GPU scope returns) | Same. Hardware inventory is not discoverable from documentation. | Check the physical node inventory against the supported DDA SKU list. Only needed if the scope grows to vLLM, `*-cuda-gpu` variants, or Agentic Retrieval. Not needed for the CPU-only first increment. |
| 7 | **Real CPU inference latency for a ~5 GB model on a `Standard_D8s_v3` worker.** | No latency or throughput table is published for CPU-backed deployments. | Measure after the first increment deploys. Shares the shape of SPIKE-18 UNKNOWN #2, and the two results are worth comparing since they are the same model class on different hosting. |

---

## Recommendation

1. **Write ADR-0014 to record the three-layer deployment shape and correct ADR-0011's track 3 decision 2.** The honest shape is: a Kubernetes and Helm prerequisite layer (Gateway API CRDs, Inference Extension CRDs, Istio, in that order, with the `gatewayclass istio` Accepted check as the gate), then an ARM layer of exactly two `Microsoft.KubernetesConfiguration/extensions` resources (`Microsoft.CertManagement`, then `Microsoft.Foundry`), then a Kubernetes intent layer of generated `ModelDeployment` manifests. Bicep owns the middle layer only. An ordering wrapper owns the sequence, because ARM cannot express the cross-layer dependencies. ADR-0011's substantive choice (declarative Bicep for the Azure-projected surface) survives; its description of the boundary does not.

2. **Re-scope ADR-0009 precondition (a) from a blanket GPU gate to a per-workload one.** A CPU-only AKS Arc cluster on `Standard_D8s_v3` workers can host a text reviewer on the default `onnx-genai` runtime today. GPU becomes mandatory for vLLM throughput, for `*-cuda-gpu` variants, and for the Agentic Retrieval path with GPT-OSS-20B. This is the change that unblocks track 3 from a hardware purchase, and it should be stated as an amendment to ADR-0009 rather than buried in ADR-0014, so the gate is not re-imposed by someone reading only ADR-0009.

3. **Scope track 3's first increment to CPU-only text reviewer inference, with Entra ID authentication enabled.** Concretely: an AKS Arc cluster with a non-GPU worker pool at `Standard_D8s_v3` or better, Kubernetes 1.29 or later, the prerequisite layer, both extensions, and one `ModelDeployment` for a CPU catalog model in the Phi-4-mini class with explicit resource values. That increment proves the entire automation pattern, needs no GPU, needs no new region (East US is supported and matches ADR-0001), and leaves both vLLM and RAG as clean later increments.

4. **Choose Entra ID authentication, and record that it is also a forward-compatibility decision.** It resolves the Key Vault question by removing the API key entirely, aligns with ADR-0005, and it must be enabled at install time to keep Agentic Retrieval possible later. This also disqualifies the Helm onboarding channel, which does not support Entra auth. Note that a real TLS certificate from a company or public CA is a separate requirement, and self-signed is explicitly discouraged for production.

5. **Make the model layer registry-driven with explicit resource values, and never rely on `ModelDeployment` defaults.** The defaults (256Mi request, 1Gi limit) cannot run a roughly 4.8 GB model. Generate manifests from the same registry that drives track 1 so the two tracks share one source of truth for which models exist, with per-track fields (`compute`, `workloadType`, resources, replicas) as registry data. Because catalog models are lazily registered, only `ModelDeployment` needs generating, not `Model`.

6. **Close SPIKE-09 UNKNOWN #3 as answered: there is no Key Vault path, and none is needed.** Record this in ADR-0014 rather than leaving it as a standing open question, since the Entra ID decision makes it moot.

7. **Resolve UNKNOWN #5 before committing to Bicep for the cluster itself.** Every current first-party example uses `az aksarc` and `az k8s-extension`, never Bicep. ADR-0011 asserted Bicep for the AKS Arc cluster and node pools without testing it. A minimal template plus `what-if` against a real custom location settles it, and if Bicep cannot express the cluster cleanly, ADR-0014 should say so and put the cluster in the wrapper layer alongside the CRDs. That would be a narrowing of ADR-0011, not a reversal: the extensions remain declarative either way.

8. **Sequence track 3 after track 2's install test, not before.** Track 2's outstanding work is one authorized install test on hardware this project already owns (SPIKE-18). Track 3's first increment needs an AKS Arc cluster and preview access approval, both of which have lead time. Submit the preview access request now, since it is free, reversible, and gates everything else in this track, and do it in parallel with track 2's test rather than serially after it.

Net: ADR-0011 got track 3's automation form substantially right and its layer boundary wrong, and it inherited a GPU gate from ADR-0009 that current documentation no longer justifies as absolute. The seam question that ADR-0011 left open is now answerable in one table. The track's real blockers are a preview access request and an AKS Arc cluster, not a GPU purchase.

---

## Sources

All first-party Microsoft Learn. Retrieved 2026-07-25.

- What is Foundry Local on Azure Local? (preview status, supported regions, supported workloads, how it works, auth modes, prerequisites scope): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/overview>
- Deployment overview for Foundry Local on Azure Local (three deployment paths, availability during preview): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-overview>
- Requirements for Foundry Local on Azure Local (Azure and on-prem resources, Entra permissions, TLS certificate, connected versus disconnected table, cluster and hardware requirements, worker node capacity, GPU SKU matrix, software requirements, network requirements, the `Standard_A4_v2` warning, EPP capacity): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements>
- Deploy Foundry Local as an Azure Arc extension (the four ordered install steps, Gateway API and Istio ordering and flakiness warning, GatewayClass check, cert-manager extension command, Foundry extension command, `entraAuth` parameters, `watch.namespaces`, `storeModel.cacheJob.resources`, `api.exposure`, portal path, verification and troubleshooting commands): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-foundry-local-arc-extension>
- Inference operator and model lifecycle in Foundry Local on Azure Local (operator responsibilities, reconciliation loop, the three CRDs, lazy registration, generative and predictive models, GPU deployment options, endpoints, API keys in a Kubernetes Secret): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-operator>
- ModelDeployment and operator configuration reference for Foundry Local (full spec field table and defaults, operator configuration, gateway naming and GatewayClass defaults): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator>
- Model catalog and sourcing in Foundry Local (image selection matrix, runtimes, the Phi-4-mini three-entry example with sizes and execution providers): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog>
- Inference runtimes in Foundry Local on Azure Local (runtime selection from the catalog framework field, vLLM GPU-only): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes>
- Run inference on Foundry Local (API key retrieval from the Kubernetes Secret, Entra JWT option, BYO deployment flow, model cache sizing): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/how-to-run-inference>
- Glossary for Foundry Local on Azure Local (inference operator, lazy registration, Entra ID authentication and Azure RBAC, model catalog ConfigMap, NGINX sidecar, multi-node deployment): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/glossary>
- Prepare to deploy Foundry Local on Azure Local in disconnected environments (ALDO minimum version, expansion pack prerequisites, mirrored device plugin): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/disconnected-operations/how-to-prepare>
- Foundry Local on Azure Local in disconnected environments overview (how disconnected differs): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/disconnected-operations/concept-overview>
- What you need for Agentic Retrieval in Foundry Local (GPT-OSS-20B recommendation and its GPU requirement, MetalLB and NFS resource requirements, Entra and AKS Arc permissions): <https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/requirements>
- What is Foundry Local? (the device product, and Microsoft's own routing of enterprise-scale inference to Azure Local): <https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local>
