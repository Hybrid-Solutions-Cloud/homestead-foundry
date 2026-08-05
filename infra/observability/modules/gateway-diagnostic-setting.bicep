// Routes the model gateway's App Service logs and metrics into Log Analytics.
//
// Separate from foundry-diagnostic-setting.bicep because that one is typed to
// Microsoft.CognitiveServices/accounts. A diagnostic setting is scoped to a
// specific resource, and the categories differ per resource type, so the two
// cannot share a module without losing the type safety that makes a wrong
// category name fail at build rather than at deploy.
//
// WHY THIS AND NOT AN AZURE MONITOR WORKSPACE
// An Azure Monitor workspace stores PROMETHEUS metrics, collected from
// Kubernetes or by Prometheus remote-write. App Service platform metrics are
// collected automatically into the Azure Monitor metrics database instead, and
// cannot be routed into that workspace. The gateway is therefore observed the
// same way the Foundry account is: platform metrics queried directly through the
// Azure Monitor data source, and resource logs routed here into Log Analytics so
// they can be correlated with everything else. See
// https://learn.microsoft.com/azure/app-service/monitor-app-service

@description('Name of the gateway web app. Must already exist.')
param gatewayName string

@description('Name for the diagnostic setting itself.')
param name string

@description('Destination workspace.')
param logAnalyticsWorkspaceResourceId string

@description('Log categories to route. AppServiceHTTPLogs is the one that answers "who called, what did they get, how long did it take".')
param logs array

@description('Metric categories to route. AllMetrics mirrors the platform metrics into logs so they can be joined against the HTTP logs in one query.')
param metrics array

@description('Dedicated tables cost more per GB but make queries readable. Empty leaves the platform default.')
param logAnalyticsDestinationType string = ''

resource gateway 'Microsoft.Web/sites@2023-12-01' existing = {
  name: gatewayName
}

var destinationType = empty(logAnalyticsDestinationType) ? {} : {
  logAnalyticsDestinationType: logAnalyticsDestinationType
}

resource diagnosticSetting 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: name
  scope: gateway
  properties: union({
    workspaceId: logAnalyticsWorkspaceResourceId
    logs: logs
    metrics: metrics
  }, destinationType)
}

output id string = diagnosticSetting.id
