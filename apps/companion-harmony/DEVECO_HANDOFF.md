# HarmonyOS DevEco Handoff

Stage: DevEco scaffold handoff. A credential-free scaffold now lives at `apps/companion-harmony-dev/`, but it is not claimed as a compiled HarmonyOS app until DevEco or the HarmonyOS command-line toolchain verifies it.

## Goal

Create a minimal HarmonyOS app that can read the same portable artifacts produced by the Mac/web app:

- `learning-companion.workspace.v1`
- `learning-companion.mirror-bundle.staging.v1`
- derived `learning-companion.harmony-reader-view.v1`

The first device milestone is read-only: import a workspace or mirror bundle, render the phone next action, active topic, answers captured today, open questions, due review cards, recent captures, and Focus Brief next action. Phone-side writes remain append-only patch exports.

## Scaffold Layout

```text
apps/companion-harmony-dev/
  build-profile.json5
  hvigorfile.ts
  oh-package.json5
  AppScope/app.json5
  AppScope/resources/base/element/string.json
  AppScope/resources/base/media/app_icon.svg
  entry/build-profile.json5
  entry/hvigorfile.ts
  entry/oh-package.json5
  entry/src/main/module.json5
  entry/src/main/ets/entryability/EntryAbility.ets
  entry/src/main/ets/pages/Index.ets
  entry/src/main/ets/pages/TopicDetail.ets
  entry/src/main/ets/pages/ReviewQueue.ets
  entry/src/main/ets/pages/ImportReceipt.ets
  entry/src/main/ets/model/workspace.ets
  entry/src/main/ets/model/harmonyReaderView.ets
  entry/src/main/ets/services/importPortableData.ets
  entry/src/main/ets/services/readerSessionState.ets
  entry/src/main/ets/services/exportPatch.ets
```

The scaffold is intentionally separate from the executable JavaScript prototype in `apps/companion-harmony/src/`. The JS prototype remains the authoritative smoke-tested implementation until DevEco compilation passes.

`learning-companion.harmony-reader-view.v1` is additive during the prototype stage: new fields may be added for scaffold consumers, but removing or renaming fields requires a derived schema bump. Current `readerNextAction`, answer-today, open-question, and parked-question fields are JSON contract evidence only, not device evidence.

`answersToday` is a Mac-generated read-only projection. `answersToday[].answeredAt` is the Today attribution time for the generated view, and `answeredAtSource` records whether that time came from `capturedAt`, `createdAt`, or an inbox patch landing through `updatedAt`. `localDayWindow` belongs to the reader generator's local timezone and must not be silently recomputed as phone-local time.

`readerNextAction` is the first landing action for reader surfaces. Its current fields are `kind`, `label`, `detail`, `route`, `routeLabel`, `meta`, `secondary`, optional `secondaryAction`, `generatedAt`, and `surface: "reader"`. `secondaryAction` gives the Index page one additional button when the primary action hides another useful lane, such as review due cards while open questions also exist. Its optional `routeParams.section` currently distinguishes `open_questions` and `answers_today` while staying inside the existing TopicDetail route. The scaffold route set is intentionally closed to `pages/ReviewQueue`, `pages/TopicDetail`, and `pages/ImportReceipt`.

## Screens

| Screen | Purpose | Data |
| --- | --- | --- |
| Index | Phone Next, optional secondary Phone Next action, Resume Here, accepted import status, answers today, active open questions, parked questions, topic list, import button, latest intake status. | `ReaderSessionState.currentView`, `readerNextAction`, `readerNextAction.secondaryAction`, `importStatus`, `activeTopic`, `answersToday`, `openQuestions`, `parkedQuestions`, `topics`, `workspace` summary. |
| TopicDetail | Source title/URL, latest capture, next action, and topic counts from the accepted reader session. | One topic from `ReaderSessionState.currentView.topics`. |
| ReviewQueue | Read-only due cards with answer reveal from the accepted reader session. | `ReaderSessionState.currentView.dueReview`. |
| ImportReceipt | Shows imported workspace/mirror metadata and limitations. | `source`, `workspace`, `limitations`. |

## Import Boundary

- Use the HarmonyOS document picker or app sandbox file picker.
- Accept only `.json` files up to 5 MB.
- Parse into `workspace.v1` or `mirror-bundle.staging.v1`.
- Use `workspace.json` as canonical when importing a mirror bundle.
- Reject unknown schema versions with a visible receipt.
- Do not read Feishu credentials, browser cookies, system clipboards, or background storage.

Concrete scaffold contract:

1. Pick one foreground file only; no recursive folder scan and no background storage crawl.
2. Run the file candidate through `validatePortableFileCandidate()` before reading bytes.
3. Read accepted files as UTF-8 text and call `importPortableJsonText(text, nowIso)`.
4. On success, persist only the derived `harmony-reader-view.v1` plus the import receipt.
5. On rejection, show `ImportReceipt` with `INVALID_JSON`, `INVALID_FILE_SIZE`, `UNSUPPORTED_FILE_TYPE`, `PORTABLE_FILE_TOO_LARGE`, `UNSUPPORTED_PORTABLE_DATA`, or `PATCH_IMPORT_NOT_SUPPORTED_ON_READER`.
6. Keep mobile inbox and review-progress patch files on the export path; the phone reader must not import them as workspace state.

Import state handoff:

- `readerSessionState.ets` mirrors the JS prototype in `apps/companion-harmony/src/import-session.mjs`.
- A successful import moves the reader session to `accepted-pending-persist`, replaces the current view, and records the import receipt.
- A rejected import moves to `rejected-kept-current` when a prior view exists, so a bad file cannot blank the phone reader.
- `persisted-by-device-adapter` is a future device-storage status, not evidence that this scaffold has written to HarmonyOS storage.
- `lastImportReceipt` is intentionally single-slot: it records the most recent import attempt, while `currentView` records the last accepted reader view.

The 5 MB cap is a conservative MVP guard: current fixture workspaces and mirror bundles are well under 1 MB, while 5 MB leaves headroom without encouraging large media-like payloads on lower-end phones. Revisit the cap when p95 mirror bundles exceed 2 MB or the app moves from read-only reader to richer offline storage.

ArkTS `validatePortableFileCandidate()` is a scaffold mirror, not a DevEco-executed behavior test. Treat the JS validator in `apps/companion-harmony/src/import-boundary.mjs` as the source of truth for verdicts until the ArkTS code is compiled and covered on device.

## Patch Boundary

- Keep phone writes append-only.
- Native write path may export:
  - `learning-companion.mobile-inbox-patch.v1`
  - `learning-companion.review-progress-patch.v1`
- Each patch needs a stable `patchId` and stable item ids.
- Never overwrite Mac workspace state directly.
- Import of these patches remains Mac-side and conflict-aware.

## ArkTS Port Notes

- Port `src/schema-reader.mjs` into `buildHarmonyReaderView.ets`.
- Port `src/import-boundary.mjs` into `importPortableData.ets` and `exportPatch.ets`.
- Keep schema constants byte-for-byte aligned with the JS prototype; `npm run smoke:harmony` checks this by text extraction.
- Keep model functions pure and deterministic.
- Prefer explicit schema interfaces over dynamic object mutation.
- Keep unsafe URLs sanitized or display-only; opening external URLs should be an explicit user action.
- Treat `mode: "read-only-prototype"` as a UI badge until native patch export exists.

## Manual Device Test Plan

| Gate | Expected Evidence |
| --- | --- |
| File candidate guard | Non-JSON files and files over 5 MB produce a visible rejection receipt before JSON parsing. |
| Import workspace JSON | Topic count, active topic, due cards match `sample-harmony-reader-view.json`. |
| Import mirror bundle | Same view model as workspace import. |
| Phone next action | The first Index action routes to Review when due cards exist, TopicDetail when questions or topic resume should lead, or ImportReceipt before a reader view is accepted. |
| Failed import preservation | Importing an unsupported patch after a valid workspace leaves the previous reader view visible and records a rejection receipt. |
| Open question backlog | Open questions and per-topic counts match the Mac Today backlog, while resolved questions only appear in recent captures as answered. |
| Answers today | `answersToday` and `workspace.answerCaptureCountToday` match Mac Today for the same local day window. |
| Offline relaunch | Last imported view model reopens without network. |
| Review reveal | Answer reveal works without changing card state. |
| Capture patch export | App writes append-only inbox patch JSON, then Mac imports it with a visible receipt. |
| Review patch export | App writes append-only review progress patch JSON, then Mac imports it with conflict receipt. |

## Stop Conditions

- Any requirement for Feishu login, browser cookie recovery, or background sync belongs to a later live-integration stage.
- Any native patch writer must be tested against Mac import receipts before calling it a device roundtrip.
- If DevEco setup requires approvals, record the blocked step and keep the schema prototype as the current evidence.

## Current Local Gate

Run:

```bash
npm run smoke:harmony
```

This verifies the JS schema reader/import boundary and checks that the DevEco scaffold has the expected files, schema constants, page names, and patch export service names. It does not compile ArkTS.

## Not Proven Tonight

- DevEco compile or ArkTS type-check.
- HarmonyOS phone/emulator rendering.
- Native file picker import.
- Feishu-backed transport or live sync.
- Any credential, login, or browser-cookie path.
