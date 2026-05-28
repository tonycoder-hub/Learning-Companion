# Learning Companion HarmonyOS Prototype

This directory is a credential-free HarmonyOS preparation area, not a runnable DevEco project yet.

The first implemented piece is a schema reader that consumes the same portable data already produced by the Mac/web MVP:

- `learning-companion.workspace.v1`
- `learning-companion.mirror-bundle.staging.v1`

It emits `learning-companion.harmony-reader-view.v1`, a compact read-only view model for a future HarmonyOS app: topics, active topic, due review cards, recent captures, and each topic's Focus Brief next action.

## Run The Prototype Smoke

From the repository root:

```bash
npm run smoke:harmony
```

## Current Boundary

- No HarmonyOS SDK or DevEco build is required.
- No Feishu credential, browser state, or local device permission is read.
- No write path exists yet. Phone-side capture and review progress still use the static `inbox.html` and `review.html` pages in the mirror bundle.
- The reader is intentionally close to plain JavaScript so the shape can be ported to ArkTS after the view model feels right.

## Next Steps

- Create a minimal DevEco project only after the reader view is stable.
- Add a file-picker/import path for `workspace.json` or the mirror bundle.
- Render active topic, due review, and recent captures from `harmony-reader-view.v1`.
- Keep patch export append-only; do not overwrite Mac workspace state from the phone.
