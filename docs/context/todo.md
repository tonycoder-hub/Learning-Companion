# Learning Companion TODO / Handoff

Updated: 2026-06-11

## Latest Verified Slice

The static mirror index bilingual slice is locally verified:

- `apps/companion-web/src/model.js`: static mirror index emits English / Chinese switchable copy for the entry point, next action, manual return, common resume actions/warnings, resume labels, summary labels, and empty states.
- `scripts/smoke-web.mjs`: static mirror smoke assertions cover English and Chinese output, the mirror language switch, Review/Inbox badge leakage guardrails, and static index CSP.

The static Review/Inbox chrome bilingual slice is locally verified:

- `apps/companion-web/src/model.js`: `review.html` and `inbox.html` emit the same static language switch and bilingual static chrome for headings, return guidance, initial controls, form labels, and return-file preview guidance. Startup-overwritten save-mode controls, Inbox answer-mode labels/placeholders, active answer-context title/help, runtime status, return-file hints, manual-copy errors, after-save guidance, follow-up links, and Inbox empty/source hints use runtime i18n helpers.
- `scripts/smoke-web.mjs`: Review/Inbox assertions cover English and Chinese output, startup-overwritten i18n helper usage, active answer-context i18n helper usage, runtime return-loop i18n helper usage, object-string regression guards, and return-file schema/fingerprint/safety checks.

Verification commands:

```bash
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check apps/companion-web/src/model.js
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check scripts/smoke-web.mjs
git diff --check
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/smoke-web.mjs
```

All four commands passed on 2026-06-11. Browser smoke and local dev server were not run.

## Next Entry Point

Continue with external source validation and the remaining bilingual surfaces. Review/Inbox runtime return-loop copy has string-level smoke coverage, but browser-executed DOM switching proof is still pending.

## User Priorities

1. Make the product bilingual at minimum: English and Chinese should be first-class surfaces, not a partial demo label swap.
2. During validation, actively use approved external reading/video material and capture screenshots to prove the app can work while the user is reading a document or watching a video.

## Immediate TODO

- Capture one approved reading-source screenshot run and one approved video-source screenshot run using [docs/external-source-validation.md](../external-source-validation.md) once URLs and browser/server authorization are available.
- Extend bilingual coverage beyond static pages to generated packs, QA receipts, native Mac shell copy, Windows/HarmonyOS surfaces, and document exports.
- Add browser-executed DOM switching checks for representative Review/Inbox runtime branches once browser/server authorization is available.
- Keep the coverage boundary honest: do not claim full bilingual support until generated packs, QA receipts, native Mac shell copy, Windows/HarmonyOS surfaces, document exports, and browser-executed runtime language checks are covered or explicitly marked out of scope.
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
