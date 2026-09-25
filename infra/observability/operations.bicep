// Operations coverage. Set dashboardName to the existing dashboard to consolidate views.
param location string = 'eastus'
param workspaceName string
param actionGroupName string
param dashboardName string
param applicationInsightsName string
param dashboardData string
param foundryTargets array
param metricAlertDefinitions array = []
param queryAlertDefinitions array = []
param tags object
param costResourceGroups array = []

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = { name: workspaceName }
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' existing = { name: actionGroupName }
resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    RetentionInDays: 30
    SamplingPercentage: 100
    DisableLocalAuth: false
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}
module diagnostics 'modules/foundry-diagnostic-setting.bicep' = [for (target, i) in foundryTargets: {
  name: 'operations-diagnostics-${i}'
  scope: resourceGroup(target.resourceGroup)
  params: {
    targetFoundryAccountName: target.name
    name: target.diagnosticName
    logAnalyticsWorkspaceResourceId: workspace.id
    logAnalyticsDestinationType: 'Dedicated'
    logs: [
      { category: 'Audit', enabled: true }
      { category: 'AzureOpenAIRequestUsage', enabled: true }
    ]
    metrics: []
  }
}]
module dashboard 'modules/grafana-dashboard.bicep' = {
  name: 'operations-dashboard'
  params: {
    name: dashboardName
    location: location
    tags: tags
    deployDashboardDefinitionPreview: true
    dashboardDefinitionName: 'default'
    dashboardDefinitionSerializedData: dashboardData
  }
}
module metricAlerts 'modules/metric-alerts.bicep' = {
  name: 'operations-metric-alerts'
  params: {
    alertDefinitions: metricAlertDefinitions
    actionGroupResourceId: actionGroup.id
    alertLocation: 'global'
    tags: tags
  }
}
module queryAlerts 'modules/scheduled-query-alerts.bicep' = {
  name: 'operations-query-alerts'
  params: {
    alertDefinitions: queryAlertDefinitions
    actionGroupResourceId: actionGroup.id
    location: location
    tags: tags
  }
}
output dashboardId string = dashboard.outputs.id
output applicationInsightsId string = insights.id

@batchSize(1)
module costCollectors 'modules/product-cost-collection.bicep' = [for (groupName, i) in costResourceGroups: {
  name: 'product-cost-${i}'
  params: {
    logAnalyticsWorkspaceName: workspaceName
    location: location
    tags: tags
    targetSubscriptionId: subscription().subscriptionId
    targetResourceGroupName: groupName
    workflowName: 'logic-foundry-cost-${i}-02'
    dataCollectionRuleName: 'dcr-foundry-cost-${i}-02'
  }
}]
module costReaders 'modules/resource-group-role-assignment.bicep' = [for (groupName, i) in costResourceGroups: {
  name: 'product-cost-reader-${i}'
  scope: resourceGroup(groupName)
  params: {
    principalId: costCollectors[i].outputs.workflowPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: '72fafb9e-0641-4937-9268-a91bfd8191a3'
  }
}]
