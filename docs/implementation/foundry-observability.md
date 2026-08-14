# Foundry observability implementation guide

::: info Scope: Azure AI Foundry
This page describes the **Azure AI Foundry** target, the hosted-cloud target of
[ADR-0011](../adr/ADR-0011-multi-target-deployment-automation). Foundry Local and
Azure Local Foundry differ from it in models, features, identity, cost, and
operations. Compare all three on [Deployment targets](../targets/).
:::


## Package layout

| Path | Purpose |
|---|---|
| `infra/observability/main.bicep` | Subscription-scope Foundry observability composition |
| `infra/observability/modules` | Single-purpose modules for foundation, alerts, diagnostics, application telemetry, and dashboard definition |
| `infra/observability/params/example.bicepparam` | Complete public, fictitious parameter contract |
| `infra/observability/dashboards` | Source-control rules for native Azure Monitor Grafana dashboard definitions |
| `infra/observability/queries` | Foundry Resource Graph inventory and tag-compliance queries |

## Deployment sequence

1. Copy `params/example.bicepparam` to the private Homestead deployment area.
2. Replace every fictitious identity, naming, recipient, budget, scope, and threshold value.
3. Select the foundation, Foundry core, or Foundry diagnostics profile by setting the
   corresponding feature switches and definitions.
4. Compile Bicep and run a subscription what-if through the private deployment path.
5. Review all resource changes, tags, metrics, alert conditions, data-producing
   features, retention, daily quota, and cost implications.
6. Obtain explicit approval, deploy, test an action-group notification, and record the
   as-built state. Do not deploy the public example file.

## Module mapping

| Capability | Module | Private definition required |
|---|---|---|
| Foundation | Resource group, Log Analytics, Azure Monitor Workspace, action group, subscription budget, dashboard | Identity tags, recipient, budget, quota, retention |
| Azure health and control plane | `activity-log-alerts.bicep` | Foundry scopes and explicit Activity Log conditions |
| Foundry behavior | `metric-alerts.bicep` | Metric namespace, supported metric, dimensions, window, threshold, severity |
| Response hygiene | `alert-processing-rules.bicep` | Narrow maintenance or routing rule properties |
| Foundry diagnostics | `foundry-diagnostic-setting.bicep` | Existing account location, selected categories, destination type |
| Foundry billed cost | `foundry-cost-collection.bicep`, `resource-group-role-assignment.bicep` | Target subscription and resource group, collection interval, retention |
| Application telemetry | `application-insights.bicep`, `availability-tests.bicep` | Application scenario, data classification, sampling, retention, safe endpoint |
| Query-based detection | `scheduled-query-alerts.bicep` | Reviewed KQL, scopes, frequency, window, and severity |

## Metric alert rule

Each metric definition contains the full ARM metric-alert properties except the action
group. Use a resource scope only for the existing Foundry account or project being
monitored. Confirm the target metric appears in Azure Monitor for that resource before
enabling the rule. Do not invent a metric or assume every Foundry model exposes the same
dimensions.

The initial candidates are model requests, availability rate, response latency, server
errors, throttling, input and output tokens, generated images, and safety metrics. They
begin as dashboard signals; alerting requires an agreed normal baseline.

## Model-use dashboard

`infra/observability/dashboards/foundry-model-usage.dashboard.json` is the core
dashboard definition. A private overlay must load the JSON and replace all seven target
placeholders before it supplies the serialized definition to
`grafanaDashboardDefinitionSerializedData`.

```bicep
param grafanaDashboardDefinitionSerializedData = replace(
  replace(
    replace(
      replace(
        replace(loadTextContent('../../core/homestead-foundry/infra/observability/dashboards/foundry-model-usage.dashboard.json'), '__SUBSCRIPTION_ID__', '<private-subscription-id>'),
        '__FOUNDRY_RESOURCE_GROUP__', '<private-foundry-resource-group>'),
      '__FOUNDRY_RESOURCE_NAME__', '<private-foundry-account-name>'),
    '__LOCATION__', '<private-azure-region>'),
  '__LOG_ANALYTICS_WORKSPACE_RESOURCE_ID__', '<private-workspace-resource-id>')
```

The full private overlay must also replace both gateway placeholders. The dashboard uses
native `Microsoft.CognitiveServices/accounts` metrics for operational signals. Its
`ModelDeploymentName` series show which deployment was used and when. `ModelRequests`
and `InputTokens`, `OutputTokens`, and `TotalTokens` show how much it was used. The
availability and status-code panels show the operating condition. Actual billed-cost
panels query `FoundryModelCost_CL`, which is populated from Cost Management ActualCost.
Do not represent raw Azure Monitor token metrics as billed currency.

## Actual-cost collection

Set `enableFoundryCostCollection` to `true` and provide
`foundryCostCollectionConfiguration` to enable the billed-cost section. The module creates
a system-assigned managed-identity Logic App, a direct data collection rule, and the
`FoundryModelCost_CL` custom table. It grants the workflow Cost Management Reader on the
target Foundry resource group and Monitoring Metrics Publisher on the data collection
rule. It does not store account keys or credentials.

Every collection run queries the current month at daily granularity, grouped by meter,
and writes a single compact raw snapshot. The dashboard selects only the newest snapshot
to avoid counting repeated month-to-date queries more than once. A four-hour interval is
recommended because Cost Management data itself can lag usage by several hours. Azure
Monitor operational panels retain their five-minute refresh cadence.

## Migration from the original foundation

The expanded public contract deliberately aligns with Platform naming. A private overlay
updating from the original Homestead foundation maps these inputs before its next
approved what-if:

| Original | Expanded contract |
|---|---|
| `env` | `environment` |
| `regionToken` | `regionCode` |
| `monthlyCreditBudgetUsd` | `monthlyBudgetUsd` |
| Existing subscription budget resource name and period | `budgetName`, `budgetStartDate`, `budgetEndDate` |
| defaulted Bicep values | Explicit private parameter-file values |

The `environment` input accepts `prod` as well as `prd` so an established
deployment can retain its existing CAF-derived resource names. Do not change
the environment token for a live deployment merely to normalize an
abbreviation, because that would target a different set of resource names.

No existing Azure resource changes because of this source update. A private parameter
overlay is migrated and deployed only through a separately approved change.

## Dashboard panels

The `foundry-model-usage.dashboard.json` dashboard contains operational, billed-cost,
and optional gateway sections:

| Panel | ID | Row | Description |
|---|---|---|---|
| Model requests by deployment | 1 | y=0 | Request volume per `ModelDeploymentName` |
| Total tokens by deployment | 2 | y=0 | Token consumption per deployment |
| Input and output tokens by deployment | 3 | y=12 | Split input vs output tokens |
| Model availability by deployment | 4 | y=12 | `ModelAvailabilityRate` per deployment |
| Throttled requests by deployment | 5 | y=24 | HTTP 429 per deployment |
| Server errors by deployment | 6 | y=24 | HTTP 5xx per deployment |
| Input and output token volume | 7 | y=32 | Raw per-deployment token counts, not currency |
| Aggregate token consumption | 8 | y=32 | All-deployment total tokens |
| Model inventory: request volume | 9 | y=40 | All 22 deployed models, top 30 |
| Content safety / RAI blocks | 10 | y=40 | HTTP 400 per deployment |
| Caller / consumer breakdown | 11 | y=48 | Requires `AzureOpenAIRequestUsage` enabled |
| Cost and consumption row | 17 | y=56 | Starts the ActualCost section |
| Actual cost today | 18 | y=57 | Current-day billed cost |
| Actual cost, last 7 days | 19 | y=57 | Trailing seven-day billed cost |
| Actual cost, month to date | 20 | y=57 | Current-month billed cost |
| Billed tokens and cost by model | 21 | y=62 | Today, seven-day, and month token and cost columns |
| Daily actual model cost | 22 | y=74 | Daily cost trend by model |
| Month-to-date actual cost by model | 23 | y=74 | Ranked model cost totals |
| Optional model gateway | 12-16 | y=82 onward | Gateway requests, latency, health, CPU, and memory |

Panels 18-23 require the ActualCost collector. They remain empty when the collector is
disabled. Cost columns use billed currency returned by Cost Management, while token
columns normalize the billed meter quantities into token counts.

## Usage diagnostics (caller identity)

The `AzureOpenAIRequestUsage` diagnostic category writes request-usage logs to Log
Analytics. Each log entry includes `callerIpAddress` and `operationName`, which
identify which pipeline or agent invoked a model deployment. Enable this category in
the private overlay's `foundryDiagnosticSetting.logs` array:

```bicep
{
  category: 'AzureOpenAIRequestUsage'
  enabled: true
  retentionPolicy: {
    enabled: false
    days: 0
  }
}
```

This category produces log data and therefore incurs Log Analytics ingestion and
retention cost. The private overlay should set `logAnalyticsDailyQuotaGb` to a value
that accommodates the expected volume. Usage logs are not required for the core
platform-metric panels (1-10); only panel 11 depends on them.

## Cost model

| Data source | Destination | Cost | Used by |
|---|---|---|---|
| Platform metrics (`Microsoft.CognitiveServices/accounts`) | Azure Monitor metrics pipeline | **Free** | Panels 1-10 |
| `AzureOpenAIRequestUsage` diagnostic logs | Log Analytics | Per GB ingested | Panel 11 only |
| Cost Management ActualCost snapshot | `FoundryModelCost_CL` in Log Analytics | Minimal ingestion plus Logic App executions | Panels 18-23 |

The caller/consumer breakdown and compact ActualCost snapshot require paid Log Analytics
ingestion. Set `logAnalyticsDailyQuotaGb` to a tight supported cap to prevent surprise
bills. The Azure Monitor Workspace (`amw-*`) deployed by this package is available for
Prometheus metrics but is not required by the Foundry dashboard panels.

No platform metrics are sent to Log Analytics. The `foundryDiagnosticSetting.metrics`
array is empty in the recommended configuration. This avoids double-ingestion cost
for data already available on the free metrics pipeline.
