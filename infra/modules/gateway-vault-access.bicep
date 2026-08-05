// Grants the gateway's managed identity read access to the two secrets it needs.
//
// This is its own module because the platform Key Vault commonly lives OUTSIDE
// the initiative's resource group, and a role assignment scoped to a resource in
// another resource group cannot be declared inline: Bicep requires a module to
// cross a scope boundary. Deploying this at the vault's scope is the whole
// reason it exists.

@description('Vault to grant on. Referenced, never created here.')
param keyVaultName string

@description('System-assigned identity of the gateway web app.')
param principalId string

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Key Vault Secrets User: get and list on secret VALUES, and nothing else. The
// identity cannot write a secret, cannot touch keys or certificates, and cannot
// change the vault itself.
var secretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource gatewaySecretsRead 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, principalId, secretsUserRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsUserRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
