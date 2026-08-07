#Requires -Version 7.0
<#
.SYNOPSIS
    Points a local editor (Continue.dev, Copilot Chat, Cursor, Cline, Roo) at this
    deployment's chat models.

.DESCRIPTION
    Reads the authoritative model registry, proves the endpoint answers with a real
    request, and writes a Continue.dev configuration containing every chat-capable
    deployment. Prints the same three values for tools that are configured by hand.

    The account key never touches this repository. It is read from Azure at run time
    and written only to the editor configuration in your user profile, or left as an
    environment variable reference when you pass -UseEnvironmentVariable.

    This is the canonical copy in the homestead-foundry framework repo. Instance
    repos (my-homestead-foundry) should call this copy, not maintain their own.

.PARAMETER AccountName
    Azure AI Foundry (AIServices) account. Defaults to this instance's account.

.PARAMETER ResourceGroup
    Resource group holding the account.

.PARAMETER RegistryPath
    The authoritative registry. Defaults to production/models/registry.json.

.PARAMETER Kind
    Registry kinds to publish to the editor. Defaults to reasoning, the chat models.

.PARAMETER ConfigPath
    Continue configuration to write. Defaults to ~/.continue/config.yaml.

.PARAMETER UseEnvironmentVariable
    Write ${{ env.FOUNDRY_API_KEY }} into the config instead of the key itself.
    Preferred on a shared or synced machine.

.PARAMETER SkipProbe
    Skip the live endpoint check. Not recommended: a tool that silently falls back
    to its own hosted model looks identical to one that is working.

.EXAMPLE
    ./scripts/Connect-EditorToFoundry.ps1 -WhatIf
    Show what would be written, and probe the endpoint, without changing anything.

.EXAMPLE
    ./scripts/Connect-EditorToFoundry.ps1 -UseEnvironmentVariable
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [string] $AccountName = 'aif-studioai-prod-eus-01',
    [string] $ResourceGroup = 'rg-studioai-prod-eus-01',
    [string] $Subscription = 'This Is My Demo - MVP Subscription',
    [string] $VaultName = 'kv-hcs-vault-01',
    # An AIServices account key is account-wide, so the secret named for speech also
    # authenticates chat. Measured 2026-08-04: this is the only studio-foundry secret
    # that exists in the vault. The image key and endpoint secrets the design
    # documents were never created.
    [string] $SecretName = 'studio-foundry-speech-key',
    [string] $RegistryPath = (Join-Path $PSScriptRoot '../production/models/registry.json'),
    # When running from the instance repo (my-homestead-foundry), pass
    # -RegistryPath (Join-Path $PSScriptRoot '../production/models/registry.json')
    # to point at the instance's own registry.
    # Every kind the editor can actually address. Chat models and embedding models
    # both have a Continue role; image, voice and video do not, and are reported at
    # the end rather than silently dropped.
    [string[]] $Kind = @('reasoning', 'embedding'),
    [string] $ConfigPath = (Join-Path $HOME '.continue/config.yaml'),
    # Display prefix, so these are distinguishable from a vendor-hosted model with
    # the same name in a crowded picker. This decorates `name` only. `model` stays
    # the bare deployment name, because that is the value sent to Azure and a
    # decorated one returns 404 DeploymentNotFound.
    [string] $NamePrefix = 'hcs-',
    [switch] $UseEnvironmentVariable,
    [switch] $SkipProbe,

    # Point the editors at the local proxy instead of Azure directly. Use this if
    # any tool sends a parameter a model refuses, which today means GitHub
    # Copilot Chat hardcoding temperature 0.1 against the three gpt-5-6
    # deployments. The proxy must be running: ./scripts/Start-FoundryProxy.ps1.
    [switch] $ViaProxy,
    [int]    $ProxyPort = 8787,

    # The HOSTED gateway, for example
    # https://app-gw-studioai-prod-eus-01.azurewebsites.net/v1. Prefer this over
    # -ViaProxy: it needs nothing running on this machine, works from anywhere,
    # and the account key never reaches the editor at all.
    [string] $GatewayUrl = '',

    # Vault secret holding the token callers present to the hosted gateway. This
    # is NOT the account key, which is the point: it can be rotated without
    # touching Azure and is useless against the Foundry account if it leaks.
    [string] $GatewayTokenSecretName = 'studio-foundry-gateway-token'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step { param([string] $Message) Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok   { param([string] $Message) Write-Host "    OK  $Message" -ForegroundColor Green }
function Write-Warn { param([string] $Message) Write-Host "    !   $Message" -ForegroundColor Yellow }

# The editors are given ONE base URL. Sending them at the proxy instead of Azure
# is the only change needed: the proxy speaks the same API on the same paths, so
# nothing else in this script or in any editor config has to know the difference.
$azureUrl = "https://$AccountName.services.ai.azure.com/openai/v1/"
$baseUrl =
    if ($GatewayUrl) { ($GatewayUrl.TrimEnd('/') + '/') }
    elseif ($ViaProxy) { "http://127.0.0.1:$ProxyPort/v1/" }
    else { $azureUrl }
$usingGateway = [bool]$GatewayUrl

# ---------------------------------------------------------------- registry ---
Write-Step "Reading the model registry"

if (-not (Test-Path $RegistryPath)) {
    throw "Registry not found at $RegistryPath. This script must run from the instance repository, or be given -RegistryPath."
}

$registry = Get-Content $RegistryPath -Raw | ConvertFrom-Json
$models = @($registry | Where-Object { $_.status -eq 'deployed' -and $Kind -contains $_.kind })

if (-not $models) {
    throw "No deployed models of kind '$($Kind -join ", ")' in the registry. Nothing to configure."
}

Write-Ok "$($models.Count) deployed model(s): $($models.deploymentName -join ', ')"

$planned = @($registry | Where-Object { $_.status -ne 'deployed' -and $Kind -contains $_.kind })
foreach ($m in $planned) {
    Write-Warn "skipping $($m.deploymentName): status is '$($m.status)', not deployed"
}

# --------------------------------------------------------------------- key ---
Write-Step "Reading the account key from Azure"

$key = $env:FOUNDRY_API_KEY
if ($key) {
    Write-Ok 'using FOUNDRY_API_KEY from the environment'
}
else {
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
        throw 'Azure CLI not found, and FOUNDRY_API_KEY is not set. Install the CLI or set the variable.'
    }
    # Key Vault first. A secret read is a data-plane call: it does not care which
    # subscription the CLI is pointed at, only that the token comes from a tenant the
    # vault trusts. That makes it the route that works from anywhere, and it avoids
    # touching the account's keys at all.
    if ($VaultName -and $SecretName) {
        Write-Step "Reading $SecretName from $VaultName"
        $secret = (az keyvault secret show --vault-name $VaultName --name $SecretName --query value --output tsv 2>&1)
        if ($LASTEXITCODE -eq 0 -and $secret) {
            $key = ($secret | Out-String).Trim()
            Write-Ok "key read from the vault, no subscription context required"
        }
        else {
            $vaultDetail = ($secret | Out-String).Trim()
            if ($vaultDetail -match 'AKV10032|Invalid issuer') {
                # The vault trusts specific tenants. The message names them; surface it,
                # because "unauthorized" reads as a missing role and this is not one.
                Write-Warn 'the vault rejected the token issuer: signed in to a tenant the vault does not trust'
                Write-Warn 'run: az login --tenant <one of the tenants named below>, then re-run'
                Write-Warn $vaultDetail
            }
            else {
                Write-Warn "vault read failed: $vaultDetail"
            }
            Write-Warn 'falling back to the account keys, which does need the right subscription'
        }
    }

  }

  # Fallback only. The account lives in one specific subscription, so a CLI pointed
  # at a different one fails with ResourceGroupNotFound, which reads like a
  # permission problem and is not.
  if (-not $key) {
    $subArgs = @()
    if ($Subscription) {
        $subArgs = @('--subscription', $Subscription)
        $current = (az account show --query name --output tsv 2>$null)
        if ($current -and $current -ne $Subscription) {
            Write-Warn "active subscription is '$current'; this account lives in '$Subscription'"
        }
    }

    $key = (az cognitiveservices account keys list --name $AccountName --resource-group $ResourceGroup @subArgs --query key1 --output tsv 2>&1)
    if ($LASTEXITCODE -ne 0 -or -not $key) {
        # Never swallow the CLI's own message. It names the real cause.
        $detail = ($key | Out-String).Trim()
        $advice = switch -Regex ($detail) {
            'ResourceGroupNotFound' { "The signed-in CLI cannot see '$ResourceGroup'. That is almost always the wrong subscription or tenant, not a missing role. Try -Subscription, or 'az login --tenant <tenant>'." }
            'SubscriptionNotFound'  { "Subscription '$Subscription' is not visible to this login. Sign in to the tenant that owns it." }
            'AuthorizationFailed'   { 'Signed in to the right place, but the identity cannot list keys. It needs a role that includes listKeys on the account.' }
            'ResourceNotFound'      { "Subscription and group resolved, but no account named '$AccountName' is in it. Check the account name." }
            'az login'              { "Not signed in. Run 'az login'." }
            default                 { "Run 'az account show' to see where the CLI is currently pointed." }
        }
        throw "Could not read the key for $AccountName in $ResourceGroup.`n`n  Azure said: $detail`n`n  $advice`n"
    }
    Write-Ok "key read for $AccountName"
}

# Through the hosted gateway the editors present the GATEWAY token, never the
# account key. The account key stays in the vault, read at runtime by the
# gateway's managed identity, and never reaches a client machine at all.
$gatewayToken = ''
if ($usingGateway) {
    Write-Step "Reading $GatewayTokenSecretName from $VaultName"
    $gatewayToken = az keyvault secret show --vault-name $VaultName --name $GatewayTokenSecretName --query value -o tsv 2>&1
    if ($LASTEXITCODE -ne 0 -or -not $gatewayToken) {
        $detail = ($gatewayToken | Out-String).Trim()
        throw "Could not read $GatewayTokenSecretName from $VaultName. The gateway will refuse every request without it.`n`n  Azure said: $detail`n"
    }
    $gatewayToken = $gatewayToken.Trim()
    Write-Ok "gateway token read; the account key will NOT be written to any editor config"
}

# Whatever the editors will send is what the probe must send, or the probe
# proves something nobody will ever do.
$probeAuth = if ($usingGateway) { $gatewayToken } else { $key }

# ------------------------------------------------------------------- probe ---
# The instance documentation is explicit: if a direct call does not work, no tool
# will. Prove the endpoint before writing a configuration that claims it does.
if ($SkipProbe) {
    Write-Warn 'endpoint probe skipped; the configuration below is unverified'
}
else {
    Write-Step "Probing $baseUrl"
    # Probe a chat model. An embedding deployment rejects a chat completion, so
    # probing whatever happens to be first would fail for the wrong reason.
    $probeCandidate = @($models | Where-Object { $_.kind -eq 'reasoning' })
    if (-not $probeCandidate) { $probeCandidate = $models }
    $probeModel = $probeCandidate[0].deploymentName
    $body = @{
        model    = $probeModel
        messages = @(@{ role = 'user'; content = 'reply with the single word: ok' })
    } | ConvertTo-Json -Depth 5

    try {
        $response = Invoke-RestMethod -Method Post -Uri "${baseUrl}chat/completions" `
            -Headers @{ Authorization = "Bearer $probeAuth" } `
            -ContentType 'application/json' -Body $body -TimeoutSec 60
        $text = $response.choices[0].message.content
        Write-Ok "$probeModel answered: $($text -replace '\s+', ' ')"
    }
    catch {
        # A connection failure has no Response at all, so reading StatusCode off
        # it throws and buries the real cause. Guard before touching it.
        $status = if ($_.Exception.PSObject.Properties['Response'] -and $_.Exception.Response) {
            [int]$_.Exception.Response.StatusCode
        } else { 0 }

        # A refused connection with -ViaProxy means the proxy is not running.
        # Without this the message reads as an Azure problem, which sends the
        # reader to the portal to debug something that is not broken.
        if ($ViaProxy -and ($_.Exception.Message -match 'actively refused|Unable to connect|connection.*refused')) {
            throw "The proxy is not running on port $ProxyPort, so there is nothing at $baseUrl to answer.`n`n  Start it in another window:  ./scripts/Start-FoundryProxy.ps1`n  Then re-run this command.`n"
        }

        $hint = switch ($status) {
            401 { 'The key is wrong. Entra tokens expire; account keys do not.' }
            403 { 'No role assignment on the account. Assign Cognitive Services User.' }
            404 { "Deployment '$probeModel' was not found. Registry and Azure disagree; reconcile the registry." }
            default { 'Check the account name and that the account is reachable from here.' }
        }
        throw "Endpoint probe failed (HTTP $status). $hint`nNo configuration was written."
    }
}

# ------------------------------------------------------------------ config ---
Write-Step "Building the Continue configuration"

# Through the proxy the editor never needs the real key: the proxy holds it and
# authenticates to Azure itself. Writing a placeholder keeps the account key out
# of a config file that editor settings-sync will happily copy to other machines.
$apiKeyValue =
    if ($usingGateway) { $gatewayToken }
    elseif ($ViaProxy) { 'proxy-holds-the-real-key' }
    elseif ($UseEnvironmentVariable) { '${{ env.FOUNDRY_API_KEY }}' }
    else { $key }

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('# Generated by scripts/Connect-EditorToFoundry.ps1. Regenerate rather than hand-edit.')
$lines.Add("# Endpoint: $baseUrl")
$lines.Add('name: Foundry')
$lines.Add('version: 1.0.0')
$lines.Add('schema: v1')
$lines.Add('models:')

# Roles are assigned by kind, not by position. An embedding model given a chat
# role produces a model the editor offers and every request against it fails.
$chatModels = @($models | Where-Object { $_.kind -eq 'reasoning' })
$primary = if ($chatModels) { $chatModels[0].deploymentName } else { $null }

foreach ($m in $models) {
    $roles = switch ($m.kind) {
        'reasoning' {
            # One model carries apply. Continue applies a diff with a single model,
            # and naming several is not an improvement.
            if ($m.deploymentName -eq $primary) { '[chat, edit, apply]' } else { '[chat, edit]' }
        }
        'embedding' { '[embed]' }
        default { $null }
    }
    if (-not $roles) { continue }

    # A prefix ending in a separator joins directly; a word prefix gets a space.
    $label = if (-not $NamePrefix) { "$($m.deploymentName) ($($m.provider))" }
             elseif ($NamePrefix -match '[-_:/.]$') { "$NamePrefix$($m.deploymentName) ($($m.provider))" }
             else { "$NamePrefix $($m.deploymentName) ($($m.provider))" }
    $lines.Add("  - name: $label")
    $lines.Add('    provider: openai')
    $lines.Add("    model: $($m.deploymentName)")
    $lines.Add("    apiBase: $baseUrl")
    $lines.Add("    apiKey: $apiKeyValue")
    $lines.Add("    roles: $roles")
}

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine

$configDir = Split-Path $ConfigPath -Parent
if ($PSCmdlet.ShouldProcess($ConfigPath, 'write Continue configuration')) {
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    if (Test-Path $ConfigPath) {
        # Never overwrite an existing editor configuration without leaving a way back.
        $backup = "$ConfigPath.bak"
        Copy-Item $ConfigPath $backup -Force
        Write-Warn "existing config backed up to $backup"
    }
    Set-Content -Path $ConfigPath -Value $content -Encoding utf8NoBOM
    Write-Ok "wrote $ConfigPath"
}
else {
    Write-Host $content
}

# ------------------------------------------------------------ manual tools ---
Write-Step 'Values for tools configured by hand'

Write-Host ''
Write-Host '  Copilot Chat  : model picker > Manage Models > OpenAI compatible'
Write-Host '  Cursor        : Settings > Models > Override OpenAI Base URL'
Write-Host '  Cline / Roo   : provider "OpenAI Compatible"'
Write-Host ''
Write-Host "  Base URL      : $baseUrl"
Write-Host "  Model         : a deployment name below, never a vendor model id"
Write-Host "  API key       : read it with"
Write-Host "                  az cognitiveservices account keys list --name $AccountName --resource-group $ResourceGroup --query key1 --output tsv"
Write-Host ''
foreach ($m in $models) {
    Write-Host ("    {0,-30} {1,-12} {2}" -f $m.deploymentName, $m.kind, $m.provider)
}
Write-Host ''

# Everything deployed that the editor cannot address, named rather than dropped.
# A model missing from the config should be a stated fact, not a silent filter.
$others = @($registry | Where-Object { $_.status -eq 'deployed' -and $Kind -notcontains $_.kind })
if ($others) {
    Write-Step 'Deployed, but not addressable from a code editor'
    Write-Host ''
    foreach ($m in $others) {
        Write-Host ("    {0,-30} {1,-12} {2}" -f $m.deploymentName, $m.kind, $m.provider)
    }
    Write-Host ''
    Write-Host '  These are image, voice and video models. Continue has no role for them,'
    Write-Host '  so they are reachable from the same endpoint but not from the editor.'
    Write-Host "  Base URL: $baseUrl"
    Write-Host ''
}

# --------------------------------------------------------------- cost note ---
Write-Warn 'The deployed budget is alert-only. It emails at thresholds and does not stop spend.'
Write-Warn 'Agentic extensions issue many calls per task with full file context attached.'
Write-Warn 'Confirm the calls reach Azure in the account metrics. A tool that fell back to its own'
Write-Warn 'hosted model looks exactly like one that is working.'
