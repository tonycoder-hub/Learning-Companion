# Learning Companion TODO / Handoff

Updated: 2026-06-11

## Latest Verified Slice

The static mirror index bilingual slice is locally verified:

- `apps/companion-web/src/model.js`: static mirror index emits English / Chinese switchable copy for the entry point, next action, manual return, common resume actions/warnings, resume labels, summary labels, and empty states.
- `scripts/smoke-web.mjs`: static mirror smoke assertions cover English and Chinese output, the mirror language switch, Review/Inbox badge leakage guardrails, and static index CSP.

The static Review/Inbox chrome bilingual slice is locally verified:

- `apps/companion-web/src/model.js`: `review.html` and `inbox.html` emit the same static language switch and bilingual static chrome for headings, return guidance, initial controls, form labels, and return-file preview guidance. Startup-overwritten save-mode controls, Inbox answer-mode labels/placeholders, active answer-context title/help, runtime status, return-file hints, manual-copy errors, after-save guidance, follow-up links, and Inbox empty/source hints use runtime i18n helpers.
- `scripts/smoke-web.mjs`: Review/Inbox assertions cover English and Chinese output, startup-overwritten i18n helper usage, active answer-context i18n helper usage, runtime return-loop i18n helper usage, object-string regression guards, and return-file schema/fingerprint/safety checks.

The first generated Markdown pack bilingual slice is locally verified:

- `apps/companion-web/src/model.js`: generated `TODAY.md` and `Learning Companion Review Pack` keep English source-of-truth labels while adding adjacent Chinese aliases/notes for titles, meta labels, sections, empty states, source/tag/reason/answer labels, overflow rows, export artifacts, stage wording, and promotion guidance.
- `scripts/smoke-web.mjs`: generated-pack assertions cover Chinese anchors for `TODAY.md`, Review Pack, source jump lines, answer/closed-question rows, and overflow rows.

The import/return receipt display bilingual slice is locally verified:

- `apps/companion-web/src/app.js`: import receipt banners, return-file batch receipt details, Device Flow `Last import` summaries, and Returned Work nudges now render English or Chinese display copy without changing receipt schema keys, stable action `kind` values, file names, patch IDs, or user-authored text.
- `scripts/smoke-web.mjs`: source-level contract assertions cover explicit receipt language formatter calls, English compatibility copy, Chinese receipt/nudge anchors, and stable schema/action constants.

The second generated artifact bilingual slice is locally verified:

- `apps/companion-web/src/model.js`: per-session Markdown, synthesis drafts, and mirror `README.md` keep English source-of-truth labels while adding adjacent Chinese aliases/notes for metadata, sections, empty states, capture source labels, review-card Q/A labels, synthesis prompts, restore guidance, and fixed mirror file descriptions.
- `scripts/smoke-web.mjs`: generated-artifact assertions cover Chinese anchors for per-session Markdown, synthesis drafts, and mirror `README.md` while keeping file paths, schema names, role strings, source URLs, and user-authored text unchanged.

Verification commands:

```bash
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check apps/companion-web/src/model.js
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check apps/companion-web/src/app.js
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check scripts/smoke-web.mjs
git diff --check
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/smoke-web.mjs
```

All five commands passed on 2026-06-11. Browser smoke and local dev server were not run.

## Next Entry Point

Continue with external source validation and the remaining bilingual surfaces. Review/Inbox runtime return-loop copy, generated `TODAY.md` / Review Pack shell copy, per-session Markdown, synthesis drafts, mirror `README.md`, and import/return receipt display copy have string-level smoke coverage, but browser-executed DOM switching proof is still pending.
The next generated-artifact gap is QA receipt templates and document exports; the next runtime evidence gap is browser-executed DOM switching plus approved external source screenshot validation.

Goal paused note on 2026-06-11:

- User paused the active goal after checkpoint `91371f1 feat: add bilingual generated artifact shells`.
- Worktree was clean except the pre-existing untracked `?? {` before this pause note was written; leave that file untouched unless the user explicitly asks.
- No subagents are left running from the latest generated-artifact slice.
- Resume by choosing either: add bilingual QA receipt templates/document exports, or run browser/external-source validation after current-turn authorization and approved non-private reading/video URLs.
- Do not claim full bilingual support until QA receipts, native Mac shell copy, Windows/HarmonyOS surfaces, document exports, and browser-executed runtime language checks are covered or explicitly marked out of scope.

## User Priorities

1. Make the product bilingual at minimum: English and Chinese should be first-class surfaces, not a partial demo label swap.
2. During validation, actively use approved external reading/video material and capture screenshots to prove the app can work while the user is reading a document or watching a video.

## Immediate TODO

- Capture one approved reading-source screenshot run and one approved video-source screenshot run using [docs/external-source-validation.md](../external-source-validation.md) once URLs and browser/server authorization are available.
- Extend bilingual coverage beyond static pages and generated Markdown artifacts to QA receipt templates, native Mac shell copy, Windows/HarmonyOS surfaces, and document exports.
- Add browser-executed DOM switching checks for representative app runtime branches, including Review/Inbox runtime copy, import receipts, and Returned Work nudges, once browser/server authorization is available.
- Keep the coverage boundary honest: do not claim full bilingual support until the remaining generated artifacts, QA receipts, native Mac shell copy, Windows/HarmonyOS surfaces, document exports, and browser-executed runtime language checks are covered or explicitly marked out of scope.
- External validation evidence should record:
  - approved source URL and title,
  - source type: reading or video,
  - video timestamp when relevant,
  - viewport and sidecar/full-desk state,
  - screenshot showing source beside the app during capture,
  - screenshot showing resume context after saving,
  - source approval recorded,
  - privacy review PASS/FAIL.
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
