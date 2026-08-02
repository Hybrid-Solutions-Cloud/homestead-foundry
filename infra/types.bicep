// Shared user-defined types for the homestead-foundry Bicep stack.

@export()
@description('One model registry entry, schema v2. Mirrors models/registry.schema.json; keep the target, kind, status, and executionProvider unions in sync with the schema enums. THIS TYPE AND THE SCHEMA ARE A SINGLE UNIT OF CHANGE: the schema sets additionalProperties false and main.bicep loads the registry through loadJsonContent, so a field added to one and not the other breaks the build. See ADR-0018.')
type registryEntry = {
  @description('Stable kebab-case identifier a consuming repo references.')
  id: string

  @description('Deployment targets, using the docs/targets/ slugs. OPTIONAL, and absent means [azure-cloud], which is what keeps every v1 registry file valid. Always an array, including for a single target: a string-or-array union is not expressible here because Bicep requires all union members to be literal values (BCP293). Only azure-cloud entries produce a deployment resource in this stack.')
  target: ('azure-cloud' | 'windows-server' | 'azure-local')[]?

  @description('Modality. Authoritative enum lives in models/registry.schema.json.')
  kind: 'image' | 'voice' | 'video' | 'reasoning' | 'text' | 'speech-to-text' | 'embedding'

  @description('Vendor name, for example Microsoft. Used as the default model format when the catalog entry omits one.')
  provider: string

  @description('The deployment name a caller passes as the model parameter.')
  deploymentName: string

  @description('Deployment SKU, for example GlobalStandard. AZURE-CLOUD ONLY; the schema forbids it on an on-premises entry, so it is optional here.')
  sku: string?

  @description('Provisioned SKU capacity for this one deployment. AZURE-CLOUD ONLY and optional; omit to inherit the stack-wide modelDeploymentCapacity. Per-entry because capacity units are not comparable across models, and one stack-wide value pins every deployment to the smallest sensible number.')
  @minValue(1)
  capacity: int?

  @description('Region the entry targets. AZURE-CLOUD ONLY; optional here for the same reason as sku. Informational for consumers; deployment resources are children of the account and always land in the account region.')
  region: string?

  @description('ON-PREMISES ONLY. The catalog entry name, for example Phi-4-mini-instruct-generic-cpu. The variant, not the model name, is the deployable unit on both on-premises targets.')
  variant: string?

  @description('ON-PREMISES ONLY. The ONNX execution provider or vllm. Unused by this stack; carried so one registry can describe all three targets.')
  executionProvider: ('CPUExecutionProvider' | 'CUDAExecutionProvider' | 'QNNExecutionProvider' | 'VitisAIExecutionProvider' | 'OpenVINOExecutionProvider' | 'WebGpuExecutionProvider' | 'NvTensorRTRTXExecutionProvider' | 'vllm')?

  @description('ON-PREMISES ONLY, optional. Free-text size with its provenance, per ADR-0020. Usually UNKNOWN.')
  sizeNote: string?

  @description('Only deployed azure-cloud entries produce a deployment resource.')
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
