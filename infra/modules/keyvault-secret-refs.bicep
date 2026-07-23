// Records the Key Vault secret-name contract, names only (ADR-0005: names in
// git, values only in the vault). This module never creates the vault, never
// reads or writes a secret value; az keyvault secret set stays a gated manual
// write (implementation guide W6). The <initiative>-image-key secret is
// deliberately never created: the image path is Entra keyless.
targetScope = 'subscription'

@minLength(3)
@maxLength(24)
param keyVaultName string

param secretNamePrefix string

var vaultDnsSuffix = environment().suffixes.keyvaultDns
var speechKeySecretName = '${secretNamePrefix}-speech-key'
var speechRegionSecretName = '${secretNamePrefix}-speech-region'
var imageEndpointSecretName = '${secretNamePrefix}-image-endpoint'

output speechKeySecretName string = speechKeySecretName
output speechRegionSecretName string = speechRegionSecretName
output imageEndpointSecretName string = imageEndpointSecretName
output speechKeySecretUri string = 'https://${keyVaultName}${vaultDnsSuffix}/secrets/${speechKeySecretName}'
output speechRegionSecretUri string = 'https://${keyVaultName}${vaultDnsSuffix}/secrets/${speechRegionSecretName}'
output imageEndpointSecretUri string = 'https://${keyVaultName}${vaultDnsSuffix}/secrets/${imageEndpointSecretName}'
