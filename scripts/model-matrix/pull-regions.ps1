param([string]$Out)

New-Item -ItemType Directory -Force -Path $Out | Out-Null

$regions = az account list-locations --query "[?metadata.regionType=='Physical'].name" -o tsv
$regions = $regions -split "`r?`n" | Where-Object { $_ }
Write-Host "Regions: $($regions.Count)"

$regions | ForEach-Object -ThrottleLimit 8 -Parallel {
    $r = $_
    $f = Join-Path $using:Out "$r.json"
    if (Test-Path $f) { return }
    $raw = az cognitiveservices model list --location $r -o json 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $raw) {
        Set-Content -Path $f -Value '[]' -Encoding utf8
        Write-Host "$r : UNSUPPORTED-OR-ERROR"
        return
    }
    Set-Content -Path $f -Value $raw -Encoding utf8
    $n = ($raw | ConvertFrom-Json).Count
    Write-Host "$r : $n"
}
Write-Host "DONE"
