# Native Module Rebuild Plan

Status: native-review-required

App: /Users/Admin/Desktop/eng/tmp/LocalMiniDrama-ohos-migration/source/desktop

Summary: 2 module(s), 2 blocking, 0 without bundled recipe.

## Global gates

- Do not reuse macOS/Windows/Linux prebuilt .node artifacts.
- Measure process.versions.modules on the target HarmonyOS PC before accepting ABI compatibility.
- Re-run this plan whenever host tag, Electron version, dependency lockfile, or native SDK changes.
- Every rebuilt .node must pass audit-node.sh and a feature-level device test.

## Queue

### better-sqlite3

- version: ^11.6.0
- dependency kind: dependency
- priority: blocking-until-reviewed
- status: pending-abi-and-sdk
- strategy: rebuild-ohos-arm64
- package dir: not installed yet
- build: `Install dependencies first, then locate node_modules/better-sqlite3 and run node scripts/ohos-tools.mjs build-native`
- audit: `node scripts/ohos-tools.mjs audit-node <rebuilt .node files>`
- rationale: Synchronous API shape is a better fit than node-sqlite3; still requires ABI-matched OHOS build and device proof.

### sharp

- version: ^0.34.5
- dependency kind: dependency
- priority: blocking-until-reviewed
- status: pending-abi-and-sdk
- strategy: prefer-wasm-or-service-replacement
- package dir: not installed yet
- build: `Install dependencies first, then locate node_modules/sharp and run node scripts/ohos-tools.mjs build-native`
- audit: `node scripts/ohos-tools.mjs audit-node <rebuilt .node files>`
- rationale: libvips toolchain is heavy; prefer WASM/service fallback unless native performance is essential.

