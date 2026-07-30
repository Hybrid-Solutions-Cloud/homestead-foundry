# SPIKE-27: What Azure can and cannot see for the local deployment tracks

Role: foundry-researcher (Opus). Status: research spike complete. No Azure resources created, no spend, no software installed, no cluster touched, no query run against any live workspace. First-party documentation review only.
Date: 2026-07-30
Scope: observability for deployment track 2 (Foundry Local on Windows Server, ADR-0013) and track 3 (Foundry Local on Azure Local, ADR-0014). SPIKE-20 and SPIKE-21 defined observability for the cloud track only, and `docs/design/observability-architecture.md` names both local tracks as "future consumers" without saying what they can actually emit. This spike closes that gap. Every factual claim is grounded in a first-party (Microsoft) source, cited inline. Anything Microsoft has not published is marked UNKNOWN with the test or doc that would resolve it. This spike feeds ADR-0022; it authorizes no deployment, no telemetry collection, and no spend.

Depends on: `docs/research/SPIKE-20-cost-first-observability.md` (cost-first foundation), `docs/research/SPIKE-21-solution-observability.md` (the nine observability concerns and the metadata-only rule for hybrid), `docs/adr/ADR-0015-cost-first-observability-boundaries.md` (the package boundary), `docs/adr/ADR-0016-foundry-model-usage-observability.md` (native model-usage metrics on the cloud track, which is the bar this spike measures the local tracks against), `docs/design/observability-architecture.md`, `docs/adr/ADR-0013-foundry-local-windows-server-install.md` decision 10, and `docs/adr/ADR-0014-foundry-local-azure-local-deployment-layers.md` decision 7. This spike verifies and corrects against Microsoft Learn; it does not restate those documents.

**Headline: the two tracks are not equally observable, and neither reaches ADR-0016's bar.** Track 3 gets a large, free infrastructure telemetry surface and a documented path to in-cluster metrics, but has **no documented Azure Monitor metric for a `ModelDeployment`**: no request count, no latency, no token count. Track 2 gets essentially nothing above the host, and ADR-0013 decision 10 is confirmed rather than refuted. The honest gap list is question 9.

---

## Question

Nine questions. Questions 6 and 9 are the decisive ones.

1. Track 2: what does Azure Arc actually surface for an Arc-enabled server, and which parts are free versus billable?
2. Track 2: does Foundry Local emit any telemetry, metrics, logs, or health endpoint locally? Is ADR-0013 decision 10 correct that the running endpoint has no Azure Monitor surface?
3. Track 2: could the Azure Monitor Agent on the Arc-enabled host reach the Foundry Local process, what would it cost, and what would it genuinely tell an operator about inference?
4. Track 3: what does Azure Monitor provide for Azure Local out of the box, and is SPIKE-21's "more than 60 standard metrics at no extra cost" claim correct?
5. Track 3: what do Container insights and managed Prometheus cover for an AKS Arc cluster, what do they cost, and what is required to enable them?
6. **Track 3: does the `Microsoft.Foundry` inference operator, or the Gateway API and Istio layer beneath it, expose Prometheus metrics? Are there request-count, latency, or token-count metrics per `ModelDeployment`?**
7. Both tracks: what can raise an alert, and on what signal?
8. Both tracks: does SPIKE-21's metadata-only, opt-in, never-capture-content stance hold, and what does a compliant signal set look like?
9. **Per track, exactly what can an operator not see through any Azure surface?**

---

## Findings

### Q1. Track 2: Arc surfaces the machine, and most of what is useful above bare inventory is billable

Azure Arc-enabled servers project the host into Azure as a resource: "When you connect a machine to Azure Arc, it's treated as a resource in Azure. Each connected machine has an Azure Resource ID, so you can include it in an Azure resource group along with other native Azure resources." Source: [Azure Arc-enabled servers Overview](https://learn.microsoft.com/azure/azure-arc/servers/overview).

| Surface | What an operator sees | Cost posture |
|---|---|---|
| Machine inventory and tags | The machine as an ARM resource, with instance metadata (OS name and version, computer name, FQDN, agent version), visible to Azure Resource Graph and taggable | **Free.** The Arc pricing page lists "Inventory. Tag your resources, organize them into resource groups, subscriptions, and management groups" as a free capability. Source: [Azure Arc pricing, core control plane](https://azure.microsoft.com/pricing/details/azure-arc/core-control-plane/) |
| Agent connectivity | Connected, Disconnected, or Expired status. "The Connected Machine agent sends a regular heartbeat message to the service every five minutes ... the status will change to Disconnected within 15 to 30 minutes." A machine disconnected for 45 days can become Expired. Source: [Arc servers overview](https://learn.microsoft.com/azure/azure-arc/servers/overview) | **Free** |
| Extension state | Installed Arc VM extensions and their provisioning state, through the machine resource. Source: [Arc servers overview](https://learn.microsoft.com/azure/azure-arc/servers/overview) | **Free** |
| Run command Instance View | `InstanceViewExecutionState`, `ProvisioningState`, exit code, stdout and stderr, with output "limited to the last 4 KB". Source: [Run command on Azure Arc-enabled servers (preview)](https://learn.microsoft.com/azure/azure-arc/servers/run-command) | **Free to run**: "While the Run command on Azure Arc-enabled servers is free to use, scripts you store in Azure incur billing charges." Same source. The pricing page also lists "Manage. Administrate your servers anywhere using SSH Arc, Run Command, and Custom Script Extension" as free |
| Machine configuration (guest configuration) | In-guest audit of settings through Azure Policy. Source: [Arc servers overview](https://learn.microsoft.com/azure/azure-arc/servers/overview) | **Billable.** Azure Policy on Azure resources is free ("There are no charges for using Azure Policy on Azure resources"), but "Azure Automanage machine configuration" is listed at **$6 per server per month** on Arc-enabled servers. Source: [Azure Policy pricing](https://azure.microsoft.com/pricing/details/azure-policy/) |
| Azure Update Manager | Update compliance, scheduled and on-demand patching, periodic assessment, update workbooks and alerts, "No dependency on Log Analytics and Azure Automation". It also patches Azure Local clusters, which matters for track 3. Source: [Azure Update Manager Overview](https://learn.microsoft.com/azure/update-manager/overview) | **Billable per Arc server per month.** The Arc pricing page lists Update Manager as a paid line for Arc servers; the exact figure did not render in the retrieved page (see UNKNOWN 1). Its FAQ states Update Manager and Policy guest configuration are included with Defender for Servers Plan 2. Source: [Azure Arc pricing](https://azure.microsoft.com/pricing/details/azure-arc/core-control-plane/) |
| Change Tracking and Inventory | "Assess configuration changes for installed software, Microsoft services, Windows registry and files, and Linux daemons by using the Azure Monitor agent for change tracking and inventory." Source: [Arc servers overview](https://learn.microsoft.com/azure/azure-arc/servers/overview) | **Billable twice over**: it is a paid line on the Arc pricing page and it requires the Azure Monitor Agent writing into a Log Analytics workspace, so per-GB ingestion applies |
| Microsoft Defender for Cloud and Defender for Endpoint | Threat detection, vulnerability management, alerts and remediation for non-Azure servers. Source: [Arc servers overview](https://learn.microsoft.com/azure/azure-arc/servers/overview) | **Billable.** Defender for Servers Plan 1 and Plan 2 are per-server-per-month paid lines. Source: [Azure Arc pricing](https://azure.microsoft.com/pricing/details/azure-arc/core-control-plane/) |
| Azure Monitor (VM insights, AMA) | Guest OS performance and log collection. See Q3 | **Agent free, data billable** |
| Activity Log | Control-plane operations against the machine resource, including run-command and extension writes | **Free for 90 days**, per SPIKE-21's existing finding |

**The load-bearing negative finding: Arc-enabled servers have no platform metrics at all.** `Microsoft.HybridCompute` does not appear in the Azure Monitor supported-metrics index, which lists metrics and log categories by resource provider; the provider is absent from the table entirely, and a direct request for a `microsoft-hybridcompute-machines-metrics` reference page returns HTTP 404. Source: [Azure Monitor supported metrics by resource type](https://learn.microsoft.com/azure/azure-monitor/reference/metrics-index), retrieved 2026-07-30. The same index states the general rule: "Metrics for the guest operating system (guest OS) ... are *not* listed here. Guest OS metrics must be collected through the Azure Monitor Agent that runs on or as part of the guest operating system."

So for track 2 there is **no free CPU, memory, or disk metric** the way there is for an Azure VM or for an Azure Local cluster. Even host-level health costs money to see. That is a materially worse starting position than either of the other two tracks and it is not stated anywhere in ADR-0011 or ADR-0013.

### Q2. Track 2: Foundry Local has local logs and a status command, and nothing else. ADR-0013 decision 10 is confirmed

The device product exposes exactly three observability affordances, all local and all interactive:

- `foundry service status`, which "prints whether the Foundry Local service is running and includes its local endpoint."
- `foundry service ps`, which "Lists all models currently loaded in the Foundry Local service."
- `foundry service diag`, which "Displays the logs of the Foundry Local service."

Source: [Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli). Note `foundry service diag` was not recorded in SPIKE-18 and is the only log surface the product documents.

What is **not** documented anywhere in the Foundry Local device docset: an OpenTelemetry exporter, an OTLP endpoint, a Prometheus `/metrics` endpoint, a structured log file path, a log format, a log retention or rotation policy, a health endpoint other than the OpenAI-compatible inference API itself, or any Azure Monitor integration. The CLI reference states "Azure RBAC: Not applicable (runs locally)", and the product FAQ states "No. Foundry Local runs entirely on local hardware. No Azure subscription is required." Sources: [CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli), [What is Foundry Local?](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local).

The endpoint is also a moving target: "Foundry Local assigns a dynamic port each time the service starts", which is why the documented workflow is to read the port from `foundry service status` before pointing a client at it. Source: [CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli). Any external probe of that endpoint must therefore discover the port first, which rules out a static synthetic check.

**Verdict on ADR-0013 decision 10: confirmed, not refuted.** Its sentence "The endpoint has no Azure RBAC, no Entra authentication, no Key Vault integration, no budget, and no Azure Monitor surface" holds against current documentation. This spike adds one correction of emphasis: the endpoint is not merely un-monitored by Azure, it is un-instrumented in any exportable form. There is no local metrics surface for an operator to scrape and forward even if they wanted to build the bridge themselves. The only machine-readable state is whatever `foundry service status`, `foundry service ps`, `foundry cache list`, and `foundry service diag` print to stdout.

Two further first-party statements have appeared since SPIKE-18 was written and are worth recording here because they bear on how much observability investment track 2 deserves:

- Microsoft now answers the server question directly: "Foundry Local is optimized for hardware-constrained devices where a single user accesses the model at a time. While you can technically install and run it on server hardware, it isn't designed as a server inference stack." It explicitly lacks "concurrent request queuing, continuous batching, and efficient GPU sharing." Source: [What is Foundry Local?](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local). This does not close SPIKE-18 UNKNOWN 1 (it is a design-intent statement, not a support statement), but it narrows it, and it is the clearest signal yet that track 2 should not be instrumented as if it were a service.
- The product's network behaviour is now documented: prompts and outputs are processed locally; the network is used for model and component downloads, and for "Optional diagnostics: If a user reports a problem, they might choose to share logs." Same source. That is the privacy floor for Q8.

### Q3. Track 2: the Azure Monitor Agent can see the host, cannot see inference, and bills per GB

The Azure Monitor Agent (AMA) is supported on Arc-enabled servers in the "Other clouds (Azure Arc)" and "On-premises (Azure Arc)" environments, and on Windows it collects Event Logs, Performance counters, file-based logs, and IIS logs, with Azure Monitor Logs as the destination. Collection is driven by data collection rules: "The Azure Monitor Agent collects data according to data collection rules (DCRs) associated with the agent." Source: [Azure Monitor Agent Overview](https://learn.microsoft.com/azure/azure-monitor/agents/azure-monitor-agent-overview).

Cost is stated plainly: "There's no cost to use the Azure Monitor Agent, but you might incur charges for data ingestion and storage." Same source. Log Analytics ingestion is per GB with a free monthly allowance per billing account. Source: [Azure Monitor pricing](https://azure.microsoft.com/pricing/details/monitor/). The exact per-GB figures did not render in the retrieved page (UNKNOWN 1).

**Would it reach the Foundry Local process? Only incidentally, and only for things Foundry Local does not emit.**

| AMA data source | What it would show for track 2 | Honest value for inference |
|---|---|---|
| Windows Event Log | Service start, stop, and crash events for the Foundry Local Windows service, if the service writes them. Whether it does is not documented (UNKNOWN 2) | Low. Proves the process died, not that it is serving |
| Performance counters | Process CPU, working set, and disk for the host and, with a process-scoped counter set, for the runtime process | Moderate for capacity, **zero for correctness**. A busy CPU is not evidence of a successful inference, and an idle CPU is not evidence of a failure |
| File-based logs | Whatever `foundry service diag` reads from, if that is a file on disk with a stable path and a parseable format | **UNKNOWN 2.** Microsoft documents the command, not the file. Without a documented path and schema, a DCR text-log source is guesswork that a product update can break silently |
| IIS logs | Not applicable | None |

There is one further constraint worth naming: guest OS performance data can be routed to the Azure Monitor custom-metrics API rather than to Logs, and "You can then chart, alert, and otherwise use guest OS metrics like platform metrics." Source: [Azure Monitor supported metrics by resource type](https://learn.microsoft.com/azure/azure-monitor/reference/metrics-index). That is the cheapest shape for host health on track 2 if host health is wanted at all, because it avoids per-GB log ingestion. It still tells an operator nothing about inference.

**Net on Q3: AMA on a track 2 host buys host health, at per-GB cost, and buys no inference visibility whatsoever.** For a single-host, non-production, single-user capability that is a poor trade, and the recommendation section says so.

### Q4. Track 3: SPIKE-21's "more than 60 standard metrics at no extra cost" is correct and can be enumerated

Confirmed verbatim: "It collects over 60 metrics at no additional cost via the `AzureEdgeTelemetryAndDiagnostics` extension." The benefits section states "**No extra cost**. These metrics are standard, out-of-the-box features that are automatically collected and provided to you at no extra cost." Source: [Monitor Azure Local with Azure Monitor Metrics](https://learn.microsoft.com/azure/azure-local/manage/monitor-cluster-with-metrics).

Prerequisites are a deployed, registered, Azure-connected Azure Local system plus the `AzureEdgeTelemetryAndDiagnostics` extension. Retention is the standard platform-metric behaviour: "Platform metrics are stored for 93 days, however, you can only query ... for a maximum of 30 days' worth of data on any single chart." Same source.

The categories, with dimensions:

| Category | Representative metrics | Dimensions |
|---|---|---|
| Nodes | Percentage CPU, Percentage CPU Guest, Percentage CPU Host, Cluster node Memory Total, Available, Used, Percentage Memory, CSV cache read hit, hit rate, miss, Cluster node Storage Degraded | Cluster, Node (some also LUN, VM) |
| Drives (physical disks) | Read and write operations per second, read and write bytes per second, latency read, write, average, capacity size total and used | Cluster, Node, LUN |
| Network adapters | Network In/Sec, Out/Sec, Total/Sec, RDMA inbound, outbound, total | Cluster, Node, Network Adapter, LUN |
| VHDs | Read and write operations per second and bytes per second, latency average, size current and maximum | Cluster, Node, VHD |
| VMs | VM Percentage CPU, memory assigned, available, used, maximum, minimum, pressure, startup, total, VM network adapter in, out, total | Cluster, Node, VM |
| Volumes | Read and write operations per second and bytes per second, volume latency read, write, average, size total and available | Cluster, Node, LUN |
| GPU (conditional) | Percentage GPU, Percentage GPU Memory, GPU Temperature, GPU graphics and memory clock speed | Cluster, Node, GPU Name, GPU UUID, GPU Index, GPU PCIe Id |

Source: [Monitor Azure Local with Azure Monitor Metrics](https://learn.microsoft.com/azure/azure-local/manage/monitor-cluster-with-metrics). Two prebuilt Azure Workbooks, Single Cluster Performance Metrics and Multi Cluster Performance Metrics, consume these with no extra setup.

**The GPU line carries a trap that lands squarely on track 3.** Microsoft states: "You can view GPU metrics only when you configure GPUs by using GPU Partitioning (GPU-P). These metrics aren't supported for Discrete Device Assignment (DDA)." Same source. ADR-0014 decision 3, inheriting SPIKE-09, records that AKS Arc uses **DDA passthrough** for GPUs. Therefore **a GPU-backed track 3 increment gets no GPU utilization, memory, or temperature metric from the free Azure Local surface.** This is a genuine, cited, previously unrecorded gap and it goes in the Q9 list.

The cluster resource type is `Microsoft.azurestackhci/clusters`, which is present in the supported-metrics index with metrics and no log categories. Source: [Azure Monitor supported metrics by resource type](https://learn.microsoft.com/azure/azure-monitor/reference/metrics-index).

Separately, the AKS Arc cluster objects have their own thin platform-metric surface, free and requiring no agent:

- `Microsoft.HybridContainerService/provisionedClusters`: one metric, `capacity_cpu_cores` (Availability category). Source: [Supported metrics, provisionedClusters](https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-hybridcontainerservice-provisionedclusters-metrics).
- `microsoft.kubernetes/connectedClusters`: `capacity_cpu_cores` plus a preview Nodes category of `node_cpu_usage_percentage`, `node_disk_usage_percentage`, `node_memory_rss_percentage`, and `node_memory_working_set_percentage`, dimensioned by `node` and `nodepool`. Source: [Supported metrics, connectedClusters](https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-kubernetes-connectedclusters-metrics).

That is node-level saturation for free, with no Prometheus and no Log Analytics. It is the correct first layer for track 3 and it should be exhausted before anything billable is switched on.

### Q5. Track 3: Container insights and managed Prometheus are supported on AKS on Azure Local, and both bill on volume

Enablement is documented and explicitly lists this track's cluster type. "AKS on Azure Local" is first in the supported-clusters list for Arc-enabled Kubernetes monitoring. Source: [Enable monitoring for Arc-enabled Kubernetes clusters](https://learn.microsoft.com/azure/azure-monitor/containers/kubernetes-monitoring-enable-arc).

Mechanism and prerequisites, from the same source:

- Enabling either feature installs "a containerized version of the Azure Monitor agent" in the cluster.
- The cluster must use managed identity authentication, which aligns with ADR-0014 decision 10 and ADR-0005 and needs no exception.
- Resource providers `Microsoft.ContainerService` and `Microsoft.Insights` must be registered in the subscription.
- Managed Prometheus is enabled as a Kubernetes extension: `az k8s-extension create --name azuremonitor-metrics --cluster-type connectedClusters --extension-type Microsoft.AzureMonitor.Containers.Metrics`, optionally bound to an existing Azure Monitor workspace. **This is a third `Microsoft.KubernetesConfiguration/extensions` resource on the cluster**, which means it fits ADR-0014's platform layer and is Bicep-authorable on the same pattern as `azure-cert-manager` and `inference-operator`.
- Prometheus metrics land in an Azure Monitor workspace; container logs land in a Log Analytics workspace. ADR-0015 decision 2 already provisions both, empty.
- For clusters with Windows nodes, "you can set up Managed Prometheus on a Linux node within the cluster, and configure scraping metrics from metrics endpoints running on the Windows nodes." Not needed for the first increment, which is Linux worker nodes.

What managed Prometheus collects by default: the enabled targets are `cadvisor`, `nodeexporter`, `kubelet`, `kube-state-metrics`, and `networkobservabilityRetina`; `coredns`, `kubeproxy`, and `apiserver` are disabled by default; control-plane targets require the preview control-plane metrics feature. A "Minimal ingestion profile" is on by default and "reduces the volume of metrics ingested by limiting them to only metrics used by default dashboards, default recording rules, and default alerts", and disabling it "can significantly increase ingestion volume." Source: [Default Prometheus metrics configuration in Azure Monitor](https://learn.microsoft.com/azure/azure-monitor/containers/prometheus-metrics-scrape-default). That default is a cost control and must not be turned off.

Cost model:

- Managed Prometheus bills on samples: an Azure Monitor workspace metrics line for samples ingested and a second line for samples processed by queries. Source: [Azure Monitor pricing](https://azure.microsoft.com/pricing/details/monitor/). Exact unit prices did not render (UNKNOWN 1). SPIKE-20 finding 2 already states workspace creation is free and ingestion and queries are chargeable; this confirms it.
- Container insights bills as Log Analytics ingestion and retention. "Since you're charged for the ingestion and retention of this data, you want to configure your environment to optimize your costs." Levers: logs presets, DCR table selection, ConfigMap filtering of `stdout` and `stderr`, namespace filtering, annotation-based pod filtering, ingestion-time transformations, and configuring `ContainerLogV2` as Basic logs. Source: [Monitoring cost for Container insights](https://learn.microsoft.com/azure/azure-monitor/containers/container-insights-cost).
- The same page notes Container insights visualizations can now be driven from managed Prometheus instead of Log Analytics, because "the format of metrics collection is cheaper and more efficient."

**Recommendation shape for track 3, on cost grounds: managed Prometheus with the minimal ingestion profile, and Container insights container logs off by default.** Container logs are the expensive, privacy-hostile half (Q8), and the model pods' stdout is exactly where prompt fragments would leak if a runtime ever logged them.

### Q6. Track 3: no documented Azure Monitor or Prometheus metric exists for a `ModelDeployment`. This is the answer that decides the track

This is the direct analogue of ADR-0016, which rests on `Microsoft.CognitiveServices/accounts` emitting request, token, availability, latency, and status-code metrics dimensioned by model deployment, with no diagnostic setting and no ingestion cost. Track 3 has **no equivalent**, and the gap is not subtle.

**What the first-party documentation does say:**

1. **The inference operator's observability contract is Kubernetes custom-resource status, not metrics.** `ModelDeployment` status exposes `state` (`Pending`, `Creating`, `Running`, `Updating`, `Error`, `Terminating`), `message`, `replicas.desired`, `replicas.ready`, `replicas.available`, `deploymentReady`, `serviceReady`, `internalEndpoint`, `endpointReady`, `httpRouteReady`, `externalEndpoint`, `resolvedModel.name`, `.variant`, `.image`, `authentication.keysSecretName`, `conditions`, and `lastUpdated`. Source: [ModelDeployment and operator configuration reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator). The operator keeps these current on a 30-second timer that "continuously monitors deployment health, tracks pod scheduling, and updates replica counts in the resource status." Source: [Inference operator and model lifecycle](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-operator). Every one of those fields is read with `kubectl`. None is projected into ARM or Azure Monitor.

2. **The operator configuration reference contains no metrics, monitoring, logging, or telemetry section at all.** Its configuration areas are images, tls, gateway API, catalog, storeModel, and authentication. Source: [ModelDeployment and operator configuration reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator). There is no `metricsPort`, no `serviceMonitor`, no scrape annotation, and no documented `/metrics` path for the operator, the operator API, or a model pod.

3. **The one documented metrics scrape in the whole stack is internal to vLLM, and it is not exportable.** The operator configuration exposes `networking.epp.metricsDataSource.scheme` (default `https`) and `networking.epp.metricsDataSource.insecureSkipVerify` (default `true`), described as the "Scheme used to scrape vLLM metrics for scoring" and "Skip TLS verification on metrics scrape." Source: same reference. The runtimes article explains what those metrics are: for multireplica vLLM deployments, "On every request, EPP scores each replica on three signals scraped from vLLM: Queue depth ... KV-cache utilization ... Prefix-cache locality". Source: [Inference Runtimes in Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes).

   Three constraints make this unusable as an observability answer for the committed increment. It exists only on the **vLLM** runtime, which "Requires GPU (CUDA). CPU isn't supported." It exists only when **EPP is on**, which defaults on at `replicas > 1` and off at `replicas == 1`. And ADR-0014 decision 4 commits the first increment to **CPU-only `onnx-genai` at one replica**, which is precisely the configuration where none of it exists. Microsoft documents no metrics endpoint for the ONNX Runtime path at all: its listed characteristics are OpenAI-compatible `/v1/chat/completions` and `/v1/models`, streaming, tool calling, and "Single model per pod." Same source.

4. **The troubleshooting guide is an admission by omission.** The entire documented diagnostic ladder is `kubectl get pods`, `kubectl get certificates`, `kubectl get modeldeployment -A`, `kubectl get events -A --sort-by=.lastTimestamp`, `kubectl describe nodes`, `kubectl top nodes`, `kubectl top pods -A`, `kubectl describe modeldeployment`, `kubectl logs`, and for support, `az k8s-extension troubleshoot --name foundry --namespace-list "foundry-local-operator"`. The words metric, Prometheus, Azure Monitor, and Container insights do not appear. Source: [Troubleshoot Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/troubleshoot). A product with request and token metrics would tell an operator to look at them here.

5. **Istio and Gateway API metrics are not documented first-party in this stack.** ADR-0014 decision 2 takes Istio as a Gateway API provider only. The Foundry Local documentation set never mentions Istio telemetry, `istio_requests_total`, or an Envoy stats endpoint, and this spike will not cite upstream Istio documentation as first-party Microsoft. Managed Prometheus provides the **mechanism** to scrape any in-cluster endpoint through a custom scrape job or pod annotations, per [Default Prometheus metrics configuration](https://learn.microsoft.com/azure/azure-monitor/containers/prometheus-metrics-scrape-default) and the ConfigMap customization it links, but whether an Istio gateway in this specific deployment exposes a scrapeable endpoint on a known port is unverified here (UNKNOWN 3).

6. **A tantalising near-miss that must not be misread.** The metrics reference for `microsoft.kubernetesconfiguration/extensions` does contain inference-shaped metrics: `ApiRequestCount`, `ApiSuccessCount`, `ApiFailureCount` (dimensioned by `EndpointName`, `GpuEnabled`, `StatusCode`), `InferenceApiRequestCount`, `TotalInferenceTimeSeconds`, `TotalCallLLMTimeSeconds` (dimensioned by `LLMProvider`, `OutputLength`), `ApiRequestDurationSeconds`, and several search and ingestion timers. Source: [Supported metrics, microsoft.kubernetesconfiguration/extensions](https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-kubernetesconfiguration-extensions-metrics).

   **That table is a union across every Arc extension type**, not a per-extension contract. The same table also carries Azure Private 5G Core metrics (`ActiveSessionCount`, `RanSetupFailure`, subscriber registration counters) and Edge Volumes metrics (`EdgevolumeSpaceAvailable`, `FileSyncErrors`). The vocabulary of the inference-shaped group (`LLMProvider`, `TotalGenerateEmbeddingsTimeSeconds`, `TotalHybridSearchTimeMilliseconds`, `InferenceAnswerFeedback`, `NumberOfEvaluations`) matches the Agentic Retrieval RAG extension's feature set, not the inference operator's. Nothing in the Azure Monitor reference attributes a metric to an `extensionType`, and **no Foundry Local page states that the `Microsoft.Foundry` extension emits any Azure Monitor metric.** Treating these as track 3 model metrics would be a guess, so this spike does not. It is carried as UNKNOWN 4 with the exact read-only test that settles it.

   Note also that none of those metrics carries a token-count dimension. Even in the best case, the analogue of ADR-0016's `InputTokens`, `OutputTokens`, and `TotalTokens` is absent.

**Answer to Q6, stated plainly: no.** There is no documented Prometheus endpoint and no documented Azure Monitor metric for a `ModelDeployment` request, latency, or token count on track 3. The only inference-adjacent numbers Microsoft documents (vLLM queue depth, KV-cache utilization, prefix-cache locality) are consumed internally by the Endpoint Picker for routing, exist only on the GPU-only vLLM multireplica path that the first increment excludes, and are not described as exported anywhere. **Track 3 cannot have cost and usage visibility equivalent to ADR-0016's cloud track from first-party product features today.** The nearest achievable substitute, if one is wanted, is a custom managed Prometheus scrape job against whatever the gateway or the runtime happens to expose, which is unverified, unsupported, and version-fragile on a preview product.

### Q7. Alerting: track 2 can alert on the host, track 3 can alert on the infrastructure, neither can alert on a model

**Track 2.** Everything that can raise an alert sits at or below the machine resource.

| Signal | Mechanism | Notes |
|---|---|---|
| Agent stopped heartbeating | Resource health alert. CAF states directly: "Create a resource health alert to monitor the Azure connected machine agent. This helps track Azure Arc-enabled servers that stop sending heartbeats." Source: [Management and monitoring for Azure Arc-enabled servers](https://learn.microsoft.com/azure/cloud-adoption-framework/scenarios/hybrid/arc-enabled-servers/eslz-management-and-monitoring-arc-server) | The single highest-value alert on this track. Detection latency follows the 15 to 30 minute status transition in Q1 |
| Outdated Connected Machine agent | "Create an Azure Advisor alert to find Azure Arc-enabled servers that don't run the latest Azure connected machine agent." Same source | Hygiene, not availability |
| Control-plane change | Activity Log alert on run-command or extension writes against the machine | Free, and the audit trail ADR-0013 decision 10 credits Arc with |
| Update compliance | Update Manager alerts and workbooks. Source: [Azure Update Manager Overview](https://learn.microsoft.com/azure/update-manager/overview) | Billable per server |
| Security | Defender for Cloud alerts. Source: [Arc servers overview](https://learn.microsoft.com/azure/azure-arc/servers/overview) | Billable per server |
| Guest events or counters | Log alert or metric alert on AMA-collected data | Requires AMA, a DCR, and ingestion cost. Only as good as what the service writes to the event log (UNKNOWN 2) |

**Nothing can alert on the Foundry Local service being down, the endpoint being unreachable, a model failing to load, or inference failing.** The only construct that would produce such a signal is a scheduled run-command that shells `foundry service status` plus one inference call and emits a compact result, then an alert on the Instance View outcome. That is a build, not a product feature; it inherits the run-command's preview status and 4 KB output cap; and it is only worth building if track 2 ever becomes something other than a single-user proof.

**Track 3.** Considerably better, and all of it below the model.

| Signal | Mechanism | Notes |
|---|---|---|
| Any of the 60-plus Azure Local metrics | Metric alert rules through metrics explorer or `az monitor metrics alert create`, with the metric namespace "Azure Local standard metrics". Source: [Set up metric alerts for Azure Local](https://learn.microsoft.com/azure/azure-local/manage/setup-metric-alerts) | Free signals; alert-rule pricing applies per monitored time series beyond the included allowance, per [Azure Monitor pricing](https://azure.microsoft.com/pricing/details/monitor/) |
| Azure Local system health | Log alerts, documented separately. Source: [Set up metric alerts for Azure Local](https://learn.microsoft.com/azure/azure-local/manage/setup-metric-alerts), which links the log-alerts article | Log alerts imply Log Analytics ingestion |
| AKS Arc node saturation | Metric alert on the `connectedClusters` preview Nodes metrics | Preview; treat as advisory, consistent with SPIKE-21's rule on preview metrics |
| Cluster and workload state | Prometheus alert rules against managed Prometheus, or Container insights log alerts on `KubeEvents` and `ContainerLogV2` | Only after the corresponding collection is enabled and costed. Container insights documents Basic-logs and summary strategies for cost-effective alerting |
| Extension and control-plane change | Activity Log alerts on the three `Microsoft.KubernetesConfiguration/extensions` resources and the cluster | Free, and it is the only Azure-native way to notice the inference operator being removed or reconfigured |
| Azure platform events | Service Health and Resource Health alerts, exactly as SPIKE-21 already requires | Free |

**Nothing in the free tier alerts on a `ModelDeployment` entering `Error`, on `replicas.ready` dropping to zero, or on an inference request failing.** The nearest reachable signal is a Container insights `KubeEvents` log alert (billable, and it depends on the operator emitting a Kubernetes event) or a Prometheus alert on `kube_pod_container_status_restarts_total` and `kube_pod_status_ready` for the model pods, both of which are in the default kube-state-metrics keep list. Source: [Default Prometheus metrics configuration](https://learn.microsoft.com/azure/azure-monitor/containers/prometheus-metrics-scrape-default). That is pod liveness standing in for model health. It is a legitimate proxy and it should be recorded as a proxy, not as model observability.

### Q8. Privacy: SPIKE-21's stance holds for both tracks, and Microsoft's own product statements support it

SPIKE-21 concluded that local observability must be metadata-only and opt-in and must never capture prompts or content. The current first-party statements are consistent with that and, in one case, state the same boundary as a product property:

- Device product: "User data never leaves the device ... prompts and model outputs are processed locally." Network use is limited to model and component downloads plus "Optional diagnostics: If a user reports a problem, they might choose to share logs." Source: [What is Foundry Local?](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local).
- The adjacent Arc AI extension states the boundary explicitly: "Agentic Retrieval in Foundry Local sends only system metadata and organizational identifiable information like subscription ID and cluster names to Microsoft. All customer content, including ingested documents, embeddings, agent configurations, and conversation threads, always stays in the on-premises infrastructure within the network boundaries defined by customers." Source: [Agentic Retrieval and Agents and Tools with Foundry Local Overview](https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/overview). This is the closest first-party articulation of the posture ADR-0022 should adopt for the whole local estate.

**Where the risk actually lives, and it is not where SPIKE-21 assumed.** The realistic leak paths are not a metrics pipeline, because neither track has one. They are:

1. **Container insights `stdout` and `stderr` collection on track 3.** `ContainerLogV2` "stores the stdout/stderr records generated by the containers in the cluster." Source: [Monitoring cost for Container insights](https://learn.microsoft.com/azure/azure-monitor/containers/container-insights-cost). If any runtime, sidecar, or gateway ever logs a request body or an error containing prompt text, enabling container logs exports customer content to a cloud workspace by default. The mitigations are documented and must be applied as a design rule, not as tuning: disable the table in the DCR, or restrict namespaces, or filter by pod annotation, or apply an ingestion-time transformation.
2. **Track 2 blob output capture.** ADR-0013 decision 5 keeps `outputBlobUri` and `errorBlobUri` opt-in. Whatever `foundry service diag` prints is unclassified by Microsoft, so piping it to a blob is an unbounded content risk as well as the ADR-0005 exception ADR-0013 decision 4 already records.
3. **Track 2 AMA text-log collection**, if anyone points a DCR at a Foundry Local log file whose contents are undocumented.

**A compliant signal set, both tracks.** Metadata, counts, states, and resource utilization only. No request bodies, no response bodies, no prompts, no completions, no tool arguments, no document text, no embeddings, no API keys, no SAS URIs, no Entra tokens, and no user identifiers beyond what Azure already records in the Activity Log.

| Track | Compliant and recommended | Compliant but billable, enable only with a stated question | Never by default |
|---|---|---|---|
| 2 | Arc machine inventory and tags, agent connectivity status, extension state, run-command Instance View exit code and compact structured result, Activity Log | Guest event log and performance counters through AMA with a named DCR, routed to custom metrics rather than Logs where possible | `foundry service diag` output shipped anywhere, run-command output and error blobs as a default, any text-log DCR pointed at an undocumented Foundry Local log file |
| 3 | Azure Local standard metrics, `connectedClusters` and `provisionedClusters` platform metrics, Activity Log on the extensions, Service and Resource Health | Managed Prometheus with the minimal ingestion profile and an explicit keep list, Container insights `KubeEvents` and inventory tables only | `ContainerLogV2` stdout and stderr from model, gateway, or operator pods; any custom scrape of an endpoint whose payload has not been inspected; anything resembling request or response capture |

Both tracks inherit ADR-0015 decision 4 unchanged: these are off until their individual activation gate is met.

### Q9. The honest gap list: exactly what an operator cannot see, per track

This is the deliverable. Each row is a named signal, not a general caveat. "No Azure surface" means no free or paid first-party Azure mechanism surfaces it today.

#### Track 2, Foundry Local on Windows Server

| # | Signal an operator cannot see through any Azure surface | Why |
|---|---|---|
| 1 | **Is the Foundry Local service running?** | Only `foundry service status`, executed locally or through a run-command. No Azure resource represents the service |
| 2 | **Is the inference endpoint reachable, and on what port?** | The port is assigned dynamically at each service start, so no static probe target exists |
| 3 | **Request count, per model or in total** | The product emits no metric of any kind |
| 4 | **Input tokens, output tokens, total tokens** | No metric. This is the direct ADR-0016 analogue and it is simply absent |
| 5 | **Latency, time to first token, tokens per second** | No metric. SPIKE-18 UNKNOWN 2 remains unmeasurable except by hand-timing a prompt |
| 6 | **Success, client error, server error, or throttling rates** | No metric, no status-code surface, no throttling concept |
| 7 | **Which model is loaded right now** | `foundry service ps` only |
| 8 | **What is in the model cache, and did a model download fail** | `foundry cache list` only. A multi-GB pull failing mid-run-command is visible solely in output that the 4 KB Instance View cap may truncate |
| 9 | **Model load failures and runtime crashes** | Only in `foundry service diag` output, whose file location and format are undocumented |
| 10 | **Execution provider or accelerator utilization** | No metric. On the committed CPU-only host this is moot, but it stays invisible if hardware ever changes |
| 11 | **Who called the endpoint** | The endpoint has no authentication, no Entra, and no Azure RBAC, so there is no caller identity to record anywhere |
| 12 | **Content-safety or filter activity** | There is no local analogue of `RAIRejectedRequests`. No first-party content filter is documented for the device runtime, so an operator cannot see rejections because there are none to see |
| 13 | **Cost or consumption attributable to inference** | No meter and no Azure resource, so Cost Management has nothing to report and a budget cannot bind. Spend is genuinely zero, but so is usage accounting |
| 14 | **Host CPU, memory, and disk, for free** | `Microsoft.HybridCompute` has no platform metrics at all, so even basic host health requires AMA, a DCR, and per-GB ingestion |
| 15 | **Full install or diagnostic logs, without a secret** | Anything beyond 4 KB needs `outputBlobUri` or `errorBlobUri`, which needs a SAS URI, which is ADR-0013 decision 4's exception |

Summary for ADR-0022: **on track 2 the entire model-usage row of `docs/design/observability-architecture.md` is empty, and the "Azure platform health" and "Deployment and configuration" rows are the only ones Arc can fill.**

#### Track 3, Foundry Local on Azure Local

| # | Signal an operator cannot see through any Azure surface | Why |
|---|---|---|
| 1 | **Requests per `ModelDeployment`** | No documented Azure Monitor metric and no documented Prometheus endpoint on the `onnx-genai` path (Q6) |
| 2 | **Input, output, and total tokens per model** | Same. No token metric is documented anywhere in the Foundry Local on Azure Local set, on either runtime |
| 3 | **Per-request latency or time to first token** | Same. The EPP measurements quoted in the runtimes article are Microsoft's own benchmark results, not an emitted metric |
| 4 | **HTTP status codes, error rates, and throttling per model endpoint** | No documented metric. The gateway is Istio, whose telemetry is undocumented in this stack (UNKNOWN 3) |
| 5 | **`ModelDeployment` state, `replicas.ready`, `endpointReady`** | These exist only as Kubernetes custom-resource status fields, read with `kubectl`. ARM has no knowledge of them, which is exactly the drift-detection problem ADR-0014 decision 7 already records for the intent layer |
| 6 | **Model cache job progress and `StoreModel` state** | Kubernetes only, via `kubectl get jobs` and `describe modeldeployment` |
| 7 | **GPU utilization, GPU memory, and GPU temperature on GPU nodes** | Azure Local GPU metrics require GPU Partitioning and "aren't supported for Discrete Device Assignment (DDA)", and AKS Arc uses DDA. Free surface, hard exclusion |
| 8 | **vLLM queue depth, KV-cache utilization, prefix-cache locality** | Scraped internally by the Endpoint Picker for routing. Not documented as exported. GPU-only, vLLM-only, multireplica-only, so absent from the committed CPU first increment entirely |
| 9 | **Cost attributable to a model, a deployment, or a request** | Azure Local bills per physical core, and there is no per-inference meter. Cost Management can show the cluster, never the model. **This is the structural difference from ADR-0016**, where token metrics are a leading cost indicator |
| 10 | **Content-safety or RAI activity** | No content filter and no rejection metric are documented for this stack |
| 11 | **Which Entra identity called which model** | Authorization resolves to Azure RBAC through the injected sidecars (ADR-0014 decision 5), but no per-request authorization decision log or metric is documented |
| 12 | **Inference operator health beyond pod liveness** | The documented ladder is `kubectl get pods`, `describe`, `logs`, and `az k8s-extension troubleshoot`. ARM shows extension provisioning state, which says the extension installed, not that it is reconciling correctly |
| 13 | **Catalog sync freshness** | `catalogSync.lastSynced` and a ConfigMap annotation, both `kubectl` only. A silently stale catalog has no Azure signal |
| 14 | **Prompt-level anything** | Deliberate, per Q8. Listed so nobody mistakes an intentional boundary for an oversight |

Summary for ADR-0022: **on track 3 everything below the model is well covered and largely free; everything at the model is invisible to Azure.** The boundary is sharp and it falls exactly where the interesting questions are.

#### The one-line comparison ADR-0022 needs

| Observability concern (SPIKE-21) | Track 1 (cloud) | Track 2 (Windows Server) | Track 3 (Azure Local) |
|---|---|---|---|
| Cost and consumption | Cost Management plus token metrics (ADR-0016) | None, and nothing to bill | Per-core cluster cost only, never per model |
| Inventory and accountability | Resource Graph plus tags | Arc machine resource, free | Cluster, node pools, and three extensions, free |
| Deployment and configuration | Activity Log, `what-if` | Activity Log plus run-command Instance View | Activity Log and `what-if` for one layer of three (ADR-0014 decision 7) |
| Azure platform health | Service and Resource Health | Resource Health on the machine | Service and Resource Health |
| Model service behavior | Native metrics by deployment | **None** | **None** |
| Infrastructure health | Platform metrics | **None free** (no HybridCompute metrics) | 60-plus free metrics, plus optional Prometheus |
| Response and alerting | Metric and Activity Log alerts | Agent-heartbeat alert only | Rich infrastructure alerting, no model alerting |

---

## What is still UNKNOWN

| # | Unknown | Why it is not in the docs | What resolves it |
|---|---|---|---|
| 1 | **Exact current unit prices** for Azure Update Manager per Arc server, Defender for Servers Plan 1 and Plan 2, Log Analytics per GB, and managed Prometheus per sample ingested and processed | The Azure pricing pages render figures dynamically by region and currency; the retrieved text showed placeholders for most lines. Only Azure Automanage machine configuration resolved, at $6 per server per month | Read [Azure Arc pricing](https://azure.microsoft.com/pricing/details/azure-arc/core-control-plane/) and [Azure Monitor pricing](https://azure.microsoft.com/pricing/details/monitor/) in a browser for the deployment's region and currency, or use the pricing calculator, at design time. Do not carry a guessed figure into ADR-0022 |
| 2 | **Does the Foundry Local Windows service write to the Windows event log, and does `foundry service diag` read a file at a documented path with a stable format?** | The CLI reference documents the command and no file, path, format, rotation, or event source | Resolvable during the ADR-0013 decision 11 install test at zero extra cost: after install, check the event log for a Foundry Local source and run `foundry service diag` and note where its content comes from. Until then, no DCR should target either |
| 3 | **Does the Istio gateway in a Foundry Local deployment expose a scrapeable Prometheus endpoint, on what port, and with what request metrics?** | The Foundry Local documentation set never mentions gateway telemetry. Upstream Istio documentation is not a first-party Microsoft source and is not cited here | Once a cluster exists: `kubectl get pods -n istio-system -o yaml` for scrape annotations and container ports, then curl the candidate port from inside the cluster. Read-only. If it exists, a managed Prometheus custom scrape job is the only route to request-level metrics on track 3, and it is unsupported and version-fragile |
| 4 | **Does the `Microsoft.Foundry` extension emit any of the inference-shaped metrics listed under `microsoft.kubernetesconfiguration/extensions`** (`InferenceApiRequestCount`, `TotalInferenceTimeSeconds`, `ApiRequestCount`, `ApiFailureCount`)? | The Azure Monitor reference publishes one combined table for the resource type across all extension types and attributes no metric to an `extensionType`. The vocabulary matches the Agentic Retrieval RAG extension, not the inference operator, but that is inference from naming, not a citation | Read-only once the extension is installed: `az monitor metrics list-definitions --resource <extension resource id>` returns the metrics the resource actually emits. This single command converts Q6 from a documentation answer to a measured one and should be run before ADR-0022 is accepted, if a cluster ever exists |
| 5 | **Whether NVIDIA DCGM or an equivalent GPU exporter is supported inside AKS Arc on Azure Local to compensate for the DDA GPU metrics gap** | Microsoft documents the NVIDIA Kubernetes device plugin as a scheduling requirement (SPIKE-19 Q3) but publishes nothing about GPU metrics collection in this stack | Only relevant if track 3 grows a GPU increment. Resolve by checking whether a DCGM exporter DaemonSet is supported alongside the device plugin, and whether managed Prometheus can scrape it, before promising GPU visibility |
| 6 | **Managed Prometheus sample volume and therefore monthly cost for this cluster shape** | Volume depends on node count, pod count, label cardinality, and the keep list, none of which exist yet | Enable on a non-production cluster with the minimal ingestion profile on, then read actual ingested samples from the Azure Monitor workspace for a week before committing. SPIKE-20 finding 2 and ADR-0015 decision 4 already require this gate |
| 7 | **Whether a scheduled Arc run-command is a workable synthetic health check for track 2** | Arc run-command's execution timeout and scheduling behaviour are undocumented, and SPIKE-18 UNKNOWN 7 already carries the timeout question | Same test as SPIKE-18 UNKNOWN 7. Do not design a track 2 heartbeat until it is answered, and do not design one at all unless track 2 outgrows its single-user framing |

---

## Recommendation

1. **Write ADR-0022 to record the observability boundary per track, not a collection plan.** The valuable output of this spike is the Q9 gap list. The ADR's core content should be the one-line comparison table plus both gap lists, so that a future reader cannot assume parity across tracks. This is the same corrective ADR-0013 decision 10 applied to governance, extended to observability.

2. **Track 2: collect nothing beyond what Arc gives for free, and say so as a decision rather than a deferral.** Concretely: machine inventory and tags, agent connectivity, extension state, run-command Instance View, Activity Log, and one Resource Health alert on the Connected Machine agent heartbeat. Do **not** install the Azure Monitor Agent, do not create a DCR, do not enable Change Tracking, and do not enable Update Manager on this host for observability reasons. Every one of those is billable per server or per GB and none of them can see inference. For a single-host, single-user, non-production capability that Microsoft itself says "isn't designed as a server inference stack", free host metadata plus a heartbeat alert is the correct and complete answer.

3. **Track 2: make the run-command's compact structured result the observability contract, because it is the only one available.** ADR-0013 decision 6 already requires each of the four stages to report `already-present`, `changed`, or `failed` in a single JSON object inside the 4 KB cap. That object is, in practice, track 2's entire telemetry surface. ADR-0022 should name it as such and require that any future health check reuses the same shape rather than inventing a second one. Keep the blob path opt-in, per ADR-0013 decision 5, on privacy grounds as well as the identity grounds already recorded.

4. **Track 3: adopt the free layers first and completely, before enabling anything billable.** Azure Local standard metrics through the `AzureEdgeTelemetryAndDiagnostics` extension, the two prebuilt performance workbooks, `connectedClusters` and `provisionedClusters` platform metrics, Activity Log alerts on the three extension resources, and Service and Resource Health alerts. This is a genuinely large surface at zero telemetry cost and it satisfies six of the nine SPIKE-21 concerns.

5. **Track 3: treat managed Prometheus as the second step, gated, with the minimal ingestion profile mandatory.** It is a fourth `Microsoft.KubernetesConfiguration/extensions` resource, so it belongs in ADR-0014's platform layer and is Bicep-authorable on the identical pattern. Gate it on a sample-volume estimate per SPIKE-20 finding 2 and ADR-0015 decision 4. Its honest value is pod liveness, restarts, and node saturation for the model pods, which is a **proxy** for model health, and ADR-0022 should call it a proxy.

6. **Track 3: keep Container insights container logs off by default, permanently, not merely initially.** `ContainerLogV2` captures pod stdout and stderr, which is the one place prompt content could plausibly leak from this stack into a cloud workspace. If container logs are ever needed, enable `KubeEvents` and inventory tables only, exclude the model, gateway, and operator namespaces from log collection, and record the classification decision in writing first.

7. **Do not promise model-usage or per-model cost visibility on either local track.** ADR-0016 is a cloud-track decision and it does not port. Any roadmap, design doc, or dashboard that shows a model-usage panel for tracks 2 or 3 is showing a panel that cannot be populated. If per-model usage accounting is a hard requirement for a workload, that requirement routes the workload to track 1, exactly as ADR-0013 decision 10 routes a governed endpoint requirement to track 3.

8. **Run UNKNOWN 4's one command before ADR-0022 is accepted, if and only if a cluster exists.** `az monitor metrics list-definitions` against the inference-operator extension resource is read-only, costs nothing, and is the difference between "Microsoft does not document any model metric" and "the resource emits none." Given this repo's own rule that a file existing is not evidence it does its job, a documentation absence is likewise not proof of a product absence. Resolve UNKNOWNs 2 and 3 by the same standard when the corresponding environments exist.

9. **Extend `docs/design/observability-architecture.md` from "future consumers" to a per-track capability matrix.** The current text says the local tracks' telemetry must be metadata-only and opt-in, which is correct but incomplete: it implies a choice about how much to collect, when for track 2 there is nothing to choose from. The design doc should carry the one-line comparison table so the boundary is visible at design time rather than discovered at deployment time.

## Verdict: proceed with a two-speed observability posture, and no model-usage promise on either track

Stated plainly, because the tasking asks for an honest answer rather than a hedge.

- **Track 2: minimal, free, host-only. GO on that, NO-GO on anything billable.** Arc gives inventory, connectivity, extension state, an audited execution path, and one useful alert, all free. Above that line there is nothing to observe, because the product emits nothing exportable and Arc-enabled servers have no platform metrics. Spending money on AMA, Change Tracking, or Update Manager to observe a single-user proof would be cost without insight.

- **Track 3: strong infrastructure observability, absent model observability. GO on the free layers now, gated GO on managed Prometheus, hard NO on claiming ADR-0016 parity.** More than sixty free metrics, prebuilt workbooks, node metrics, real alerting, and a documented Prometheus path make this track genuinely operable. What it cannot do is tell an operator how many requests a model served, how many tokens it consumed, how fast it answered, or what it cost. That is not a configuration gap that a keep list or a dashboard closes. It is a product gap, and the first increment's CPU-only, single-replica, `onnx-genai` shape is the configuration where even the vLLM-internal signals do not exist.

- **The decisive number for ADR-0022 is zero: zero documented model-usage metrics on either local track.** Both gap lists in Q9 exist to make sure that number is stated once, in writing, rather than discovered by an operator who opens a dashboard expecting the cloud track's panels.

---

## Sources

All first-party Microsoft (Microsoft Learn, or `azure.microsoft.com` for pricing). Retrieved 2026-07-30.

Track 2 and Azure Arc:

- Azure Arc-enabled servers Overview (govern, protect, configure, monitor capability list, machine configuration, Change Tracking, Update Manager, Defender, VM insights, AMA, agent heartbeat and Connected, Disconnected, Expired status, instance metadata): <https://learn.microsoft.com/azure/azure-arc/servers/overview>
- Run command on Azure Arc-enabled servers (preview) (Instance View fields, 4 KB output cap, free to use, blob billing, SAS requirements, preview status): <https://learn.microsoft.com/azure/azure-arc/servers/run-command>
- Management and monitoring for Azure Arc-enabled servers, Cloud Adoption Framework (resource health alert for the Connected Machine agent, Advisor alert for agent version, VM insights, DCR planning, central workspace and RBAC guidance): <https://learn.microsoft.com/azure/cloud-adoption-framework/scenarios/hybrid/arc-enabled-servers/eslz-management-and-monitoring-arc-server>
- Azure Monitor Agent Overview (supported environments including Arc, Windows and Linux data sources, DCR-driven collection, "There's no cost to use the Azure Monitor Agent, but you might incur charges for data ingestion and storage"): <https://learn.microsoft.com/azure/azure-monitor/agents/azure-monitor-agent-overview>
- Azure Update Manager Overview (features, alerts and workbooks, no Log Analytics dependency, patching of Arc machines and Azure Local clusters): <https://learn.microsoft.com/azure/update-manager/overview>
- Azure Arc pricing, core control plane (free inventory and management lines including Run Command and SSH Arc; paid lines for machine configuration, Change Tracking, Update Manager, Defender for Servers, Analytics logs and Sentinel per GB): <https://azure.microsoft.com/pricing/details/azure-arc/core-control-plane/>
- Azure Policy pricing ("There are no charges for using Azure Policy on Azure resources"; Azure Automanage machine configuration at $6 per server per month on Arc servers): <https://azure.microsoft.com/pricing/details/azure-policy/>

Foundry Local, device:

- Foundry Local CLI reference (`foundry service status`, `ps`, `diag`, `set`, cache commands, dynamic port, "Azure RBAC: Not applicable (runs locally)"): <https://learn.microsoft.com/azure/foundry-local/reference/reference-cli>
- What is Foundry Local? ("User data never leaves the device", prompts and outputs processed locally, model and component downloads, optional diagnostics, no Azure subscription required, and the "Can Foundry Local run on a server?" answer): <https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local>

Track 3, Azure Local and AKS Arc:

- Monitor Azure Local with Azure Monitor Metrics (over 60 metrics at no additional cost, `AzureEdgeTelemetryAndDiagnostics` prerequisite, 93-day retention with 30-day chart query, full node, drive, network adapter, VHD, VM, volume and GPU metric tables, and the GPU-P only versus DDA unsupported statement): <https://learn.microsoft.com/azure/azure-local/manage/monitor-cluster-with-metrics>
- Set up metric alerts for Azure Local (metric alert creation through metrics explorer and `az monitor metrics alert create`, the "Azure Local standard metrics" namespace, link to log alerts): <https://learn.microsoft.com/azure/azure-local/manage/setup-metric-alerts>
- Enable monitoring for Arc-enabled Kubernetes clusters (AKS on Azure Local as a supported cluster, containerized Azure Monitor agent, managed identity and resource-provider prerequisites, the `Microsoft.AzureMonitor.Containers.Metrics` extension commands, Azure Monitor workspace and Log Analytics workspace roles, Windows-node scraping from a Linux node): <https://learn.microsoft.com/azure/azure-monitor/containers/kubernetes-monitoring-enable-arc>
- Default Prometheus metrics configuration in Azure Monitor (minimal ingestion profile, default enabled and disabled targets, per-target keep lists, custom scrape guidance, default dashboards and recording rules): <https://learn.microsoft.com/azure/azure-monitor/containers/prometheus-metrics-scrape-default>
- Monitoring cost for Container insights (ingestion and retention charges, `ContainerLogV2` stdout and stderr, logs presets, DCR table selection, namespace and annotation filtering, transformations, Basic logs, cost-effective alerting): <https://learn.microsoft.com/azure/azure-monitor/containers/container-insights-cost>
- Azure Monitor pricing (Azure Monitor workspace metrics ingestion and query sample billing, free unlimited platform metrics, metric and log alert rule pricing per time series, Log Analytics per-GB tiers): <https://azure.microsoft.com/pricing/details/monitor/>

Azure Monitor metric references:

- Azure Monitor supported metrics by resource type (absence of `Microsoft.HybridCompute`; presence of `Microsoft.azurestackhci/clusters`, `microsoft.kubernetes/connectedClusters`, `Microsoft.HybridContainerService/provisionedClusters`, `microsoft.kubernetesconfiguration/extensions`; the guest-OS metrics rule): <https://learn.microsoft.com/azure/azure-monitor/reference/metrics-index>
- Supported metrics, `microsoft.kubernetes/connectedClusters` (`capacity_cpu_cores` and the preview node metrics): <https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-kubernetes-connectedclusters-metrics>
- Supported metrics, `Microsoft.HybridContainerService/provisionedClusters` (`capacity_cpu_cores` only): <https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-hybridcontainerservice-provisionedclusters-metrics>
- Supported metrics, `microsoft.kubernetesconfiguration/extensions` (the combined cross-extension table containing the inference-shaped, Edge Volumes and Private 5G Core metrics): <https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-kubernetesconfiguration-extensions-metrics>

Foundry Local on Azure Local:

- Inference operator and model lifecycle (reconciliation loop and 30-second health timer, child resources, `ModelDeployment` lifecycle states, catalog ConfigMap and sync, lazy registration, operator configuration areas): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-operator>
- ModelDeployment and operator configuration reference (full status field list, absence of any metrics or telemetry configuration, `networking.epp.metricsDataSource` scheme and `insecureSkipVerify`): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator>
- Inference Runtimes in Foundry Local on Azure Local (ONNX Runtime characteristics and endpoints, vLLM GPU-only, EPP scoring on queue depth, KV-cache utilization and prefix-cache locality, EPP replica-count defaults): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes>
- Troubleshoot Foundry Local on Azure Local (the full `kubectl` diagnostic ladder and `az k8s-extension troubleshoot`, with no metrics or Azure Monitor guidance): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/troubleshoot>
- Agentic Retrieval and Agents and Tools with Foundry Local Overview (the data on-premises versus cloud statement: only system metadata and organizational identifiable information such as subscription ID and cluster names are sent to Microsoft): <https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/overview>

No Azure CLI command was executed, no workspace was queried, and no environment-specific identifier appears in this document.

Related records: `SPIKE-20` and `SPIKE-21` (cloud-track observability, which this spike extends), `ADR-0015` (package boundary and activation gates, unchanged), `ADR-0016` (the model-usage bar that neither local track reaches), `ADR-0013` decision 10 (confirmed by Q2), `ADR-0014` decision 7 (extended by Q9 track 3 rows 5 and 6), `SPIKE-18` and `SPIKE-19` (the track 2 and track 3 deployment spikes this one is scoped to match), and `ADR-0022` (the decision this spike feeds).
