param tests array
param applicationInsightsResourceId string
param location string
param tags object

resource availabilityTests 'Microsoft.Insights/webTests@2022-06-15' = [for test in tests: {
  name: test.name
  location: location
  kind: test.kind
  tags: union(tags, test.?tags ?? {}, {
    'hidden-link:${applicationInsightsResourceId}': 'Resource'
  })
  properties: test.properties
}]

output ids array = [for (test, index) in tests: availabilityTests[index].id]
