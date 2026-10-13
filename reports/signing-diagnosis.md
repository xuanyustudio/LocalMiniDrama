# Signing Diagnosis

Status: needs-provisioning

Workspace: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration

HAP project: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/ohos_hap

Signing material count: 48

## Signing path references

| Key | Exists | Stale user path | Value |
|---|---|---|---|
| none | no | no | no signing path references found |

## HAP outputs

- none

## Blockers

- none detected by static signing diagnosis

## Next

1. Configure one AGC Service Account credential outside the repository (platform administrator action).
2. Run node scripts/agc-unattended-signing.mjs diagnose --config <agc-provisioning.json>.
3. Resume migration with --agc-config <agc-provisioning.json>; the Agent provisions, signs, verifies, installs, and captures evidence without DevEco Studio UI.
4. Use --signing-config <authorized-signing.json> only when authorized P12/CER/P7B material already exists.

This diagnosis does not prove signed-device execution; Phase 6 is complete only after device-evidence-verification.json status is passed.
