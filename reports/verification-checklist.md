# HarmonyOS PC Verification Checklist

Status: pending-signed-device-run

App: 本地短剧助手

Bundle: com.localminidrama.desktop

Static parity score: 82/100 (Static planning score only; final parity requires signed device evidence.)

Cases: 26

## Gates

- Do not mark any case passed without device evidence.
- Every core case must pass; a failing core case voids parity regardless of the weighted score.
- A degraded case can be accepted only when user-visible behavior is documented in migration-report.md.
- Main task source: floor-unverified (weak definition: achievable parity is capped at 0.85 until a project ohos-migration.test.json or README usage section exists)
- Native modules require feature-level proof, not only successful require().
- Unknown Electron APIs remain unclaimed until probed on the current host tag.

## Cases

### V001-install-and-launch-signed-hap Install and launch signed HAP

- category: smoke
- risk: blocking (core)
- status: pending-device-verification
- steps:
  - Sign the generated HAP in DevEco Studio.
  - Run hdc install <signed.hap>.
  - Launch the application from HarmonyOS PC.
  - Run hdc hilog and filter by app name/electron/dlopen.
- expected: App opens to its initial UI; hilog has no fatal Electron startup, ERR_DLOPEN_FAILED, or wrong ELF class errors.
- evidence: launch screenshot, install command output, hilog excerpt

### V002-main-window-renders-content Main window renders content

- category: smoke
- risk: blocking (core)
- status: pending-device-verification
- steps:
  - Keep the launched app in the foreground.
  - Confirm a window belonging to the bundle exists (install-and-capture records this automatically).
  - Confirm two frames captured at least 3s apart are not blank (no white/black/empty render).
- expected: A window exists for the bundle and the captured frames show rendered content.
- evidence: evidence/frame-a-*.png, evidence/frame-b-*.png, device-run-summary.json

### V003-main-task-step-1 Main task step 1: 确认主窗口渲染完成

- category: main-task
- risk: blocking (core)
- status: pending-device-verification
- steps:
  - Perform on device: 确认主窗口渲染完成
  - Capture the resulting UI state.
  - Record any deviation from the desktop behaviour.
- expected: The step completes on device with an observable result matching the desktop behaviour.
- evidence: screenshot, hilog excerpt on failure

### V004-main-task-step-2 Main task step 2: 执行一次真实交互（点击 / 输入 / 菜单）并观察到可见变化

- category: main-task
- risk: blocking (core)
- status: pending-device-verification
- steps:
  - Perform on device: 执行一次真实交互（点击 / 输入 / 菜单）并观察到可见变化
  - Capture the resulting UI state.
  - Record any deviation from the desktop behaviour.
- expected: The step completes on device with an observable result matching the desktop behaviour.
- evidence: screenshot, hilog excerpt on failure

### V005-contents-on contents.on

- category: window-webcontents
- risk: high
- status: pending-device-verification
- steps:
  - Navigate to the feature path using contents.on.
  - Run a focused manual probe for contents.on; do not claim parity until the result is recorded.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Observed behavior is recorded before parity is claimed.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V006-win-on win.on

- category: electron-api
- risk: high
- status: pending-device-verification
- steps:
  - Navigate to the feature path using win.on.
  - Run a focused manual probe for win.on; do not claim parity until the result is recorded.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Observed behavior is recorded before parity is claimed.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V007-win-once win.once

- category: electron-api
- risk: high
- status: pending-device-verification
- steps:
  - Navigate to the feature path using win.once.
  - Run a focused manual probe for win.once; do not claim parity until the result is recorded.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Observed behavior is recorded before parity is claimed.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V008-app-getpath app.getPath

- category: electron-api
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using app.getPath.
  - Exercise app.getPath on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V009-app-ispackaged app.isPackaged

- category: electron-api
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using app.isPackaged.
  - Exercise app.isPackaged on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V010-app-quit app.quit

- category: electron-api
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using app.quit.
  - Exercise app.quit on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V011-app-setpath app.setPath

- category: electron-api
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using app.setPath.
  - Exercise app.setPath on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V012-app-whenready app.whenReady

- category: electron-api
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using app.whenReady.
  - Exercise app.whenReady on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V013-app-event-before-quit app#event:before-quit

- category: electron-api
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using app#event:before-quit.
  - Exercise app#event:before-quit on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V014-contents-opendevtools contents.openDevTools

- category: window-webcontents
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using contents.openDevTools.
  - Exercise contents.openDevTools on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V015-dialog-showerrorbox dialog.showErrorBox

- category: desktop-ui
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using dialog.showErrorBox.
  - Exercise dialog.showErrorBox on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot, hilog excerpt if event-driven

### V016-menu-setapplicationmenu Menu.setApplicationMenu

- category: desktop-ui
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using Menu.setApplicationMenu.
  - Exercise Menu.setApplicationMenu on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot, hilog excerpt if event-driven

### V017-new-browserwindow new BrowserWindow

- category: window-webcontents
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using new BrowserWindow.
  - Exercise new BrowserWindow on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V018-win-isdestroyed win.isDestroyed

- category: electron-api
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using win.isDestroyed.
  - Exercise win.isDestroyed on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V019-win-isvisible win.isVisible

- category: electron-api
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using win.isVisible.
  - Exercise win.isVisible on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V020-win-loadurl win.loadURL

- category: electron-api
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using win.loadURL.
  - Exercise win.loadURL on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V021-win-show win.show

- category: electron-api
- risk: normal
- status: pending-device-verification
- steps:
  - Navigate to the feature path using win.show.
  - Exercise win.show on the signed HarmonyOS PC app and capture visible success or hilog confirmation.
  - Save screenshot/hilog into evidence/ with this case id in the filename when possible.
- expected: Behavior matches the desktop Electron app for the exercised path.
- evidence: screenshot or visible UI state, hilog excerpt on failure

### V022-process-platform-branch-main-js-113 process.platform branch main.js:113

- category: platform-branch
- risk: medium
- status: pending-device-verification
- steps:
  - Exercise the code path containing this branch.
  - Confirm openharmony path or safe fallback is taken.
- expected: No macOS/win32-only code path is accidentally selected on HarmonyOS PC.
- evidence: screenshot or hilog excerpt

### V023-process-platform-branch-scripts-clean-win-unpack process.platform branch scripts/clean-win-unpacked.js:14

- category: platform-branch
- risk: medium
- status: pending-device-verification
- steps:
  - Exercise the code path containing this branch.
  - Confirm openharmony path or safe fallback is taken.
- expected: No macOS/win32-only code path is accidentally selected on HarmonyOS PC.
- evidence: screenshot or hilog excerpt

### V024-process-platform-branch-scripts-dist-cn-js-6 process.platform branch scripts/dist-cn.js:6

- category: platform-branch
- risk: medium
- status: pending-device-verification
- steps:
  - Exercise the code path containing this branch.
  - Confirm openharmony path or safe fallback is taken.
- expected: No macOS/win32-only code path is accidentally selected on HarmonyOS PC.
- evidence: screenshot or hilog excerpt

### V025-native-module-better-sqlite3 Native module better-sqlite3

- category: native-module
- risk: blocking
- status: pending-device-verification
- steps:
  - Install dependencies first, then locate node_modules/better-sqlite3 and run node scripts/ohos-tools.mjs build-native
  - node scripts/ohos-tools.mjs audit-node <rebuilt .node files>
  - Run the app feature that uses better-sqlite3.
  - Capture hilog and UI evidence.
- expected: Addon loads from OHOS arm64 location and its real feature works; require()-only success is not enough.
- evidence: audit-node output, hilog excerpt, feature result screenshot

### V026-native-module-sharp Native module sharp

- category: native-module
- risk: blocking
- status: pending-device-verification
- steps:
  - Install dependencies first, then locate node_modules/sharp and run node scripts/ohos-tools.mjs build-native
  - node scripts/ohos-tools.mjs audit-node <rebuilt .node files>
  - Run the app feature that uses sharp.
  - Capture hilog and UI evidence.
- expected: Addon loads from OHOS arm64 location and its real feature works; require()-only success is not enough.
- evidence: audit-node output, hilog excerpt, feature result screenshot

