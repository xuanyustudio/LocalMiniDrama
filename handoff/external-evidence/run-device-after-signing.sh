#!/usr/bin/env bash
set -euo pipefail
signed_hap="${1:-}"
if [ -z "$signed_hap" ]; then
  echo "Usage: ./run-device-after-signing.sh <signed.hap>" >&2
  exit 2
fi
node '/Users/Admin/.config/deveco/skills/ohos-electron-migrate/scripts/ohos-tools.mjs' install-and-capture "$signed_hap" '本地短剧助手' --bundle 'com.localminidrama.desktop' --workspace '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration'
node '/Users/Admin/.config/deveco/skills/ohos-electron-migrate/scripts/verify-device-evidence.mjs' --workspace '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration' --json '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/reports/device-evidence-verification.json' --markdown '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/reports/device-evidence-verification.md'
node '/Users/Admin/.config/deveco/skills/ohos-electron-migrate/scripts/audit-skill-completion.mjs' '/Users/Admin/.config/deveco/skills/ohos-electron-migrate' --workspace '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration' --json '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/reports/completion-audit-after-device.json' --markdown '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/reports/completion-audit-after-device.md'
