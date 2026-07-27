# SPIKE-20: Cost-first observability for Azure AI Foundry

- Status: Complete
- Date: 2026-07-27
- Scope: First-party Azure services only. No Azure resources were created during this research.

## Decision-driving findings

1. **Azure Monitor dashboards with Grafana are the right dashboard baseline.** They are available in the Azure portal with no Grafana service charge or configuration. They support Azure Monitor metrics, Logs, Traces, managed Prometheus, Azure Resource Graph, and Azure Data Explorer. They are native Azure resources and can be managed with RBAC and Bicep. Azure Managed Grafana is not selected because it adds per-user and compute cost and is only justified when its external data sources, Grafana alerts, scheduled reports, or private networking are needed. [Microsoft Learn: Grafana overview](https://learn.microsoft.com/azure/azure-monitor/visualize/visualize-grafana-overview)

2. **Azure Monitor Workspace is not a generic replacement for Log Analytics.** It is the store for Azure Monitor managed Prometheus. Workspace creation has no direct charge, but Prometheus sample ingestion and queries are chargeable. It belongs in the foundation for future Arc-enabled Kubernetes and Azure Local, but must not receive data until a Prometheus-capable workload exists. [Microsoft Learn: managed Prometheus](https://learn.microsoft.com/azure/azure-monitor/metrics/prometheus-metrics-overview)

3. **Use native platform metrics before logs.** Azure platform metrics are available without a Log Analytics diagnostic setting. Resource logs are not collected by default, and sending them to Log Analytics creates ingestion and retention costs. Platform metrics must not be exported to Log Analytics by default. [Microsoft Learn: Azure Monitor cost and usage](https://learn.microsoft.com/azure/azure-monitor/fundamentals/cost-usage) [Microsoft Learn: diagnostic settings](https://learn.microsoft.com/azure/azure-monitor/platform/diagnostic-settings)

4. **A dedicated Log Analytics workspace is still useful, but it starts empty.** It provides a bounded target for a later approved diagnostic category, Application Insights, or hybrid control-plane logs. The package sets 30-day retention and a low daily cap. A cap is an operational safety circuit, not a billing hard stop, and can leave telemetry unavailable when reached. [Microsoft Learn: Log Analytics daily cap](https://learn.microsoft.com/azure/azure-monitor/logs/daily-cap)

5. **Foundry tracing is opt-in.** Foundry observability integrates with Application Insights and OpenTelemetry, but trace data can include prompts, outputs, tool calls, token use, latency, and errors. Enable it only after a data-classification, sampling, retention, and access review. [Microsoft Learn: Foundry trace data](https://learn.microsoft.com/azure/foundry/observability/concepts/trace-data)

6. **Budgets are alerts, not controls.** Cost Management supports actual and forecast notifications and action groups, but data arrives with delay and budgets cannot prevent spend. Keep the existing resource-group budget and add a subscription-level credit budget for shared-tenant awareness. [Microsoft Learn: Cost Management budgets](https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets)

7. **Health models are an optional preview pilot.** They can discover resources with tag-filtered Resource Graph queries and combine existing signals into workload health, but preview status makes them unsuitable as a production dependency. [Microsoft Learn: Azure Monitor health models](https://learn.microsoft.com/azure/azure-monitor/health-models/overview) [Microsoft Learn: health-model discoveries](https://learn.microsoft.com/azure/azure-monitor/health-models/discoveries)

8. **The design extends to Azure Local without forcing it now.** Arc-enabled Kubernetes supports Azure Monitor managed Prometheus through an Azure Monitor Workspace and uses a separate Log Analytics workspace for container and control-plane logs. Foundry Local itself can run entirely on-device without an Azure subscription, so its diagnostics remain opt-in and must not capture prompts or outputs by default. [Microsoft Learn: Arc Kubernetes monitoring](https://learn.microsoft.com/azure/azure-monitor/containers/kubernetes-monitoring-enable-arc) [Microsoft Learn: Foundry Local](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local)

## Result

The first package provisions the low-cost control plane only: dedicated resource group, empty Log Analytics workspace, empty Azure Monitor Workspace, action group, subscription budget, and a native Grafana dashboard resource. It provisions no Managed Grafana, diagnostic settings, Application Insights, Prometheus scraping, or health model.
