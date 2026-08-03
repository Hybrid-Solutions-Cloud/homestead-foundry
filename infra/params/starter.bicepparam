// Starter parameters. Copy this to a file the repo will not commit, for example
// infra/params/prod.local.bicepparam (*.local.bicepparam is gitignored), then
// replace every value marked REPLACE below.
//
// This file differs from example.bicepparam in one important way: it is wired to
// models/registry.starter.json, a real 28-model roster, rather than to the
// placeholder registry. Follow docs/guide/deployment.md and this deploys a
// working environment.
using '../main.bicep'

// ---------------------------------------------------------------------------
// CAF name segments. These compose into every resource name, for example
// rg-<workload>-<env>-<regionToken>-<instance> and aif-<workload>-<env>-<regionToken>-<instance>.
// ---------------------------------------------------------------------------
param workload = 'REPLACE' // short, lowercase, no delimiters, 3-12 chars, for example myai
param initiative = 'REPLACE' // full initiative name, also the Key Vault secret-name prefix
param env = 'prod'
param regionToken = 'eus' // CAF short code matching location below
param instance = '01'

// The single region every resource lands in. Changing this is the only region
// knob; nothing else takes a location.
param location = 'eastus'

param ownerAlias = 'REPLACE' // a name for the owner tag, never a credential

// ---------------------------------------------------------------------------
// Models. The registry decides which deployment resources exist.
// ---------------------------------------------------------------------------
param modelRegistry = loadJsonContent('../../models/registry.starter.json')

// Both voice entries are reached through the Speech endpoint by SSML voice name
// and need no deployment resource (ADR-0004). Everything else in the starter
// registry with status deployed becomes a real deployment.
param skipDeploymentModelIds = ['mai-voice-2', 'azure-neural-standard']

// Generated, never hardcoded (ADR-0002). Before deploying, run:
//   node scripts/build-model-catalog.mjs --location eastus \
//     --registry models/registry.starter.json \
//     --skip mai-voice-2,azure-neural-standard
// That queries your subscription for the current name and version of every
// model and writes infra/params/model-catalog.json.
param modelCatalog = loadJsonContent('./model-catalog.json')

// Fallback capacity only, for a registry entry that declares none of its own.
// Every deployed entry in the starter registry declares its own capacity, so
// nothing should reach this. Check the inheritedCapacityRegistryIds output after
// what-if: any id listed there is deploying at the number below, and 1 measures
// at roughly one request per minute.
param modelDeploymentCapacity = 1

// ---------------------------------------------------------------------------
// Identity. Both groups are Entra objects created outside ARM. Create them
// first (see docs/guide/deployment.md step 2) and paste their object ids here.
// ---------------------------------------------------------------------------
param imageUsersGroupObjectId = 'REPLACE' // 36-char object id
param speechUsersGroupObjectId = 'REPLACE' // 36-char object id

// Leave true for a greenfield deploy. Set false only when reconciling an
// existing account whose groups already hold these roles, so the deployment
// does not fail on RoleAssignmentExists.
param manageRoleAssignments = true

// ---------------------------------------------------------------------------
// Secrets and cost. The vault must already exist; this template records secret
// names only and never reads or writes a secret value.
// ---------------------------------------------------------------------------
param keyVaultName = 'REPLACE' // name of your existing platform Key Vault

// Your own monthly cap, in USD. Required, with no default, so no deployment
// silently inherits someone else's figure. This is an alerting budget, not a
// hard spend stop (ADR-0006).
param budgetAmountUsd = 100
param budgetContactEmails = ['REPLACE@example.com']
