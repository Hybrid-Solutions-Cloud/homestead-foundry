// The single resource group every created resource lives in. Deleting it is
// the whole teardown: account, model deployments, project, account-scoped role
// assignments, and the budget all go with it.
targetScope = 'subscription'

param name string
param location string
param tags object

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: name
  location: location
  tags: tags
}

output name string = rg.name
output id string = rg.id
