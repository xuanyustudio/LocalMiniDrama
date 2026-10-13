# External Evidence Handoff Report

Status: handoff-ready

Workspace: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration

App: 本地短剧助手

Bundle: com.localminidrama.desktop

## Scripts

- Windows smoke: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/handoff/external-evidence/run-windows-smoke.ps1
- signed-device shell: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/handoff/external-evidence/run-device-after-signing.sh
- signed-device PowerShell: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/handoff/external-evidence/run-device-after-signing.ps1

## Remaining proof gates

- Windows compatibility is proved only after `cross-platform-smoke.json.status = passed` on `hostOS.platform = win32`.
- Signed-device evidence is proved only after `device-evidence-verification.json.status = passed` with per-case feature evidence.
