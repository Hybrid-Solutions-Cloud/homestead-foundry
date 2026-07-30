# Deployment targets

"Azure AI Foundry" is not one product. It is a family that spans a hosted cloud
service, an on-device runtime, and a Kubernetes-native on-premises stack. This
repository's methodology covers all three, and they differ in ways that matter
before you pick one: they do not run the same models, they do not expose the same
features, they are not governed the same way, and they are not deployed by the
same mechanism.

This page compares them. [Choosing a target](./choosing) is the same comparison
as prose, for readers who want the reasoning rather than the grid.

## The three targets

| Target | Slug | What it is | Runs on |
|---|---|---|---|
| **Azure AI Foundry** | [`azure-cloud`](./azure-cloud/) | The hosted Azure service, `Microsoft.CognitiveServices/accounts` of kind `AIServices` | Microsoft's Azure regions |
| **Foundry Local** | [`windows-server`](./windows-server/) | The on-device runtime | One Windows Server you own, Arc-enabled |
| **Azure Local Foundry** | [`azure-local`](./azure-local/) | Foundry Local at cluster scale, via the `Microsoft.Foundry` cluster extension | An Arc-connected AKS Arc cluster on your own hardware |

Each target is named for its Microsoft product, and the slug is its URL on this
site. Those are the only two names for each target. Decision records written
before [ADR-0017](../adr/ADR-0017-deployment-target-documentation-structure.md)
call these targets track 1, track 2, and track 3, numbering that comes from
[ADR-0011](../adr/ADR-0011-multi-target-deployment-automation.md); the numbers
survive in those records and in the research spikes, and map to this table in
order.

::: warning How to read the cells
Every cell below is a fact with a first-party source behind it. There are no
blank cells and no hedges.

**As of 2026-07-30 there are no `UNKNOWN` cells left.** Earlier revisions of this
page carried `UNKNOWN (SPIKE-nn)` markers naming the research that would close
them; that research is now written and every marker has been resolved into an
answer. Several of those answers **contradicted what this page previously said**,
most consequentially on TLS, on hardware sizing, on Azure Local Foundry's
endpoint authentication, and on content safety. Where a cell says "none" or "not
documented", that is a finding, not a gap in the research.

A "no" here means Microsoft does not document the capability. It does not mean
the capability is impossible to build yourself.
:::

::: info One column is observed, two are designed
**Only the Azure AI Foundry column describes something that exists.** It is drawn
from an environment this repository actually deployed and smoke-tested.

The Foundry Local and Azure Local Foundry columns describe **designs, not
systems.** They are drawn from first-party research and accepted decisions, and
nothing behind them has been built, deployed, or automated. Every cell in those
two columns is what the documentation says *should* happen, not something anyone
here has observed happening.

So: **do not read a filled cell as a working cell.** Table 1's "status in this
repo" row repeats this per target, and so does every per-target page.
:::

## 1. At a glance

| | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| Microsoft product | Azure AI Foundry, `Microsoft.CognitiveServices/accounts` of kind `AIServices` | Foundry Local | Foundry Local on Azure Local, via the `Microsoft.Foundry` cluster extension |
| Where it runs | Azure region (this repo: East US) | One Windows Server in your own facility | An AKS Arc cluster on Azure Local hardware in your own facility |
| Scale unit | Foundry account | Host | Cluster |
| Azure subscription required | Yes | For Arc governance of the host, yes. The runtime itself needs none. | Yes |
| Product maturity | GA, with individual models in preview | GA | Public preview, access by request. No SLA and no GA date. |
| Where inference actually runs | In the Azure region you chose | On your server, in your building | On your cluster, in your building |
| Region constraint | Per-model region availability, and it governs where inference runs | None. It is not an Azure resource. | **None for inference.** The Azure *resource* registers into one of eighteen supported regions (East US among them), which sets where its metadata and billing live, not where inference happens |
| Status in this repo | **Built and running.** Deployed from the Bicep in this repo, live, and smoke-tested end to end. | **Designed on paper only.** The research and the decisions are done, but nothing has been built, deployed, or automated. | **Designed on paper only.** The research and the decisions are done, but nothing has been built, deployed, or automated. |
| Governing ADRs | [0001](../adr/ADR-0001-target-tenant), [0004](../adr/ADR-0004-foundry-topology-and-region), [0005](../adr/ADR-0005-identity-and-secrets), [0006](../adr/ADR-0006-cost-governance), [0011](../adr/ADR-0011-multi-target-deployment-automation) | [0011](../adr/ADR-0011-multi-target-deployment-automation), [0013](../adr/ADR-0013-foundry-local-windows-server-install) | [0009](../adr/ADR-0009-azure-local-reviewer-track), [0011](../adr/ADR-0011-multi-target-deployment-automation), [0014](../adr/ADR-0014-foundry-local-azure-local-deployment-layers) |
| Governing spikes | [01](../research/SPIKE-01-image-model), [02](../research/SPIKE-02-voice-model), [03](../research/SPIKE-03-tenant-readiness), [04](../research/SPIKE-04-identity-security), [05](../research/SPIKE-05-cost-governance) | [08](../research/SPIKE-08-foundry-local-on-device), [18](../research/SPIKE-18-foundry-local-windows-server) | [09](../research/SPIKE-09-azure-local-foundry), [19](../research/SPIKE-19-foundry-local-azure-local-deployment) |

## 2. Models and modalities

This is the table most readers come for, and it is where the three targets differ
most. The rosters are close to disjoint. Nothing in this repository's cloud model
catalog runs on either on-premises target.

| Capability | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| Text and chat | Yes | Yes | Yes |
| Reasoning | Yes, frontier-class hosted models | Small-model only, quality bounded by the host | Yes, up to `gpt-oss-20b` class with GPU |
| Vision input | Yes | **No.** No vision-capable entry in its catalog | **Yes**, and it is the only on-premises option: `pixtral-12b-2409` and three `nemotron-nano-12b-v2-vl` variants, all vLLM and GPU only |
| Image generation | Yes. MAI-Image family and FLUX family. | No | No |
| Video generation | No. Evaluated and rejected; see the catalog. | No | No |
| Text to speech | Yes. MAI-Voice-2 and the Azure neural voices. | No | No |
| Speech to text | Yes | **Yes.** Five Whisper sizes plus three NVIDIA streaming ASR models | **Yes.** Five Whisper sizes plus one NVIDIA streaming ASR model |
| Embeddings | Yes | **No** | **No** |
| Open-weight models | Available in the catalog | The only kind available | The only kind available |
| Proprietary frontier models | Yes | No | No |
| Model source | The Azure model catalog | The Foundry Local catalog | The Foundry Local catalog, via `ModelDeployment` custom resources |
| Catalog size | 258 entries in East US alone, and it changes continuously | 70 entries, 35 aliases | 170 entries: the same 35 shared aliases plus a 100-entry vLLM roster of its own |
| Published hardware minimum | Not applicable. Capacity is a quota and SKU question. | **None. Microsoft publishes no CPU, RAM, or disk minimum at all** for Foundry Local on Windows; the prerequisites name an OS build, a .NET SDK, and a GPU, and nothing else (SPIKE-25) | Sized by the cluster. GPU support is gated by Azure Local release number, and the release that added each NVIDIA model is published |
| Largest practical model, default hardware | Not host-bound. | A roughly 5 GB quantized 4B-class model on CPU was measured on one 64 GB host. **Treat that as one observation, not a rule:** SPIKE-18's "core count, not RAM" claim is not supported by any first-party statement, and Microsoft's own troubleshooting guidance points at RAM (SPIKE-25) | CPU first increment is the `Phi-4-mini-instruct-generic-cpu` class. GPU raises it; the vLLM roster publishes GPU memory for five entries, up to 14.793 GB for `gpt-oss-20b` |
| Execution | Hosted. Not your concern. | ONNX Runtime. CPU, CUDA GPU, AMD Vitis NPU, Qualcomm QNN NPU, Intel OpenVINO, WebGPU, or TensorRT RTX. | ONNX-GenAI or vLLM, CPU or NVIDIA GPU via DDA. AMD unsupported. |
| Models in this repo's roster | 22 marked deployed in the registry, 20 live on the account | None yet (ADR-0019) | None yet (ADR-0019) |
| Catalog page | [Model catalog](../reference/model-catalog), and [what is available](../reference/model-availability-azure-cloud) | [Available models, both on-premises targets](../reference/model-catalog-foundry-local) | [Available models, both on-premises targets](../reference/model-catalog-foundry-local) |

## 3. Features and platform capabilities

::: danger Moving a workload off the cloud silently drops every safety control
**Neither on-premises target documents any content filtering or responsible-AI
guardrail.** Not a weaker filter, not an optional one: none. Everything
[ADR-0007](../adr/ADR-0007-content-safety-and-responsible-ai) relies on is a
property of the hosted service, and it does not travel with the model.

An adopter who moves a workload from Azure AI Foundry to either on-premises
target loses prompt and completion classification, the four harm categories, the
`content_filter` finish reason, and the HTTP 400 rejection path, and gets no
warning that it happened. If content safety is a requirement, it has to be
rebuilt in the application layer before that move, not after. Source:
[SPIKE-31](../research/SPIKE-31-cross-track-feature-parity) Q8.
:::

| Feature | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| OpenAI-compatible chat completions | Yes | Yes | Yes |
| Foundry Agent Service | Yes. Prompt agents and hosted agents, needing a project rather than just an account. | **No.** Bring your own runtime and point it at the endpoint | **No** |
| MCP tool gateway | First-class, plus APIM governance gated to a future phase by [ADR-0012](../adr/ADR-0012-agent-mcp-gateway-governance) | **No.** No MCP surface documented. Tool calling works at the API level, so an agent loop can orchestrate its own tools | **No** |
| RAG and retrieval | Bring your own, plus Azure AI Search | Bring your own | Agentic Retrieval, which requires GPU and `gpt-oss-20b` |
| Fine-tuning | Yes. Supervised, DPO, and reinforcement fine-tuning, per model. | **No training service.** You can convert and optimize a model with Olive, or bring one fine-tuned elsewhere | **No training service.** You can bring a custom model from an OCI registry via `spec.model.custom` |
| Batch inference | Yes, a real Batch API with its own enqueued-token quota | **No.** Microsoft states plainly that continuous batching is a capability Foundry Local does not provide | **No batch job API.** vLLM gives serving-tier throughput, which is not the same thing |
| Structured outputs (`json_schema`) | Yes, strict schema adherence | **Not documented** on chat completions | **Not documented** |
| Content safety and responsible AI filters | Yes. Mandatory, on by default, four categories across four severity levels, per deployment ([ADR-0007](../adr/ADR-0007-content-safety-and-responsible-ai)) | **None documented, at all.** | **None documented, at all.** |
| Quotas and rate limits | Yes, per deployment and region | None. Bounded by the host. | None. Bounded by the cluster. |
| Concurrent multi-user serving | Yes | Not its design point | Yes, that is its design point |
| Disconnected or air-gapped operation | No | Yes, once the model cache is populated | Yes, via the Azure Local disconnected operations appliance, version `2604.3.0` or later |
| Data residency | The chosen Azure region | Your building | Your building |
| Portal or UI surface | Azure portal and the Foundry portal | None. CLI and API only. | Azure portal via Arc for the cluster. No Foundry portal surface. |
| Local CLI | Not required | `foundry` CLI | `kubectl` plus the Azure CLI |

## 4. Deployment and automation

| Aspect | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| Automation form | Declarative | Imperative | Declarative for one layer, imperative for two |
| Layers | One | One | Three: Kubernetes prerequisites, ARM platform, Kubernetes intent |
| IaC surface | Bicep at subscription scope, single resource group | Arc run command, with Arc SSH as fallback | Bicep owns the platform layer only. `kubectl` and Helm own the layers above and below it. |
| Repo path | [`infra/`](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/tree/main/infra) | `infra/windows-server/`, pending phase P | `infra/azure-local/`, pending phase P |
| Ordering wrapper required | No | No | Yes, and [ADR-0014](../adr/ADR-0014-foundry-local-azure-local-deployment-layers) calls it a first-class deliverable, not glue |
| Install mechanism | ARM deployment | Machine-wide MSIX provisioning via `Add-AppxProvisionedPackage -Online`. Not `winget`, which blocks MSIX machine-scope installs. | Two cluster extensions, `Microsoft.CertManagement` and `Microsoft.Foundry`, over a Gateway API and Istio base |
| Idempotent redeploy | Yes, wipe and redeploy safe | Yes by contract: four check-before-act stages, with the on-disk model cache as the unit of state | Per layer. Not established end to end. |
| Drift detection | `az deployment sub what-if` sees everything | **Arc run command cannot detect state at all**, only run an action. Machine configuration is the mechanism ADR-0013 is missing (SPIKE-29) | Split three ways, because `what-if` sees only the middle layer |
| Prerequisite | An Azure subscription and two Entra security groups | Arc-enable the server first. Hard prerequisite, not optional. | An AKS Arc cluster, preview access granted, **and a working LoadBalancer implementation, which AKS Arc does not have by default** (SPIKE-28) |
| Teardown | Delete the resource group | Uninstall script, pending phase P | **Leaves residue, some of it by design** (SPIKE-29 Q9) |
| Deploy gate | Owner-gated. Proven. | Two read-only resolutions, then one owner-authorized install test on a disposable build VM | Preview access request, then a `what-if` test |
| Automation status in this repo | Complete and proven | Not written | Not written |

## 5. Identity, authentication, and secrets

| Aspect | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| Deploy-time principal | User-assigned managed identity, federated to GitHub via OIDC | Same, for the Arc run command. A service principal is accepted for Arc onboarding only. | Same |
| Runtime identity | Managed identity | Arc system-assigned managed identity. User-assigned is not supported on Arc machines. | Managed identity |
| Endpoint authentication | Entra ID, or API key | **None at all.** The service listens locally and is not authenticated | **Two modes, both mandatory:** an Entra ID token, or an API key |
| Azure RBAC on the endpoint | Yes | No | **Only on the Entra path. The API-key path bypasses Azure RBAC entirely** (SPIKE-31) |
| Key Vault path | Yes, secrets referenced by name | None by default. See the exception below. | Yes |
| Inbound network ports | Azure-managed HTTPS endpoint | None opened. Arc dials out. | Cluster ingress via the Gateway API. `exposure: external` additionally needs a LoadBalancer the cluster does not provide by default |
| TLS certificate | Azure-managed | Not applicable | **Self-signed is the default and mandatory mechanism for all internal traffic:** cert-manager mints a self-signed cluster root CA on first deployment and every model sidecar chains to it. A real CA certificate is needed **only** for the external Gateway, and only when off-cluster clients cannot be made to trust the cluster CA (SPIKE-28) |
| Exceptions to [ADR-0005](../adr/ADR-0005-identity-and-secrets) | None | One, scoped and time-boxed: Arc run command cannot authenticate to blob storage with a managed identity, so a shared access signature of 24 hours or less is permitted for the optional blob staging path. The default path uses no blob and therefore has no secret surface at all. | None |
| Honest summary | Full Azure governance | Arc governs installing and managing the host, not the running inference endpoint. That endpoint has no Azure RBAC, no Entra, no Key Vault, no budget, and no Azure Monitor. | Full Azure governance via Arc **on the Entra path only.** Issue an API key instead and the endpoint is outside Azure RBAC. |

## 6. Cost model

| Aspect | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| Billing unit | Per token or per image, per deployment | None for the runtime | Per physical core of the Azure Local host, per day |
| Fixed or variable | Variable, driven by usage | Fixed. Hardware you already own. | Fixed, driven by core count rather than usage |
| Azure spend for the runtime itself | Yes | No. Arc run command is free; storing scripts in Azure is not. | Yes, the Azure Local host fee |
| Windows Server guest licensing | Not applicable | Existing host licence | **23.30 USD per physical core per month**, waived by Azure Hybrid Benefit |
| Exact rates | Published per model | Not applicable | **0.33 (L1), 0.667 (L2), 1.67 (disconnected) USD per physical core per day**, roughly 9.90 / 20.01 / 50.10 per 30-day month (SPIKE-26) |
| Azure Hybrid Benefit | Not applicable | Not applicable | **Not a discount.** It is a separate SKU rated 0.00 that waives the host fee and the guest subscription together, and it applies to L1 only |
| Hardware capital cost | None | Yours | Yours |
| Marginal cost of one more model | A new deployment, then per-token | Disk in the model cache | Cluster resources only |
| Marginal cost of one more request | Real and metered | Zero | Zero |
| Budget and alerting | Resource-group budget with alert thresholds ([ADR-0006](../adr/ADR-0006-cost-governance)) | **No Azure resource exists to cap, and no metered call exists to guard.** Only the subscription spending limit transfers | The fee is set by core count and does not move with usage, so a budget rule cannot bind it. Only the subscription spending limit transfers |
| Where a hard cap can be enforced | Azure budget plus per-deployment capacity | Nowhere in Azure. The cap is the hardware. | Nowhere usage-based. The cap is the core count you registered. |
| Cost of doing nothing | Zero. Idle deployments do not bill. | Zero | **Not zero, and it does not stop on its own: billing continues for 31 days after disconnection unless the ARM resource is deleted.** A decommission step is a real control, not hygiene (SPIKE-26) |

## 7. Observability

| Signal | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| Azure Monitor platform metrics | Yes | **None.** `Microsoft.HybridCompute` has no platform metrics at all, so even host CPU and memory need the Azure Monitor Agent, a DCR, and per-GB ingestion | Yes for the infrastructure. More than sixty standard Azure Local metrics at no extra cost. |
| Diagnostic settings to Log Analytics | Yes | Host only, via AMA, billed per GB | Infrastructure only. Container insights and managed Prometheus are supported, and both bill on volume |
| Application Insights | Yes | No | No |
| Managed Prometheus and Grafana | Yes, deployed | No | Supported for the cluster, but deferred by design until a Prometheus-capable workload exists |
| **Token-usage metrics** | Yes, native Foundry metrics ([ADR-0016](../adr/ADR-0016-foundry-model-usage-observability)) | **None. The product emits no metric of any kind** | **None. No documented Azure Monitor or Prometheus metric exists for a `ModelDeployment`:** no request count, no latency, no token count |
| Request count, latency, error rate | Yes | **None** | **None** |
| Alerting | Metric, activity-log, and scheduled-query alerts, deployed | Host only. No Azure surface for the service. | Infrastructure only. **Neither on-premises target can alert on a model.** |
| Availability test or health probe | Yes, deployed | `foundry service status`, locally. The port is assigned dynamically at each start, so there is no static probe target | Cluster-level probes only |
| Audit trail of deployment actions | Azure activity log | Arc run command instance view, output truncated to the last 4 KB | Azure activity log via Arc |
| Who called the endpoint | Entra identity in the logs | **Unknowable.** No authentication means no caller identity exists to record | Entra path only. An API-key caller is not attributable. |
| Prompt and content capture | Not captured | Must remain metadata-only and opt-in | Must remain metadata-only and opt-in |
| What has no Azure surface at all | Nothing material | The running service, request volume, latency, errors, tokens, which model is loaded, and cache state. **The entire model-usage row of the observability design is empty** | The `ModelDeployment` itself. Infrastructure is well covered; the model serving it is not |

::: warning Neither on-premises target reaches ADR-0016's bar
[ADR-0016](../adr/ADR-0016-foundry-model-usage-observability) is built on native
token-usage metrics. Those exist only on Azure AI Foundry. On Foundry Local the
product emits no metric at all, and on Azure Local Foundry the infrastructure is
richly instrumented while the model deployment has no documented metric of any
kind. Full per-signal gap list:
[SPIKE-27](../research/SPIKE-27-local-track-observability) Q9.
:::

## 8. Operations and lifecycle

| Aspect | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| Runtime patching | Microsoft's problem | **No documented update path exists for the MSIX install mechanism ADR-0013 selected** (SPIKE-29 Q1) | Cluster extension versions, plus AKS Arc and Kubernetes upgrades. The generic extension mechanism is documented; the Foundry-specific one is not. |
| Model updates | Automatic version upgrade, preserved by default | Re-pull into the model cache. **No version pinning at all:** the CLI's "model ID" is a hardware variant, not a version | A new `ModelDeployment` revision |
| Upgrade ordering constraints | None | None documented | **Severe, and only half documented.** Install ordering is published, upgrade ordering is not. An AKS Arc upgrade is a rolling node replacement that necessarily restarts `istiod`, which is the exact event Microsoft's own install warning calls flaky |
| Preview to GA migration | Per model | Not applicable | **No path is published and in-place migration is not promised.** A breaking change has already landed inside the preview: three deprecated `ModelDeployment` endpoint fields plus an nginx-to-Gateway-API annotation migration table |
| Backup and restore | Configuration is in Bicep; there is no state to back up | The model cache is rebuildable | Almost everything is rebuildable. **The exceptions are the certificate material and the disconnected-operations artifacts** |
| Scale out | Raise capacity or add a deployment | Buy another server | Add worker nodes and replicas |
| Failure domain | Azure region | The one host. It is a single point of failure. | The cluster, with node-level redundancy |
| Recovery from host or node loss | Not your concern | Reinstall and re-pull | Kubernetes reschedules the workload |
| Who operates it | Azure | You | You, and you need Kubernetes skills |

## 9. When to choose which

| If your requirement is | Choose | Why | Do not choose | Because |
|---|---|---|---|---|
| Image generation | Azure AI Foundry | It is the only target with image models at all | Either on-premises target | Neither generates images |
| Text to speech | Azure AI Foundry | Same reason | Either on-premises target | Neither synthesizes speech |
| Embeddings | Azure AI Foundry | Same reason | Either on-premises target | Neither has an embeddings model |
| Frontier reasoning quality | Azure AI Foundry | Proprietary frontier models are hosted-only | Either on-premises target | Open-weight small models are the only on-premises option |
| **Content filtering is a requirement** | **Azure AI Foundry** | **It is the only target with any documented content filter** | **Either on-premises target** | **Neither documents one at all. You would be building it yourself.** |
| Vision input on your own hardware | Azure Local Foundry | `pixtral` and the `nemotron-vl` family, GPU only | Foundry Local | It has no vision-capable model |
| Data must never leave your building | Either on-premises target | Both run entirely on your hardware | Azure AI Foundry | Inference happens in an Azure region |
| Air-gapped or disconnected operation | Azure Local Foundry | Supported via the disconnected operations appliance | Azure AI Foundry | It is a hosted service |
| No Azure subscription available | Foundry Local | The runtime needs none. You lose Arc governance. | The other two | Both are Azure resources |
| One developer, one machine, fastest start | Foundry Local | Install, pull a model, call it | Azure Local Foundry | A cluster is not a workstation |
| A governed on-premises endpoint with real RBAC | Azure Local Foundry, **on the Entra path only** | Entra token authentication and Azure governance via Arc. **Issue an API key instead and you leave Azure RBAC behind.** | Foundry Local | Its endpoint has no authentication and no RBAC at all |
| Many concurrent users on premises | Azure Local Foundry | Cluster-scale serving is its design point | Foundry Local | Single host, single point of failure, and no continuous batching |
| Token or usage metering on premises | Neither on-premises target | **Neither emits usage metrics.** If metering is required, that points back at the cloud | Either on-premises target | No request, latency, or token metric exists on either |
| Lowest time to a first working call | Azure AI Foundry | A deployment and an endpoint, no hardware | Azure Local Foundry | Preview access, a cluster, and a three-layer install come first |
| Lowest fixed monthly cost | Foundry Local | Zero Azure spend for the runtime | Azure Local Foundry | A per-core host fee applies whether or not you infer, and continues 31 days past disconnection |
| No Kubernetes skills on the team | Azure AI Foundry or Foundry Local | Neither needs `kubectl` | Azure Local Foundry | Two of its three layers are Kubernetes and Helm |
| A production SLA | Azure AI Foundry | GA with published commitments | Azure Local Foundry | Public preview, no SLA, no GA date, **and no published preview-to-GA migration path** |

## Where to go next

- [Choosing a target](./choosing), the same comparison as prose.
- [Azure AI Foundry](./azure-cloud/), the target this repository has deployed and proven.
- [Foundry Local](./windows-server/), on a single Arc-enabled Windows Server.
- [Azure Local Foundry](./azure-local/), Foundry Local at cluster scale.
- [Available models](../reference/model-catalog-foundry-local), the full on-premises rosters.
