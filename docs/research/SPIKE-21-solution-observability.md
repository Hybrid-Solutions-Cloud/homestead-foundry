# SPIKE-21: Solution observability for Azure AI Foundry

- Status: Complete
- Date: 2026-07-27
- Scope: Define solution observability beyond the existing cost-first foundation, evaluate Azure-native capabilities, and recommend a cost-first implementation sequence. This is research and design only. It creates no Azure resources and changes no telemetry collection.

## Question

What must **observability** cover for a Microsoft Foundry solution, and which Azure services should provide that coverage without turning a small, shared subscription into an unbounded telemetry bill?

## Current position

The deployed Homestead observability instance is intentionally a foundation. It provides
an isolated observability resource group, an empty Log Analytics workspace, an empty
Azure Monitor workspace, a notification action group, a subscription budget, and a
no-cost Azure Monitor dashboard with Grafana resource. The public Homestead package now
implements the Foundry-specific core and diagnostics modules, while the complete
tenant-wide reusable package remains owned by `D:/git/platform/observability`. The
optional Foundry modules are not enabled in the deployed instance until their approval
gates are met.

A read-only check of the reference environment on 2026-07-27 found that the deployed Foundry account exposes platform metrics for model requests, availability, latency, tokens, images, errors, and voice usage. Its Foundry project also exposes preview agent metrics. Neither the account nor the project has a configured diagnostic setting. This is the correct low-cost baseline, but it is not yet complete solution observability.

## What observability includes

Observability is not a synonym for a dashboard, a Log Analytics workspace, or application performance monitoring. For this solution it is the ability to answer the following questions quickly and with evidence.

| Concern | Operator question | Minimum evidence |
|---|---|---|
| Cost and consumption | What is spending, which resource or model caused it, and is the trend abnormal? | Cost Management cost analysis, budgets, anomaly alerts, tags, and model usage metrics |
| Inventory and accountability | What exists, who owns it, what project is it for, and when should it be removed? | Azure Resource Graph and the required tag contract |
| Deployment and configuration | Who changed or deleted a resource, and did a deployment fail? | Azure Activity Log, deployment records, and selected activity-log alerts |
| Azure platform health | Is Azure reporting a service incident, maintenance event, or resource-health change? | Service Health and Resource Health alerts |
| Model service behavior | Are requests succeeding, being throttled, taking too long, or consuming unexpectedly? | Cognitive Services platform metrics by deployment and model |
| Agent and application behavior | Which agent, tool, dependency, or request path failed, and why? | Foundry project metrics first; sampled Application Insights tracing only after approval |
| AI quality and safety | Are outputs safe, grounded, useful, and within agreed quality thresholds? | Foundry evaluations and sampled production monitoring, introduced only with an application workload and data-governance review |
| Hybrid and local operation | Is an Arc or Azure Local component healthy without exporting private prompt content? | Azure Local standard metrics, then tightly scoped managed Prometheus and logs when a cluster exists |
| Response | Who is notified, what is the runbook, and how is alert noise contained? | Action groups, alert rules, severity policy, alert-processing rules, and runbooks |

The first five rows are the operating baseline for every Foundry deployment. Agent tracing, quality evaluation, and hybrid telemetry are workload-dependent layers. They must not be enabled merely because a workspace already exists.

## Azure-native capability assessment

| Azure capability | What it answers | Cost and privacy posture | Recommendation |
|---|---|---|---|
| Cost Management | Spend by resource, service, resource group, tag, budget, forecast, and anomaly | Native Cost Management features have no direct charge. Billing data is delayed and budgets notify only. | Required. Keep the subscription budget. Add an anomaly alert and a scheduled cost report after the report recipients and cadence are approved. |
| Azure Resource Graph | Inventory, untagged resources, owner, project, lifecycle, expiry, region, and resource type | No telemetry ingestion. Resource metadata only. | Required. Use it for inventory and tag-compliance dashboard panels. |
| Azure Monitor platform metrics | Request volume, availability, latency, tokens, generated images, server and client errors, and model utilization | Standard platform metrics are collected without a diagnostic setting or Log Analytics ingestion. | Required. Use metrics and metric alerts before exporting logs. |
| Foundry project metrics | Agent runs, responses, tokens, tools, threads, indexed files, and hosted-agent CPU or memory consumption | Agent metrics are preview. They do not require trace capture. | Pilot only when an agent workload is active. Treat preview metrics as advisory rather than a production dependency. |
| Azure Activity Log | Control-plane creates, updates, deletes, policy events, deployment failures, and Service or Resource Health events | Automatically retained for 90 days with no charge. Export is only needed for longer retention or KQL correlation. | Required for review and selected alerts. Start with activity-log alerts. Export only the justified categories after estimating the workspace effect. |
| Service Health and Resource Health | Azure incident, maintenance, advisory, or resource transition affecting the solution | Uses the existing action group. No application payload is collected. | Required. Add low-noise alerts scoped to the Foundry service, region, and solution resources. |
| Cognitive Services diagnostic settings | Audit, request and response, trace, managed-network, and request-usage logs | Some categories have an export charge and all Log Analytics ingestion adds cost. Request or response data can be sensitive. | Disabled by default. Enable one named category only after a question, data classification, retention period, and daily-volume budget are approved. |
| Application Insights and Foundry tracing | Distributed agent execution, prompts, outputs, tool calls, latency, tokens, and exceptions | Trace data can contain customer content and personal data. Application Insights and Log Analytics pricing applies. | Optional. Require an explicit data-governance decision, least-privilege RBAC, redaction, sampling, retention, and a monthly ingestion limit. |
| Azure Monitor dashboards with Grafana | Azure Monitor metrics, Logs, Traces, managed Prometheus, and Resource Graph views | No Grafana service charge. It does not provide Grafana alerts or scheduled reports. | Required dashboard surface. Use Azure Monitor alerts and Cost Management for notifications and reports. |
| Azure Monitor Workspace and managed Prometheus | Kubernetes, Arc-enabled Kubernetes, and future Azure Local Prometheus metrics | Creation is free, but samples ingested and queried are chargeable. | Deferred until a Kubernetes workload exists and a sample-volume estimate is approved. |
| Azure Monitor health models | A workload health rollup from existing metrics and logs | Preview. It does not collect the source telemetry itself, but the required source signals can have cost. | Non-production pilot only after the metric and alert set has proved useful. |
| Application Insights availability tests | External synthetic availability of a user-facing HTTP endpoint | Test execution and resulting telemetry have cost. It requires a safe endpoint and access design. | Deferred. Use only when the solution exposes a supported, non-destructive health endpoint. |

## Foundry signals that are available before log ingestion

The Foundry account uses the `Microsoft.CognitiveServices/accounts` metrics namespace. The following are the first dashboard and alert candidates, filtered by deployed model type and actual workload.

| Signal | Use | Initial alert decision |
|---|---|---|
| `ModelRequests` or `AzureOpenAIRequests` | Adoption and workload change by deployment, model, status code, and service tier | Dashboard first. Alert only for a sudden, approved-baseline breach. |
| `ModelAvailabilityRate` or `AzureOpenAIAvailabilityRate` | Server-side availability trend | Dashboard and a low-severity degradation alert once normal traffic is known. It is not an end-to-end availability test. |
| `TimeToResponse`, `TimeToLastByte`, and token timing metrics | Model service responsiveness | Dashboard first. Do not page until a user-facing response target exists. |
| `InputTokens`, `OutputTokens`, `TotalTokens`, and `GeneratedImages` | Workload consumption and a leading cost indicator | Dashboard and daily trend review. These are not a replacement for billed Cost Management data. |
| Requests split by `StatusCode`, plus error metrics where applicable | Server errors, client errors, and throttling evidence | Alert on sustained server failures or rate-limit failures, with thresholds supplied by a parameter file. |
| `RAIRejectedRequests` and related safety metrics | Content filter activity | Dashboard first. Escalation thresholds require a safety policy and a human review process. |
| Preview project agent metrics | Agent responses, runs, tools, tokens, and hosted-agent capacity use | Pilot dashboard only. Do not use as a sole production alert signal while preview. |

The platform-metric reference distinguishes Azure OpenAI-specific metrics from generic Cognitive Services metrics. The implementation must choose only metrics supported by the actual resource and deployment, never assume that every metric is meaningful for every model.

## Recommended design: three cost-controlled profiles

The deployment must remain modular. A consumer chooses a profile in a public parameter file, and a private overlay supplies recipients, scope, and numeric thresholds. No email address, subscription-specific value, or threshold is hardcoded in reusable Bicep.

| Profile | Included | Excluded | Cost expectation |
|---|---|---|---|
| `foundation` | Existing budget, action group, resource inventory, Azure Monitor workspace, empty Log Analytics workspace, native Grafana shell | Logs, tracing, Prometheus, health models, synthetic tests | No telemetry-ingestion cost by default |
| `foundry-core` | Foundation plus Resource Graph panels, Foundry platform-metric panels, service-health alert, resource-health alert, deployment-failure alert, and selected metric alerts | Resource-log export, traces, Prometheus, synthetic tests | Standard metrics are free to collect. Alert-rule costs must be checked against current Azure pricing before enablement. |
| `foundry-diagnostics` | Foundry core plus individually approved diagnostic categories, Application Insights tracing or availability test, and relevant Log Analytics queries | Broad request or response logs, unbounded retention, all-resource diagnostic settings | Variable, controlled by data volume, retention, test frequency, and alert count |

`foundry-core` is implemented as public source. It observes the solution using Azure
metadata and standard metrics. It does not collect prompt or output content, and it
avoids the main ingestion-cost drivers. Its deployment remains separately approval-gated.

## Dashboard and response model

The native Grafana dashboard should be a navigation surface, not a fabricated single source of truth.

| View | Data source | Purpose |
|---|---|---|
| Cost and budget | Cost Management | Actual and forecast spend, budget progress, anomaly investigation, Advisor cost recommendations, and tag allocation |
| Solution inventory | Azure Resource Graph | Foundry resources, model deployments, owner, project, lifecycle, untagged resources, and expired temporary resources |
| Foundry model behavior | Azure Monitor Metrics | Requests, availability, latency, status code, model usage, token and image consumption, and safety signals |
| Control-plane changes | Activity Log and, if approved, `AzureActivity` in Log Analytics | Deployments, resource changes, deletions, policy events, and failed operations |
| Platform health | Service Health and Resource Health | Azure incident, maintenance, advisory, and resource transition context |
| Agent behavior | Project metrics, then approved Application Insights traces | Agent runs, response status, tools, tokens, errors, and trace drill-down |
| Hybrid operations | Azure Local metrics and later managed Prometheus | Cluster and infrastructure health without default prompt-content export |

Cost Management is deliberately outside the Grafana-only data contract. Native Grafana supports Azure Monitor metrics, Logs, Traces, Resource Graph, Azure Data Explorer, and managed Prometheus, but it is not a Cost Management data source. Cost reports and budget or anomaly notifications remain in Cost Management unless a future, separately approved export and analytics design is added.

The dashboard resource currently exists as a shell. A dashboard definition and panels
are not yet deployed. The public package supports a source-controlled definition through
the `foundry-core` profile; the definition must be reviewed as configuration, not
hand-built in the portal without source control.

## Alert policy

1. **Spend**: retain the existing actual-spend budget notifications at $100, $250, and $500 in the private overlay. Add forecast and anomaly notifications only after validating recipient and escalation behavior.
2. **Control plane**: alert on failed deployments and high-risk deletes or changes to the Foundry account, model deployments, Key Vault, and observability resources. Prefer a small, explicit operation list over subscription-wide administrative alert noise.
3. **Platform health**: alert for Azure service incidents, planned maintenance, and relevant Resource Health transitions, scoped to the deployed region and Foundry service.
4. **Model behavior**: alert only on sustained server failure, rate-limit failure, or an agreed availability degradation. Thresholds, evaluation windows, severity, and enablement must be Bicep parameters with public defaults that are examples only.
5. **Data volume**: alert if the Log Analytics daily cap is reached and review the top ingestion source before increasing a cap. A cap is a safeguard, not a spend guarantee.
6. **Response**: every enabled alert must name an owner, severity, action group, suppression approach for planned maintenance, and a short runbook.

## Hybrid and local extension

Foundry Local on Windows is local first. Its observability profile must be metadata-only and opt-in for any Azure-connected telemetry. It must not capture prompts, responses, credentials, or model inputs by default.

For Azure Local, Azure Monitor provides more than 60 standard infrastructure metrics at no extra cost. Those metrics can flow into the same operations view. If an Arc-enabled Kubernetes workload is added, the existing Azure Monitor workspace becomes the target for managed Prometheus. Enable that only after defining scrape targets, label cardinality, sample volume, retention, and a monthly cost envelope. A Linux node can collect managed Prometheus for Windows-node workloads, but that remains a future design condition, not a requirement for the cloud solution.

## Decisions and follow-up work

1. Implement the `foundry-core` profile in the Homestead public package, using Platform's generic patterns without duplicating its tenant-wide capabilities. Deployment remains a separately approved private-overlay change.
2. Keep diagnostic settings, Application Insights tracing, synthetic availability tests, managed Prometheus, and health models disabled until their individual activation gates are met.
3. Add a proposed ADR before enabling `foundry-diagnostics`, because it changes data classification, access, and recurring cost.
4. Keep the public Bicep as independent, optional Foundry modules: metric alerts, Activity Log alerts, selected diagnostics, application telemetry, scheduled query alerts, and a versioned native-Grafana dashboard definition. Platform's tenant-wide package remains separate from every core workload deployment.
5. Add public examples with placeholder thresholds. Private overlays contain recipient addresses and approved values only.
6. Validate every selected metric against the target Foundry account at deployment time. Preview project metrics and preview health models must never be hard production dependencies.

## Sources

All sources are first-party Microsoft Learn. Retrieved 2026-07-27.

- [Observability in generative AI](https://learn.microsoft.com/azure/foundry/concepts/observability)
- [Microsoft Foundry tracing and data handling](https://learn.microsoft.com/azure/foundry/observability/concepts/trace-data)
- [Supported metrics for Microsoft.CognitiveServices/accounts](https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-cognitiveservices-accounts-metrics)
- [Supported metrics for Microsoft.CognitiveServices/accounts/projects](https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-cognitiveservices-accounts-projects-metrics)
- [Supported logs for Microsoft.CognitiveServices/accounts](https://learn.microsoft.com/azure/azure-monitor/reference/supported-logs/microsoft-cognitiveservices-accounts-logs)
- [Activity Log in Azure Monitor](https://learn.microsoft.com/azure/azure-monitor/platform/activity-log)
- [Create activity-log, Service Health, and Resource Health alerts](https://learn.microsoft.com/azure/azure-monitor/alerts/alerts-create-activity-log-alert-rule)
- [Azure Monitor cost and usage](https://learn.microsoft.com/azure/azure-monitor/fundamentals/cost-usage)
- [Analyze Log Analytics workspace usage](https://learn.microsoft.com/azure/azure-monitor/logs/analyze-usage)
- [Overview of Cost Management](https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management)
- [Identify cost anomalies and unexpected changes](https://learn.microsoft.com/azure/cost-management-billing/understand/analyze-unexpected-charges)
- [Visualize Azure Monitor data with Grafana](https://learn.microsoft.com/azure/azure-monitor/visualize/visualize-grafana-overview)
- [Application Insights availability tests](https://learn.microsoft.com/azure/azure-monitor/app/availability)
- [Health models in Azure Monitor](https://learn.microsoft.com/azure/azure-monitor/health-models/overview)
- [Monitor Azure Local with Azure Monitor Metrics](https://learn.microsoft.com/azure/azure-local/manage/monitor-cluster-with-metrics)
- [Enable monitoring for Arc-enabled Kubernetes clusters](https://learn.microsoft.com/azure/azure-monitor/containers/kubernetes-monitoring-enable-arc)
