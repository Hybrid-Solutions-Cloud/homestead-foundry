// Parallel replacement foundation. Existing resources are deliberately outside this template.
targetScope = 'subscription'

param workload string
param environment string = 'prod'
param instance string
param owner string
param project string
param costCenter string
param primaryLocation string = 'eastus'
param secondaryLocation string = 'eastus2'
param primaryRegionCode string = 'eus'
param secondaryRegionCode string = 'eus2'
param keyVaultName string
param keyVaultResourceGroupName string
param gatewayTokenSecretName string
param primaryKeySecretName string
param secondaryKeySecretName string
param deployGateway bool = false

var primaryBase = '${workload}-${environment}-${primaryRegionCode}-${instance}'
var secondaryBase = '${workload}-${environment}-${secondaryRegionCode}-${instance}'
var tags = {
  Owner: owner
  Project: project
  Environment: environment
  CostCenter: costCenter
  ManagedBy: 'bicep'
  Generation: instance
}

module primaryGroup '../modules/resource-group.bicep' = {
  name: 'migration-primary-group-${instance}'
  params: { name: 'rg-${primaryBase}', location: primaryLocation, tags: tags }
}
module secondaryGroup '../modules/resource-group.bicep' = {
  name: 'migration-secondary-group-${instance}'
  params: { name: 'rg-${secondaryBase}', location: secondaryLocation, tags: tags }
}
module primary '../modules/foundry-account.bicep' = {
  name: 'migration-primary-${instance}'
  scope: resourceGroup('rg-${primaryBase}')
  dependsOn: [primaryGroup]
  params: {
    accountName: 'aif-${primaryBase}'
    location: primaryLocation
    tags: tags
    skuName: 'S0'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    restoreSoftDeleted: false
    createProject: true
    projectName: 'proj-${workload}-main-${instance}'
    models: []
    modelCatalog: {}
    capacity: 1
  }
}
module secondary '../modules/foundry-account.bicep' = {
  name: 'migration-secondary-${instance}'
  scope: resourceGroup('rg-${secondaryBase}')
  dependsOn: [secondaryGroup]
  params: {
    accountName: 'aif-${secondaryBase}'
    location: secondaryLocation
    tags: tags
    skuName: 'S0'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    restoreSoftDeleted: false
    createProject: true
    projectName: 'proj-${workload}-media-${instance}'
    models: []
    modelCatalog: {}
    capacity: 1
  }
}
module gateway '../modules/model-gateway.bicep' = if (deployGateway) {
  name: 'migration-gateway-${instance}'
  scope: resourceGroup('rg-${primaryBase}')
  dependsOn: [primary, secondary]
  params: {
    location: primaryLocation
    planName: 'asp-${primaryBase}'
    gatewayName: 'app-gw-${primaryBase}'
    foundryAccountName: 'aif-${primaryBase}'
    keyVaultName: keyVaultName
    keyVaultResourceGroupName: keyVaultResourceGroupName
    foundryKeySecretName: primaryKeySecretName
    gatewayTokenSecretName: gatewayTokenSecretName
    tags: tags
    secondaryAccountName: 'aif-${secondaryBase}'
    secondaryKeySecretName: secondaryKeySecretName
  }
}
output primaryAccountId string = primary.outputs.accountId
output secondaryAccountId string = secondary.outputs.accountId
output gatewayName string = 'app-gw-${primaryBase}'
