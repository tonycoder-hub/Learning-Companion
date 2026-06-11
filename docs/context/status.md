# Learning Companion Status

Updated: 2026-06-11

## Current State

The web MVP remains the runnable product. The current project push is focused on making bilingual support real enough to validate, then proving the study loop against approved reading/video sources.

The static mirror index bilingual slice is locally verified. It now emits English and Chinese copy for:

- mirror heading and generated summary,
- language switch,
- return-ready badge,
- next action panel,
- manual return steps,
- resume/source/session/latest labels,
- due/open/recent/session preview headings and empty states.

This is not full bilingual coverage. Static Review/Inbox pages, generated packs, QA receipts, native Mac shell copy, Windows/HarmonyOS surfaces, and document exports are still outside the completed boundary.

## Verification

PASS:

- `/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check apps/companion-web/src/model.js`
- `/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check scripts/smoke-web.mjs`
- `git diff --check`
- `/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/smoke-web.mjs` -> `smoke_web_ok`

## Not Run

- Browser smoke was not run because it can start or depend on local browser/server behavior and was not authorized in the current turn.
- Local dev server and build commands were not run.
- External reading/video screenshot validation was not run because approved non-private source URLs and current-turn browser/server authorization are still needed.
- External systems, remote branches, permissions, and production targets were not written.

## Next Best Action

1. Add a small external-source validation checklist/harness that saves run notes and screenshots under `.codex-tmp/external-source-validation/`.
2. With approved URLs and current-turn authorization, run one reading-source and one video-source validation side by side with the app.
3. Continue bilingual coverage into static Review/Inbox and generated artifacts before claiming full bilingual support.
