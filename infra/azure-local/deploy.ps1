#Requires -Version 7.0
<#
.SYNOPSIS
    The three-layer ordering wrapper for Azure Local Foundry.

.DESCRIPTION
    ADR-0014 calls this a FIRST-CLASS DELIVERABLE, NOT GLUE. The ordering is the
    part that breaks, and no single tool can express it: layer 1 is kubectl and
    Helm, layer 2 is ARM, layer 3 is kubectl again.

        layer 1  prereq/    Gateway API CRDs, then Istio
        layer 2  platform/  Microsoft.CertManagement, then Microsoft.Foundry
        layer 3  intent/    ModelDeployment custom resources

    WHY ORDERING IS LOAD-BEARING: Gateway API CRDs must land before Istio, or
    istiod restarts and Microsoft's own documentation reports the result as
    flaky. That same restart is what an AKS Arc cluster upgrade causes by
    design, which is why ADR-0024 decision 5 makes cluster upgrades a planned,
    gated event rather than background maintenance.

    NEVER EXECUTED. Azure Local Foundry is a public preview with access by
    request, and no AKS Arc cluster exists in this project.

.PARAMETER ConnectedClusterName
    The Arc-connected AKS Arc cluster.

.PARAMETER ResourceGroup
    Resource group holding the connected cluster resource.

.PARAMETER EnableExternalExposure
    Opt in to external exposure. ADR-0023 decision 6 makes internal the default.
    Requires a working LoadBalancer, which this script verifies first.

.PARAMETER WhatIf
    Runs every read-only precondition check and the layer 2 ARM what-if, and
    changes nothing. NOTE the honest limit: ARM what-if covers layer 2 ONLY.
    Layers 1 and 3 are reported from live cluster state instead.

.NOTES
    ADR-0014 three layers and the ordering wrapper.
    ADR-0021 teardown deletes the ARM resource: billing continues 31 days
             after disconnection otherwise.
    ADR-0023 TLS, LoadBalancer prerequisite, cert-manager conflict.
    ADR-0024 upgrade ordering and CRD version floors.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][string]$ConnectedClusterName,
    [Parameter(Mandatory)][string]$ResourceGroup,
    [switch]$EnableExternalExposure
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot

function Write-Layer {
    param([int]$Number, [string]$Title)
    Write-Host ''
    Write-Host ("=== layer {0}: {1} ===" -f $Number, $Title) -ForegroundColor Cyan
}

# ------------------------------------------------------- preconditions ------
# All read-only. These run before anything is changed, including under -WhatIf,
# because two of them are the difference between a working install and a
# confusing runtime failure.
function Test-Preconditions {
    $failures = @()

    if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
        $failures += 'kubectl is not on PATH. Layers 1 and 3 need it.'
    }

    # ADR-0023 decision 4. The two cert-managers do not coexist and Microsoft
    # says so explicitly. A pre-existing community cert-manager is a BLOCKING
    # conflict to resolve before install, not a compatible alternative.
    $existingCertManager = kubectl get deployment -A -o name 2>$null |
        Where-Object { $_ -match 'cert-manager' }
    if ($existingCertManager) {
        $failures += "A cert-manager is already installed on this cluster ($($existingCertManager -join ', ')). The Microsoft.CertManagement extension does not coexist with it. Remove it first."
    }

    # ADR-0023 decision 5 / SPIKE-28. This prerequisite appears in NO Foundry
    # Local document. Without a LoadBalancer implementation, `exposure: external`
    # does not work, and AKS Arc does not have one by default.
    if ($EnableExternalExposure) {
        $lbProviders = kubectl get pods -A -o name 2>$null |
            Where-Object { $_ -match 'metallb|kube-vip|cloud-provider' }
        if (-not $lbProviders) {
            $failures += 'External exposure was requested, but no LoadBalancer implementation was found on this cluster. AKS Arc has none by default and Foundry Local does not document this prerequisite. Install one, or drop -EnableExternalExposure and use the default internal posture.'
        }
    }

    if ($failures) {
        Write-Host ''
        Write-Host 'Preconditions failed:' -ForegroundColor Red
        $failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
        return $false
    }

    Write-Host 'Preconditions passed.' -ForegroundColor Green
    return $true
}

# ------------------------------------------------------------- layer 1 ------
function Invoke-Layer1 {
    Write-Layer -Number 1 -Title 'Gateway API CRDs, then Istio (kubectl and Helm)'

    # ORDER IS LOAD-BEARING. CRDs first. Istio second. Reversing this restarts
    # istiod against missing CRDs, which Microsoft reports as flaky.
    #
    # The CRDs are not vendored into this repository: prereq/gateway-api-crds.yaml
    # is a PIN, holding the exact upstream release this repository has reasoned
    # about. Read the pin, apply that URL. Vendoring several thousand lines of
    # someone else's CRD would mean maintaining a fork that goes stale silently.
    $pinFile = Join-Path $root 'prereq/gateway-api-crds.yaml'
    $pin = @{}
    foreach ($line in Get-Content -LiteralPath $pinFile) {
        if ($line -match '^\s{2}(channel|version|url):\s*(\S+)\s*$') {
            $pin[$Matches[1]] = $Matches[2]
        }
    }
    if (-not $pin.ContainsKey('url')) {
        throw "Could not read the Gateway API pin from $pinFile. Refusing to guess a version."
    }
    Write-Host "Gateway API pinned to $($pin['version']) ($($pin['channel']) channel)."

    if ($PSCmdlet.ShouldProcess("Gateway API CRDs $($pin['version'])", 'kubectl apply')) {
        kubectl apply -f $pin['url']
        if ($LASTEXITCODE -ne 0) { throw 'Gateway API CRD apply failed. Do not continue to Istio.' }

        # Wait for establishment rather than racing Istio against CRD readiness.
        kubectl wait --for=condition=Established --timeout=120s crd `
            gateways.gateway.networking.k8s.io `
            gatewayclasses.gateway.networking.k8s.io `
            httproutes.gateway.networking.k8s.io
        if ($LASTEXITCODE -ne 0) { throw 'Gateway API CRDs did not reach Established. Do not continue to Istio.' }
    }
    else {
        Write-Host "WhatIf: would apply Gateway API CRDs $($pin['version']) and wait for Established."
    }

    if ($PSCmdlet.ShouldProcess('Istio', 'helm install')) {
        Write-Host 'Istio install is intentionally not scripted here yet: the chart, version floor, and values are an environment decision, and ADR-0024 decision 11 requires pinning to a known-good floor rather than taking latest.' -ForegroundColor Yellow
    }
    else {
        Write-Host 'WhatIf: would install Istio, pinned to a known-good version floor.'
    }
}

# ------------------------------------------------------------- layer 2 ------
function Invoke-Layer2 {
    Write-Layer -Number 2 -Title 'cert-management and Foundry extensions (Bicep)'

    $template = Join-Path $root 'platform/main.bicep'
    $common = @(
        '--resource-group', $ResourceGroup,
        '--template-file', $template,
        '--parameters', "connectedClusterName=$ConnectedClusterName",
        '--parameters', "enableExternalExposure=$($EnableExternalExposure.IsPresent.ToString().ToLower())"
    )

    if ($PSCmdlet.ShouldProcess('platform layer', 'az deployment group create')) {
        az deployment group create @common --output table
        if ($LASTEXITCODE -ne 0) { throw 'Platform layer deployment failed.' }
    }
    else {
        Write-Host 'WhatIf: ARM what-if for the platform layer only.' -ForegroundColor Yellow
        Write-Host 'REMINDER: this covers layer 2 and nothing else. It is not drift detection for the deployment.' -ForegroundColor Yellow
        az deployment group what-if @common
    }
}

# ------------------------------------------------------------- layer 3 ------
function Invoke-Layer3 {
    Write-Layer -Number 3 -Title 'ModelDeployment intent (kubectl)'

    $intent = Join-Path $root 'intent/model-deployment.yaml'

    if ($PSCmdlet.ShouldProcess('ModelDeployment', 'kubectl apply')) {
        kubectl apply -f $intent
        if ($LASTEXITCODE -ne 0) { throw 'ModelDeployment apply failed.' }
    }
    else {
        Write-Host 'WhatIf: would apply the ModelDeployment intent.'
        kubectl diff -f $intent 2>&1 | Write-Host
    }
}

# ---------------------------------------------------------------- main ------
if (-not (Test-Preconditions)) { exit 1 }

Invoke-Layer1
Invoke-Layer2
Invoke-Layer3

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host ''
Write-Host 'Drift detection for this deployment is SPLIT THREE WAYS. `az deployment' -ForegroundColor Yellow
Write-Host 'group what-if` sees layer 2 only. There is no single command that shows' -ForegroundColor Yellow
Write-Host 'you the state of the whole stack.' -ForegroundColor Yellow
Write-Host ''
Write-Host 'When decommissioning, run teardown.ps1. It DELETES the ARM resource,' -ForegroundColor Yellow
Write-Host 'which is a cost control: billing continues for 31 days after' -ForegroundColor Yellow
Write-Host 'disconnection unless the resource is deleted (ADR-0021).' -ForegroundColor Yellow
