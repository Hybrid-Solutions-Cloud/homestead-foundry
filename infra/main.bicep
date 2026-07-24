// homestead-foundry: parameterized, registry-driven Azure AI Foundry stack.
// Reproduces the Phase 8/9 as-built shape (docs/implementation/as-built.md) in any
// subscription: resource group, AIServices (Foundry) account, registry-driven
// model deployments, two-security-group RBAC (ADR-0005 as amended by the
// as-built), Key Vault secret-name references (names only), and the RG budget
// cap (ADR-0006).
//
// Wipe-and-redeploy contract (owner directive, 2026-07-21): every created
// resource is contained in the one resource group and pinned to the single
// location parameter, so a full teardown (az group delete) leaves nothing
// orphaned and a redeploy from scratch lands entirely back in one region with
// no manual reconciliation. The two deliberate exceptions, both by design:
// the Entra security groups (identity objects, not ARM resources) and the
// pre-existing platform Key Vault (REUSE, never created or deleted here).
//
// Phase D is validation only: az bicep build and what-if. Any real deployment
// remains gated behind owner confirmation.
targetScope = 'subscription'

import { registryEntry, modelCatalogMap } from 'types.bicep'

// ---------------------------------------------------------------------------
// CAF naming segments (D-04). Bicep has no regex or @pattern decorator (its
// parameter decorators are allowed, description, discriminator, min/maxLength,
// min/maxValue, metadata, sealed, secure; checked against Microsoft Learn
// 2026-07-23), so the CAF shape <abbrev>-<workload>-<env>-<region>-<instance>
// is enforced by construction instead: each segment is its own constrained
// parameter and the names are composed below, which guarantees segment order
// and hyphen delimiters more strictly than a pattern on one string would.
// The naming-lint script (D-04) covers the character-class check.
// ---------------------------------------------------------------------------

@description('Short, lowercase, undelimited workload token (the CAF initiative segment), for example myai.')
@minLength(3)
@maxLength(12)
param workload string

@description('Full initiative name, for example my-initiative. Used for the initiative tag and as the Key Vault secret-name prefix.')
@minLength(3)
@maxLength(30)
param initiative string

@description('Environment token. Pick what the deployment actually serves (production-serving output is prod even during rollout).')
@allowed(['prod', 'dev', 'test'])
param env string

@description('CAF short code for the region in the location parameter, for example eus for eastus.')
@minLength(2)
@maxLength(5)
param regionToken string

@description('Two-digit instance token; first instance is 01.')
@minLength(2)
@maxLength(2)
param instance string = '01'

@description('The single Azure region every resource lands in. No per-module region drift: this one value is threaded through every module that takes a location.')
param location string

@description('Owner alias for the owner tag. A name only, never a credential or an id.')
param ownerAlias string

@description('Optional costCenter tag value; leave empty to omit the tag.')
param costCenter string = ''

// --------------------------- model registry --------------------------------

@description('Model registry entries. Defaults to models/registry.example.json; only entries with status deployed, and not listed in skipDeploymentModelIds, produce a deployment resource.')
param modelRegistry registryEntry[] = loadJsonContent('../models/registry.example.json')

@description('Registry ids that are deployed but need no deployment resource, for example a voice model selected per call by SSML voice name (ADR-0004).')
param skipDeploymentModelIds string[] = []

@description('Deploy-time model name, version, and format per registry id (ADR-0002: re-query with az cognitiveservices model list at deploy time, never hardcode a preview version).')
param modelCatalog modelCatalogMap

@description('Capacity for every model deployment (ADR-0004: capacity 1).')
@minValue(1)
param modelDeploymentCapacity int = 1

// --------------------------- Foundry account -------------------------------

@description('Foundry account SKU (ADR-0004: S0).')
param accountSkuName string = 'S0'

@description('Public network access. The publish pipeline runs outside Azure, so Enabled is the recorded posture (ADR-0005).')
@allowed(['Enabled', 'Disabled'])
param publicNetworkAccess string = 'Enabled'

@description('Keep local (key) auth enabled while the Speech path uses key auth sourced from Key Vault (ADR-0005); set true once Entra-for-Speech is proven.')
param disableLocalAuth bool = false

@description('Set true when redeploying an account name that sits in the Cognitive Services soft-deleted state, so a wipe-and-redeploy cycle restores the name instead of failing on the tombstone.')
param restoreSoftDeletedAccount bool = false

@description('Create the optional Foundry project (worked example: playground voice audition plus the auto-applied project cost tag).')
param createProject bool = true

@description('Purpose token for the project name, proj-<workload>-<purpose>-<instance>. The project is scoped inside the account, which already fixes env and region.')
@minLength(2)
@maxLength(12)
param projectPurpose string = 'media'

// ------------------------------- identity ----------------------------------

@description('Object id of the Entra security group granted Cognitive Services User on the account (image inference data plane). Two-security-group pattern per the as-built amendment of ADR-0005; the groups are Entra objects created outside ARM, for example with az ad group create.')
@minLength(36)
@maxLength(36)
param imageUsersGroupObjectId string

@description('Object id of the Entra security group granted Cognitive Services Speech User on the account (TTS data plane; the generic roles grant no Speech data-plane access).')
@minLength(36)
@maxLength(36)
param speechUsersGroupObjectId string

// ------------------------------- Key Vault ---------------------------------

@description('Name of the pre-existing platform Key Vault (REUSE, never created here). This template records secret names only and never reads or writes a secret value (ADR-0005).')
@minLength(3)
@maxLength(24)
param keyVaultName string

// -------------------------------- budget -----------------------------------

@description('Monthly budget cap in USD on the resource-group scope (ADR-0006). Deployer-chosen and REQUIRED: set it to your own monthly cap. No default, so no deployment silently inherits another deployer\'s figure or triggers an unintended spend ceiling.')
@minValue(1)
param budgetAmountUsd int

@description('Email recipients for the budget alerts. The as-built uses contactEmails directly; no action group.')
@minLength(1)
param budgetContactEmails string[]

@description('Budget period start, first of the current month.')
param budgetStartDate string = utcNow('yyyy-MM-01')

// ------------------------------ composed names -----------------------------

var baseName = '${workload}-${env}-${regionToken}-${instance}'

// aif- per the current CAF Learn mapping for kind AIServices (owner directive;
// as-built deviation 1 supersedes the older ais- strings in docs/design).
var names = {
  resourceGroup: 'rg-${baseName}'
  account: 'aif-${baseName}'
  budget: 'budget-${baseName}'
  project: 'proj-${workload}-${projectPurpose}-${instance}'
}

var baseTags = {
  initiative: initiative
  env: env
  owner: ownerAlias
}
var tags = empty(costCenter) ? baseTags : union(baseTags, { costCenter: costCenter })

var deployableModels = filter(modelRegistry, m => m.status == 'deployed' && !contains(skipDeploymentModelIds, m.id))

// Deployment resources are children of the account and always land in
// location; a registry entry claiming a different region is surfaced below as
// an output so drift is visible in every what-if, never silently absorbed.
var regionMismatchedRegistryIds = map(filter(deployableModels, m => m.region != location), m => m.id)

// -------------------------------- modules ----------------------------------

module rg 'modules/resource-group.bicep' = {
  name: 'deploy-${names.resourceGroup}'
  params: {
    name: names.resourceGroup
    location: location
    tags: tags
  }
}

module foundry 'modules/foundry-account.bicep' = {
  name: 'deploy-${names.account}'
  scope: az.resourceGroup(names.resourceGroup)
  dependsOn: [rg]
  params: {
    accountName: names.account
    location: location
    tags: tags
    skuName: accountSkuName
    publicNetworkAccess: publicNetworkAccess
    disableLocalAuth: disableLocalAuth
    restoreSoftDeleted: restoreSoftDeletedAccount
    createProject: createProject
    projectName: names.project
    models: deployableModels
    modelCatalog: modelCatalog
    capacity: modelDeploymentCapacity
  }
}

module rbac 'modules/rbac.bicep' = {
  name: 'deploy-rbac-${names.account}'
  scope: az.resourceGroup(names.resourceGroup)
  dependsOn: [foundry]
  params: {
    accountName: names.account
    imageUsersGroupObjectId: imageUsersGroupObjectId
    speechUsersGroupObjectId: speechUsersGroupObjectId
  }
}

module budget 'modules/budget.bicep' = {
  name: 'deploy-${names.budget}'
  scope: az.resourceGroup(names.resourceGroup)
  dependsOn: [rg]
  params: {
    budgetName: names.budget
    amountUsd: budgetAmountUsd
    contactEmails: budgetContactEmails
    startDate: budgetStartDate
  }
}

module kvRefs 'modules/keyvault-secret-refs.bicep' = {
  name: 'deploy-secretref-contract'
  params: {
    keyVaultName: keyVaultName
    secretNamePrefix: initiative
  }
}

// -------------------------------- outputs ----------------------------------

output resourceGroupName string = names.resourceGroup
output accountName string = names.account
output accountEndpoint string = foundry.outputs.endpoint
output modelDeploymentNames string[] = foundry.outputs.deploymentNames
output foundryProjectName string = createProject ? names.project : ''
output budgetName string = names.budget
output keyVaultName string = keyVaultName
output speechKeySecretName string = kvRefs.outputs.speechKeySecretName
output speechRegionSecretName string = kvRefs.outputs.speechRegionSecretName
output imageEndpointSecretName string = kvRefs.outputs.imageEndpointSecretName

@description('CAF-shaped display names for the two Entra security groups the RBAC module expects (create with az ad group create before deploying).')
output suggestedSecurityGroupNames string[] = [
  'sg-${workload}-image-users-${env}-${regionToken}-${instance}'
  'sg-${workload}-speech-users-${env}-${regionToken}-${instance}'
]

@description('Deployable registry ids whose declared region differs from the location parameter. Should be empty; reconcile the registry if not.')
output regionMismatchedRegistryIds string[] = regionMismatchedRegistryIds
