param alertDefinitions array
param actionGroupResourceId string
param alertLocation string
param tags object

resource activityLogAlerts 'Microsoft.Insights/activityLogAlerts@2026-01-01' = [for definition in alertDefinitions: {
  name: definition.name
  location: alertLocation
  tags: tags
  properties: {
    enabled: definition.enabled
    description: definition.description
    scopes: definition.scopes
    condition: {
      allOf: definition.conditionAllOf
    }
    actions: {
      actionGroups: [
        {
          actionGroupId: actionGroupResourceId
        }
      ]
    }
  }
}]

output ids array = [for (definition, index) in alertDefinitions: activityLogAlerts[index].id]
