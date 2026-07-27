param targetFoundryAccountName string
param name string
param logAnalyticsWorkspaceResourceId string
param logs array
param metrics array
param logAnalyticsDestinationType string

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: targetFoundryAccountName
}

var destinationType = empty(logAnalyticsDestinationType) ? {} : {
  logAnalyticsDestinationType: logAnalyticsDestinationType
}

resource diagnosticSetting 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: name
  scope: foundryAccount
  properties: union({
    workspaceId: logAnalyticsWorkspaceResourceId
    logs: logs
    metrics: metrics
  }, destinationType)
}

output id string = diagnosticSetting.id
