param(
  [string]$SignedHap = '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/handoff/device-evidence/signed.hap'
)
$ErrorActionPreference = 'Stop'
node '/Users/Admin/.config/deveco/skills/ohos-electron-migrate/scripts/ohos-tools.mjs' 'install-and-capture' "$SignedHap" '.' '--bundle' 'com.localminidrama.desktop' '--workspace' '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration'
