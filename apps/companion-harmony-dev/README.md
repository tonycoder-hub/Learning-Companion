# Learning Companion HarmonyOS Scaffold

Stage: DevEco scaffold handoff. This directory is intentionally not claimed as a compiled HarmonyOS app until DevEco Studio or the HarmonyOS command-line toolchain verifies it.

## Purpose

This scaffold gives the native HarmonyOS work a concrete shape without requiring credentials, device access, or SDK approval tonight.

- Import local `learning-companion.workspace.v1` or `learning-companion.mirror-bundle.staging.v1` JSON.
- Render Phone Next, Resume Here, topic summaries, due review cards, and import receipts.
- Export append-only inbox/review-progress patch envelopes.
- Avoid Feishu credentials, browser cookies, background sync, or direct Mac workspace mutation.

## DevEco Import

Open this folder as a HarmonyOS project candidate:

```text
apps/companion-harmony-dev/
```

Expected first DevEco tasks:

1. Confirm `AppScope/app.json5` and `entry/src/main/module.json5` match the installed SDK version.
2. Wire a document picker into `services/importPortableData.ets` using the scaffolded contract: one `.json` file, 5 MB max, workspace or mirror bundle schema only.
3. Replace `sampleReaderView()` with the accepted `ReaderSessionState.currentView`, then render `readerNextAction` as the first phone landing action.
4. Add device storage for the last accepted reader view.
5. Run the manual gates from `../companion-harmony/DEVECO_HANDOFF.md`.

## Boundaries

- Read-only reader screens may ship first.
- Phone writes must remain append-only patch exports.
- Mac remains the authority for importing patches and resolving conflicts.
- Live Feishu sync is not part of this scaffold.
- Non-JSON files, oversized files, and patch files should show an import receipt instead of mutating reader state.
- Failed imports must keep the previous `ReaderSessionState.currentView` visible.
- Index, TopicDetail, and ReviewQueue should all render from `ReaderSessionState.currentView`, not from separate page-local placeholders. Index should keep `readerNextAction` above dense lists so the phone starts with one study action instead of a dashboard.
