# External Evidence Handoff

This folder exists because two acceptance gates require external state:

1. a real Windows agent for Windows compatibility evidence;
2. a user-signed HAP installed and operated on a HarmonyOS PC device.

## Windows agent smoke

Copy or sync the skill folder to a Windows agent with Node.js, Git, DevEco command-line tools, and network access, then run:

```powershell
.\run-windows-smoke.ps1 -SkillRoot "/Users/Admin/.config/deveco/skills/ohos-electron-migrate" -OutDir "C:\temp\ohos-electron-windows-smoke"
```

Attach `cross-platform-smoke.json`, `cross-platform-smoke.md`, and `completion-audit.md` from the output folder.

## Signed-device evidence

After the user signs the HAP in DevEco Studio, run one of:

```bash
./run-device-after-signing.sh <signed.hap>
```

```powershell
.\run-device-after-signing.ps1 -SignedHap <signed.hap>
```

Then operate every item in `reports/verification-checklist.md` and record each case with `scripts/record-feature-evidence.mjs`.
