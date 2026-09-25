#Requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$SubscriptionId,
    [Parameter(Mandatory)][string]$ManifestPath,
    [Parameter(Mandatory)][string]$PolicyPath,
    [Parameter(Mandatory)][ValidateSet('eastus','eastus2')][string]$Location,
    [Parameter(Mandatory)][string]$ResultPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json -AsHashtable
$policy = Get-Content -LiteralPath $PolicyPath -Raw | ConvertFrom-Json -AsHashtable
$accessToken = az account get-access-token --subscription $SubscriptionId --resource https://management.azure.com --query accessToken -o tsv
if ($LASTEXITCODE -ne 0) { throw 'Azure authentication failed.' }
$headers = @{ Authorization = "Bearer $accessToken" }
$arm = "https://management.azure.com/subscriptions/$SubscriptionId"
$target = $manifest.targets[$Location]
$accountPath = "$arm/resourceGroups/$($target.resourceGroup)/providers/Microsoft.CognitiveServices/accounts/$($target.account)"
function Invoke-Arm([string]$Method, [string]$Uri, [object]$Body = $null) {
    $arguments = @{ Method = $Method; Uri = $Uri; Headers = $headers; TimeoutSec = 120 }
    if ($null -ne $Body) { $arguments.ContentType = 'application/json'; $arguments.Body = ConvertTo-Json -InputObject $Body -Depth 30 -Compress }
    Invoke-RestMethod @arguments
}
$null = Invoke-Arm 'PUT' "$accountPath/raiPolicies/hcs-code-assistant?api-version=2025-06-01" $policy
$results = [System.Collections.Generic.List[object]]::new()
foreach ($model in @($manifest.models | Where-Object { $_.targetRegion -eq $Location })) {
    $record = [ordered]@{ deployment = $model.deployment; region = $Location; requestedCapacity = $model.capacity; status = 'pending'; reason = '' }
    try {
        $existing = Invoke-Arm 'GET' "$accountPath/deployments?api-version=2025-06-01"
        $found = @($existing.value | Where-Object { $_.name -eq $model.deployment })
        if ($found.Count -gt 0 -and $model.ContainsKey('routing')) {
            # Successful provisioning alone does not prove the router subset was applied.
            $deploymentUri = "$accountPath/deployments/$([uri]::EscapeDataString($model.deployment))?api-version=2025-10-01-preview"
            $body = @{ sku = @{ name = $model.sku; capacity = $model.capacity }; properties = @{ model = $model.model; raiPolicyName = $model.policy; versionUpgradeOption = 'NoAutoUpgrade'; routing = $model.routing } }
            $null = Invoke-Arm 'PUT' $deploymentUri $body
            $state = Invoke-Arm 'GET' $deploymentUri
            if ($state.properties.routing.mode -ne $model.routing.mode -or
                (Compare-Object @($state.properties.routing.models | ForEach-Object { "$($_.format)/$($_.name)/$($_.version)" }) @($model.routing.models | ForEach-Object { "$($_.format)/$($_.name)/$($_.version)" }))) {
                throw 'Router settings readback differs from the requested model subset.'
            }
            $record.status = if ($state.properties.provisioningState -eq 'Succeeded') { 'deployed' } else { 'failed' }
            $record.reason = 'Router mode and model subset reconciled and verified'
        } elseif ($found.Count -gt 0 -and $found[0].properties.provisioningState -eq 'Succeeded') {
            $record.status = 'deployed'; $record.reason = 'Existing successful target deployment'
        } else {
            $usage = Invoke-Arm 'GET' "$arm/providers/Microsoft.CognitiveServices/locations/$Location/usages?api-version=2025-06-01"
            $quotaModelName = if ($model.model.name -eq 'model-router') { 'ModelRouter' } else { $model.model.name }
            $quota = @($usage.value | Where-Object { $_.name.value -ieq "OpenAI.$($model.sku).$quotaModelName" -or $_.name.value -ieq "AIServices.$($model.sku).$quotaModelName" })
            if ($quota.Count -ne 1) {
                $record.status = 'quota-unresolved'; $record.reason = 'Expected one exact model/SKU quota pool'
            } elseif (($quota[0].limit - $quota[0].currentValue) -lt $model.capacity) {
                $record.status = 'quota-blocked'; $record.reason = "Available capacity $($quota[0].limit - $quota[0].currentValue) is insufficient"
            } else {
                $properties = @{ model = $model.model; raiPolicyName = $model.policy; versionUpgradeOption = 'NoAutoUpgrade' }
                if ($model.ContainsKey('routing')) { $properties.routing = $model.routing }
                $body = @{ sku = @{ name = $model.sku; capacity = $model.capacity }; properties = $properties }
                $deploymentUri = "$accountPath/deployments/$([uri]::EscapeDataString($model.deployment))?api-version=2025-10-01-preview"
                $null = Invoke-Arm 'PUT' $deploymentUri $body
                $deadline = [DateTime]::UtcNow.AddMinutes(6)
                do {
                    $state = Invoke-Arm 'GET' $deploymentUri
                    if ($state.properties.provisioningState -in @('Succeeded','Failed','Canceled')) { break }
                    Start-Sleep -Seconds 5
                } while ([DateTime]::UtcNow -lt $deadline)
                $record.status = if ($state.properties.provisioningState -eq 'Succeeded') { 'deployed' } else { 'failed' }
                $record.reason = $state.properties.provisioningState
            }
        }
    } catch {
        $record.status = 'failed'
        $record.reason = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    }
    $results.Add([pscustomobject]$record)
    ConvertTo-Json -InputObject @($results.ToArray()) -Depth 8 | Set-Content -LiteralPath $ResultPath -Encoding utf8
    Write-Output "$($record.deployment): $($record.status) - $($record.reason)"
}
$accessToken = $null
if (@($results | Where-Object status -eq 'failed').Count) { exit 2 }
