@description('Alert-processing rules for reviewed routing or maintenance suppression. Each item contains name, location, and full rule properties.')
param ruleDefinitions array

resource alertProcessingRules 'Microsoft.AlertsManagement/actionRules@2021-08-08' = [for definition in ruleDefinitions: {
  name: definition.name
  location: definition.location
  properties: definition.properties
}]

output ids array = [for (definition, index) in ruleDefinitions: alertProcessingRules[index].id]
