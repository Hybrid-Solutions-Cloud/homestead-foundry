using '../main.bicep'

// Public, fictitious example only. Copy this file to an ignored private overlay
// and replace every example value before a what-if or deployment.
param workload = 'example'
param environment = 'dev'
param regionCode = 'eus'
param instance = '01'
param location = 'eastus'
param ownerAlias = 'example-owner'
param project = 'example-foundry'
param costCenter = 'example-cost-center'
param lifecycle = 'permanent'
param expiresOn = ''
param managedBy = 'bicep'

param operationsEmails = [
  'operations@example.invalid'
]
param actionGroupShortName = 'fdry-alerts'
param actionGroupLocation = 'global'

param monthlyBudgetUsd = 100
param budgetName = 'budget-example-credit-sub-01'
param budgetStartDate = '2026-01-01'
param budgetEndDate = '2036-01-01T00:00:00Z'
param budgetActualAlertThresholds = {
  low: 10
  medium: 25
  high: 50
}
param enableBudgetForecastNotifications = false
param budgetForecastAlertThresholds = {
  low: 10
  medium: 25
  high: 50
}

param logAnalyticsSkuName = 'PerGB2018'
param azureMonitorWorkspacePublicNetworkAccess = 'Enabled'
param logAnalyticsRetentionInDays = 30
param logAnalyticsDailyQuotaGb = 1
param deployGrafanaDashboardShell = true
param deployGrafanaDashboardDefinitionPreview = false
param grafanaDashboardDefinitionName = 'default'
param grafanaDashboardDefinitionSerializedData = ''

// Optional ActualCost snapshots for the billed-cost dashboard section. The
// collector uses managed identity and writes one compact snapshot per run.
param enableFoundryCostCollection = false
param foundryCostCollectionConfiguration = {
  targetSubscriptionId: '00000000-0000-0000-0000-000000000000'
  targetResourceGroupName: 'rg-<initiative>-<env>-<region>-01'
  collectionIntervalHours: 4
  retentionInDays: 30
}

param alertRuleLocation = 'global'
param enableActivityLogAlerts = false
param activityLogAlertDefinitions = []
param enableMetricAlerts = false
param metricAlertDefinitions = []
param enableAlertProcessingRules = false
param alertProcessingRuleDefinitions = []

param enableFoundryDiagnosticSetting = false
param foundryDiagnosticSetting = {}
param enableApplicationInsights = false
param applicationInsightsConfiguration = {}
param enableAvailabilityTests = false
param availabilityTestDefinitions = []
param enableScheduledQueryAlerts = false
param scheduledQueryAlertDefinitions = []

// ------------------------- model gateway monitoring -------------------------
// All of this is for the OPTIONAL model gateway (docs/guide/model-gateway.md).
// Leave it off unless you deployed one; most deployments do not.
//
// These read Microsoft.Web/sites PLATFORM metrics, which Azure collects with no
// configuration. They do NOT use the Azure Monitor workspace and cannot: that
// workspace stores Prometheus metrics, and App Service platform metrics go to
// the Azure Monitor metrics database instead. The diagnostic setting below is
// for the HTTP LOGS, which are the part that is not a metric.

param enableGatewayDiagnosticSetting = false
param gatewayDiagnosticSetting = {
  targetSubscriptionId: '00000000-0000-0000-0000-000000000000'
  targetResourceGroupName: 'rg-<initiative>-<env>-<region>-01'
  gatewayName: 'app-gw-<initiative>-<env>-<region>-01'
  name: 'diag-gateway-to-law'
  // AppServiceHTTPLogs answers "who called, what did they get, how long did it
  // take". AppServiceConsoleLogs and AppServicePlatformLogs carry the shim's own
  // stdout, which is where a stripped-parameter line shows up.
  logs: [
    { category: 'AppServiceHTTPLogs', enabled: true }
    { category: 'AppServiceConsoleLogs', enabled: true }
    { category: 'AppServicePlatformLogs', enabled: true }
  ]
  metrics: [
    { category: 'AllMetrics', enabled: true }
  ]
}

// Add these to metricAlertDefinitions when the gateway is deployed. Both are
// whole-gateway: an App Service has no per-model dimension to split on.
//
//   {
//     name: 'alert-gateway-5xx'
//     properties: {
//       description: 'The gateway is failing requests. Every model behind it is affected.'
//       severity: 1
//       enabled: true
//       scopes: [ '<gateway resource id>' ]
//       evaluationFrequency: 'PT1M'
//       windowSize: 'PT5M'
//       criteria: {
//         'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
//         allOf: [
//           {
//             name: 'Http5xx'
//             metricName: 'Http5xx'
//             metricNamespace: 'Microsoft.Web/sites'
//             operator: 'GreaterThan'
//             threshold: 5
//             timeAggregation: 'Total'
//             criterionType: 'StaticThresholdCriterion'
//           }
//         ]
//       }
//     }
//   }
//
// Deliberately NOT alerting on Http4xx. A 401 there is a caller presenting the
// wrong gateway token, which is the security control working, not an incident.

// Add this to availabilityTestDefinitions to have Application Insights probe
// /health from outside Azure. The endpoint is unauthenticated on purpose so a
// probe can reach it, and it reports nothing about the account behind it.
//
//   {
//     name: 'avail-gateway-health'
//     kind: 'standard'
//     properties: {
//       Name: 'avail-gateway-health'
//       SyntheticMonitorId: 'avail-gateway-health'
//       Enabled: true
//       Frequency: 300
//       Timeout: 30
//       Kind: 'standard'
//       RetryEnabled: true
//       Locations: [ { Id: 'us-il-ch1-azr' }, { Id: 'emea-nl-ams-azr' } ]
//       Request: { RequestUrl: 'https://<gateway>.azurewebsites.net/health', HttpVerb: 'GET' }
//       ValidationRules: { ExpectedHttpStatusCode: 200, SSLCheck: true, SSLCertRemainingLifetimeCheck: 7 }
//     }
//   }
