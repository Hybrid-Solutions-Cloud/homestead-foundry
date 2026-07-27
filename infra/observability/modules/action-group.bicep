param name string
param shortName string
param emailAddress string
param tags object

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: name
  location: 'global'
  tags: tags
  properties: {
    groupShortName: shortName
    enabled: true
    emailReceivers: [
      {
        name: 'operations-owner'
        emailAddress: emailAddress
        useCommonAlertSchema: true
      }
    ]
  }
}

output id string = actionGroup.id
