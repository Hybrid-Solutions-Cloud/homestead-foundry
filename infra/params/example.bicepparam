// Placeholder parameters only. Nothing below is a real tenant, subscription,
// group object id, email address, or vault. Values mirror the worked
// placeholder example (contoso-ai) in docs/design/resource-topology-and-caf-naming.md.
using '../main.bicep'

// CAF name segments: compose to rg-contosoai-prod-eus-01 and so on.
param workload = 'contosoai'
param initiative = 'contoso-ai'
param env = 'prod'
param regionToken = 'eus'
param instance = '01'

// The single region for everything (owner directive: one region, wipe-and-redeploy safe).
param location = 'eastus'

param ownerAlias = 'owner-alias'

// Registry-driven model deployments: the registry file is the single source of
// which deployment resources exist. Only status deployed entries deploy.
param modelRegistry = loadJsonContent('../../models/registry.example.json')

// Deployed voice models invoked per call by SSML voice name need no deployment
// resource (ADR-0004), so the example voice entry is skipped.
param skipDeploymentModelIds = ['example-voice-model-01']

// Deploy-time resolution (ADR-0002): immediately before any real deployment,
// re-query the current name and version with
//   az cognitiveservices model list --location <location>
// and never commit a stale preview version. Placeholder values here.
param modelCatalog = {
  'example-image-model-01': {
    name: 'Example-Image-Model'
    version: '2026-01-01'
    format: 'Microsoft'
  }
}

// Two Entra security groups (created outside ARM, for example:
//   az ad group create --display-name sg-contosoai-image-users-prod-eus-01 ...).
// Placeholder object ids; replace with the real group ids before deploying.
param imageUsersGroupObjectId = '00000000-0000-0000-0000-000000000001'
param speechUsersGroupObjectId = '00000000-0000-0000-0000-000000000002'

// Pre-existing platform Key Vault: reused by name only, never created here.
param keyVaultName = 'kv-example-vault-01'

// ADR-0006: EXAMPLE monthly cap and alert email. Both are deployer-chosen:
// replace them with your own values before you deploy. main.bicep requires
// budgetAmountUsd (no default), so set it here or override at deploy time.
param budgetAmountUsd = 100
param budgetContactEmails = ['owner@example.com']
