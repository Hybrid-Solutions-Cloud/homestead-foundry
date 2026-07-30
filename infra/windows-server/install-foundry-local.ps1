#Requires -Version 7.0
<#
.SYNOPSIS
    Installs Foundry Local on a Windows Server host, idempotently.

.DESCRIPTION
    Runs ON THE TARGET HOST, delivered by Azure Arc run command. See
    invoke-install.ps1 for the operator-side wrapper.

    Implements the four check-before-act stages of ADR-0013 decision 3.

    IDEMPOTENCE IS THIS SCRIPT'S CONTRACT, NOT THE TOOLING'S. Arc run command
    can only run an action; it cannot read state (SPIKE-29 Q3). So every stage
    determines its own precondition here, at runtime, and reports one of
    already-present / changed / failed. A second run must exit 0 having
    changed nothing.

    UNPROVEN. This has never been executed. The largest known risk is stage 2:
    a provisioned MSIX may never register on a headless server nobody signs in
    to, because provisioning stages the package for registration at next user
    sign-in (SPIKE-23). That is what the first authorized test exists to answer.

.PARAMETER ModelAlias
    Catalog alias to pull. Defaults to the ADR-0019 first increment.

.PARAMETER PackagePath
    Local path or UNC path to the Foundry Local MSIX bundle. Required: this
    script never downloads from the internet on the operator's behalf.

.PARAMETER SkipModelPull
    Run stages 1 to 3 only. Useful for a first test that keeps a multi-GB pull
    out of the picture while the install mechanism is being validated.

.OUTPUTS
    A JSON summary object on the last line of stdout. Run-command output is
    truncated to the LAST 4 KB in the Arc instance view, so the machine-readable
    result is emitted last, deliberately.

.NOTES
    ADR-0013 install mechanism and identity scope.
    ADR-0019 first-increment model.
    ADR-0024 lifecycle and drift.
    SPIKE-23 install artifacts and run-command mechanics.
#>
[CmdletBinding()]
param(
    [string]$ModelAlias = 'phi-4-mini',

    [Parameter(Mandatory)]
    [string]$PackagePath,

    [switch]$SkipModelPull
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Minimum free space for the model cache. TRANSFERRED, not published: Microsoft
# publishes no disk minimum for Foundry Local on Windows at all (SPIKE-25). This
# is the ADR-0019 first-increment model size (4.8 GB, the one catalog entry with
# a published size) with headroom. Per ADR-0020 every hardware number in this
# repository carries its provenance, and this one is transferred.
$script:MinimumFreeGb = 20

$script:Stages = [System.Collections.Generic.List[object]]::new()

function Write-Stage {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][ValidateSet('already-present', 'changed', 'failed')][string]$Result,
        [string]$Detail = ''
    )
    $script:Stages.Add([pscustomobject]@{ stage = $Name; result = $Result; detail = $Detail })
    Write-Host ("[{0,-14}] {1}{2}" -f $Result, $Name, $(if ($Detail) { " - $Detail" } else { '' }))
}

function Get-FoundryCommand {
    # The CLI is not on PATH until the package registers for the calling user,
    # which is the crux of the headless-registration risk above.
    Get-Command -Name 'foundry' -CommandType Application -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------- stage 1 ----
function Test-Prerequisites {
    $osBuild = [System.Environment]::OSVersion.Version.Build
    if ($osBuild -lt 20348) {
        Write-Stage -Name 'prerequisites' -Result 'failed' -Detail "OS build $osBuild is below the Windows Server 2022 floor (20348)"
        return $false
    }

    $systemDrive = $env:SystemDrive.TrimEnd(':')
    $free = (Get-PSDrive -Name $systemDrive).Free / 1GB
    if ($free -lt $script:MinimumFreeGb) {
        Write-Stage -Name 'prerequisites' -Result 'failed' -Detail ("only {0:N1} GB free, need {1} GB for the model cache" -f $free, $script:MinimumFreeGb)
        return $false
    }

    if (-not (Test-Path -LiteralPath $PackagePath)) {
        Write-Stage -Name 'prerequisites' -Result 'failed' -Detail "package not found at $PackagePath"
        return $false
    }

    Write-Stage -Name 'prerequisites' -Result 'already-present' -Detail ("OS build {0}, {1:N1} GB free" -f $osBuild, $free)
    return $true
}

# ---------------------------------------------------------------- stage 2 ----
function Install-Package {
    # NOT winget. Microsoft documents winget as blocked for machine-scope MSIX
    # installs, which is why ADR-0013 supersedes ADR-0011 on this point.
    $existing = Get-AppxProvisionedPackage -Online |
        Where-Object { $_.DisplayName -like '*FoundryLocal*' }

    if ($existing) {
        Write-Stage -Name 'install' -Result 'already-present' -Detail "provisioned version $($existing[0].Version)"
        return $true
    }

    try {
        Add-AppxProvisionedPackage -Online -PackagePath $PackagePath -SkipLicense | Out-Null
    }
    catch {
        Write-Stage -Name 'install' -Result 'failed' -Detail $_.Exception.Message
        return $false
    }

    $now = Get-AppxProvisionedPackage -Online |
        Where-Object { $_.DisplayName -like '*FoundryLocal*' }

    if (-not $now) {
        Write-Stage -Name 'install' -Result 'failed' -Detail 'provisioning reported success but the package is not listed'
        return $false
    }

    Write-Stage -Name 'install' -Result 'changed' -Detail "provisioned version $($now[0].Version)"
    return $true
}

# ---------------------------------------------------------------- stage 3 ----
function Start-FoundryService {
    $foundry = Get-FoundryCommand
    if (-not $foundry) {
        # THE headless-registration risk. Provisioning stages the package for
        # registration at next user sign-in; on a server nobody signs into, that
        # may never happen. Reported as a distinct, named failure rather than a
        # generic "not found" so the first test produces a usable answer.
        Write-Stage -Name 'service' -Result 'failed' -Detail 'foundry CLI not on PATH: the provisioned package has not registered for this user (SPIKE-23 headless-registration risk)'
        return $false
    }

    $status = & $foundry service status 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -and $status -match 'running') {
        Write-Stage -Name 'service' -Result 'already-present' -Detail 'service already running'
        return $true
    }

    & $foundry service start 2>&1 | Out-String | Write-Verbose
    if ($LASTEXITCODE -ne 0) {
        Write-Stage -Name 'service' -Result 'failed' -Detail "service start exited $LASTEXITCODE"
        return $false
    }

    Write-Stage -Name 'service' -Result 'changed' -Detail 'service started'
    return $true
}

# ---------------------------------------------------------------- stage 4 ----
function Install-Model {
    if ($SkipModelPull) {
        Write-Stage -Name 'model' -Result 'already-present' -Detail 'skipped by -SkipModelPull'
        return $true
    }

    $foundry = Get-FoundryCommand
    if (-not $foundry) {
        Write-Stage -Name 'model' -Result 'failed' -Detail 'foundry CLI not available'
        return $false
    }

    $cache = & $foundry cache list 2>&1 | Out-String
    if ($cache -match [regex]::Escape($ModelAlias)) {
        Write-Stage -Name 'model' -Result 'already-present' -Detail "$ModelAlias already in the cache"
        return $true
    }

    # A multi-GB pull is exactly the case the 4 KB instance-view truncation
    # hurts, so the outcome is reduced to a single line rather than streamed.
    & $foundry model download $ModelAlias 2>&1 | Out-String | Write-Verbose
    if ($LASTEXITCODE -ne 0) {
        Write-Stage -Name 'model' -Result 'failed' -Detail "download of $ModelAlias exited $LASTEXITCODE"
        return $false
    }

    Write-Stage -Name 'model' -Result 'changed' -Detail "$ModelAlias pulled into the cache"
    return $true
}

# ------------------------------------------------------------------- main ----
$ok = $true
foreach ($stage in @(
        { Test-Prerequisites },
        { Install-Package },
        { Start-FoundryService },
        { Install-Model }
    )) {
    if (-not (& $stage)) { $ok = $false; break }
}

$summary = [pscustomobject]@{
    ok      = $ok
    changed = [bool]($script:Stages | Where-Object { $_.result -eq 'changed' })
    stages  = $script:Stages
}

# Last line, so it survives the 4 KB instance-view truncation.
Write-Host ($summary | ConvertTo-Json -Depth 4 -Compress)

exit $(if ($ok) { 0 } else { 1 })
