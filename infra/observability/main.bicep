// Foundry-specific observability package for an existing Azure AI Foundry workload.
// This subscription-scope deployment is separate from ../main.bicep. It owns only
// Foundry observability, cost controls, and response resources. It never creates,
// changes, or deletes the Foundry account, project, model deployments, or application.
targetScope = 'subscription'

@minLength(2)
@maxLength(24)
@description('Lowercase workload token used in CAF-derived resource names.')
param workload string

@allowed([
  'dev'
  'stg'
  'prd'
  'prod'
])
@description('Deployment environment token. prod is retained for compatibility with established CAF-named workloads.')
param environment string

@minLength(2)
@maxLength(5)
@description('CAF region token used in resource names.')
param regionCode string

@minLength(2)
@maxLength(2)
@description('Zero-padded CAF instance identifier.')
param instance string

@description('Azure region for regional observability resources.')
param location string

@description('Accountable owner or team alias for the Owner tag.')
param ownerAlias string

@description('Foundry product or workload value for the Project tag.')
param project string

@description('Allocation code for the CostCenter tag.')
param costCenter string

@allowed([
  'permanent'
  'temporary'
  'sandbox'
])
@description('Lifecycle tag for package-created resources.')
param lifecycle string

@description('ISO 8601 expiry date for temporary or sandbox resources. Supply an empty string only for permanent resources.')
param expiresOn string

@description('Provisioning authority for the ManagedBy tag.')
param managedBy string

@minLength(1)
@description('Private action-group recipient addresses. Keep real addresses in a private overlay.')
param operationsEmails string[]

@minLength(1)
@maxLength(12)
@description('Short display name in action-group notifications.')
param actionGroupShortName string

@description('Azure-supported action-group location.')
param actionGroupLocation string

@minValue(1)
@description('Monthly subscription budget in USD. This is an alert threshold, not a spending cap.')
param monthlyBudgetUsd int

@description('First day of the monthly budget period in yyyy-MM-01 form.')
param budgetStartDate string

@description('Actual-cost budget notifications. Object keys: low, medium, high. Values are percentages.')
param budgetActualAlertThresholds object

@description('Whether forecast budget notifications are enabled.')
param enableBudgetForecastNotifications bool

@description('Forecast budget notifications. Object keys: low, medium, high. Values are percentages.')
param budgetForecastAlertThresholds object

@description('Log Analytics SKU name selected by the consumer.')
param logAnalyticsSkuName string

@minValue(30)
@description('Log Analytics interactive retention in days.')
param logAnalyticsRetentionInDays int

@minValue(1)
@description('Log Analytics daily quota safety value in GB.')
param logAnalyticsDailyQuotaGb int

@description('Whether to create the native Azure Monitor dashboard with Grafana shell.')
param deployGrafanaDashboardShell bool

@description('Whether to deploy the preview native Grafana dashboard-definition resource.')
param deployGrafanaDashboardDefinitionPreview bool

@description('Dashboard-definition child-resource name.')
param grafanaDashboardDefinitionName string

@description('Serialized source-controlled dashboard JSON. It must contain no credentials, private URLs, prompts, responses, or personal data.')
param grafanaDashboardDefinitionSerializedData string

@description('Azure-supported location for Foundry alert rule resources.')
param alertRuleLocation string

@description('Whether to deploy selected Activity Log alerts for Foundry deployment failures, Service Health, Resource Health, or high-risk resource changes.')
param enableActivityLogAlerts bool

@description('Activity Log alert definitions. Each item contains name, description, enabled, scopes, and conditionAllOf.')
param activityLogAlertDefinitions array

@description('Whether to deploy Azure Monitor metric alerts for existing Foundry resources. Enable only metrics supported by the target account or project.')
param enableMetricAlerts bool

@description('Foundry metric alert definitions. Each item contains name and full metric-alert properties except actions.')
param metricAlertDefinitions array

@description('Whether to deploy Foundry alert-processing rules for approved maintenance or response routing scenarios.')
param enableAlertProcessingRules bool

@description('Alert-processing rule definitions. Each item contains name, location, and full properties.')
param alertProcessingRuleDefinitions array

@description('Whether to deploy selected diagnostic categories to an existing Microsoft Foundry account.')
param enableFoundryDiagnosticSetting bool

@description('Foundry diagnostic-setting configuration. Required keys when enabled: targetSubscriptionId, targetResourceGroupName, targetFoundryAccountName, name, logs, metrics, optional logAnalyticsDestinationType.')
param foundryDiagnosticSetting object

@description('Whether to create workspace-based Application Insights for an approved Foundry application, API, or agent telemetry scenario.')
param enableApplicationInsights bool

@description('Application Insights configuration. Required keys when enabled are documented in docs/implementation/foundry-observability.md.')
param applicationInsightsConfiguration object

@description('Whether to create approved Application Insights availability tests. This requires Application Insights and a safe, non-destructive health endpoint.')
param enableAvailabilityTests bool

@description('Availability-test definitions. Each item contains name, kind, properties, and optional tags. No secret-bearing request data is allowed.')
param availabilityTestDefinitions array

@description('Whether to create scheduled query alerts against approved Foundry diagnostics or application telemetry.')
param enableScheduledQueryAlerts bool

@description('Scheduled query alert definitions. Each item contains name and full alert properties.')
param scheduledQueryAlertDefinitions array

var observabilityBaseName = '${workload}-obs-${environment}-${regionCode}-${instance}'
var names = {
  resourceGroup: 'rg-${observabilityBaseName}'
  logAnalytics: 'log-${observabilityBaseName}'
  azureMonitorWorkspace: 'amw-${observabilityBaseName}'
  actionGroup: 'ag-${observabilityBaseName}'
  budget: 'budget-${workload}-${environment}-${instance}'
  dashboard: 'dash-${workload}-${environment}-${regionCode}-${instance}'
}

var requiredTags = {
  Owner: ownerAlias
  Project: project
  Environment: environment
  CostCenter: costCenter
  ManagedBy: managedBy
  Lifecycle: lifecycle
}

var tags = empty(expiresOn) ? requiredTags : union(requiredTags, {
  ExpiresOn: expiresOn
})

var deployActivityAlerts = enableActivityLogAlerts && !empty(activityLogAlertDefinitions)
var deployMetricAlertDefinitions = enableMetricAlerts && !empty(metricAlertDefinitions)
var deployAlertProcessingRules = enableAlertProcessingRules && !empty(alertProcessingRuleDefinitions)
var deployAvailability = enableApplicationInsights && enableAvailabilityTests && !empty(availabilityTestDefinitions)
var deployScheduledQueries = enableScheduledQueryAlerts && !empty(scheduledQueryAlertDefinitions)

module observabilityResourceGroup 'modules/resource-group.bicep' = {
  name: 'deploy-${names.resourceGroup}'
  params: {
    name: names.resourceGroup
    location: location
    tags: tags
  }
}

module logAnalytics 'modules/log-analytics-workspace.bicep' = {
  name: 'deploy-${names.logAnalytics}'
  scope: resourceGroup(names.resourceGroup)
  dependsOn: [
    observabilityResourceGroup
  ]
  params: {
    name: names.logAnalytics
    location: location
    tags: tags
    skuName: logAnalyticsSkuName
    retentionInDays: logAnalyticsRetentionInDays
    dailyQuotaGb: logAnalyticsDailyQuotaGb
  }
}

module azureMonitorWorkspace 'modules/azure-monitor-workspace.bicep' = {
  name: 'deploy-${names.azureMonitorWorkspace}'
  scope: resourceGroup(names.resourceGroup)
  dependsOn: [
    observabilityResourceGroup
  ]
  params: {
    name: names.azureMonitorWorkspace
    location: location
    tags: tags
  }
}

module actionGroup 'modules/action-group.bicep' = {
  name: 'deploy-${names.actionGroup}'
  scope: resourceGroup(names.resourceGroup)
  dependsOn: [
    observabilityResourceGroup
  ]
  params: {
    name: names.actionGroup
    location: actionGroupLocation
    shortName: actionGroupShortName
    emailAddresses: operationsEmails
    tags: tags
  }
}

module subscriptionBudget 'modules/subscription-budget.bicep' = {
  name: 'deploy-${names.budget}'
  params: {
    name: names.budget
    amountUsd: monthlyBudgetUsd
    startDate: budgetStartDate
    actionGroupResourceId: actionGroup.outputs.id
    contactEmails: operationsEmails
    actualAlertThresholds: budgetActualAlertThresholds
    enableForecastNotifications: enableBudgetForecastNotifications
    forecastAlertThresholds: budgetForecastAlertThresholds
  }
}

module grafanaDashboard 'modules/grafana-dashboard.bicep' = if (deployGrafanaDashboardShell) {
  name: 'deploy-${names.dashboard}'
  scope: resourceGroup(names.resourceGroup)
  dependsOn: [
    observabilityResourceGroup
  ]
  params: {
    name: names.dashboard
    location: location
    tags: tags
    deployDashboardDefinitionPreview: deployGrafanaDashboardDefinitionPreview
    dashboardDefinitionName: grafanaDashboardDefinitionName
    dashboardDefinitionSerializedData: grafanaDashboardDefinitionSerializedData
  }
}

module activityAlerts 'modules/activity-log-alerts.bicep' = if (deployActivityAlerts) {
  name: 'deploy-${workload}-activity-alerts-${instance}'
  scope: resourceGroup(names.resourceGroup)
  params: {
    alertDefinitions: activityLogAlertDefinitions
    actionGroupResourceId: actionGroup.outputs.id
    alertLocation: alertRuleLocation
    tags: tags
  }
}

module metricAlerts 'modules/metric-alerts.bicep' = if (deployMetricAlertDefinitions) {
  name: 'deploy-${workload}-metric-alerts-${instance}'
  scope: resourceGroup(names.resourceGroup)
  params: {
    alertDefinitions: metricAlertDefinitions
    actionGroupResourceId: actionGroup.outputs.id
    alertLocation: alertRuleLocation
    tags: tags
  }
}

module alertProcessingRules 'modules/alert-processing-rules.bicep' = if (deployAlertProcessingRules) {
  name: 'deploy-${workload}-alert-processing-${instance}'
  scope: resourceGroup(names.resourceGroup)
  params: {
    ruleDefinitions: alertProcessingRuleDefinitions
  }
}

module foundryDiagnostics 'modules/foundry-diagnostic-setting.bicep' = if (enableFoundryDiagnosticSetting) {
  name: 'deploy-${workload}-foundry-diagnostics-${instance}'
  scope: resourceGroup(foundryDiagnosticSetting.targetSubscriptionId, foundryDiagnosticSetting.targetResourceGroupName)
  params: {
    targetFoundryAccountName: foundryDiagnosticSetting.targetFoundryAccountName
    name: foundryDiagnosticSetting.name
    logAnalyticsWorkspaceResourceId: logAnalytics.outputs.id
    logs: foundryDiagnosticSetting.logs
    metrics: foundryDiagnosticSetting.metrics
    logAnalyticsDestinationType: foundryDiagnosticSetting.?logAnalyticsDestinationType ?? ''
  }
}

module applicationInsights 'modules/application-insights.bicep' = if (enableApplicationInsights) {
  name: 'deploy-${workload}-application-insights-${instance}'
  scope: resourceGroup(names.resourceGroup)
  params: {
    name: applicationInsightsConfiguration.name
    location: location
    kind: applicationInsightsConfiguration.kind
    applicationType: applicationInsightsConfiguration.applicationType
    logAnalyticsWorkspaceResourceId: logAnalytics.outputs.id
    retentionInDays: applicationInsightsConfiguration.retentionInDays
    samplingPercentage: applicationInsightsConfiguration.samplingPercentage
    disableLocalAuth: applicationInsightsConfiguration.disableLocalAuth
    publicNetworkAccessForIngestion: applicationInsightsConfiguration.publicNetworkAccessForIngestion
    publicNetworkAccessForQuery: applicationInsightsConfiguration.publicNetworkAccessForQuery
    tags: tags
  }
}

module availabilityTests 'modules/availability-tests.bicep' = if (deployAvailability) {
  name: 'deploy-${workload}-availability-tests-${instance}'
  scope: resourceGroup(names.resourceGroup)
  params: {
    tests: availabilityTestDefinitions
    applicationInsightsResourceId: applicationInsights!.outputs.id
    location: location
    tags: tags
  }
}

module scheduledQueryAlerts 'modules/scheduled-query-alerts.bicep' = if (deployScheduledQueries) {
  name: 'deploy-${workload}-scheduled-query-alerts-${instance}'
  scope: resourceGroup(names.resourceGroup)
  params: {
    alertDefinitions: scheduledQueryAlertDefinitions
    actionGroupResourceId: actionGroup.outputs.id
    location: location
    tags: tags
  }
}

output observabilityResourceGroupName string = names.resourceGroup
output logAnalyticsWorkspaceResourceId string = logAnalytics.outputs.id
output azureMonitorWorkspaceResourceId string = azureMonitorWorkspace.outputs.id
output actionGroupResourceId string = actionGroup.outputs.id
output capabilityStatus object = {
  activityLogAlerts: deployActivityAlerts
  metricAlerts: deployMetricAlertDefinitions
  alertProcessingRules: deployAlertProcessingRules
  foundryDiagnosticSetting: enableFoundryDiagnosticSetting
  applicationInsights: enableApplicationInsights
  availabilityTests: deployAvailability
  scheduledQueryAlerts: deployScheduledQueries
  dashboardDefinitionPreview: deployGrafanaDashboardShell && deployGrafanaDashboardDefinitionPreview && !empty(grafanaDashboardDefinitionSerializedData)
}
