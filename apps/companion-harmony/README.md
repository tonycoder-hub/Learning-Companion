# Learning Companion HarmonyOS Prototype

This directory is the executable credential-free HarmonyOS preparation area. The DevEco scaffold handoff lives next door in `../companion-harmony-dev/`; it is structure-checked, but not claimed as compiled until DevEco or the HarmonyOS command-line toolchain verifies it.

The first implemented piece is a schema reader that consumes the same portable data already produced by the Mac/web MVP:

- `learning-companion.workspace.v1`
- `learning-companion.mirror-bundle.staging.v1`

It emits `learning-companion.harmony-reader-view.v1`, a compact read-only view model for a future HarmonyOS app: topics, active topic, answers captured today, due review cards, active open questions, parked unresolved questions, recent captures with question status, and each topic's Focus Brief next action. `src/import-boundary.mjs` adds a pure import/patch boundary that is shaped for later ArkTS porting.

The reader-view contract is still prototype-stage v1. Additive fields such as `answersToday`, `answersTodayOverflow`, `localDayWindow`, `workspace.answerCaptureCountToday`, `openQuestions`, `parkedQuestions`, `workspace.openQuestionCount`, and `workspace.unresolvedQuestionCount` are allowed while consumers are scaffolded and should be ignored by older readers; any removal or rename should bump the derived reader-view schema instead of silently changing v1.

`answersToday[].answeredAt` is the Mac-generated Today attribution time, not a claim about when the user originally typed the answer. The companion also emits `answeredAtSource` so the Harmony reader can explain whether the timestamp came from `capturedAt`, `createdAt`, or an inbox patch landing via `updatedAt`. `localDayWindow` is the reader generator's local day window, not independently recomputed on the phone.

## Run The Prototype Smoke

From the repository root:

```bash
npm run smoke:harmony
```

## Current Boundary

- No HarmonyOS SDK or DevEco build is required for the local smoke gate.
- No Feishu credential, browser state, or local device permission is read.
- The file-picker contract is now explicit in the prototype: accept one `.json` file up to 5 MB, reject non-JSON or oversized files before parsing, then parse only `workspace.v1` or `mirror-bundle.staging.v1`.
- `answersToday` is a Mac-side read-only projection for Harmony, not proof that the Harmony device has written or synced those answers.
- Native write UI is scaffolded only. Phone-side capture and review progress still use append-only patch JSON and must be imported on Mac.
- The reader is intentionally close to plain JavaScript so the shape can be ported to ArkTS after the view model feels right.
- Patch envelopes can be built as pure JSON fixtures, but no native HarmonyOS writer UI exists yet.
- Open-question and answer-today handoff are proven only as generated JSON and scaffold type shape; DevEco compile, device rendering, file picker import, Feishu sync, and live login are not proven here.

See [DEVECO_HANDOFF.md](DEVECO_HANDOFF.md) for the scaffold layout, ArkTS port boundaries, permissions, and device test gates.

## Next Steps

- Verify `../companion-harmony-dev/` in DevEco Studio once SDK setup is available.
- Wire the scaffolded file-picker contract to a real HarmonyOS document picker and persist the accepted reader view.
- Render active topic, answers today, open questions, due review, and recent captures from `harmony-reader-view.v1`.
- Port `src/import-boundary.mjs` into ArkTS services.
- Keep patch export append-only; do not overwrite Mac workspace state from the phone.
