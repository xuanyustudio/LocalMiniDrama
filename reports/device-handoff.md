# Device Evidence Handoff

Status: external-signing-handoff-ready

Workspace: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration

Bundle: com.localminidrama.desktop

Unsigned HAP: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/handoff/device-evidence/electron-default-unsigned.hap

Signed HAP drop path: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/handoff/device-evidence/signed.hap

## External authorized signing fallback

macOS/Linux:

```bash
/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/handoff/device-evidence/run-after-signing.sh '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/handoff/device-evidence/signed.hap'
```

Windows PowerShell:

```powershell
& '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/handoff/device-evidence/run-after-signing.ps1' -SignedHap '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/handoff/device-evidence/signed.hap'
```

Feature case evidence:

```bash
node /Users/Admin/.config/deveco/skills/ohos-electron-migrate/scripts/record-feature-evidence.mjs --workspace '/Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration' --case <case-id> --status passed --note "<what was verified>"
```

## Next

1. Prefer --agc-config for automatic certificate/Profile provisioning, signing, installation, and evidence capture.
2. If signing must occur on another authorized machine, copy its signed HAP to handoff/device-evidence/signed.hap or pass it as the first script argument.
3. Run run-after-signing.sh on macOS/Linux or run-after-signing.ps1 on Windows.
4. Operate every item in reports/verification-checklist.md and run record-feature-evidence for each case.
5. Accept Phase 6 only when reports/device-evidence-verification.json status is passed.
