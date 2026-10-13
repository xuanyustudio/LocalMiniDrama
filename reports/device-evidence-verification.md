# Device Evidence Verification

Status: passed

Workspace: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration

Evidence dir: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/evidence

Verification cases planned: 26

Feature evidence: 26/26

| Check | OK | Evidence | Next |
|---|---|---|---|
| device-run-summary | yes | /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/reports/device-run-summary.json | Run node scripts/ohos-tools.mjs install-and-capture after automatic signing. |
| device-run-complete | yes | launched-and-evidence-captured | Do not accept evidence from a failed or partial device run. |
| online-target-recorded | yes | 3BT0124910000126 | Use an online hdc target selected by install-and-capture. |
| signed-hap-recorded | yes | /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/artifacts/electron-app-signed.hap | Pass the signed HAP path to install-and-capture. |
| signed-hap-exists | yes | /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/artifacts/electron-app-signed.hap | Keep the signed HAP available until acceptance is complete. |
| bundle-recorded | yes | com.localminidrama.desktop | Use migration-metadata.json bundleName with --bundle. |
| install-command-passed | yes | 0 | Resolve the hdc install failure before collecting evidence. |
| bundle-manager-confirmed-install | yes | true | Require bm dump to return the expected bundle after installation. |
| launch-command-passed | yes | 0 | Resolve the Ability Manager launch failure before collecting evidence. |
| application-process-alive | yes | true | Require the target bundle process to remain alive through the observation window. |
| evidence-index | yes | /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/evidence/evidence-index.json | Run node scripts/ohos-tools.mjs capture-evidence or install-and-capture. |
| screenshot-captured | yes | ev-20261009-181242.jpeg | Capture at least one screenshot after app launch. |
| window-present | yes | true | Run node scripts/ohos-tools.mjs install-and-capture; it records window presence from the device window dump. |
| screenshot-analysed | yes | true | Two PNG frames at least 3s apart must decode; a non-decodable capture cannot prove a usable window. |
| screenshot-not-blank | yes | false | Blank/white/black frames mean the app rendered nothing; fix the app before claiming delivery. |
| parity-report-present | yes | /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/reports/parity-report.json | Run node scripts/compute-parity.mjs --plan reports/verification-plan.json --evidence reports/feature-evidence.json. |
| parity-verdict-passed | yes | passed | Fix the failing hard constraints (C1-C6) listed in reports/parity-report.md. |
| parity-core-cases-passed | yes | all 4 core cases passed | Every core case (install/launch, main window renders, main task steps) must pass. |
| parity-score-meets-target | yes | F=0.85 target=0.8 | Record real device evidence for every case; degraded cases score half. |
| parity-no-not-applicable-abuse | yes | not-applicable weighted share 8.3% (limit 15%) | not-applicable cannot exceed 15% of the weighted denominator. |
| hilog-captured | yes | hilog-20261009-181242.log | Capture hilog filtered by app/electron/dlopen. |
| no-obvious-native-loader-error | yes | /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/evidence/hilog-20261009-181242.log | If this fails, inspect native-build-audit and rebuild affected addon. |
| verification-plan-present | yes | /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/reports/verification-plan.json | Generate reports/verification-plan.json during migration. |
| feature-evidence-report | yes | /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/reports/feature-evidence.json | Run node scripts/record-feature-evidence.mjs --workspace <workspace> --init, then record each checklist case after operating the app. |
| feature-evidence-all-cases-recorded | yes | 26/26 | Record evidence for every reports/verification-plan.json case; degraded/not-applicable is allowed only with a note. |
| feature-evidence-no-failed-or-blocked | yes | 0 failed/blocked | Resolve failed/blocking cases or document them as accepted degraded/not-applicable before claiming parity. |
| feature-evidence-artifacts-present | yes | 0 accepted cases lack screenshot/hilog files | Every accepted feature case must point to a non-empty screenshot or hilog artifact. |
