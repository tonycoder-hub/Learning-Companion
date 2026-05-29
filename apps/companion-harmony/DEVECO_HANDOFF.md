# HarmonyOS DevEco Handoff

Stage: DevEco scaffold handoff. A credential-free scaffold now lives at `apps/companion-harmony-dev/`, but it is not claimed as a compiled HarmonyOS app until DevEco or the HarmonyOS command-line toolchain verifies it.

## Goal

Create a minimal HarmonyOS app that can read the same portable artifacts produced by the Mac/web app:

- `learning-companion.workspace.v1`
- `learning-companion.mirror-bundle.staging.v1`
- derived `learning-companion.harmony-reader-view.v1`

The first device milestone is read-only: import a workspace or mirror bundle, render the active topic, due review cards, recent captures, and Focus Brief next action. Phone-side writes remain append-only patch exports.

## Scaffold Layout

```text
apps/companion-harmony-dev/
  AppScope/app.json5
  entry/src/main/module.json5
  entry/src/main/ets/entryability/EntryAbility.ets
  entry/src/main/ets/pages/Index.ets
  entry/src/main/ets/pages/TopicDetail.ets
  entry/src/main/ets/pages/ReviewQueue.ets
  entry/src/main/ets/pages/ImportReceipt.ets
  entry/src/main/ets/model/workspace.ts
  entry/src/main/ets/model/harmonyReaderView.ts
  entry/src/main/ets/services/importPortableData.ts
  entry/src/main/ets/services/buildHarmonyReaderView.ts
  entry/src/main/ets/services/exportPatch.ts
```

The scaffold is intentionally separate from the executable JavaScript prototype in `apps/companion-harmony/src/`. The JS prototype remains the authoritative smoke-tested implementation until DevEco compilation passes.

## Screens

| Screen | Purpose | Data |
| --- | --- | --- |
| Index | Resume Here, topic list, import button, latest intake status. | `activeTopic`, `topics`, `workspace` summary. |
| TopicDetail | Source title/URL, latest capture, notes preview, capture count. | One topic from `topics`. |
| ReviewQueue | Read-only due cards with answer reveal. | `dueReview`. |
| ImportReceipt | Shows imported workspace/mirror metadata and limitations. | `source`, `workspace`, `limitations`. |

## Import Boundary

- Use the HarmonyOS document picker or app sandbox file picker.
- Accept only JSON files under the documented size limit chosen for the app.
- Parse into `workspace.v1` or `mirror-bundle.staging.v1`.
- Use `workspace.json` as canonical when importing a mirror bundle.
- Reject unknown schema versions with a visible receipt.
- Do not read Feishu credentials, browser cookies, system clipboards, or background storage.

## Patch Boundary

- Keep phone writes append-only.
- Native write path may export:
  - `learning-companion.mobile-inbox-patch.v1`
  - `learning-companion.review-progress-patch.v1`
- Each patch needs a stable `patchId` and stable item ids.
- Never overwrite Mac workspace state directly.
- Import of these patches remains Mac-side and conflict-aware.

## ArkTS Port Notes

- Port `src/schema-reader.mjs` into `buildHarmonyReaderView.ts`.
- Port `src/import-boundary.mjs` into `importPortableData.ts` and `exportPatch.ts`.
- Keep model functions pure and deterministic.
- Prefer explicit schema interfaces over dynamic object mutation.
- Keep unsafe URLs sanitized or display-only; opening external URLs should be an explicit user action.
- Treat `mode: "read-only-prototype"` as a UI badge until native patch export exists.

## Manual Device Test Plan

| Gate | Expected Evidence |
| --- | --- |
| Import workspace JSON | Topic count, active topic, due cards match `sample-harmony-reader-view.json`. |
| Import mirror bundle | Same view model as workspace import. |
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
