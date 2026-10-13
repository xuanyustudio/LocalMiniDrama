# Parity Report

Status: **passed**

App: 本地短剧助手

F: **0.85** (before cap 0.9545, capped by floor main-task definition) — target 0.8

Main task source: floor-unverified

Case counts: total 26, core 4, passed 21, degraded 2, failed 0, unrecorded 0, n/a 3

## Hard constraints

| ID | OK | Detail |
|---|---|---|
| C1 | yes | all 4 core cases passed |
| C2 | yes | no fatal launch state recorded |
| C3 | yes | every accepted case carries evidence |
| C4 | yes | degraded weighted share 9.1% (limit 30%) |
| C5 | yes | not-applicable weighted share 8.3% (limit 15%) |
| C6 | yes | weak main-task definition (floor-unverified): achievable F capped at 0.85 (cap applied) |

## Cases

| Case | Core | Weight | Declared | Scored | Reason |
|---|---|---:|---|---|---|
| V001-install-and-launch-signed-hap Install and launch signed HAP | yes | 3 | passed | passed |  |
| V002-main-window-renders-content Main window renders content | yes | 3 | passed | passed |  |
| V003-main-task-step-1 Main task step 1: 确认主窗口渲染完成 | yes | 3 | passed | passed |  |
| V004-main-task-step-2 Main task step 2: 执行一次真实交互（点击 / 输入 / 菜单）并观察到可见变化 | yes | 3 | passed | passed |  |
| V005-contents-on contents.on |  | 1 | passed | passed |  |
| V006-win-on win.on |  | 1 | passed | passed |  |
| V007-win-once win.once |  | 1 | passed | passed |  |
| V008-app-getpath app.getPath |  | 1 | passed | passed |  |
| V009-app-ispackaged app.isPackaged |  | 1 | passed | passed |  |
| V010-app-quit app.quit |  | 1 | passed | passed |  |
| V011-app-setpath app.setPath |  | 1 | passed | passed |  |
| V012-app-whenready app.whenReady |  | 1 | passed | passed |  |
| V013-app-event-before-quit app#event:before-quit |  | 1 | passed | passed |  |
| V014-contents-opendevtools contents.openDevTools |  | 1 | not-applicable | not-applicable |  |
| V015-dialog-showerrorbox dialog.showErrorBox |  | 1 | degraded | degraded |  |
| V016-menu-setapplicationmenu Menu.setApplicationMenu |  | 1 | passed | passed |  |
| V017-new-browserwindow new BrowserWindow |  | 1 | passed | passed |  |
| V018-win-isdestroyed win.isDestroyed |  | 1 | passed | passed |  |
| V019-win-isvisible win.isVisible |  | 1 | passed | passed |  |
| V020-win-loadurl win.loadURL |  | 1 | passed | passed |  |
| V021-win-show win.show |  | 1 | passed | passed |  |
| V022-process-platform-branch-main-js-113 process.platform branch main.js:113 |  | 1 | passed | passed |  |
| V023-process-platform-branch-scripts-clean-win-unpack process.platform branch scripts/clean-win-unpacked.js:14 |  | 1 | not-applicable | not-applicable |  |
| V024-process-platform-branch-scripts-dist-cn-js-6 process.platform branch scripts/dist-cn.js:6 |  | 1 | not-applicable | not-applicable |  |
| V025-native-module-better-sqlite3 Native module better-sqlite3 |  | 2 | passed | passed |  |
| V026-native-module-sharp Native module sharp |  | 2 | degraded | degraded |  |
