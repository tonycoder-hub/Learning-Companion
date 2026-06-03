# Learning Companion HarmonyOS Scaffold

Stage: DevEco scaffold handoff. This directory is intentionally not claimed as a compiled HarmonyOS app until DevEco Studio or the HarmonyOS command-line toolchain verifies it.

## Purpose

This scaffold gives the native HarmonyOS work a concrete shape without requiring credentials, device access, or SDK approval tonight.

- Import local `learning-companion.workspace.v1` or `learning-companion.mirror-bundle.staging.v1` JSON.
- Render Phone Next, Resume Here, topic summaries, due review cards, and import receipts.
- Export append-only inbox/review-progress patch envelopes.
- Avoid Feishu credentials, browser cookies, background sync, or direct Mac workspace mutation.

## Intended Phone Loop

1. Import a fresh Mac mirror or workspace JSON.
2. Start from `Phone Next` instead of browsing the whole dashboard.
3. Read a topic, answer an open question, or reveal due review cards.
4. Save/copy the append-only return JSON produced by the wired capture or review action.
5. Move that return file back to Mac by USB, AirDrop, email, file share, or manual Feishu Drive.
6. Import on Mac from `Today > Return Files`, then export a fresh mirror before the next phone pass.

This is still a scaffold contract until DevEco compile, document picker, device storage, and real file export behavior are verified on a HarmonyOS phone.
The save/copy return JSON step names the intended native behavior; this scaffold has not verified a real HarmonyOS file write or share-sheet export.

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
- Index, TopicDetail, and ReviewQueue should all render from `ReaderSessionState.currentView`, not from separate page-local placeholders. Index should keep `readerNextAction` above dense lists so the phone starts with one study action instead of a dashboard; when `readerNextAction.secondaryAction` is present, render it as one additional button rather than another dashboard section. TopicDetail consumes `topicId` and `section` route params so topic rows and secondary actions land on the intended scaffold section instead of a generic detail page. `open_questions` and `answers_today` are across-topic reader lanes unless a later compiled app adds topic-filtered collections.
- `Manual Return` copy must stay consistent across Index, TopicDetail, and ReviewQueue: phone work exports append-only return JSON, Mac remains the source of truth, and the user imports returned files on Mac from `Today > Return Files`. ImportReceipt should stay focused on the next phone pass after a Mac import succeeds.
