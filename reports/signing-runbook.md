# Signing and Device Verification Runbook

Status: automatic-agc-signing-supported

Workspace: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration

HAP project: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap

App: 本地短剧助手

Bundle: com.localminidrama.desktop

## Unattended AGC signing provisioning

1. A platform administrator provisions one AGC Service Account credential outside the repository; project users do not open DevEco Studio.
2. Copy references/agc-provisioning-config.example.json outside the repository and point its credentialFileEnv to the protected credential path.
3. Rerun with --resume --agc-config <agc-provisioning.json>; the Agent reads the PC UDID, requests Huawei-authorized certificate/Profile material, signs, verifies, installs, and captures evidence automatically.
4. Existing authorized keystore/certificate/Profile material remains supported through --signing-config as a compatibility path.
5. Keep Service Account keys, API secrets, P12 passwords, and access tokens outside reports and source control.

## Automatic run and diagnostic commands

`node scripts/migrate-electron-ohos.mjs <source> --out '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration' --resume --agc-config <agc-provisioning.json>`
`hdc list targets`
`hdc install <signed.hap>`
`hdc shell aa start -a EntryAbility -b 'com.localminidrama.desktop'`
`node scripts/ohos-tools.mjs install-and-capture <signed.hap> '.' --bundle 'com.localminidrama.desktop' --workspace '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration'`

## Verification inputs

- reports/verification-checklist.md
- reports/native-plan.md
- reports/signing-diagnosis.md
- reports/device-handoff.md
- reports/feature-evidence.md
- evidence/evidence-index.json
- reports/device-evidence-verification.json

## Acceptance rule

Do not claim installation or feature parity until a signed HAP has been installed on device and reports/device-evidence-verification.json is passed.
