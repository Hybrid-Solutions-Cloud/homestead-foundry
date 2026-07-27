// Cost-first observability foundation for an existing Azure AI Foundry workload.
// This package is intentionally separate from ../main.bicep. It creates shared
// observability controls without owning the Foundry account or model deployments.
// No diagnostic setting, Application Insights tracing, or Prometheus scraping is
// enabled here. Those data-producing features require a separate approved change.
targetScope = 'subscription'

@description('Short, lowercase, undelimited workload token. Limited to 11 characters so the native Grafana dashboard name remains within Azure limits.')
@minLength(3)
@maxLength(11)
param workload string

@description('Environment served by the workload.')
@allowed([
  'prod'
  'dev'
  'test'
])
param env string

@description('CAF short code for the Azure region, for example eus.')
@minLength(2)
@maxLength(5)
param regionToken string

@description('Two-digit instance token; first instance is 01.')
@minLength(2)
@maxLength(2)
param instance string = '01'

@description('Azure region for the observability resource group and regional resources.')
param location string

@description('Named human owner. Do not supply an object ID or credential.')
@minLength(2)
param ownerAlias string

@description('Product or project name used for cost allocation.')
@minLength(2)
param project string

@description('Cost center or personal allocation code.')
@minLength(1)
param costCenter string

@description('Lifecycle classification for the observability foundation.')
@allowed([
  'permanent'
  'temporary'
  'sandbox'
])
param lifecycle string = 'permanent'

@description('ISO 8601 expiry date for temporary or sandbox resources. Leave empty for permanent resources.')
param expiresOn string = ''

@description('Automation owner recorded in the ManagedBy tag.')
param managedBy string = 'bicep'

@description('Action group email recipient. Keep the real value in a private local parameter file.')
param operationsEmail string

@description('Short name shown in action group notifications. Azure limits this to 12 characters.')
@minLength(1)
@maxLength(12)
param actionGroupShortName string = 'foundry-obs'

@description('Monthly subscription-level credit or spend alert threshold in USD. This is an alert, not a hard spending cap.')
@minValue(1)
param monthlyCreditBudgetUsd int

@description('First day of the budget period, in yyyy-MM-01 form.')
param budgetStartDate string = utcNow('yyyy-MM-01')

@description('Log Analytics interactive retention. Thirty days is the lean baseline; no data is sent until an approved data source is configured.')
@minValue(30)
param logAnalyticsRetentionInDays int = 30

@description('Log Analytics daily cap in GB. This is a safety circuit, not a billing hard-stop. Keep it low until an approved data source needs more.')
@minValue(1)
param logAnalyticsDailyQuotaGb int = 1

@description('Create a native Azure Monitor dashboard resource shell for the Grafana experience. It is not Azure Managed Grafana and carries no Grafana service charge.')
param deployGrafanaDashboardShell bool = true

var observabilityBaseName = '${workload}-obs-${env}-${regionToken}-${instance}'
var dashboardName = 'dash-${workload}-${env}-${regionToken}-${instance}'
var names = {
  resourceGroup: 'rg-${observabilityBaseName}'
  logAnalytics: 'log-${observabilityBaseName}'
  azureMonitorWorkspace: 'amw-${observabilityBaseName}'
  actionGroup: 'ag-${observabilityBaseName}'
  subscriptionBudget: 'budget-${workload}-credit-sub-${instance}'
  dashboard: dashboardName
}

var requiredTags = {
  Owner: ownerAlias
  Project: project
  Environment: env
  CostCenter: costCenter
  ManagedBy: managedBy
  Lifecycle: lifecycle
}
var tags = empty(expiresOn) ? requiredTags : union(requiredTags, {
  ExpiresOn: expiresOn
})

module observabilityRg 'modules/resource-group.bicep' = {
  name: 'deploy-${names.resourceGroup}'
  params: {
    name: names.resourceGroup
    location: location
    tags: tags
  }
}

module logAnalytics 'modules/log-analytics-workspace.bicep' = {
  name: 'deploy-${names.logAnalytics}'
  scope: az.resourceGroup(names.resourceGroup)
  dependsOn: [
    observabilityRg
  ]
  params: {
    name: names.logAnalytics
    location: location
    tags: tags
    retentionInDays: logAnalyticsRetentionInDays
    dailyQuotaGb: logAnalyticsDailyQuotaGb
  }
}

module azureMonitorWorkspace 'modules/azure-monitor-workspace.bicep' = {
  name: 'deploy-${names.azureMonitorWorkspace}'
  scope: az.resourceGroup(names.resourceGroup)
  dependsOn: [
    observabilityRg
  ]
  params: {
    name: names.azureMonitorWorkspace
    location: location
    tags: tags
  }
}

module actionGroup 'modules/action-group.bicep' = {
  name: 'deploy-${names.actionGroup}'
  scope: az.resourceGroup(names.resourceGroup)
  dependsOn: [
    observabilityRg
  ]
  params: {
    name: names.actionGroup
    shortName: actionGroupShortName
    emailAddress: operationsEmail
    tags: tags
  }
}

module subscriptionBudget 'modules/subscription-budget.bicep' = {
  name: 'deploy-${names.subscriptionBudget}'
  params: {
    name: names.subscriptionBudget
    amountUsd: monthlyCreditBudgetUsd
    startDate: budgetStartDate
    actionGroupResourceId: actionGroup.outputs.id
    contactEmail: operationsEmail
  }
}

module grafanaDashboard 'modules/grafana-dashboard.bicep' = if (deployGrafanaDashboardShell) {
  name: 'deploy-${names.dashboard}'
  scope: az.resourceGroup(names.resourceGroup)
  dependsOn: [
    observabilityRg
  ]
  params: {
    name: names.dashboard
    location: location
    tags: tags
  }
}

output observabilityResourceGroupName string = names.resourceGroup
output logAnalyticsWorkspaceName string = names.logAnalytics
output azureMonitorWorkspaceName string = names.azureMonitorWorkspace
output actionGroupName string = names.actionGroup
output subscriptionBudgetName string = names.subscriptionBudget
output grafanaDashboardName string = deployGrafanaDashboardShell ? names.dashboard : ''
output logAnalyticsWorkspaceResourceId string = logAnalytics.outputs.id
output azureMonitorWorkspaceResourceId string = azureMonitorWorkspace.outputs.id
output actionGroupResourceId string = actionGroup.outputs.id
output grafanaDashboardResourceId string = deployGrafanaDashboardShell ? grafanaDashboard!.outputs.id : ''
