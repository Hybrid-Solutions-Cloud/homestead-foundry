#Requires -Version 7.0
<#
.SYNOPSIS
    Operator-side wrapper: submits the Foundry Local install to an Arc-enabled
    server via Azure Arc run command, and interprets the result.

.DESCRIPTION
    Runs ON THE OPERATOR'S MACHINE, not on the target host.

    THIS IS THE GATED ENTRY POINT. It performs an Azure write (it creates a run
    command resource and executes code on a server), so it prompts for
    confirmation unless -Force is passed, per this repository's Azure writes
    gate.

    WHAT IT DOES NOT DO: it does not Arc-enable the server. That is a hard
    prerequisite, not an optional step (ADR-0011), and onboarding a machine is
    an owner action outside this script.

    NO BLOB, NO SECRET. SPIKE-23 found blob staging is not required, so the
    default path uses none and therefore has no secret surface at all. That is
    why this script has no SAS handling: ADR-0005's exception applies only to
    the optional blob output path, which this does not use.

.PARAMETER MachineName
    Name of the Arc-enabled machine (Microsoft.HybridCompute/machines).

.PARAMETER ResourceGroup
    Resource group holding the Arc machine resource.

.PARAMETER PackagePath
    Path to the Foundry Local MSIX, as the TARGET HOST will see it.

.PARAMETER SkipModelPull
    Pass through to the install script. Recommended for the first test run.

.PARAMETER Force
    Skip the confirmation prompt. Intended for a non-interactive re-run after a
    human has already approved this exact operation once.

.NOTES
    ADR-0011 automation form. ADR-0013 install mechanics.
    SPIKE-23 run-command mechanics: 4 KB instance-view cap, RBAC split,
    preview status, and the agent version floor.

    RBAC needed: Azure Connected Machine Resource Administrator to submit
    (runCommands/write), Reader to read the result (runCommands/read).
    Requires Connected Machine agent 1.33 or later and the
    connectedmachine CLI extension 2.75.0 or later.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$MachineName,
    [Parameter(Mandatory)][string]$ResourceGroup,
    [Parameter(Mandatory)][string]$PackagePath,
    [switch]$SkipModelPull,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'install-foundry-local.ps1'
if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "install-foundry-local.ps1 not found next to this script at $scriptPath"
}

# Run command names are limited to 36 characters on Linux; kept short here for
# consistency across platforms rather than relying on the Windows allowance.
$runCommandName = 'foundry-local-install'

Write-Host ''
Write-Host 'Azure write, and remote code execution on a server.' -ForegroundColor Yellow
Write-Host "  machine        : $MachineName"
Write-Host "  resource group : $ResourceGroup"
Write-Host "  package        : $PackagePath"
Write-Host "  model pull     : $(if ($SkipModelPull) { 'skipped' } else { 'yes' })"
Write-Host ''
Write-Host 'This has NEVER been executed successfully. Run it against a disposable' -ForegroundColor Yellow
Write-Host 'build VM, never a working host.' -ForegroundColor Yellow
Write-Host ''

if (-not $Force) {
    $answer = Read-Host 'Type the machine name to proceed'
    if ($answer -ne $MachineName) {
        Write-Host 'Aborted. Nothing was submitted.'
        exit 1
    }
}

$parameters = @("PackagePath=$PackagePath")
if ($SkipModelPull) { $parameters += 'SkipModelPull=true' }

az connectedmachine run-command create `
    --name $runCommandName `
    --machine-name $MachineName `
    --resource-group $ResourceGroup `
    --script "@$scriptPath" `
    --parameters $parameters `
    --output json | Out-Null

if ($LASTEXITCODE -ne 0) {
    throw "run command submission failed with exit code $LASTEXITCODE"
}

$result = az connectedmachine run-command show `
    --name $runCommandName `
    --machine-name $MachineName `
    --resource-group $ResourceGroup `
    --output json | ConvertFrom-Json

$view = $result.instanceView

Write-Host ''
Write-Host "execution state : $($view.executionState)"
Write-Host "exit code       : $($view.exitCode)"
Write-Host ''
Write-Host '--- output (LAST 4 KB ONLY; the cap is the product, not this script) ---'
Write-Host $view.output

if ($view.error) {
    Write-Host '--- error ---' -ForegroundColor Red
    Write-Host $view.error
}

# The install script emits its JSON summary last precisely so it survives the
# 4 KB truncation. Pull it back out for a machine-readable result.
$lastLine = ($view.output -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 1)
try {
    $summary = $lastLine | ConvertFrom-Json
    Write-Host ''
    Write-Host "ok      : $($summary.ok)"
    Write-Host "changed : $($summary.changed)"
}
catch {
    Write-Host ''
    Write-Host 'Could not parse a JSON summary from the last output line.' -ForegroundColor Yellow
    Write-Host 'That usually means the output was truncated past the summary, or the' -ForegroundColor Yellow
    Write-Host 'script failed before emitting it.' -ForegroundColor Yellow
}

exit $(if ($view.exitCode -eq 0) { 0 } else { 1 })
