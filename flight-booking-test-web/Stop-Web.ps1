$ErrorActionPreference = 'Stop'
$runtimeDirectory = Join-Path $PSScriptRoot 'runtime'
if (-not (Test-Path -LiteralPath (Join-Path $runtimeDirectory 'web.json'))) {
    Write-Output 'No running test web recorded.'
    exit 0
}
New-Item -ItemType File -Path (Join-Path $runtimeDirectory 'stop.request') -Force | Out-Null
Write-Output 'Stop requested. Your test database is kept for the next start.'
