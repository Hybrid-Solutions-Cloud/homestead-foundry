param([string]$Out, [string]$Filter = 'DeepSeek')

$regions = (Get-Content $Out\regions.txt) -split "`r?`n" | Where-Object { $_ }
Write-Host "scanning $($regions.Count) regions for '$Filter' quota"

$regions | ForEach-Object -ThrottleLimit 8 -Parallel {
    $r = $_
    $f = Join-Path $using:Out "usage-$r.json"
    if (Test-Path $f) { return }
    $raw = az cognitiveservices usage list -l $r -o json 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $raw) { Set-Content -Path $f -Value '[]' -Encoding utf8; return }
    Set-Content -Path $f -Value $raw -Encoding utf8
}
Write-Host "DONE"
