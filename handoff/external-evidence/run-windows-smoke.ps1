param(
  [string]$SkillRoot = "/Users/Admin/.config/deveco/skills/ohos-electron-migrate",
  [string]$OutDir = "C:\temp\ohos-electron-windows-smoke"
)
$ErrorActionPreference = "Stop"
Set-Location $SkillRoot
node scripts\smoke-cross-platform.mjs --out $OutDir
$smoke = Join-Path $OutDir "cross-platform-smoke.json"
if (!(Test-Path $smoke)) { throw "Missing cross-platform-smoke.json" }
$data = Get-Content $smoke -Raw | ConvertFrom-Json
if ($data.status -ne "passed") { throw "Windows smoke did not pass" }
if ($data.hostOS.platform -ne "win32") { throw "Smoke did not run on win32" }
node scripts\audit-skill-completion.mjs $SkillRoot --workspace $OutDir --json (Join-Path $OutDir "completion-audit.json") --markdown (Join-Path $OutDir "completion-audit.md")
Write-Host "Windows evidence ready:" $OutDir
