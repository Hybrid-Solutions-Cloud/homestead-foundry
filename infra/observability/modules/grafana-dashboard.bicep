param name string
param location string
param tags object

// Native Azure Monitor dashboard with Grafana resource. This is deliberately
// Microsoft.Dashboard/dashboards, not Microsoft.Dashboard/grafana, which is
// the Azure Managed Grafana service.
resource dashboard 'Microsoft.Dashboard/dashboards@2025-08-01' = {
  name: name
  location: location
  tags: tags
  properties: {}
}

output id string = dashboard.id
