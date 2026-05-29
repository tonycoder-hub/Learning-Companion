# Learning Companion HarmonyOS Prototype

This directory is the executable credential-free HarmonyOS preparation area. The DevEco scaffold handoff lives next door in `../companion-harmony-dev/`; it is structure-checked, but not claimed as compiled until DevEco or the HarmonyOS command-line toolchain verifies it.

The first implemented piece is a schema reader that consumes the same portable data already produced by the Mac/web MVP:

- `learning-companion.workspace.v1`
- `learning-companion.mirror-bundle.staging.v1`

It emits `learning-companion.harmony-reader-view.v1`, a compact read-only view model for a future HarmonyOS app: topics, active topic, due review cards, open questions, recent captures with question status, and each topic's Focus Brief next action. `src/import-boundary.mjs` adds a pure import/patch boundary that is shaped for later ArkTS porting.

The reader-view contract is still prototype-stage v1. Additive fields such as `openQuestions` and `workspace.openQuestionCount` are allowed while consumers are scaffolded and should be ignored by older readers; any removal or rename should bump the derived reader-view schema instead of silently changing v1.

## Run The Prototype Smoke

From the repository root:

```bash
npm run smoke:harmony
```

## Current Boundary

- No HarmonyOS SDK or DevEco build is required for the local smoke gate.
- No Feishu credential, browser state, or local device permission is read.
- Native write UI is scaffolded only. Phone-side capture and review progress still use append-only patch JSON and must be imported on Mac.
- The reader is intentionally close to plain JavaScript so the shape can be ported to ArkTS after the view model feels right.
- Patch envelopes can be built as pure JSON fixtures, but no native HarmonyOS writer UI exists yet.
- Open-question handoff is proven only as generated JSON and scaffold type shape; DevEco compile, device rendering, file picker import, Feishu sync, and live login are not proven here.

See [DEVECO_HANDOFF.md](DEVECO_HANDOFF.md) for the scaffold layout, ArkTS port boundaries, permissions, and device test gates.

## Next Steps

- Verify `../companion-harmony-dev/` in DevEco Studio once SDK setup is available.
- Add a file-picker/import path for `workspace.json` or the mirror bundle.
- Render active topic, open questions, due review, and recent captures from `harmony-reader-view.v1`.
- Port `src/import-boundary.mjs` into ArkTS services.
- Keep patch export append-only; do not overwrite Mac workspace state from the phone.
