#Requires -Version 7.0
<#
.SYNOPSIS
    Removes Foundry Local from a Windows Server host, idempotently.

.DESCRIPTION
    Runs ON THE TARGET HOST, delivered by Azure Arc run command.

    Same contract as the install: every stage checks before acting and reports
    already-absent / changed / failed, and a second run exits 0 having changed
    nothing.

    WHY THE MODEL CACHE IS NOT REMOVED BY DEFAULT: the cache is the unit of
    state for this target (ADR-0013), it is multi-GB, and re-pulling it is the
    slowest part of a rebuild. Removing it is opt-in via -RemoveModelCache.

    NOTE ON COST: unlike Azure Local Foundry, this target has no ARM resource
    and no meter, so there is no billing tail to stop. ADR-0021's 31-day
    disconnection rule does NOT apply here. Deleting the Arc machine resource,
    if the host is being retired entirely, is a separate operator action and is
    deliberately out of this script's scope: it governs the host, not Foundry
    Local.

.PARAMETER RemoveModelCache
    Also delete the on-disk model cache.

.OUTPUTS
    A JSON summary object on the last line of stdout, for the same 4 KB
    truncation reason as the install script.

.NOTES
    ADR-0013 install mechanism and governance scope.
    ADR-0024 teardown and residue.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$RemoveModelCache
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:Stages = [System.Collections.Generic.List[object]]::new()

function Write-Stage {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][ValidateSet('already-absent', 'changed', 'failed')][string]$Result,
        [string]$Detail = ''
    )
    $script:Stages.Add([pscustomobject]@{ stage = $Name; result = $Result; detail = $Detail })
    Write-Host ("[{0,-14}] {1}{2}" -f $Result, $Name, $(if ($Detail) { " - $Detail" } else { '' }))
}

function Stop-FoundryService {
    $foundry = Get-Command -Name 'foundry' -CommandType Application -ErrorAction SilentlyContinue
    if (-not $foundry) {
        Write-Stage -Name 'service' -Result 'already-absent' -Detail 'foundry CLI not present'
        return $true
    }

    $status = & $foundry service status 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -or $status -notmatch 'running') {
        Write-Stage -Name 'service' -Result 'already-absent' -Detail 'service not running'
        return $true
    }

    if ($PSCmdlet.ShouldProcess('Foundry Local service', 'stop')) {
        & $foundry service stop 2>&1 | Out-String | Write-Verbose
        if ($LASTEXITCODE -ne 0) {
            Write-Stage -Name 'service' -Result 'failed' -Detail "service stop exited $LASTEXITCODE"
            return $false
        }
    }

    Write-Stage -Name 'service' -Result 'changed' -Detail 'service stopped'
    return $true
}

function Remove-Package {
    $existing = Get-AppxProvisionedPackage -Online |
        Where-Object { $_.DisplayName -like '*FoundryLocal*' }

    if (-not $existing) {
        Write-Stage -Name 'package' -Result 'already-absent' -Detail 'no provisioned package'
        return $true
    }

    foreach ($pkg in $existing) {
        if ($PSCmdlet.ShouldProcess($pkg.PackageName, 'remove provisioned package')) {
            try {
                Remove-AppxProvisionedPackage -Online -PackageName $pkg.PackageName -ErrorAction Stop | Out-Null
            }
            catch {
                Write-Stage -Name 'package' -Result 'failed' -Detail $_.Exception.Message
                return $false
            }
        }
    }

    Write-Stage -Name 'package' -Result 'changed' -Detail "removed $($existing.Count) provisioned package(s)"
    return $true
}

function Remove-ModelCache {
    if (-not $RemoveModelCache) {
        Write-Stage -Name 'model-cache' -Result 'already-absent' -Detail 'left in place; pass -RemoveModelCache to delete it'
        return $true
    }

    # Documented cache location is not published as a stable contract, so this
    # is best-effort and reports honestly when it cannot find it rather than
    # guessing at a path and deleting something else.
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'FoundryLocal'),
        (Join-Path $env:ProgramData 'FoundryLocal')
    ) | Where-Object { Test-Path -LiteralPath $_ }

    if (-not $candidates) {
        Write-Stage -Name 'model-cache' -Result 'already-absent' -Detail 'no cache directory found at the known locations'
        return $true
    }

    foreach ($path in $candidates) {
        if ($PSCmdlet.ShouldProcess($path, 'delete model cache')) {
            Remove-Item -LiteralPath $path -Recurse -Force
        }
    }

    Write-Stage -Name 'model-cache' -Result 'changed' -Detail ($candidates -join '; ')
    return $true
}

$ok = $true
foreach ($stage in @(
        { Stop-FoundryService },
        { Remove-Package },
        { Remove-ModelCache }
    )) {
    if (-not (& $stage)) { $ok = $false; break }
}

$summary = [pscustomobject]@{
    ok      = $ok
    changed = [bool]($script:Stages | Where-Object { $_.result -eq 'changed' })
    stages  = $script:Stages
}

Write-Host ($summary | ConvertTo-Json -Depth 4 -Compress)

exit $(if ($ok) { 0 } else { 1 })
