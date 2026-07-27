param alertDefinitions array
param actionGroupResourceId string
param location string
param tags object

resource scheduledQueryAlerts 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = [for definition in alertDefinitions: {
  name: definition.name
  location: location
  kind: 'LogAlert'
  tags: tags
  properties: {
    displayName: definition.displayName
    description: definition.description
    enabled: definition.enabled
    severity: definition.severity
    scopes: definition.scopes
    evaluationFrequency: definition.evaluationFrequency
    windowSize: definition.windowSize
    criteria: definition.criteria
    autoMitigate: definition.autoMitigate
    skipQueryValidation: definition.skipQueryValidation
    actions: {
      actionGroups: [
        actionGroupResourceId
      ]
    }
  }
}]

output ids array = [for (definition, index) in alertDefinitions: scheduledQueryAlerts[index].id]
