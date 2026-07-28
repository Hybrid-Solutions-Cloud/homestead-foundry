# Foundry observability package

This is the public, Foundry-specific observability package for an existing Azure AI
Foundry deployment. It is standalone, subscription-scope Bicep and does not modify
`infra/main.bicep`, a Foundry account, model deployment, Foundry project, or application.

It is derived from the canonical Platform observability package at
`D:/git/platform/observability`, but only implements the operating capabilities that a
Foundry workload needs. Platform remains the source for tenant-wide governance, FinOps
reporting and exports, broad inventory, Azure Local collection, Prometheus, and health
model capabilities.

## Profiles

| Profile | Included | Data-cost posture |
|---|---|---|
| Foundation | Isolated resource group, workspaces, action group, subscription budget, query library, dashboard shell | No telemetry ingestion |
| Foundry core | Foundation plus Foundry model-use metrics and dashboard, selected metric alerts, deployment and Azure-health alerts, alert routing, and source-controlled dashboard definition | Standard platform metrics before logs |
| Foundry diagnostics | Individually approved Foundry diagnostic categories, Application Insights, availability tests, and scheduled-query alerts | Explicit privacy, retention, RBAC, and cost gates |

## What this package provisions

- A CAF-named observability resource group, Log Analytics workspace, Azure Monitor
  Workspace, action group, subscription budget, and native Azure Monitor dashboard
  with Grafana shell.
- Optional Activity Log alerts for Foundry deployment failures, high-risk changes,
  Service Health, and Resource Health.
- Optional Azure Monitor metric alerts for Foundry account and project metrics that
  the target resource actually supports.
- A versioned model-usage dashboard definition that uses native Foundry metrics by
  model deployment. It shows request, input-token, output-token, total-token,
  availability, throttle, and server-error trends without Log Analytics ingestion.
- Optional alert-processing rules for approved maintenance suppression or routing.
- Optional selected Foundry diagnostic settings, workspace-based Application Insights,
  safe availability tests, and scheduled query alerts.
- Foundry inventory and tag-compliance Resource Graph queries.

## What it does not provision

- A Foundry account, project, model deployment, endpoint, model, network, or identity.
- Azure Managed Grafana, catch-all diagnostic categories, prompt or response capture,
  or a diagnostic setting without an explicit approved definition.
- Tenant-wide Policy assignments, Cost Management exports or scheduled reports, broad
  Activity Log export, generic resource governance, Prometheus collection, Azure Arc
  extensions, data collection rules, or Azure Monitor health-model preview.

## Public and private configuration

`params/example.bicepparam` is a complete, fictitious public contract. Copy it to an
ignored private overlay and replace its recipients, values, scopes, resource identifiers,
thresholds, and approved definitions. No personal email, subscription identifier,
private endpoint, credential, or tenant value belongs in reusable Bicep.

`dashboards/foundry-model-usage.dashboard.json` is also public and fictitious. Its
target placeholders must be replaced only by a private parameter overlay with
`loadTextContent()` and `replace()`. The public source never contains a subscription ID,
resource group, Foundry account name, recipient, or deployment-specific threshold.

## Validation and deployment

```powershell
az bicep build --file infra/observability/main.bicep --outfile D:\tmp\homestead-foundry-observability.json
az deployment sub what-if --location <deployment-region> --template-file infra/observability/main.bicep --parameters <private-params>.bicepparam
```

`what-if` is read-only. A real deployment requires the owner's immediate approval after
the reviewed what-if. The public package is never deployed with its example parameter
file.
