param name string
param location string
param shortName string
param emailAddresses string[]
param tags object

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    groupShortName: shortName
    enabled: true
    emailReceivers: [for (emailAddress, index) in emailAddresses: {
      name: 'operations-${index + 1}'
      emailAddress: emailAddress
      useCommonAlertSchema: true
    }]
  }
}

output id string = actionGroup.id
