targetScope = 'subscription'

// Sends the subscription Activity Log to the operations workspace so the
// dashboard can show control-plane changes by client, including changes made
// through the Foundry MCP Server. A subscription can hold several Activity Log
// diagnostic settings, so this sits beside any existing export (for example to
// a security workspace) and does not replace it.

@description('Name of the diagnostic setting. Must be unique within the subscription.')
param settingName string = 'diag-activity-foundry-operations'

@description('Resource ID of the Log Analytics workspace the operations dashboard reads.')
param workspaceResourceId string

@description('Activity Log categories to export. Administrative is enough for the control-plane change panels.')
param categories array = [
  'Administrative'
]

resource activityExport 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: settingName
  properties: {
    workspaceId: workspaceResourceId
    logs: [
      for category in categories: {
        category: category
        enabled: true
      }
    ]
  }
}

output settingId string = activityExport.id
