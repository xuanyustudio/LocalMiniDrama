# Release Capability Hints

Status: ready

Host tag: v37.2.1

Release note: /Users/Admin/.ohos-electron-hosts/release-notes/v37.2.1.md

Hints come from release-note keyword analysis. API support remains authoritative in upstream docs/api/index.md and scan-project.mjs.

## Hints

- global-shortcut: version-supported; APIs: globalShortcut.register; Prefer direct Electron API and keep runtime verification.
- deeplink-open-url: version-supported; APIs: app#event:open-url, protocol; Use direct API when project needs deep link/open-url behavior; add fallback documentation.
- arkts-bridge: bridge-available; APIs: systemPreferences.callArkTSFunction; Use ArkTS bridge for platform-specific replacements when Electron API is unavailable.
- screen-area: version-improved; APIs: screen.getDisplayNearestPoint, screen.getPrimaryDisplay; Keep screen APIs in verification checklist, especially multi-display behavior.
- notifications: version-improved; APIs: new Notification, notification.show; Verify permission prompt and notification delivery on device.
- hardware-codec: runtime-improved; APIs: webContents, BrowserWindow; Add media playback/image rendering smoke test when app uses media.
- native-messaging: native-runtime-improved; APIs: native module, NativeMessaging; Do not skip native verification; check process and addon hilog.
- background-app-limit: platform-limitation; APIs: Tray, app; Tray/background persistence must be degraded or explicitly documented.
- clipboard: version-improved; APIs: clipboard; Verify read/write and permission prompts.
- printing: version-improved; APIs: webContents.print, webContents.printToPDF; Add print/PDF focused probe when app uses it.
