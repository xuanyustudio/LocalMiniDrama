param(
  [Parameter(Mandatory=$true)][string]$SignedHap
)
$ErrorActionPreference = "Stop"
node "/Users/Admin/.config/deveco/skills/ohos-electron-migrate/scripts/ohos-tools.mjs" install-and-capture $SignedHap "本地短剧助手" --bundle "com.localminidrama.desktop" --workspace "/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration"
node "/Users/Admin/.config/deveco/skills/ohos-electron-migrate/scripts/verify-device-evidence.mjs" --workspace "/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration" --json "/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/reports/device-evidence-verification.json" --markdown "/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/reports/device-evidence-verification.md"
node "/Users/Admin/.config/deveco/skills/ohos-electron-migrate/scripts/audit-skill-completion.mjs" "/Users/Admin/.config/deveco/skills/ohos-electron-migrate" --workspace "/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration" --json "/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/reports/completion-audit-after-device.json" --markdown "/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/reports/completion-audit-after-device.md"
Write-Host "Device evidence verification finished."
