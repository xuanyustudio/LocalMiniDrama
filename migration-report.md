# Electron to HarmonyOS PC Migration Report

Status: delivered

Complete: yes

Source: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/source/desktop

Workspace: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration

Host: /Users/Admin/.ohos-electron-hosts/hosts/v37.2.1

Bundle: com.localminidrama.desktop

## Invocation

- original args: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama --app desktop --out /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration --resume --bundle-name com.localminidrama.desktop --signing-config /Users/Admin/.ohos/config/localminidrama-authorized-signing.json
- effective command: node scripts/migrate-electron-ohos.mjs /Users/Admin/Desktop/eng/tmp/LocalMiniDrama --app desktop --out /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration --resume --bundle-name com.localminidrama.desktop --signing-config /Users/Admin/.ohos/config/localminidrama-authorized-signing.json
- natural language request: n/a
- host OS: darwin/arm64, Node v24.14.1

## Source Acquisition

- source type: local-copy
- provider: local
- acquisition method: unknown
- source url/path: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama
- checkout path: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/source
- clone url: n/a
- archive url: n/a
- branch/tag/commit: default
- resolved commit: n/a
- archive sha256: n/a

## Electron Detection

- status: electron
- is Electron: true
- confidence: high
- selected app: desktop
- next: Proceed with migration using the preferred Electron app root.

## Source Preparation

- app root: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/source/desktop
- package manager: npm
- install status: ready
- install command: npm ci
- source audit status: risk-review
- migration mode: source-with-prebuild
- mode strategy: Run dependency install and prebuild before injection unless explicitly skipped; inject both source and generated dist artifacts.
- mode cautions: desktop packaging scripts detected: pack, dist, dist:cn, dist:mac, postinstall. Do not run win/mac packaging as the migration target.
- prebuild status: ready
- prebuild command: npm run build:front

## Environment

- status: ready
- hdc: device-present
- ohpm: /Applications/DevEco-Studio.app/Contents/tools/ohpm/bin/ohpm
- hvigor: /Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw
- java: /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin/java

## Host Release Capability Hints

- status: ready
- host tag: v37.2.1
- hints: 10
- limitations: background-app-limit

## Summary

- APIs scanned: 17
- Unsupported: 0
- Partial: 0
- Unknown: 3
- Native modules: better-sqlite3, sharp

## Native Module Plan

- status: native-review-required
- queue size: 2
- blocking: 2
- unknown recipes: 0
- native build audit: passed

- better-sqlite3: blocking-until-reviewed; rebuild-ohos-arm64; pending-abi-and-sdk; not installed yet
- sharp: blocking-until-reviewed; prefer-wasm-or-service-replacement; pending-abi-and-sdk; not installed yet

## Verification Plan

- cases: 26
- static parity score: 82/100 (planning score only; final proof needs signed-device evidence)
- blocking cases: 6

Checklist: reports/verification-checklist.md

## Degraded Or Blocking Items

- none detected by static scan

## Unknown Items Requiring Probe

- contents.on: main.js:202
- win.on: main.js:207
- win.once: main.js:191

## Generated Artifacts

- source acquisition: reports/source-acquisition.json
- electron detection: reports/electron-detection.json
- app resolution: reports/app-resolution.json
- source audit: reports/source-audit.json
- dependency install: reports/dependency-install.json
- migration mode: reports/migration-mode.json
- prebuild: reports/prebuild.json
- environment check: reports/environment-check.json
- release capabilities: reports/release-capabilities.json
- scan report: reports/scan-report.json
- shim report: ohos_hap/web_engine/src/main/resources/resfile/resources/app/ohos-shim-report.json
- command log: reports/command-log.json

- native plan: reports/native-plan.json
- native plan markdown: reports/native-plan.md
- native build audit: reports/native-build-audit.json
- verification plan: reports/verification-plan.json
- verification checklist: reports/verification-checklist.md
- signing runbook: reports/signing-runbook.md
- signing diagnosis: reports/signing-diagnosis.json
- device handoff: reports/device-handoff.json
- external evidence handoff: reports/external-evidence-handoff.json
- external evidence handoff markdown: reports/external-evidence-handoff.md
- device run summary after install: reports/device-run-summary.json
- device evidence verification after install: reports/device-evidence-verification.json

## Signing Boundary

Build output remains unsigned until either AGC unattended provisioning or an existing authorized signing config completes. DevEco Studio UI is not required. Do not claim install success before a Huawei-authorized signed HAP is installed on device and evidence is captured.

Signing runbook status: automatic-agc-signing-supported

Signing diagnosis status: needs-provisioning

Device handoff status: external-signing-handoff-ready

External evidence handoff status: handoff-ready

## Build

OHPM command: /Applications/DevEco-Studio.app/Contents/tools/ohpm/bin/ohpm install --all
OHPM status: 0
OHPM error: none
ohpm INFO: MetaDataFetcher fetching meta info of package 'inversify' from https://ohpm.openharmony.cn/ohpm/
ohpm INFO: MetaDataFetcher fetching meta info of package 'reflect-metadata' from https://ohpm.openharmony.cn/ohpm/
ohpm INFO: fetch meta info of package 'reflect-metadata' success https://ohpm.openharmony.cn/ohpm/reflect-metadata
ohpm INFO: fetch meta info of package 'inversify' success https://ohpm.openharmony.cn/ohpm/inversify
[32minstall completed in 0s 754ms[39m



Command: /Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw assembleHap --no-daemon
Command status: 0
Error: none
ard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleWindow.ets:61:68
 The 'KEYCODE_ESCAPE' API is supported since SDK version 9. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleWindow.ets:62:17
 The 'stopPropagation' API is supported since SDK version 7. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleWindow.ets:66:6
 The 'width' API is supported since SDK version 7. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleWindow.ets:67:6
 The 'height' API is supported since SDK version 7. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleWindow.ets:68:6
 The 'padding' API is supported since SDK version 7. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleWindow.ets:75:17
 The 'getUIContext' API is supported since SDK version 11. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleWindow.ets:75:32
 The 'px2vp' API is supported since SDK version 12. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleSubWindow.ets:32:18
 The 'LocalStorage' API is supported since SDK version 9. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleSubWindow.ets:32:31
 'getShared' has been deprecated.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleSubWindow.ets:32:31
 The 'getShared' API is supported since SDK version 10. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleSubWindow.ets:33:2
 The 'Entry' API is supported since SDK version 7. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleSubWindow.ets:34:2
 The 'Component' API is supported since SDK version 7. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleSubWindow.ets:37:5
 The 'Column' API is supported since SDK version 7. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleSubWindow.ets:40:6
 The 'width' API is supported since SDK version 7. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33m[33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/NodeHandleSubWindow.ets:41:6
 The 'height' API is supported since SDK version 7. However, the current compatible SDK version is 5.0.5(17).
 It is recommended to use apiAvailable to safeguard API compatibility.
[39m[39m
[33mWARN: [33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/src/main/ets/pages/WebPage.ets:6:1
 It's not a recommended way to export struct with '@Entry' decorator, which may cause ACE Engine error in component preview mode.[39m[39m
[33mWARN: [33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/web_engine/src/main/ets/interface/CommonInterface.ts:70:53
 Cannot find name 'GestureEvent'.[39m[39m
[33mWARN: [33mArkTS:WARN File: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/web_engine/src/main/ets/interface/CommonInterface.ts:71:59
 Cannot find name 'GestureEvent'.[39m[39m
[39m
> hvigor [33mWARN: No signingConfig found for product default[39m


## Audit

HAP: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/build/default/outputs/default/electron-default-unsigned.hap
Status: 0

✓ Electron 运行时 so
✓ electron 可执行文件
✓ 应用已注入(resources/app)
✓ icu 数据
✓ v8 快照
✓ 应用入口可解析: main=ohos-main-wrapper.js → resources/resfile/resources/app/ohos-main-wrapper.js
✓ 架构: libs/arm64-v8a/libadapter.so — ELF 64-bit machine=183 (AArch64)
✓ 架构: libs/arm64-v8a/better_sqlite3_sync.node — ELF 64-bit machine=183 (AArch64)
✓ 架构: libs/arm64-v8a/libc++_shared.so — ELF 64-bit machine=183 (AArch64)
✓ 架构: libs/arm64-v8a/libelectron.so — ELF 64-bit machine=183 (AArch64)
✓ 架构: libs/arm64-v8a/libffmpeg.so — ELF 64-bit machine=183 (AArch64)
✓ audit-hap 全绿: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap/electron/build/default/outputs/default/electron-default-unsigned.hap


