$ErrorActionPreference = 'Stop'
$taskDirectory = $PSScriptRoot
$runtimeDirectory = Join-Path $taskDirectory 'runtime'
$readyFile = Join-Path $runtimeDirectory 'web.json'
if (Test-Path -LiteralPath $readyFile) {
    $webInfo = Get-Content -LiteralPath $readyFile -Raw | ConvertFrom-Json
    $existingProcess = Get-Process -Id $webInfo.pid -ErrorAction SilentlyContinue
    if ($existingProcess -and $existingProcess.ProcessName -eq 'node') {
        Write-Output "Web test is already running: $($webInfo.url)"
        exit 0
    }
}
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath (Join-Path $taskDirectory 'node_modules/express/package.json'))) {
    throw 'Dependencies missing. Run npm ci inside flight-booking-test-web first.'
}
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
if (Test-Path -LiteralPath $readyFile) { Remove-Item -LiteralPath $readyFile }
$serverFile = Join-Path $taskDirectory 'server.mjs'
$webProcess = Start-Process -FilePath $nodeExecutable -ArgumentList @('"' + $serverFile + '"') `
    -WorkingDirectory $taskDirectory -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $runtimeDirectory 'server.log') `
    -RedirectStandardError (Join-Path $runtimeDirectory 'server-error.log')
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if (Test-Path -LiteralPath $readyFile) {
        $webInfo = Get-Content -LiteralPath $readyFile -Raw | ConvertFrom-Json
        Write-Output "READY: $($webInfo.url)"
        Write-Output 'Admin: admin/admin123 | Customer: nguyenvanan/user123'
        Write-Output 'This web uses its own local PostgreSQL database. Oracle and DBeaver are not required.'
        exit 0
    }
    if ($webProcess.HasExited) {
        Get-Content -LiteralPath (Join-Path $runtimeDirectory 'server-error.log')
        throw 'Web test failed to start.'
    }
    Start-Sleep -Milliseconds 500
}
throw "Startup is taking longer than expected. See $runtimeDirectory/server.log"
