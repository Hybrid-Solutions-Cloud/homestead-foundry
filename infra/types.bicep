// Shared user-defined types for the homestead-foundry Bicep stack.

@export()
@description('One model registry entry. Mirrors models/registry.schema.json; keep the kind and status unions in sync with the schema enums.')
type registryEntry = {
  @description('Stable kebab-case identifier a consuming repo references.')
  id: string

  @description('Modality. Authoritative enum lives in models/registry.schema.json.')
  kind: 'image' | 'voice' | 'video' | 'reasoning'

  @description('Vendor name, for example Microsoft. Used as the default model format when the catalog entry omits one.')
  provider: string

  @description('The Foundry deployment name a caller passes as the model parameter.')
  deploymentName: string

  @description('Deployment SKU, for example GlobalStandard.')
  sku: string

  @description('Region the entry targets. Informational for consumers; deployment resources are children of the account and always land in the account region.')
  region: string

  @description('Only deployed entries produce a deployment resource.')
  status: 'deployed' | 'planned' | 'rejected'

  accessGating: string
  capabilities: string[]
  notes: string
  sourceRef: string
}

@export()
@description('Deploy-time model resolution keyed by registry id. Name and version are re-queried at deploy time via az cognitiveservices model list and never hardcoded (ADR-0002). A deployable registry entry with no catalog entry fails the deployment fast.')
type modelCatalogMap = {
  *: {
    @description('Underlying model name as listed by az cognitiveservices model list.')
    name: string

    @description('Model version current at deploy time.')
    version: string

    @description('Model format; defaults to the registry entry provider when omitted.')
    format: string?
  }
}
