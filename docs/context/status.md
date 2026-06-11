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
- startup-safe Review/Inbox save-mode button/help and Inbox answer-mode labels/placeholders plus active answer-context title/help that JS overwrites on load.

This is not full bilingual coverage. Most Review/Inbox JavaScript runtime status strings after interaction, after-save/follow-up copy, generated packs, QA receipts, native Mac shell copy, Windows/HarmonyOS surfaces, and document exports are still outside the completed boundary.

Subagent review follow-up:

- `PASS_WITH_NOTES`: external-source validation runbook needed stricter approval, privacy, app revision, and timestamp evidence fields. Fixed in `docs/external-source-validation.md`.
- `PASS_WITH_NOTES`: static mirror bilingual review found Review/Inbox badge language leakage, English-only dynamic Resume copy, and permissive script CSP. Fixed in `apps/companion-web/src/model.js` and `scripts/smoke-web.mjs`.
- `PASS_WITH_NOTES`: Review/Inbox static page reviewers recommended dynamic runtime i18n too. Static chrome plus startup-overwritten save-mode and answer-mode controls were implemented in this slice; remaining runtime JS status/after-save/follow-up strings stay as the next bilingual task.
- `BLOCKED`: final subagent review found active Inbox answer-context title/help still used English-only `textContent`. Fixed with `setI18nHtml(...)` and smoke assertions for the active title/help calls.

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
2. Add the remaining Review/Inbox JavaScript runtime i18n for status messages, after-save guidance, and follow-up link copy.
3. Continue bilingual coverage into generated artifacts before claiming full bilingual support.
