// AIServices (Foundry) account, registry-driven model deployments, and the
// optional Foundry project. Everything here inherits the one location value.
import { registryEntry, modelCatalogMap } from '../types.bicep'

param accountName string
param location string
param tags object
param skuName string

@allowed(['Enabled', 'Disabled'])
param publicNetworkAccess string

param disableLocalAuth bool
param restoreSoftDeleted bool
param createProject bool
param projectName string

@description('Pre-filtered registry entries (status deployed, not skipped) to create deployment resources for.')
param models registryEntry[]

param modelCatalog modelCatalogMap

@minValue(1)
param capacity int

@description('RAI (content safety) policy applied to every model deployment. Defaults to the Azure-managed Microsoft.DefaultV2 so a reconcile of an existing account preserves the content-safety policy instead of stripping it (ADR-0007).')
param raiPolicyName string = 'Microsoft.DefaultV2'

@description('Version-upgrade behavior for every model deployment. Defaults to the Azure default so a reconcile of an existing account preserves it instead of clearing it.')
@allowed(['OnceNewDefaultVersionAvailable', 'OnceCurrentVersionExpired', 'NoAutoUpgrade'])
param versionUpgradeOption string = 'OnceNewDefaultVersionAvailable'

resource account 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: accountName
  location: location
  tags: tags
  kind: 'AIServices'
  sku: {
    name: skuName
  }
  identity: {
    type: 'SystemAssigned'
  }
  // Custom subdomain matches the account name: AIServices default and the
  // prerequisite that keeps the Entra-for-Speech door open (ADR-0004, ADR-0005).
  // restore: true is only merged in when redeploying over a soft-deleted name.
  properties: union(
    {
      customSubDomainName: accountName
      publicNetworkAccess: publicNetworkAccess
      disableLocalAuth: disableLocalAuth
      // Keep project management on so the account can host a Foundry project and
      // a reconcile does not drop this flag on an existing account.
      allowProjectManagement: true
    },
    restoreSoftDeleted ? { restore: true } : {}
  )
}

// Deployments on one account must be created serially; parallel creates fail.
@batchSize(1)
resource modelDeployments 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = [
  for m in models: {
    parent: account
    name: m.deploymentName
    sku: {
      name: m.sku
      capacity: capacity
    }
    properties: {
      raiPolicyName: raiPolicyName
      versionUpgradeOption: versionUpgradeOption
      model: {
        format: modelCatalog[m.id].?format ?? m.provider
        name: modelCatalog[m.id].name
        version: modelCatalog[m.id].version
      }
    }
  }
]

resource project 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = if (createProject) {
  parent: account
  name: projectName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {}
}

output accountId string = account.id
output endpoint string = account.properties.endpoint
output deploymentNames string[] = [for (m, i) in models: modelDeployments[i].name]
