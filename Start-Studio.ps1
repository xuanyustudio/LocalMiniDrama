param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend-node'
$url = 'http://127.0.0.1:5679/'
$studioProcess = $null

function Test-Studio {
    try {
        $result = Invoke-RestMethod -Uri ($url + 'health') -TimeoutSec 2
        return $result.app -eq 'LocalMiniDrama API' -and $result.status -eq 'ok'
    } catch { return $false }
}

if (-not (Test-Studio)) {
    $node = Join-Path $root 'runtime-node-test\node.exe'
    if (-not (Test-Path $node)) {
        $installedNode = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $installedNode) { throw 'Install Node.js 22 or newer before starting the studio.' }
        $node = $installedNode.Source
    }
    $studioProcess = Start-Process -FilePath $node -ArgumentList 'src/server.js' -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $backend 'studio-output.log') -RedirectStandardError (Join-Path $backend 'studio-error.log') -PassThru
    for ($i = 0; $i -lt 30 -and -not (Test-Studio); $i++) { Start-Sleep -Seconds 1 }
    if (-not (Test-Studio)) { throw "Studio did not start. See backend-node/studio-error.log" }
}

try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 | Out-Null }
catch {
    $ollama = Get-Command ollama.exe -ErrorAction SilentlyContinue
    if ($ollama) { Start-Process -FilePath $ollama.Source -ArgumentList 'serve' -WindowStyle Hidden | Out-Null }
}

if (-not $NoBrowser) { Start-Process $url }
Write-Output "Studio ready: $url"
if ($studioProcess) {
    Write-Output 'Keep this window open while using the studio.'
    Wait-Process -Id $studioProcess.Id
}
