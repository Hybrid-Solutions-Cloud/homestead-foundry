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
Every cell below is either a fact with a source behind it, or an explicit
`UNKNOWN (SPIKE-nn)` naming the research that will close it. There are no blank
cells and no hedges. The unknowns are real and are being worked in order; see
the [roadmap](../roadmap).
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
| Vision input | Yes | UNKNOWN (SPIKE-22) | UNKNOWN (SPIKE-22) |
| Image generation | Yes. MAI-Image family and FLUX family. | No | No |
| Video generation | No. Evaluated and rejected; see the catalog. | No | No |
| Text to speech | Yes. MAI-Voice-2 and the Azure neural voices. | No | No |
| Speech to text | Yes | Yes, Whisper | UNKNOWN (SPIKE-22) |
| Embeddings | Yes | UNKNOWN (SPIKE-22) | UNKNOWN (SPIKE-22) |
| Open-weight models | Available in the catalog | The only kind available | The only kind available |
| Proprietary frontier models | Yes | No | No |
| Model source | The Azure model catalog | The Foundry Local catalog | The Foundry Local catalog, via `ModelDeployment` custom resources |
| Largest practical model, default hardware | Not host-bound. Capacity is a quota and SKU question. | Roughly a 5 GB quantized 4B-class model on CPU. Core count, not RAM, is the binding constraint. | CPU first increment is the `Phi-4-mini-instruct-generic-cpu` class. GPU raises this; exact ceiling UNKNOWN (SPIKE-25). |
| Execution | Hosted. Not your concern. | ONNX Runtime. CPU, CUDA GPU, AMD Vitis NPU, or Qualcomm QNN NPU. | ONNX-GenAI or vLLM, CPU or NVIDIA GPU via DDA. AMD unsupported. |
| Models in this repo's roster | 22 marked deployed in the registry, 20 live on the account | None yet (SPIKE-22, ADR-0019) | None yet (SPIKE-22, ADR-0019) |
| Catalog page | [Model catalog](../reference/model-catalog) | Foundry Local catalog, pending SPIKE-22 | Foundry Local catalog, pending SPIKE-22 |

## 3. Features and platform capabilities

| Feature | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| OpenAI-compatible chat completions | Yes | Yes | Yes |
| Foundry Agent Service | Yes | No | UNKNOWN (SPIKE-31) |
| MCP tool gateway | Available via APIM, gated to a future phase by [ADR-0012](../adr/ADR-0012-agent-mcp-gateway-governance) | UNKNOWN (SPIKE-31) | UNKNOWN (SPIKE-31) |
| RAG and retrieval | Bring your own, plus Azure AI Search | Bring your own | Agentic Retrieval, which requires GPU and `gpt-oss-20b` |
| Fine-tuning | Yes, per model | UNKNOWN (SPIKE-31) | UNKNOWN (SPIKE-31) |
| Batch inference | Yes, per model | UNKNOWN (SPIKE-31) | UNKNOWN (SPIKE-31) |
| Content safety and responsible AI filters | Yes, default policy applied per deployment ([ADR-0007](../adr/ADR-0007-content-safety-and-responsible-ai)) | UNKNOWN (SPIKE-31) | UNKNOWN (SPIKE-31) |
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
| Idempotent redeploy | Yes, wipe and redeploy safe | Yes by contract: four check-before-act stages, with the on-disk model cache as the unit of state | Per layer. UNKNOWN end to end (SPIKE-29). |
| Drift detection | `az deployment sub what-if` sees everything | Not applicable. Arc governs the install action, not the resulting state. | Split three ways, because `what-if` sees only the middle layer |
| Prerequisite | An Azure subscription and two Entra security groups | Arc-enable the server first. Hard prerequisite, not optional. | An AKS Arc cluster, plus preview access granted |
| Teardown | Delete the resource group | Uninstall script, pending phase P | UNKNOWN (SPIKE-29) |
| Deploy gate | Owner-gated. Proven. | Two read-only resolutions, then one owner-authorized install test on a disposable build VM | Preview access request, then a `what-if` test |
| Automation status in this repo | Complete and proven | Not written | Not written |

## 5. Identity, authentication, and secrets

| Aspect | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| Deploy-time principal | User-assigned managed identity, federated to GitHub via OIDC | Same, for the Arc run command. A service principal is accepted for Arc onboarding only. | Same |
| Runtime identity | Managed identity | Arc system-assigned managed identity. User-assigned is not supported on Arc machines. | Managed identity |
| Endpoint authentication | Entra ID, or API key | None. The service listens locally and is not authenticated. | Entra ID token. There is no API key at all. |
| Azure RBAC on the endpoint | Yes | No | Yes |
| Key Vault path | Yes, secrets referenced by name | None by default. See the exception below. | Yes |
| Inbound network ports | Azure-managed HTTPS endpoint | None opened. Arc dials out. | Cluster ingress via the Gateway API |
| TLS certificate | Azure-managed | Not applicable | A real certificate-authority certificate is required. Self-signed is not accepted. |
| Exceptions to [ADR-0005](../adr/ADR-0005-identity-and-secrets) | None | One, scoped and time-boxed: Arc run command cannot authenticate to blob storage with a managed identity, so a shared access signature of 24 hours or less is permitted for the optional blob staging path. The default path uses no blob and therefore has no secret surface at all. | None |
| Honest summary | Full Azure governance | Arc governs installing and managing the host, not the running inference endpoint. That endpoint has no Azure RBAC, no Entra, no Key Vault, no budget, and no Azure Monitor. | Full Azure governance via Arc |

## 6. Cost model

| Aspect | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| Billing unit | Per token or per image, per deployment | None for the runtime | Per physical core of the Azure Local host, per month |
| Fixed or variable | Variable, driven by usage | Fixed. Hardware you already own. | Fixed, driven by core count rather than usage |
| Azure spend for the runtime itself | Yes | No. Arc run command is free; storing scripts in Azure is not. | Yes, the Azure Local host fee |
| Windows Server guest licensing | Not applicable | Existing host licence | An add-on per core, reducible by Azure Hybrid Benefit |
| Exact rates | Published per model | Not applicable | UNKNOWN (SPIKE-26) |
| Hardware capital cost | None | Yours | Yours |
| Marginal cost of one more model | A new deployment, then per-token | Disk in the model cache | Cluster resources only |
| Marginal cost of one more request | Real and metered | Zero | Zero |
| Budget and alerting | Resource-group budget with alert thresholds ([ADR-0006](../adr/ADR-0006-cost-governance)) | No Azure resource exists to cap. What replaces the budget is UNKNOWN (SPIKE-26, ADR-0021). | The host fee is capped by core count, not by a budget rule. Detail UNKNOWN (SPIKE-26). |
| Where a hard cap can be enforced | Azure budget plus per-deployment capacity | Nowhere in Azure. The cap is the hardware. | The cap is the cluster. |

## 7. Observability

| Signal | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| Azure Monitor platform metrics | Yes | No, for the inference endpoint | Yes for the infrastructure. More than sixty standard Azure Local metrics at no extra cost. |
| Diagnostic settings to Log Analytics | Yes | No | UNKNOWN (SPIKE-27) |
| Application Insights | Yes | No | UNKNOWN (SPIKE-27) |
| Managed Prometheus and Grafana | Yes, deployed | No | Deferred by design until a Prometheus-capable workload exists |
| Token-usage metrics | Yes, native Foundry metrics ([ADR-0016](../adr/ADR-0016-foundry-model-usage-observability)) | UNKNOWN (SPIKE-27) | UNKNOWN (SPIKE-27) |
| Alerting | Metric, activity-log, and scheduled-query alerts, deployed | No Azure surface | UNKNOWN (SPIKE-27) |
| Availability test or health probe | Yes, deployed | `foundry service status`, locally | UNKNOWN (SPIKE-27) |
| Audit trail of deployment actions | Azure activity log | Arc run command instance view, output truncated to the last 4 KB | Azure activity log via Arc |
| Prompt and content capture | Not captured | Must remain metadata-only and opt-in | Must remain metadata-only and opt-in |
| What has no Azure surface at all | Nothing material | The running inference service, its request volume, its latency, and its errors | UNKNOWN (SPIKE-27) |

## 8. Operations and lifecycle

| Aspect | Azure AI Foundry | Foundry Local | Azure Local Foundry |
|---|---|---|---|
| Runtime patching | Microsoft's problem | MSIX servicing. Mechanism UNKNOWN (SPIKE-29). | Cluster extension versions, plus AKS Arc and Kubernetes upgrades |
| Model updates | Automatic version upgrade, preserved by default | Re-pull into the model cache | A new `ModelDeployment` revision |
| Upgrade ordering constraints | None | UNKNOWN (SPIKE-29) | Severe. Gateway API CRDs before Istio, or `istiod` restarts and the result is reported as flaky. |
| Preview to GA migration | Per model | Not applicable | Required, and the path is UNKNOWN (SPIKE-29) |
| Backup and restore | Configuration is in Bicep; there is no state to back up | The model cache is rebuildable | UNKNOWN (SPIKE-29) |
| Scale out | Raise capacity or add a deployment | Buy another server | Add worker nodes and replicas |
| Failure domain | Azure region | The one host. It is a single point of failure. | The cluster, with node-level redundancy |
| Recovery from host or node loss | Not your concern | Reinstall and re-pull | Kubernetes reschedules. Detail UNKNOWN (SPIKE-29). |
| Who operates it | Azure | You | You, and you need Kubernetes skills |

## 9. When to choose which

| If your requirement is | Choose | Why | Do not choose | Because |
|---|---|---|---|---|
| Image generation | Azure cloud | It is the only target with image models at all | Either local target | Foundry Local generates no images |
| Text to speech | Azure cloud | Same reason | Either local target | Foundry Local synthesizes no speech |
| Frontier reasoning quality | Azure cloud | Proprietary frontier models are hosted-only | Either local target | Open-weight small models are the only local option |
| Data must never leave your building | Windows Server or Azure Local | Both run entirely on your hardware | Azure cloud | Inference happens in an Azure region |
| Air-gapped or disconnected operation | Azure Local | Supported via the disconnected operations appliance | Azure cloud | It is a hosted service |
| No Azure subscription available | Windows Server | The runtime needs none. You lose Arc governance. | The other two | Both are Azure resources |
| One developer, one machine, fastest local start | Windows Server | Install, pull a model, call it | Azure Local | A cluster is not a workstation |
| A governed on-premises endpoint with real RBAC | Azure Local | Entra ID token authentication and full Azure governance via Arc | Windows Server | Its endpoint has no authentication and no RBAC |
| Many concurrent users on premises | Azure Local | Cluster-scale serving is its design point | Windows Server | It is a single host, single point of failure |
| Lowest time to a first working call | Azure cloud | A deployment and an endpoint, no hardware | Azure Local | Preview access, a cluster, and a three-layer install come first |
| Lowest fixed monthly cost | Windows Server | Zero Azure spend for the runtime | Azure Local | A per-physical-core host fee applies whether or not you infer |
| No Kubernetes skills on the team | Azure cloud or Windows Server | Neither needs `kubectl` | Azure Local | Two of its three layers are Kubernetes and Helm |
| A production SLA | Azure cloud | GA with published commitments | Azure Local | Public preview, no SLA, no GA date |

## Where to go next

- [Choosing a target](./choosing), the same comparison as prose.
- [Azure cloud](./azure-cloud/), the target this repository has deployed and proven.
- [Windows Server](./windows-server/), Foundry Local on a single Arc-enabled host.
- [Azure Local](./azure-local/), Foundry Local at cluster scale.
