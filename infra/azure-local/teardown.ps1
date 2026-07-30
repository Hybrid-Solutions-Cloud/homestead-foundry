#Requires -Version 7.0
<#
.SYNOPSIS
    Tears down Azure Local Foundry, in reverse layer order, and DELETES the ARM
    resource.

.DESCRIPTION
    THE ARM DELETE IS A COST CONTROL, NOT TIDINESS.

    ADR-0021, from SPIKE-26: billing continues for 31 DAYS AFTER DISCONNECTION
    unless the ARM resource is deleted. A teardown that stops the workload and
    leaves the resource in place costs real money for a month. An uninstall that
    skips this step is a defect, which is why it is not optional here.

    Order is the reverse of deploy.ps1: intent, then platform, then the layer 1
    prerequisites are LEFT ALONE by default, because Gateway API CRDs and Istio
    are frequently shared with other workloads on the same cluster and removing
    them can break something this project never installed.

    RESIDUE IS EXPECTED, AND SOME OF IT IS BY DESIGN (ADR-0024 decision 9).
    This script reports what remains rather than pretending the cluster is
    clean.

    NEVER EXECUTED.

.PARAMETER ConnectedClusterName
    The Arc-connected AKS Arc cluster.

.PARAMETER ResourceGroup
    Resource group holding the connected cluster resource.

.PARAMETER RemovePrerequisites
    Also remove Gateway API CRDs and Istio. OFF by default: they are commonly
    shared, and removing a CRD deletes every custom resource of that kind on the
    cluster, including ones this project did not create.

.NOTES
    ADR-0021 the 31-day billing tail.
    ADR-0024 teardown, residue, and what is worth backing up first.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][string]$ConnectedClusterName,
    [Parameter(Mandatory)][string]$ResourceGroup,
    [switch]$RemovePrerequisites
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot

Write-Host ''
Write-Host 'BEFORE YOU TEAR DOWN: almost everything here is rebuildable from source' -ForegroundColor Yellow
Write-Host 'and from the catalog. The exceptions, and therefore the backup scope, are' -ForegroundColor Yellow
Write-Host 'the CERTIFICATE MATERIAL and the DISCONNECTED-OPERATIONS ARTIFACTS' -ForegroundColor Yellow
Write-Host '(ADR-0024 decision 10). Back those up first if you will need them.' -ForegroundColor Yellow
Write-Host ''

# ----------------------------------------------------- layer 3, intent ------
Write-Host '=== removing layer 3: ModelDeployment intent ===' -ForegroundColor Cyan
$intent = Join-Path $root 'intent/model-deployment.yaml'
if ($PSCmdlet.ShouldProcess('ModelDeployment', 'kubectl delete')) {
    kubectl delete -f $intent --ignore-not-found
}

# --------------------------------------------------- layer 2, platform ------
Write-Host '=== removing layer 2: extensions ===' -ForegroundColor Cyan
foreach ($ext in @('foundry', 'cert-management')) {
    if ($PSCmdlet.ShouldProcess($ext, 'az k8s-extension delete')) {
        az k8s-extension delete `
            --name $ext `
            --cluster-name $ConnectedClusterName `
            --resource-group $ResourceGroup `
            --cluster-type connectedClusters `
            --yes 2>&1 | Write-Verbose
    }
}

# ------------------------------------------------ layer 1, prerequisites ----
Write-Host '=== layer 1: prerequisites ===' -ForegroundColor Cyan
if ($RemovePrerequisites) {
    Write-Host 'Removing Gateway API CRDs. NOTE: deleting a CRD deletes EVERY custom' -ForegroundColor Yellow
    Write-Host 'resource of that kind on this cluster, including ones this project did' -ForegroundColor Yellow
    Write-Host 'not create.' -ForegroundColor Yellow
    $pinFile = Join-Path $root 'prereq/gateway-api-crds.yaml'
    $url = (Get-Content -LiteralPath $pinFile | Select-String -Pattern '^\s{2}url:\s*(\S+)').Matches.Groups[1].Value
    if ($PSCmdlet.ShouldProcess('Gateway API CRDs', 'kubectl delete')) {
        kubectl delete -f $url --ignore-not-found
    }
}
else {
    Write-Host 'Left in place. Gateway API and Istio are commonly shared with other'
    Write-Host 'workloads. Pass -RemovePrerequisites only if you are certain.'
}

# ------------------------------------------- the part that stops billing ----
Write-Host ''
Write-Host '=== deleting the ARM resource ===' -ForegroundColor Cyan
Write-Host 'This is the step that stops billing. Skipping it leaves the meter running' -ForegroundColor Yellow
Write-Host 'for 31 days after disconnection (ADR-0021).' -ForegroundColor Yellow

if ($PSCmdlet.ShouldProcess($ConnectedClusterName, 'delete the Arc connected cluster resource')) {
    $confirm = Read-Host "Type $ConnectedClusterName to confirm deletion of the ARM resource"
    if ($confirm -ne $ConnectedClusterName) {
        Write-Host ''
        Write-Host 'ARM resource NOT deleted.' -ForegroundColor Red
        Write-Host 'BILLING CONTINUES FOR 31 DAYS. Re-run this step when ready.' -ForegroundColor Red
        exit 1
    }

    az connectedk8s delete `
        --name $ConnectedClusterName `
        --resource-group $ResourceGroup `
        --yes
}

Write-Host ''
Write-Host 'Teardown complete. Residue is expected and some of it is by design;' -ForegroundColor Yellow
Write-Host 'inspect the cluster before assuming it is clean (ADR-0024 decision 9).' -ForegroundColor Yellow
