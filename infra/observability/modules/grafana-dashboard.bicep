param name string
param location string
param tags object
param deployDashboardDefinitionPreview bool
param dashboardDefinitionName string
param dashboardDefinitionSerializedData string

// This is the native Azure Monitor dashboard with Grafana resource. It is not
// Microsoft.Dashboard/grafana, which is Azure Managed Grafana.
resource dashboard 'Microsoft.Dashboard/dashboards@2025-08-01' = {
  name: name
  location: location
  tags: tags
  properties: {}
}

// Dashboard definition automation uses the current preview ARM type. The shell is
// stable and the preview child is enabled only by an explicit profile switch.
resource dashboardDefinition 'Microsoft.Dashboard/dashboards/dashboardDefinitions@2025-09-01-preview' = if (deployDashboardDefinitionPreview && !empty(dashboardDefinitionSerializedData)) {
  parent: dashboard
  name: dashboardDefinitionName
  properties: {
    serializedData: dashboardDefinitionSerializedData
  }
}

output id string = dashboard.id
output dashboardDefinitionId string = deployDashboardDefinitionPreview && !empty(dashboardDefinitionSerializedData) ? dashboardDefinition!.id : ''
