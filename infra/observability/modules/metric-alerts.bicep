param alertDefinitions array
param actionGroupResourceId string
param alertLocation string
param tags object

resource metricAlerts 'Microsoft.Insights/metricAlerts@2018-03-01' = [for definition in alertDefinitions: {
  name: definition.name
  location: alertLocation
  tags: tags
  properties: union(definition.properties, {
    actions: [
      {
        actionGroupId: actionGroupResourceId
      }
    ]
  })
}]

output ids array = [for (definition, index) in alertDefinitions: metricAlerts[index].id]
