# Foundry observability parameter reference

Every input to `infra/observability/main.bicep` is explicit. Public examples are
fictitious. Actual values belong only in an ignored private overlay.

## Identity, naming, and foundation

| Parameters | Purpose |
|---|---|
| `workload`, `environment`, `regionCode`, `instance`, `location` | CAF-derived names and regional placement |
| `ownerAlias`, `project`, `costCenter`, `lifecycle`, `expiresOn`, `managedBy` | Required ownership, allocation, and lifecycle tag values |
| `operationsEmails`, `actionGroupShortName`, `actionGroupLocation` | Private notification routing |
| `monthlyBudgetUsd`, `budgetName`, `budgetStartDate`, `budgetEndDate`, actual and forecast threshold objects | Subscription budget and notification posture. An established deployment passes its existing budget name and period. |
| `logAnalyticsSkuName`, `azureMonitorWorkspacePublicNetworkAccess`, retention, daily quota | Workspace cost and network safeguards |
| Dashboard shell and preview-definition inputs | Native Azure Monitor Grafana resource and optional versioned JSON definition |

## Foundry core inputs

| Parameters | Object contract |
|---|---|
| `enableActivityLogAlerts`, `activityLogAlertDefinitions` | Each definition supplies `name`, `description`, `enabled`, `scopes`, and `conditionAllOf` for Foundry change, health, or deployment conditions |
| `enableMetricAlerts`, `metricAlertDefinitions` | Each definition supplies `name` and full metric-alert properties except actions; the package wires its action group |
| `enableAlertProcessingRules`, `alertProcessingRuleDefinitions` | Each definition supplies `name`, `location`, and full `Microsoft.AlertsManagement/actionRules` properties |

## Foundry diagnostics inputs

| Parameters | Object contract |
|---|---|
| `enableFoundryDiagnosticSetting`, `foundryDiagnosticSetting` | Existing target subscription, resource group, Foundry account, diagnostic setting name, selected logs, metrics, optional destination type |
| `enableApplicationInsights`, `applicationInsightsConfiguration` | Name, kind, type, retention, sampling, local-auth setting, ingestion and query network-access settings |
| `enableAvailabilityTests`, `availabilityTestDefinitions` | Safe endpoint test `name`, `kind`, properties, optional tags; no headers or request data containing secrets |
| `enableScheduledQueryAlerts`, `scheduledQueryAlertDefinitions` | Full alert name, display fields, scope, frequency, window, criteria, severity, `autoMitigate`, and `skipQueryValidation` behavior |

Feature switches do not fill missing objects or create defaults. A false switch keeps the
module disabled; a true switch requires a complete, reviewed private definition.

## Model-use profile inputs

The model-use profile has no public subscription or account values. A private overlay
uses the dashboard-definition switches plus a source-controlled dashboard JSON file. It
replaces the file's four target placeholders before supplying the serialized string.
`grafanaDashboardDefinitionName` is always `default`, which Azure requires for native
Azure Monitor dashboard definitions.

The initial private metric-alert definitions use only verified account metrics and
explicit static thresholds:

| Signal | Metric and dimension | Recommended initial response |
|---|---|---|
| Availability degradation | `ModelAvailabilityRate` by model deployment | Investigate Azure health and current deployment use |
| Throttling | `ModelRequests` with `StatusCode` 429 | Identify the deployment and request-rate change |
| Server failure | `ModelRequests` with `StatusCode` 5xx | Investigate Azure health, configuration change, and active alerts |

No hardcoded metric thresholds, resource IDs, subscription IDs, locations, account
names, or recipients are added to the reusable Bicep. The private parameter file owns
all of them.
