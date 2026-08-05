// A permanent, hosted shim in front of the Foundry account.
//
// WHY IT EXISTS
// Editor clients hardcode request parameters that some models reject. GitHub
// Copilot Chat sends `temperature: 0.1` on every request and offers no field to
// change it, so reasoning deployments answer 400 and are unusable through the
// editor while working perfectly over curl. That parameter is chosen by the
// client, so there is nothing to configure on the Foundry side: a deployment has
// no setting that permits or forbids a temperature. The only place to intervene
// is between the client and the account.
//
// A shim on a laptop solves it but has to be running. This is the same shim,
// hosted, so every machine and every tool reaches one durable HTTPS endpoint.
//
// WHY APP SERVICE AND NOT API MANAGEMENT
// APIM is the richer answer and carries the AI Gateway policy set (per-consumer
// token quotas, semantic caching, load balancing across deployments). It is also
// roughly $48/month for a tier with NO SLA and roughly $150/month for the
// cheapest tier that has one, against roughly $12/month here. Adopt APIM when
// governing MULTIPLE consumers is the requirement, which is what ADR-0012 gates
// to a future agent phase. For putting a parameter shim in a durable place, it
// is an order of magnitude of cost for capability that goes unused.
//
// SECURITY POSTURE
// The account key never reaches a client. It is read from Key Vault by the app's
// managed identity at runtime, so it exists in the vault and in process memory
// and nowhere else. Callers authenticate with a SEPARATE gateway token, also
// vaulted, which can be rotated without touching Azure and cannot be replayed
// against the Foundry account if it leaks. Both are Key Vault references, so no
// secret VALUE appears in this template, in a parameter file, or in git
// (ADR-0005: names in git, values only in the vault).
//
// This module creates resources. Deployment stays gated behind owner
// confirmation like every other write in this repository.

@description('Azure region. Should match the Foundry account to avoid a cross-region hop on every call.')
param location string

@description('CAF-compliant name for the App Service plan, for example asp-studioai-prod-eus-01.')
param planName string

@description('CAF-compliant name for the gateway web app. Becomes <name>.azurewebsites.net, which must be globally unique.')
param gatewayName string

@description('Foundry account the gateway forwards to, for example aif-studioai-prod-eus-01.')
param foundryAccountName string

@description('Key Vault holding both secrets. Referenced, never created here.')
param keyVaultName string

@description('Resource group holding that vault. A platform vault is commonly shared and lives OUTSIDE the initiative resource group, so this cannot be assumed to match. Defaults to this module scope for the case where it does.')
param keyVaultResourceGroupName string = resourceGroup().name

@description('Vault secret holding the Foundry account key. An AIServices account key is account-wide, so one secret authenticates every modality.')
param foundryKeySecretName string

@description('Vault secret holding the token callers must present. Deliberately not the Foundry key.')
param gatewayTokenSecretName string

@description('Tags applied to every resource, so the gateway is attributable in Cost Management alongside the account it fronts.')
param tags object = {}

@description('B1 is the cheapest tier that stays warm. F1 exists but carries a daily CPU quota that stalls an editor mid-task, which is worse than not deploying at all.')
@allowed(['B1', 'B2', 'B3', 'S1', 'P0v3', 'P1v3'])
param sku string = 'B1'

var vaultDnsSuffix = environment().suffixes.keyvaultDns
var foundryEndpoint = 'https://${foundryAccountName}.services.ai.azure.com/openai/v1'

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  tags: tags
  sku: {
    name: sku
  }
  // Linux. The shim is a dependency-free Node script; a Windows plan would add
  // cost and a runtime nobody here needs.
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource gateway 'Microsoft.Web/sites@2023-12-01' = {
  name: gatewayName
  location: location
  tags: tags
  // System-assigned rather than user-assigned: the identity has exactly one
  // consumer and should not outlive it. Deleting the app removes the identity,
  // which is the behaviour you want for a wipe-and-redeploy contract.
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    // The gateway carries a bearer token on every request. Allowing plaintext
    // HTTP would let that token cross the network in the clear.
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      healthCheckPath: '/health'
      appCommandLine: 'node scripts/foundry-proxy.mjs'
      appSettings: [
        {
          name: 'FOUNDRY_ENDPOINT'
          value: foundryEndpoint
        }
        {
          // A Key Vault reference. The platform resolves it with the managed
          // identity below at start-up; the value is never in this template.
          name: 'FOUNDRY_KEY'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${vaultDnsSuffix}/secrets/${foundryKeySecretName}/)'
        }
        {
          name: 'FOUNDRY_GATEWAY_TOKEN'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${vaultDnsSuffix}/secrets/${gatewayTokenSecretName}/)'
        }
        {
          // The shim binds 0.0.0.0 when it detects App Service, and refuses to
          // start on a non-loopback address without a gateway token. This makes
          // that explicit rather than relying on platform detection.
          name: 'FOUNDRY_PROXY_HOST'
          value: '0.0.0.0'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
      ]
    }
  }
}

// The grant runs at the VAULT's scope, which is commonly a different resource
// group from this one, so it has to be a module. The app cannot resolve its Key
// Vault references until this exists, which is why the app is restarted below
// rather than left to fail its first start-up.
module vaultAccess 'gateway-vault-access.bicep' = {
  name: 'deploy-gateway-vault-access'
  scope: resourceGroup(keyVaultResourceGroupName)
  params: {
    keyVaultName: keyVaultName
    principalId: gateway.identity.principalId
  }
}

@description('Point every editor at this. It replaces the account endpoint, not the deployment name.')
output gatewayBaseUrl string = 'https://${gateway.properties.defaultHostName}/v1'

@description('Unauthenticated, and says nothing about the account behind it.')
output healthUrl string = 'https://${gateway.properties.defaultHostName}/health'

@description('The identity that must hold Key Vault Secrets User. Assigned above; surfaced for the as-built record.')
output gatewayPrincipalId string = gateway.identity.principalId
