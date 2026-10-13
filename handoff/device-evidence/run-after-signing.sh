#!/usr/bin/env bash
set -euo pipefail
SIGNED_HAP="${1:-$(dirname "$0")/signed.hap}"
node '/Users/Admin/.config/deveco/skills/ohos-electron-migrate/scripts/ohos-tools.mjs' 'install-and-capture' "$SIGNED_HAP" '.' '--bundle' 'com.localminidrama.desktop' '--workspace' '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration'
