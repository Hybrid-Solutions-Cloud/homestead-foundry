# Cost-first observability architecture

## Objective

Provide an operations view of the Homestead Foundry deployment and its shared subscription: what is deployed, who owns it, what project it serves, whether it is temporary, what it costs, and when a budget requires action. The design deliberately does not begin with application-performance telemetry.

## Foundation topology

The standalone `infra/observability/` subscription-scope package creates a separate observability resource group. It does not modify the core Foundry template or own the Foundry account.

| Resource | CAF pattern | Purpose | Default data cost |
|---|---|---|---|
| Resource group | `rg-<workload>-obs-<env>-<region>-<instance>` | Isolates observability lifecycle and cost | None |
| Log Analytics workspace | `log-<workload>-obs-<env>-<region>-<instance>` | Future selected logs and traces only | None while empty |
| Azure Monitor Workspace | `amw-<workload>-obs-<env>-<region>-<instance>` | Future managed Prometheus for Arc and Azure Local | None while no samples are ingested or queried |
| Action group | `ag-<workload>-obs-<env>-<region>-<instance>` | Budget notifications | Email action only |
| Subscription budget | `budget-<workload>-credit-sub-<instance>` | Shared-credit and subscription spend awareness | Notification only |
| Native Grafana dashboard | `dash-<workload>-<env>-<region>-<instance>` | Portal dashboard resource, not Managed Grafana | No Grafana service charge |

## Signal policy

| Signal plane | First release | Activation gate |
|---|---|---|
| Azure platform metrics | Use from Azure Monitor and native Grafana | Available without log collection |
| Azure Resource Graph | Use for inventory, tags, lifecycle, and owner views | Reader access to the subscription |
| Cost Management | Use for cost, budget, forecast, and tag allocation views | Cost Management Reader or equivalent |
| Resource logs | Disabled | Named operations question, selected category, cost estimate, and owner approval |
| Foundry traces | Disabled | Data classification, retention, sampling, and access review |
| Managed Prometheus | Disabled | Azure Arc or Azure Local Kubernetes workload and sample-volume review |
| Health models | Disabled | Successful non-production preview pilot |

## Dashboard model

Use **Azure Monitor dashboards with Grafana**, not Azure Managed Grafana. The package creates the native `Microsoft.Dashboard/dashboards` resource shell. Dashboard definition JSON is created or imported in the Azure Monitor Grafana experience, exported as an ARM template, then reviewed before automation. This is necessary because the initial ARM create supplies an empty dashboard and the data-plane API writes its definition. [Microsoft Learn: Grafana APIs](https://learn.microsoft.com/azure/azure-monitor/visualize/visualize-call-grafana-api)

Initial panels are:

1. Subscription actual and forecast spend against the alert threshold.
2. Resource inventory by resource type, region, Owner, Project, and Lifecycle.
3. Untagged resources and temporary resources approaching `ExpiresOn`.
4. Foundry account platform metrics available without Log Analytics export.
5. Alert and budget status, with the action-group response runbook.

The native Grafana experience does not provide Grafana alerts or scheduled reports. Budgets and Azure Monitor alerts use the action group. Scheduled FinOps exports and reports belong to the Platform observability initiative.

The Bicep template takes alert recipients, the budget amount, and actual-cost
thresholds as parameters. The public example is anonymous. The private Homestead
parameter file sets the current $1,000 subscription budget with 10%, 25%, and
50% alerts, which correspond to $100, $250, and $500 actual cost.

## Tag contract

Every new resource in this package receives these tags, following the live platform infrastructure standard:

| Tag | Meaning |
|---|---|
| `Owner` | Named accountable person or team alias |
| `Project` | Product, project, or workload being served |
| `Environment` | `prod`, `dev`, or `test` |
| `CostCenter` | Allocation code |
| `ManagedBy` | Provisioning authority, initially `bicep` |
| `Lifecycle` | `permanent`, `temporary`, or `sandbox` |
| `ExpiresOn` | Required when lifecycle is temporary or sandbox |

The core Foundry deployment currently uses lowercase legacy tags. Platform work item AB#6298 defines the tenant-wide migration dictionary. Until then, dashboards report both vocabularies rather than silently retagging existing resources.

## Future hybrid extension

For Azure Local and Arc-enabled Kubernetes, reuse the same tag contract, action group, budget, and dashboard. Add managed Prometheus only for Kubernetes metrics. Add a separate and filtered Log Analytics collection profile for container and control-plane logs. For device-local Foundry Local, preserve local inference and keep any Azure-connected telemetry opt-in, metadata-only by default, and free of prompt and output content.
