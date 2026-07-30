// Azure Local Foundry, PLATFORM LAYER ONLY (layer 2 of 3).
//
// ADR-0014 decision 1: the deployment has three layers because mandatory
// Gateway API and Istio prerequisites sit UNDERNEATH this extension and cannot
// be expressed in ARM, and the ModelDeployment intent sits ABOVE it as
// Kubernetes custom resources. This file owns the middle and nothing else.
//
// CONSEQUENCE: `az deployment group what-if` against this template sees only
// the middle layer. It is not a drift check for the deployment as a whole.
// Layers 1 and 3 are checked by ../deploy.ps1, with kubectl.
//
// NEVER EXECUTED. Azure Local Foundry is a public preview with access by
// request. No cluster exists in this project.

targetScope = 'resourceGroup'

@description('Name of the Arc-connected AKS Arc cluster (Microsoft.Kubernetes/connectedClusters) to install onto.')
@minLength(3)
@maxLength(63)
param connectedClusterName string

@description('Release namespace for both extensions. Kept as one namespace so the cert-manager and Foundry lifecycles stay visibly coupled, which they are.')
param releaseNamespace string = 'foundry-local'

@description('Version of the Microsoft.CertManagement extension, or empty to take the latest. ADR-0024 decision 11: CRD upgrades are unaddressed by Microsoft and there is no compatibility matrix, only floors, so pin this in any environment you care about.')
param certManagementVersion string = ''

@description('Version of the Microsoft.Foundry extension, or empty to take the latest. Pin it for the same reason as certManagementVersion.')
param foundryVersion string = ''

@description('Set true only when off-cluster clients cannot be made to trust the cluster CA. ADR-0023 decision 6: internal is the default posture, and external exposure additionally requires a LoadBalancer implementation that AKS Arc does not provide by default (SPIKE-28). ../deploy.ps1 checks for one before it lets this be true.')
param enableExternalExposure bool = false

// The cluster is a pre-existing resource. This template never creates it: an
// AKS Arc cluster is a hard prerequisite, not something automation stands up.
resource connectedCluster 'Microsoft.Kubernetes/connectedClusters@2024-07-15-preview' existing = {
  name: connectedClusterName
}

// ---------------------------------------------------------------------------
// cert-manager.
//
// ADR-0023 decision 2: this mints a SELF-SIGNED cluster root CA on first
// deployment and every model sidecar chains to it. That is the default AND
// mandatory mechanism for internal traffic, not a fallback. SPIKE-19 recorded
// the opposite and was wrong.
//
// ADR-0023 decision 4: the two cert-managers do not coexist. A community
// cert-manager already on the cluster is a blocking conflict, and ../deploy.ps1
// checks for one before this runs.
// ---------------------------------------------------------------------------
resource certManagement 'Microsoft.KubernetesConfiguration/extensions@2023-05-01' = {
  name: 'cert-management'
  scope: connectedCluster
  properties: {
    extensionType: 'Microsoft.CertManagement'
    autoUpgradeMinorVersion: empty(certManagementVersion)
    version: empty(certManagementVersion) ? null : certManagementVersion
    releaseTrain: 'preview'
    scope: {
      cluster: {
        releaseNamespace: releaseNamespace
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Foundry.
//
// Depends on cert-management explicitly. Ordering inside this layer is the one
// part ARM can enforce; the ordering ARM cannot enforce is exactly why layers 1
// and 3 exist and why ../deploy.ps1 is a first-class deliverable rather than
// glue (ADR-0014).
// ---------------------------------------------------------------------------
resource foundry 'Microsoft.KubernetesConfiguration/extensions@2023-05-01' = {
  name: 'foundry'
  scope: connectedCluster
  dependsOn: [certManagement]
  properties: {
    extensionType: 'Microsoft.Foundry'
    autoUpgradeMinorVersion: empty(foundryVersion)
    version: empty(foundryVersion) ? null : foundryVersion
    releaseTrain: 'preview'
    scope: {
      cluster: {
        releaseNamespace: releaseNamespace
      }
    }
    configurationSettings: {
      // Ingress is the Gateway API, not nginx. ADR-0024 decision 7: Microsoft
      // has already published an nginx-to-Gateway-API annotation migration
      // table inside the preview, so building on annotations is a
      // self-inflicted upgrade.
      'gateway.enabled': 'true'
      'exposure': enableExternalExposure ? 'external' : 'internal'
    }
  }
}

@description('Extension resource ids, for the wrapper to assert against after layer 2 completes.')
output extensionIds object = {
  certManagement: certManagement.id
  foundry: foundry.id
}

@description('Restates the layer boundary so a reader of what-if output does not mistake this for whole-deployment drift.')
output layerScopeWarning string = 'Platform layer only. Gateway API and Istio (layer 1) and ModelDeployment intent (layer 3) are not represented in this template or in its what-if.'
