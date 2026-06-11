# Learning Companion TODO / Handoff

Updated: 2026-06-11

## Latest Verified Slice

The static mirror index bilingual slice is locally verified:

- `apps/companion-web/src/model.js`: static mirror index emits English / Chinese switchable copy for the entry point, next action, manual return, resume labels, summary labels, and empty states.
- `scripts/smoke-web.mjs`: static mirror smoke assertions cover English and Chinese output plus the mirror language switch.

Verification commands:

```bash
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check apps/companion-web/src/model.js
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check scripts/smoke-web.mjs
git diff --check
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/smoke-web.mjs
```

All four commands passed on 2026-06-11. Browser smoke and local dev server were not run.

## Next Entry Point

Continue with external source validation and the remaining bilingual surfaces.

## User Priorities

1. Make the product bilingual at minimum: English and Chinese should be first-class surfaces, not a partial demo label swap.
2. During validation, actively use approved external reading/video material and capture screenshots to prove the app can work while the user is reading a document or watching a video.

## Immediate TODO

- Capture one approved reading-source screenshot run and one approved video-source screenshot run using [docs/external-source-validation.md](../external-source-validation.md) once URLs and browser/server authorization are available.
- Extend bilingual coverage beyond the static mirror index to static Review/Inbox pages, generated packs, QA receipts, native Mac shell copy, Windows/HarmonyOS surfaces, and document exports.
- Keep the coverage boundary honest: do not claim full bilingual support until static Review/Inbox pages, generated packs, QA receipts, native Mac shell copy, Windows/HarmonyOS surfaces, and document exports are covered or explicitly marked out of scope.
- External validation evidence should record:
  - approved source URL and title,
  - source type: reading or video,
  - video timestamp when relevant,
  - viewport and sidecar/full-desk state,
  - screenshot showing source beside the app during capture,
  - screenshot showing resume context after saving.
- Store future validation screenshots under `.codex-tmp/external-source-validation/` and keep private/authenticated content out of screenshots.

## Acceptance Direction

The next credible milestone is not just "UI can switch language"; it should show:

- English and Chinese mode render cleanly with no overflow in the main study loop.
- Static mirror entry and return loop have bilingual guidance.
- A real approved reading page can be used beside the app while capturing notes.
- A real approved video page can be used beside the app while capturing notes, including timestamp/resume evidence when available.
- Evidence is saved locally as screenshots plus a short run note, without private cookies, tokens, or sensitive page content.

## Blocked / Needs Decision

- External source validation needs approved public or user-provided non-private URLs before screenshots are captured.
- Browser smoke, local dev server startup, or video-page automation should be authorized in the current turn before running.
