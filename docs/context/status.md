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
- common resume action and warning copy,
- due/open/recent/session preview headings and empty states.

The static Review/Inbox chrome bilingual slice is also locally verified. It now emits English and Chinese copy for:

- Review and Inbox page headings, summaries, language switch, and return-ready badge,
- return-to-Mac guidance,
- Review initial card metadata/control labels and return-file controls,
- Inbox initial form labels/placeholders, action buttons, draft section, and return-file preview guidance,
- startup-safe Review/Inbox save-mode button/help and Inbox answer-mode labels/placeholders plus active answer-context title/help that JS overwrites on load,
- Review/Inbox runtime return-loop status, return-file hints, manual-copy errors, after-save guidance, follow-up links, and Inbox empty/source hints.

This is not full bilingual coverage. Browser-executed DOM switching proof for every runtime branch, generated packs, QA receipts, native Mac shell copy, Windows/HarmonyOS surfaces, and document exports are still outside the completed boundary.

Subagent review follow-up:

- `PASS_WITH_NOTES`: external-source validation runbook needed stricter approval, privacy, app revision, and timestamp evidence fields. Fixed in `docs/external-source-validation.md`.
- `PASS_WITH_NOTES`: static mirror bilingual review found Review/Inbox badge language leakage, English-only dynamic Resume copy, and permissive script CSP. Fixed in `apps/companion-web/src/model.js` and `scripts/smoke-web.mjs`.
- `PASS_WITH_NOTES`: Review/Inbox static page reviewers recommended dynamic runtime i18n too. Static chrome plus startup-overwritten save-mode and answer-mode controls were implemented first; runtime status, after-save, follow-up, and return-loop copy are now covered by the latest slice.
- `BLOCKED`: final subagent review found active Inbox answer-context title/help still used English-only `textContent`. Fixed with `setI18nHtml(...)` and smoke assertions for the active title/help calls.
- `PASS`: Review/Inbox runtime i18n scans found English-only status sinks, return-file hints, after-save/follow-up copy, manual-copy errors, and Inbox empty/source hints. Fixed with pair-aware runtime helpers and smoke assertions guarding against `textContent = message` / object-string regressions.

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

1. With approved URLs and current-turn authorization, run one reading-source and one video-source validation side by side with the app using [docs/external-source-validation.md](../external-source-validation.md).
2. Continue bilingual coverage into generated artifacts, QA receipts, and platform-specific surfaces before claiming full bilingual support.
3. Add browser-executed DOM switching checks for representative Review/Inbox runtime branches when local browser/server authorization is available.
