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
dashboard definition. A private overlay must load the JSON and replace all four target
placeholders before it supplies the serialized definition to
`grafanaDashboardDefinitionSerializedData`.

```bicep
param grafanaDashboardDefinitionSerializedData = replace(
  replace(
    replace(
      replace(loadTextContent('../../core/homestead-foundry/infra/observability/dashboards/foundry-model-usage.dashboard.json'), '__SUBSCRIPTION_ID__', '<private-subscription-id>'),
      '__FOUNDRY_RESOURCE_GROUP__', '<private-foundry-resource-group>'),
    '__FOUNDRY_RESOURCE_NAME__', '<private-foundry-account-name>'),
  '__LOCATION__', '<private-azure-region>')
```

The dashboard uses only native `Microsoft.CognitiveServices/accounts` metrics. Its
`ModelDeploymentName` series show which deployment was used and when. `ModelRequests`
and `InputTokens`, `OutputTokens`, and `TotalTokens` show how much it was used. The
availability and status-code panels show the operating condition. Do not represent those
token counts as billed currency. Cost Management remains the source for actual and
forecast charges.

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

The `foundry-model-usage.dashboard.json` dashboard contains 11 panels across 5 rows:

| Panel | ID | Row | Description |
|---|---|---|---|
| Model requests by deployment | 1 | y=0 | Request volume per `ModelDeploymentName` |
| Total tokens by deployment | 2 | y=0 | Token consumption per deployment |
| Input and output tokens by deployment | 3 | y=8 | Split input vs output tokens |
| Model availability by deployment | 4 | y=8 | `ModelAvailabilityRate` per deployment |
| Throttled requests by deployment | 5 | y=16 | HTTP 429 per deployment |
| Server errors by deployment | 6 | y=16 | HTTP 5xx per deployment |
| Estimated cost by deployment | 7 | y=24 | Directional token-based cost (currencyUSD) |
| Aggregate token consumption | 8 | y=24 | All-deployment total tokens |
| Model inventory: request volume | 9 | y=32 | All 22 deployed models, top 30 |
| Content safety / RAI blocks | 10 | y=32 | HTTP 400 per deployment |
| Caller / consumer breakdown | 11 | y=40 | Requires `AzureOpenAIRequestUsage` enabled |

Panels 1-6 use the original 6-panel layout. Panels 7-11 were added for cost estimation,
inventory, content safety, and caller tracking.

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
