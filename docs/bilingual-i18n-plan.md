# Bilingual UI Plan

Date: 2026-06-11

## Goal

Make Learning Companion usable in English and Chinese without claiming full i18n before every generated artifact and manual QA surface is covered.

## Rollout Order

1. Add a persisted UI language preference with English as the default.
2. Translate the high-frequency study loop surface first: Learning Flow, Activity, Quick Capture context, and capture guidance.
3. Extend the same switchable copy model to Today, Device Flow, Return Files, static mirror pages, generated packs, and QA receipts.
4. Add English and Chinese layout checks at sidecar and mobile widths, including long-copy fit and no horizontal overflow.
5. Only after generated packs, receipts, static pages, and app UI all use the same language boundary, consider claiming full bilingual coverage.

## First Slice Boundary

The first implementation slice covers only:

- local UI preference persistence,
- a visible English / Chinese selector,
- Learning Flow labels and actions,
- Quick Capture context, source state, guidance placeholders, and starter controls,
- a focused browser smoke proving Chinese mode can render and persist before switching back to English.

The second implementation slice extends the same boundary to:

- default Activity strip states and action labels for source/Quick Capture entry,
- Today `Next Move` card labels and actions,
- the first-run `First Note` card and its primary buttons,
- the collapsed first-run `Other devices later` route copy.

The third implementation slice extends the app UI surface to:

- the expanded `Device Flow` / `Return Files` panel,
- manual transfer steps and device-transfer guide cards,
- mirror handoff status and primary import/export/paste actions,
- the mirror-export Activity feedback opened from Return Files.

It does not cover static mirrors, generated receipts, QA runbooks, native Mac shell copy, Windows/HarmonyOS surfaces, or full document export language.

The fourth implementation slice should cover the static mirror entry point:

- bilingual static mirror index heading, generated summary, next action, and return-ready guidance,
- bilingual manual return instructions,
- bilingual resume/source/session summary labels,
- static smoke assertions proving both English and Chinese copy are emitted.

This slice still must not be treated as full bilingual coverage until generated Review/Inbox static pages, receipts, native shells, Windows/HarmonyOS surfaces, and document exports are also covered or explicitly marked out of scope.

The fifth implementation slice starts static Review/Inbox coverage:

- bilingual language switch and static chrome for `review.html` and `inbox.html`,
- bilingual return-ready badge and return-to-Mac guidance,
- bilingual initial form labels, initial action buttons, card control labels, and return-file preview guidance,
- bilingual startup-safe save-mode button/help, Inbox answer-mode labels/placeholders, and active answer-context title/help,
- bilingual Review/Inbox runtime return-loop status, after-save guidance, follow-up links, manual-copy errors, and source/empty hints,
- static smoke assertions proving both English and Chinese copy are emitted while return-file schema/fingerprint behavior remains stable.

This slice still does not cover generated receipts, native shells, Windows/HarmonyOS surfaces, document exports, or browser-executed DOM switching proof for every runtime branch.

The sixth implementation slice starts generated Markdown pack coverage:

- bilingual shell copy for generated `TODAY.md`,
- bilingual shell copy for `Learning Companion Review Pack`,
- English source-of-truth labels preserved for compatibility, with adjacent Chinese aliases/notes,
- smoke assertions proving Chinese generated-pack anchors are emitted.

This slice still does not cover per-session Markdown, mirror `README.md`, synthesis drafts, native shells, Windows/HarmonyOS surfaces, document exports, or browser-executed DOM switching proof. QA receipt templates are covered later by the ninth slice.

The seventh implementation slice covers import/return receipt display:

- bilingual display formatters for mobile inbox, review-progress, return-files, and import-error receipts,
- bilingual Device Flow `Last import` summaries,
- bilingual Returned Work nudge titles, details, action labels, failed-file warnings, and review-status activity copy,
- source-level smoke assertions for explicit language formatter calls and Chinese/English receipt anchors.

This slice does not translate receipt schema keys, stable `kind` values, file names, patch IDs, or user-authored capture/session/source text. It also does not replace browser-executed DOM switching proof.

The eighth implementation slice covers the remaining generated Markdown bundle shell:

- bilingual shell copy for generated per-session Markdown,
- bilingual shell copy for generated synthesis drafts,
- bilingual shell copy for mirror `README.md`,
- English source-of-truth labels preserved for compatibility, with adjacent Chinese aliases/notes,
- source-level smoke assertions proving Chinese anchors and English compatibility anchors are emitted.

This slice does not translate user-authored notes, captures, questions, review-card prompts/answers, source URLs, mirror file paths, schema names, role strings, or byte counts. It still does not cover native shells, Windows/HarmonyOS surfaces, document exports, or browser-executed DOM switching proof. QA receipt templates are covered later by the ninth slice.

The ninth implementation slice covers generated QA receipt guidance:

- bilingual shell copy for generated `MAC_MANUAL_QA.md`, `WINDOWS_STATIC_QA.md`, and `HARMONY_DEVICE_QA.md`,
- bilingual section aliases, stage/evidence boundaries, fill instructions, preconditions, notes, validation commands, and claim-gate guidance,
- adjacent Chinese row-level intent guides for Mac manual, Windows static, and HarmonyOS device Test Matrix rows,
- receipt assertions proving Chinese shell-copy and row-guide anchors are emitted while all pending smoke rows remain `NT`.

This slice does not translate parser-owned Test Matrix tables, field keys, result tokens, schema names, filenames, command strings, or claim-boundary identifiers. It still does not cover native shells, Windows/HarmonyOS app surfaces, document exports, or browser-executed DOM switching proof.

The tenth implementation slice covers the web Export panel and document-export shell:

- bilingual visible copy for Export panel section headings, boundary note, workspace JSON disclosure, and copy/save buttons,
- bilingual copy/save/download/failure toasts for workspace, Review Pack, current-session Markdown/JSON, Today, mirror JSON/ZIP, and browser capture bookmarklet,
- bilingual workspace-backup completion notice and mirror handoff Activity copy,
- source-level smoke assertions proving Chinese export anchors and guarding against hard-coded English-only copy handlers.

This slice does not change export filenames, schema names, generated document contents, mirror handoff kind values, or save/download mechanics. It still does not cover native shells, Windows/HarmonyOS app surfaces, or browser-executed DOM switching proof.

The eleventh implementation slice covers native Mac shell copy at source/string level:

- bilingual AppKit menu labels for File, Capture, and Window actions,
- bilingual native status labels for global hotkey and selected-text capture state,
- bilingual import/export/open-review panel titles and native alerts,
- bilingual native save-panel titles and write/fallback errors for workspace and web-export saves,
- source-level smoke assertions proving Chinese native shell anchors while preserving hotkeys, filenames, bridge message names, and save/import mechanics.

This slice does not run Swift build/native GUI manual QA, does not localize the product/window brand name, and does not change native bridge protocols, suggested filenames, file limits, URL boundaries, or JavaScript bridge calls. It still does not cover Windows/HarmonyOS app surfaces or browser-executed DOM switching proof.

The twelfth implementation slice covers HarmonyOS visible scaffold copy at source/string level:

- bilingual visible copy for Phone Next, resume, import-return, Review Queue, Answers Today, open/parked questions, topic stats, and topic detail states,
- bilingual reader fallback and summary labels,
- bilingual review queue due/reveal/hide/manual-return copy,
- bilingual import receipt and picker contract/limitation copy,
- bilingual return-to-Mac export contract copy and Harmony resource descriptions,
- source-level smoke assertions proving Chinese HarmonyOS scaffold anchors while preserving routes, schemas, and transfer contracts.

This slice does not run DevEco build, HarmonyOS device QA, or any on-device runtime flow. It also does not change ArkTS routes, persisted data shapes, import/export contract IDs, schema keys, or user/source-authored text.

The thirteenth implementation slice covers browser-executed bilingual runtime smoke for representative web branches:

- runtime English / Chinese switching in headless Chromium,
- Export panel labels and actions,
- mobile inbox import receipt banners/details,
- Returned Work nudge copy,
- return-file preview title/details/actions,
- desktop no-horizontal-overflow at 1280px,
- local receipt written to `.codex-tmp/bilingual-browser-smoke/receipt.json`.

This slice does not replace external reading/video screenshot validation, Windows/HarmonyOS runtime proof, native Mac WKWebView proof, or human learning evidence.

The fourteenth implementation slice restores the full browser runtime smoke:

- `scripts/smoke-browser.mjs` resolves `CHROME_PATH`, Linux Chromium/Chrome paths, or macOS Chrome instead of a single hard-coded browser path,
- the full browser smoke runs in local Chromium,
- static mirror, file-backed mirror navigation, Review/Inbox return-file runtime branches, mobile layout checks, patch import receipts, and negative import cases accept the current bilingual static-page copy while preserving schema/file/route assertions,
- source-level smoke guards prevent the browser-smoke launcher from regressing to hard-coded macOS Chrome only.

This slice does not prove real Windows/HarmonyOS target-device behavior, native Mac WKWebView behavior, external reading/video source use, or human learning outcomes.

The fifteenth implementation slice restores source-resume and controlled-loop browser evidence in the current Chromium environment:

- `scripts/smoke-source-resume.mjs` resolves `CHROME_PATH`, Linux Chromium/Chrome paths, or macOS Chrome and verifies saved-capture source resume, text-fragment jumps, and video timestamp resume URLs,
- `scripts/smoke-text-fragment-browser.mjs` resolves the same browser candidates and verifies text-fragment scrolling on a generated source page,
- `scripts/agent-study-loop-check.mjs` resolves the same browser candidates and runs the controlled sidecar/capture/question/answer/notes loop,
- `scripts/smoke-web.mjs` prevents these scripts from regressing to a single hard-coded macOS Chrome path.

This slice is still controlled/local evidence. It does not replace the required approved reading/video screenshot validation.

The sixteenth implementation slice prepares the approved-source evidence path without claiming it:

- `scripts/external-source-validation-browser.mjs` adds a gated headless-browser harness for reading/video evidence capture,
- real-source runs require `--approved-current-turn`, `--reading-url`, `--video-url`, `--video-timestamp`, and `--approval-note`,
- `npm run external:validate:selftest` verifies the harness with generated local reading/video fixtures,
- `docs/external-source-validation.md` documents the self-test command, the real approved-source command, and the privacy-review boundary,
- `scripts/smoke-web.mjs` guards the new package scripts, approval gates, local fixture tier, and `canClaimExternalKo: false` boundary.

This slice is harness readiness only. It does not replace exact current-turn approved reading/video URLs, human privacy review, or real external-source evidence.

The seventeenth implementation slice closes the candidate-to-KO evidence contract:

- `scripts/validate-external-source-privacy-review.mjs` generates human privacy-review templates for candidate receipts,
- completed reviews must confirm current-turn source approval, screenshot privacy PASS for every listed evidence file, source-context preservation, and video timestamp evidence,
- local fixture self-tests cannot be converted into KO evidence,
- only `APPROVED_SOURCE_CANDIDATE` receipts with one reading run and one video run can produce a derived `APPROVED_SOURCE_PRIVACY_REVIEWED` artifact,
- `npm run external:privacy-review:selftest` verifies the validator with a positive candidate fixture, a self-test rejection, and a failed-privacy rejection.

This slice still does not provide real approved external-source evidence; it only makes the final evidence gate machine-checkable after approved URLs and human artifact review exist.

The eighteenth implementation slice adds the top-level KO evidence gate:

- `scripts/validate-ko-evidence.mjs` combines the bilingual browser runtime receipt, controlled learning-loop receipt, and privacy-reviewed approved-source external evidence artifact,
- `npm run ko:validate:selftest` verifies the positive gate shape in memory plus negative cases for missing external evidence and fixture-only external evidence,
- current status reporting writes `.codex-tmp/ko-evidence/current-status.json` with `canClaimKo: false` until a real approved-source `learning-companion.external-source-ko-evidence-review.v1` artifact is provided,
- old claim-shaped artifacts from privacy-review self-tests are explicitly rejected.

This slice is still not final KO evidence. It makes the completion audit executable and keeps the missing real approved reading/video artifact visible.

The nineteenth implementation slice tightens the top-level KO evidence gate so the bilingual completeness claim cannot bypass platform proof:

- `scripts/validate-ko-evidence.mjs` now also requires native Mac manual QA, Windows static/manual QA, and HarmonyOS device/toolchain QA receipts,
- pending `NT` platform receipts keep `canClaimKo: false`,
- `npm run ko:validate:selftest` now includes a negative case for pending platform evidence,
- current status reporting lists native Mac, Windows, HarmonyOS, and approved external reading/video blockers together.

This slice still does not run those platform QAs. It prevents a future approved-source artifact from being mistaken for the whole KO by itself.

The twentieth implementation slice expands browser-executed bilingual runtime proof into the main web study shell:

- `apps/companion-web/src/app.js` localizes source strip labels, material type options, focus-mode buttons, inspector tabs, Quick Capture shell, Notes actions, Today stats/map/sections/Learning Flow/Study Details/Question Queue Health, Review toolbar/card controls, and the existing export/import/return branches,
- `scripts/smoke-bilingual-runtime-browser.mjs` adds `snapshotStudyShell()` and records `studyShellZh`, `studyShellEnAfterSwitch`, `todayLearningFlowZh`, and `reviewToolbarZh` in the headless Chromium receipt,
- `scripts/validate-ko-evidence.mjs` requires those expanded bilingual receipt checks before the top-level KO gate can pass,
- `scripts/smoke-web.mjs` guards the new source anchors and focused browser receipt fields.

This slice does not translate user-authored content, source URLs, schema names, filenames, or data-layer/model summaries. It also does not replace approved external reading/video evidence, native Mac runtime/manual proof, Windows proof, or HarmonyOS device/toolchain proof.

The twenty-first implementation slice closes another main-loop runtime gap:

- `apps/companion-web/src/app.js` localizes remaining high-frequency runtime shell copy for save/source/time feedback, Activity undo and next-step hints, Focus Brief, sidecar rail, Search results, Synthesis status/actions, Recent Stack, Captures details, highlight annotation, note/review/delete actions, and question status transitions,
- `scripts/smoke-bilingual-runtime-browser.mjs` now performs a real quote-only capture in Chinese mode and verifies Activity hint, Recent Stack, Captures details, Search results, and time-adjustment feedback in the browser receipt,
- `scripts/validate-ko-evidence.mjs` requires `mainLoopCaptureZh`, `recentStackZh`, `searchResultsZh`, and `activityHintZh` in addition to the prior main-shell bilingual receipt checks,
- `scripts/smoke-web.mjs` guards the new source anchors and receipt fields.

This slice intentionally preserves user-authored capture text, source titles/URLs, stable hint kinds, import/export schemas, file names, and the English `Question:` / `Answer:` / `Takeaway:` draft prefixes used by parser-compatible capture starters.

The twenty-second implementation slice makes the remaining platform QA blockers easier to audit:

- `scripts/validate-ko-evidence.mjs` now adds `platformQaStatus` to the KO status report for native Mac, Windows, and HarmonyOS receipts,
- each platform receipt is classified as `PENDING_NOT_RUN`, `PARTIAL_OR_BLOCKED_RUN`, `PASSING_REAL_RUN`, `INVALID`, or `INVALID_OR_INCOMPLETE`,
- the status records row counts, gate booleans, reviewer/environment fields, and blocking reasons so a real QA run can be verified without reading three separate receipt files first,
- `npm run ko:validate:selftest` now checks both the passing platform status shape and the pending-platform classification.

This slice still does not run native Mac GUI QA, Windows static/manual QA, or HarmonyOS device/toolchain QA. It keeps those blockers explicit in the KO evidence report; the current status remains `canClaimKo: false` with all three platform receipts classified as `PENDING_NOT_RUN`.

The twenty-third implementation slice strengthens external-source evidence auditability:

- `scripts/external-source-validation-browser.mjs` writes `runContext` into each candidate receipt and `run.md`, including app URL/root, git HEAD, dirty-worktree status, git-status summary, throwaway browser profile, viewport sizes, and local/remote network mode,
- `scripts/validate-external-source-privacy-review.mjs` rejects candidate receipts without `runContext`, requires app revision / throwaway profile / viewport / network fields, and adds `runContextReviewed` plus `appRevisionRecorded` to the human review template,
- `scripts/validate-ko-evidence.mjs` now rejects approved external KO artifacts that lack `runContext`,
- `scripts/smoke-web.mjs` guards the new external-source and KO run-context anchors.

This slice still does not provide real approved external-source evidence. It makes the eventual reading/video evidence more auditable once exact approved URLs, video timestamp, and a filled human privacy review exist.

The twenty-fourth implementation slice tightens approved-source URL eligibility:

- `scripts/external-source-validation-browser.mjs` rejects localhost, private/link-local IPs, IPv4-mapped local IPv6 literals, single-label intranet hosts, reserved example domains, credentials, and exact normalized sensitive URL query keys, including common signed URL keys such as `X-Amz-Signature` and `X-Goog-Signature`, before a real-source candidate run can start while allowing benign public query keys such as `keyword`,
- `scripts/validate-external-source-privacy-review.mjs` applies the same public/non-private URL rule before converting a candidate receipt into a reviewed external-source artifact,
- `scripts/validate-ko-evidence.mjs` applies the same rule before accepting a reviewed external-source artifact in the top-level KO gate,
- self-tests now cover local/private source URL rejection, IPv4-mapped IPv6 local source rejection, sensitive query-key rejection, and signed query-key rejection, and `scripts/smoke-web.mjs` guards the boundary helpers.

This slice still does not supply approved reading/video materials. It prevents local/private/internal fixture-like URLs from being promoted into the future approved-source evidence path.

The twenty-fifth implementation slice adds a real public-source preflight path without weakening approval:

- `scripts/external-source-validation-browser.mjs` accepts `--public-source-dry-run` as a third mutually exclusive mode beside local self-test and approved candidate,
- dry-runs require public reading/video URLs, a video timestamp, and `--dry-run-note`, reject browser network error pages or pages with too little visible content, then write `PUBLIC_SOURCE_DRY_RUN` receipts with `approvedCurrentTurn: false`, `PUBLIC_SOURCE_DRY_RUN_NOT_APPROVED` source markers, screenshots, and `runContext`,
- `scripts/validate-external-source-privacy-review.mjs` rejects `PUBLIC_SOURCE_DRY_RUN` receipts before template generation or review validation, so real public preflight artifacts cannot be converted into KO evidence without rerunning the approved candidate path,
- `scripts/smoke-web.mjs` guards the dry-run package script, mode markers, non-claiming boundary, and validator rejection.

This slice still does not approve any reading/video materials. It reduces execution risk for the eventual approved run by letting the same browser evidence flow be exercised against real public sources first.

The twenty-sixth implementation slice adds a readable KO next-action command:

- `scripts/ko-next-action-summary.mjs` reads `.codex-tmp/ko-evidence/current-status.json` and prints already-proved requirements, missing approved-source evidence, the exact learning-material URL inputs needed, privacy-review commands, platform QA blockers, and the final KO command,
- `package.json` exposes it as `npm run ko:next`,
- `scripts/smoke-web.mjs` guards the new package script and source anchors so the CLI keeps explaining that self-test and public dry-run evidence cannot fill approved external rows.

This slice does not satisfy any missing KO row by itself. It makes the current blockers executable and easier to resume without reading raw JSON.

The twenty-seventh implementation slice expands browser-executed static shell coverage:

- `apps/companion-web/src/app.js` now localizes the document title, sidebar/search chrome, new/export/import workspace controls, storage/update/import receipt buttons, landmark aria labels, synthesis shell controls, and search/capture/synthesis placeholders through the existing runtime language state,
- `scripts/smoke-bilingual-runtime-browser.mjs` captures and asserts those shell values in both Chinese mode and English-after-switch mode, then records `staticShellChromeZh` and `staticShellChromeEnAfterSwitch` in the bilingual browser receipt,
- `scripts/validate-ko-evidence.mjs` requires those new static shell checks before the top-level KO gate can pass,
- `scripts/smoke-web.mjs` guards the new receipt keys and Chinese shell anchors.

This slice does not change stored workspace data, source URLs, generated artifact schemas, import/export formats, or approved-source evidence gates. It strengthens the browser bilingual runtime proof while preserving the current `canClaimKo: false` boundary until approved reading/video evidence and platform QA receipts exist.

The twenty-eighth implementation slice closes a generated-title runtime gap:

- `apps/companion-web/src/app.js` now creates new topics as `新建学习主题` when the active UI language is Chinese, while preserving `New learning session` in English mode,
- the source-paste auto-rename path treats both English and Chinese generated defaults as replaceable, so pasting a real source can still rename the topic to the source title,
- the Chinese capture destination label was tightened from `到 <title>` to `到<title>`,
- `scripts/smoke-bilingual-runtime-browser.mjs` clicks the new-session button in Chinese mode and asserts the generated title, session list entry, capture destination text/title/aria, and capture-context aria,
- `scripts/validate-ko-evidence.mjs` requires `newSessionDefaultZh` before the top-level KO gate can pass, and `scripts/smoke-web.mjs` guards the new runtime receipt key and source anchors.

This slice changes only the generated default title for Chinese-mode newly created topics. It does not translate user-authored existing titles, source titles, captures, notes, schemas, or import/export data.

The twenty-ninth implementation slice closes a Synthesis confirmation runtime gap:

- `apps/companion-web/src/app.js` localizes the confirmation shown before replacing an edited Synthesis draft with a regenerated version,
- `scripts/smoke-bilingual-runtime-browser.mjs` switches to Chinese mode, enters Synthesis, marks the draft as edited, captures the `window.confirm` message, and asserts that canceling keeps the edited draft intact,
- `scripts/validate-ko-evidence.mjs` requires `synthesisOverwriteConfirmZh` in the bilingual runtime receipt before the top-level KO gate can pass,
- `scripts/smoke-web.mjs` guards the localized source anchor and browser receipt key.

This slice does not alter generated synthesis content, note insertion, source/capture data, or any external-source evidence path. It only localizes the confirmation that protects edited Synthesis drafts.

The thirtieth implementation slice closes a mirror-import confirmation runtime gap:

- `apps/companion-web/src/app.js` localizes the confirmation shown before replacing the current workspace with a mirror bundle,
- the English copy keeps the existing replacement warning while adding singular/plural session wording,
- the Chinese copy records the mirror bundle export time when present and warns that the current workspace will be replaced,
- `scripts/smoke-bilingual-runtime-browser.mjs` generates a mirror bundle from the current browser workspace, monkey-patches `window.confirm`, imports the bundle through the native bridge, asserts the Chinese confirmation copy, cancels the import, and verifies the current workspace still has the expected active session and Chinese topic title,
- `scripts/validate-ko-evidence.mjs` requires `mirrorImportConfirmZh` in the bilingual runtime receipt before the top-level KO gate can pass, and `scripts/smoke-web.mjs` guards the source anchors.

This slice does not change mirror bundle schema, import parsing, workspace replacement behavior, or return-file contracts. It only localizes the destructive mirror-import confirmation and proves the cancel path.

## External Source Visual Validation

Future study-loop validation should include public or user-approved non-private reading/video material and store screenshots under project-local `.codex-tmp/`.

Record for each run:

- source URL and title,
- whether the material is reading or video,
- timestamp when video timing is relevant,
- app git HEAD and dirty-worktree state,
- viewport size and sidecar/full-desk state,
- throwaway browser profile and network mode,
- screenshot showing the source beside the app during capture,
- screenshot showing source resume after saving.

Do not use authenticated/private pages, cookies, or sensitive content. A screenshot is visual evidence only; it is not proof of live playback, platform compatibility, or human comprehension unless the test actually exercises and records that behavior.

## Continuation TODO

Use [docs/context/todo.md](context/todo.md) as the local handoff for the next iteration. The static mirror index, Review/Inbox static and runtime return-loop copy, generated `TODAY.md` / review-pack shell copy, per-session Markdown, synthesis drafts, mirror `README.md`, import/return receipt display copy, generated QA receipt guidance, export-panel shell copy, native Mac shell copy, HarmonyOS visible scaffold copy, main web shell / Today / Review / Recent Stack / Search browser runtime switching, full browser runtime smoke, source resume, text-fragment source jumps, controlled agent loop, external-source harness self-test, privacy-review contract self-test, and top-level KO gate self-test are locally verified. The next step is external document/video screenshot validation with approved non-private sources and a filled human privacy review, plus native Mac manual proof, Windows static/manual proof, and HarmonyOS device/toolchain proof; the top-level KO gate now requires all of them.
