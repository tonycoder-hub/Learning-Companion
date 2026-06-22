# Learning Companion Status

Updated: 2026-06-23

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

This is not full bilingual coverage. Browser-executed DOM switching proof for every runtime branch, native Mac GUI/manual proof, Windows static/manual proof, and HarmonyOS device proof are still outside the completed boundary.

The first generated Markdown pack slice is locally verified. It now emits English and Chinese shell copy for:

- generated `TODAY.md` title, meta labels, resume section, section aliases, empty states, source/tag/reason/answer labels, overflow lines, and final notes,
- `Learning Companion Review Pack` title, scope boundary, workspace/export/stage sections, command gates, and promotion-gate guidance.

This generated-pack slice preserves user-authored capture/session text and English source-of-truth labels. Full browser-executed DOM checks, native Mac GUI/manual proof, Windows static/manual proof, and HarmonyOS device proof remain outside the completed boundary.

The second generated artifact slice is locally verified. It now emits English and Chinese shell copy for:

- generated per-session Markdown title/source/type/tag labels, Notes/Captures/Review Cards section aliases, empty states, capture source labels, and review-card Q/A labels,
- synthesis draft title/source/generated-from/section aliases, empty states, evidence labels, fallback prompts, and review target guidance,
- mirror `README.md` title, export/schema summary, restore guidance, and fixed-file descriptions.

This slice preserves user-authored notes, captures, questions, review-card prompts/answers, source URLs, mirror file paths, schema names, bundle role strings, and byte counts.

The import/return receipt display slice is locally verified. It now emits English and Chinese display copy for:

- import receipt titles and action buttons for mobile inbox, review-progress, return-files, and import-error receipts,
- receipt details for mobile inbox, review-progress, and return-files receipts, while import-error details preserve the raw failure message,
- Device Flow `Last import` summaries with explicit English/Chinese formatter calls,
- Returned Work nudge titles, details, action labels, failed-file/basis warnings, and review-status activity copy.

This slice preserves receipt schema names, stable `kind` values, file names, patch IDs, and user-authored session/capture text. A later focused browser smoke covers representative import/return branches, but external reading/video validation remains outside this completed boundary.

The generated QA receipt bilingual slice is locally verified. It now emits adjacent Chinese guidance for:

- generated `MAC_MANUAL_QA.md`, `WINDOWS_STATIC_QA.md`, and `HARMONY_DEVICE_QA.md` titles,
- stage/evidence boundary statements,
- fill instructions for `PASS` / `FAIL` / `BLOCKED` / `NT`,
- Session Header, Preconditions, Test Matrix, and Notes section aliases,
- core preconditions, blocker/result guidance, validation commands, and usability-claim gates.
- detailed row-level intent guides for the Mac manual, Windows static, and HarmonyOS device Test Matrix rows.

This slice intentionally preserves the English Test Matrix tables, table field keys, result tokens, schema names, filenames, command strings, and claim-boundary identifiers so the existing validators keep parsing real receipts. The row-level Chinese guidance is adjacent explanatory copy, not a replacement for parser-owned table cells. Static-return validation was also updated to accept bilingual generated mirror headings while still checking English contract anchors, Chinese heading aliases, relative return links, and no external script/style behavior.

The export-panel/document-export shell-copy slice is locally verified. It now emits English and Chinese copy for:

- Export panel section headings and local-backup/cloud-sync boundary text,
- workspace JSON disclosure summary,
- copy/save buttons for workspace, Review Pack, current-session Markdown/JSON, Today, mirror JSON/ZIP, and browser capture bookmarklet,
- copy/save/download/failure toast messages,
- workspace backup completion notices,
- mirror handoff-ready Activity copy after mirror JSON/ZIP export.

This slice intentionally preserves export filenames, schema names, generated document contents, mirror handoff kind values, and the actual browser/native save mechanisms. Full browser-executed DOM switching proof, native Mac GUI/manual proof, Windows static/manual proof, and HarmonyOS device proof remain outside this completed boundary.

The native Mac shell-copy slice is locally verified at source/string level. It now emits English and Chinese copy for:

- native AppKit File/Capture/Window menu titles and action labels,
- clipboard and selected-text capture status labels,
- import/export/open-review panel titles and failure alerts,
- native workspace and web-export save-panel titles and write/fallback errors,
- missing-web-root guidance.

This slice intentionally preserves the native app name, window title, menu hotkeys, suggested export filenames, bridge message names, save/import flow, file-size limits, URL boundaries, JavaScript bridge calls, and stderr diagnostics. Swift build/native GUI manual QA were not run, so this is not native runtime proof.

The HarmonyOS visible scaffold bilingual slice is locally verified at source/string level. It now emits English and Chinese copy for:

- Phone Next / resume / import-return entry points on the HarmonyOS landing page,
- review queue, answered-today, open-question, parked-question, and topic-stat labels,
- topic detail source/sidebar/section/empty-state/status copy,
- review queue heading, due count, reveal/hide/manual-return copy,
- import receipt titles, actions, status/details, picker contract text, and picker limitation guidance,
- return-to-Mac export contract copy,
- module and entry descriptions in Harmony resources.

This slice intentionally preserves ArkTS route names, persisted data shapes, import/export contract IDs, schema keys, and source/user-authored text. It was not run on a HarmonyOS device or DevEco build, so it is not device runtime proof.

The browser-executed bilingual runtime slice is locally verified for representative return-loop branches and the main web study shell. It now proves in a real headless Chromium session that English and Chinese mode can switch at runtime for:

- document title, sidebar/search chrome, top-level workspace import/export actions, storage/update/import receipt buttons, and landmark aria labels,
- the Export panel shell and action labels,
- the source strip, material type options, focus-mode buttons, inspector tabs, Quick Capture shell, and Notes actions,
- Chinese-mode new-session creation, including the generated topic title, session list entry, and capture destination context,
- search, capture, and synthesis input placeholders plus Synthesis build/insert shell controls,
- Chinese-mode Synthesis overwrite confirmation for edited drafts,
- Chinese-mode mirror bundle import replacement confirmation, including the cancel path preserving the current workspace,
- Today stats, Today map labels, section titles, Learning Flow text, Study Details drawer, and Question Queue Health copy,
- Review toolbar due count and answer/reveal/grade/delete controls,
- main-loop capture feedback, Activity next-step hints, Recent Stack, Captures details, Search results, source/time adjustment feedback, and note/review/delete actions,
- mobile inbox import receipt banners/details,
- Returned Work nudges after a return file is staged,
- return-file preview ready/apply/discard copy,
- desktop no-horizontal-overflow at 1280px.

This focused browser smoke writes a local receipt to `.codex-tmp/bilingual-browser-smoke/receipt.json`.

The full browser smoke is also locally verified again. `scripts/smoke-browser.mjs` no longer hard-codes the macOS Chrome path; it resolves `CHROME_PATH`, Linux Chromium/Chrome paths, or the macOS Chrome path before launching. The full smoke now runs under local Chromium and covers the broader browser workflow, including app startup, static mirror pages, file-backed mirror navigation, Review/Inbox return-file runtime branches, mobile layout checks, patch import receipts, and negative import cases. It does not validate external reading/video sources, HarmonyOS or Windows runtime behavior, native Mac WKWebView behavior, or actual human learning outcomes.

The source-resume and controlled-loop browser evidence scripts are also locally verified in the current Chromium environment:

- `scripts/smoke-source-resume.mjs` now resolves `CHROME_PATH`, Linux Chromium/Chrome paths, or macOS Chrome, and verifies saved-capture source resume behavior including text-fragment jumps and video timestamp resume URLs.
- `scripts/smoke-text-fragment-browser.mjs` now runs in local Chromium and verifies browser text-fragment scrolling on a generated local source page.
- `scripts/agent-study-loop-check.mjs` now runs in local Chromium and writes `.codex-tmp/agent-study-loop-smoke/receipt.json` for a controlled sidecar/capture/question/answer/notes loop.
- `scripts/smoke-web.mjs` guards these scripts against regressing to a single hard-coded macOS Chrome path.

These scripts strengthen source/resume and loop regression evidence, but they are still fixture/controlled evidence. They do not replace the required approved reading-source and video-source screenshot runs.

The external-source validation browser harness is now locally self-tested:

- `scripts/external-source-validation-browser.mjs` refuses approved KO-candidate runs unless the command includes `--approved-current-turn`, `--reading-url`, `--video-url`, and `--approval-note`.
- `npm run external:source-help` now prints the plain English/Chinese meaning of required source URLs: public reading and video learning-material links, plus the video timestamp to capture. It also shows the shortest user input shape: `阅读：https://... / 视频：https://... / 时间：00:15`.
- `npm run external:source-intake` now parses the pasted `阅读/视频/时间` input shape without launching Chromium, validates the public URL boundary with the same approved-source checks, normalizes the timestamp, and prints the next public dry-run plus approved-candidate commands. It never creates KO evidence.
- `scripts/external-source-validation-browser.mjs` now also supports `--public-source-dry-run` for real public reading/video preflight before approval. It requires public `--reading-url`, `--video-url`, `--video-timestamp`, and `--dry-run-note`, rejects browser network error pages or pages with too little visible content, writes `evidenceTier: PUBLIC_SOURCE_DRY_RUN`, records `approvedCurrentTurn: false`, and cannot be privacy-template-generated or privacy-reviewed into KO evidence.
- Real video runs now also require `--video-timestamp` so the harness cannot pass a video candidate without timestamp evidence.
- `npm run external:validate:selftest` launches local reading/video fixtures in headless Chromium, captures the source/app evidence screenshots, writes `receipt.json` and `run.md`, and keeps `canClaimExternalKo: false`.
- `scripts/validate-external-source-privacy-review.mjs` adds the candidate-to-KO evidence contract: it can generate a human privacy-review template, refuses local fixture self-tests, requires an `APPROVED_SOURCE_CANDIDATE` receipt with reading and video timestamp evidence, verifies screenshot files still exist, rejects placeholder human review fields for reviewer / approval reference / notes, requires `reviewedAt` to be an ISO date-time with timezone, and only writes a derived `APPROVED_SOURCE_PRIVACY_REVIEWED` artifact with `canClaimExternalKo: true` after a filled human review has `PASS` verdict and all privacy booleans are true. Its self-test writes only a fixture-only summary with `canClaimExternalKo: false`; the positive claim shape is checked in memory.
- `docs/external-source-validation.md` now documents the self-test command, the real-source candidate command, privacy-review template generation, and privacy-review validation. This is process readiness only; exact approved non-private reading/video URLs and a real human privacy review are still required before claiming KO evidence.

The external-source evidence chain now records run context:

- `scripts/external-source-validation-browser.mjs` writes `runContext` into each candidate/self-test receipt and `run.md`, including app URL/root, git HEAD, dirty-worktree status, git-status summary, throwaway browser profile, viewport sizes, and local/remote network mode.
- `scripts/validate-external-source-privacy-review.mjs` rejects candidate receipts without `runContext`, requires app revision / throwaway profile / viewport / network fields, and adds `runContextReviewed` plus `appRevisionRecorded` to the human review contract.
- `scripts/validate-ko-evidence.mjs` now rejects approved external KO artifacts that lack `runContext`, so old claim-shaped artifacts cannot satisfy the external-source requirement after this slice.
- The latest local self-test receipt under `.codex-tmp/external-source-validation/` shows `runContext.schema = learning-companion.external-source-run-context.v1`, a captured git HEAD, `dirtyWorktree: true`, `profileMode: throwaway-profile`, and the expected source-evidence viewport.
- The real-source browser harness, privacy-review validator, and KO gate now reject localhost, private/link-local IPs, IPv4-mapped local IPv6 literals, single-label intranet hosts, reserved example domains, and exact normalized sensitive URL query keys, including common signed URL keys such as `X-Amz-Signature` and `X-Goog-Signature`, as approved external source URLs while allowing benign public query keys such as `keyword`. Self-tests cover local/private source rejection, IPv4-mapped IPv6 local source rejection, sensitive query-key rejection, signed query-key rejection, and public dry-run receipt rejection while still keeping fixture/dry-run output non-claiming.
- A real public-source dry-run now exists at `.codex-tmp/external-source-validation/20260615T121613Z-public-wikipedia-mdn-video-preflight/receipt.json`. It used `https://en.wikipedia.org/wiki/Spaced_repetition` and `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4`, saved reading/video captures, preserved source context, captured video timestamp `00:03`, and kept `evidenceTier: PUBLIC_SOURCE_DRY_RUN`, `approvedCurrentTurn: false`, and `canClaimExternalKo: false`.
- A failed preflight against `https://commons.wikimedia.org/wiki/File:Knowledge_for_Everyone.webm` now proves browser network error pages are rejected before evidence is accepted. The latest negative check also proves `external:privacy-template` rejects the public dry-run receipt and writes no template.

The top-level KO evidence gate is now locally self-tested:

- `scripts/validate-ko-evidence.mjs` combines the bilingual browser runtime receipt, the controlled learning-loop receipt, native Mac manual QA, Windows static/manual QA, HarmonyOS device/toolchain QA, and a privacy-reviewed approved-source external evidence artifact.
- `scripts/ko-next-action-summary.mjs` prints the current KO state as a readable next-action summary: already proved requirements, missing approved reading/video evidence, required learning-material URLs, privacy-review commands, and remaining platform QA blockers. With `--refresh`, it first runs `scripts/validate-ko-evidence.mjs --allow-missing --out <status>` so the summary is based on the current local receipt files instead of a stale status snapshot.
- `scripts/platform-qa-handoff.mjs` reads the current KO status plus the generated Mac, Windows, and HarmonyOS QA templates and emits a `learning-companion.platform-qa-handoff.v1` handoff with `PLATFORM_QA_HANDOFF_ONLY`, `canClaimKo: false`, exact validation commands, required session fields, row/result counts, and explicit no-platform-run boundaries. It does not retain raw QA Markdown or row Notes.
- The bilingual receipt requirement now also includes static shell chrome checks: `staticShellChromeZh` and `staticShellChromeEnAfterSwitch`.
- The bilingual receipt requirement now also includes `newSessionDefaultZh`, proving Chinese mode does not create a new topic with an English default title.
- The bilingual receipt requirement now also includes `synthesisOverwriteConfirmZh`, proving the edited-draft overwrite confirmation is localized in Chinese mode.
- The bilingual receipt requirement now also includes `mirrorImportConfirmZh`, proving the mirror bundle replacement confirmation is localized in Chinese mode and cancel preserves the current workspace.
- The bilingual receipt requirement now includes the expanded main-shell checks: `studyShellZh`, `studyShellEnAfterSwitch`, `todayLearningFlowZh`, `reviewToolbarZh`, `mainLoopCaptureZh`, `recentStackZh`, `searchResultsZh`, and `activityHintZh`.
- The gate reports `canClaimKo: false` when any platform QA receipt is still pending, when the external approved-source artifact is missing, or when old self-test claim-shaped artifacts from `.codex-tmp/external-source-privacy-review-selftest/` are passed in.
- The report now includes `platformQaStatus` for native Mac, Windows, and HarmonyOS receipts. It classifies each receipt as `PENDING_NOT_RUN`, `PARTIAL_OR_BLOCKED_RUN`, `PASSING_REAL_RUN`, `INVALID`, or `INVALID_OR_INCOMPLETE`, with row counts, gate booleans, reviewer/environment fields, and blocking reasons.
- Platform QA validators and the top-level KO gate now require every non-`NT` platform QA row to include a concrete Notes evidence reference; empty or placeholder Notes such as `TBD`, `N/A`, `none`, `no evidence`, `placeholder`, `todo`, or wrapped/decorated variants like `- todo: capture screenshot`, `1. todo: capture screenshot`, and `> todo: capture screenshot` are only valid for `NT` rows. A receipt with `PASS`, `FAIL`, or `BLOCKED` rows lacking concrete Notes is classified as `INVALID_OR_INCOMPLETE`.
- `npm run ko:validate:selftest` verifies the positive gate shape in memory and negative cases for missing external evidence, fixture-only external evidence, pending platform evidence, platform rows without evidence Notes, platform rows with exact/decorated/numbered/blockquote placeholder evidence Notes, and platform-status classification. It writes only a fixture-only summary with `canClaimKo: false`.
- `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json` now records the current authoritative status: the local bilingual/controlled-loop evidence exists, but KO is not claimable because native Mac manual QA, Windows static/manual QA, HarmonyOS device/toolchain QA, and the real privacy-reviewed approved reading/video artifact are still missing or pending. The current platform receipt statuses are all `PENDING_NOT_RUN`.

Subagent review follow-up:

- `PASS_WITH_NOTES`: external-source validation runbook needed stricter approval, privacy, app revision, and timestamp evidence fields. Fixed in `docs/external-source-validation.md`.
- `PASS_WITH_NOTES`: static mirror bilingual review found Review/Inbox badge language leakage, English-only dynamic Resume copy, and permissive script CSP. Fixed in `apps/companion-web/src/model.js` and `scripts/smoke-web.mjs`.
- `PASS_WITH_NOTES`: Review/Inbox static page reviewers recommended dynamic runtime i18n too. Static chrome plus startup-overwritten save-mode and answer-mode controls were implemented first; runtime status, after-save, follow-up, and return-loop copy are now covered by the latest slice.
- `BLOCKED`: final subagent review found active Inbox answer-context title/help still used English-only `textContent`. Fixed with `setI18nHtml(...)` and smoke assertions for the active title/help calls.
- `PASS`: Review/Inbox runtime i18n scans found English-only status sinks, return-file hints, after-save/follow-up copy, manual-copy errors, and Inbox empty/source hints. Fixed with pair-aware runtime helpers and smoke assertions guarding against `textContent = message` / object-string regressions.
- `PASS`: generated-artifact scan identified `TODAY.md` as the best next target, with Review Pack as a small adjacent pack. Fixed the generated Markdown shell copy and added smoke anchors for Chinese output.
- `PASS_WITH_NOTES`: import receipt display scan recommended render-time localization and no receipt schema changes. Fixed import receipt formatters, return-nudge copy, and Device Flow latest-import formatting; a later focused browser smoke now covers representative import/return branches.
- `PASS`: generated QA receipt smoke now guards Chinese shell-copy and row-guide anchors for Mac manual, Windows static, and HarmonyOS device pending receipts while keeping all pending receipt rows non-claiming (`NT`).
- `PASS`: export-panel string smoke now guards export shell-copy anchors and bilingual copy/save feedback while keeping export filenames and data contracts unchanged.
- `PASS`: native Mac shell-copy smoke now guards Chinese AppKit menu/panel/status/error anchors and native save bridge anchors while keeping hotkeys, filenames, and bridge mechanics unchanged.
- `PASS_WITH_NOTES`: GPT subagent review for full browser smoke restoration found the changes scoped to browser discovery/Linux Chromium support and bilingual-copy-compatible assertions. It confirmed this is progress toward KO, not KO-complete; DeepSeek/Orange/Seed remote review channels did not execute because `.21` SSH/Kerberos auth failed.
- `PASS_WITH_NOTES`: GPT subagent review for source-resume/text-fragment/controlled-loop browser evidence found the changes scoped to local Chromium portability and confirmed the docs preserve the approved external reading/video evidence gap. DeepSeek/Orange/Seed remote review channels again did not execute because `.21` SSH/Kerberos auth failed.
- `PASS_WITH_NOTES` below normal quorum: GPT subagent review for the external-source validation harness found no blocker and confirmed the approval gates, fixture self-test, throwaway profile, and non-KO claim boundary. DeepSeek/Orange/Seed remote review channels did not execute because `.21` SSH permission was denied.
- `BLOCKED` then fixed: GPT subagent review for the privacy-review contract found false-positive risks around empty screenshot lists, missing source URLs, and a claim-shaped self-test artifact. Fixed by requiring non-empty required screenshot files, absolute http(s) source URLs, review URL matching, and changing privacy self-test output to a fixture-only summary with `canClaimExternalKo: false`.
- `PASS_WITH_NOTES` below normal quorum: GPT subagent re-review found the privacy-review contract fixes sufficient for this implementation slice and reiterated that no real approved external source evidence exists yet. DeepSeek/Orange/Seed remote review channels did not execute because `.21` SSH permission was denied.
- `PASS_WITH_NOTES` below normal quorum: GPT subagent review for the top-level KO evidence gate found no obvious fixture/self-test path to final KO evidence and confirmed the current status remains non-claiming until real approved-source privacy-reviewed evidence is provided. DeepSeek/Orange/Seed remote review channels did not execute because `.21` SSH permission was denied.
- `PASS` below normal quorum: GPT subagent review for the static shell bilingual browser coverage found the slice correctly expands runtime bilingual proof without changing data contracts or implying final KO completion. DeepSeek/Orange/Seed remote review channels did not execute because `.21` SSH permission was denied.
- `PASS` below normal quorum: GPT subagent review for the Chinese-mode new-session default slice found the exact generated-default matching and `newSessionDefaultZh` KO receipt check scoped correctly, without translating user-authored titles or implying final KO completion. DeepSeek/Orange/Seed remote review channels did not execute because `.21` SSH permission was denied.
- `PASS` below normal quorum: GPT subagent review for the Synthesis overwrite confirmation slice found the localized confirm path and cancel-preserves-draft browser proof scoped correctly, without implying final KO completion. DeepSeek/Orange/Seed remote review channels did not execute because `.21` SSH permission was denied.
- `PASS_WITH_NOTES` below normal quorum: GPT subagent review for the mirror bundle import confirmation slice found the localized confirmation, cancel-path browser proof, and `mirrorImportConfirmZh` KO receipt requirement properly scoped. DeepSeek/Orange/Seed remote review channels did not execute because `.21` SSH permission was denied.
- `PASS` below normal quorum: GPT subagent review for the source URL help clarity slice found the changes scoped to help/docs/static smoke assertions, preserving evidence semantics and the `canClaimKo: false` boundary. DeepSeek/Orange/Seed remote review channels did not execute because `.21` SSH permission was denied.
- `PASS_WITH_NOTES` below normal quorum: GPT subagent review for the `external:source-intake` command found it directionally correct because it validates pasted reading/video/time input before browser evidence, reuses `requireApprovedUrl()`, and does not create evidence or claim KO. The note was to ensure all extraction paths pass through `requireApprovedUrl()` before command generation; the implementation does this for the final reading and video URLs. DeepSeek/Orange/Seed remote review channels did not execute because `.21` SSH permission was denied.

## Verification

PASS:

- `node --check scripts/build-morning-demo.mjs`
- `node --check scripts/validate-morning-receipts.mjs`
- `node --check scripts/static-return-loop-check.mjs`
- `node --check apps/companion-web/src/model.js`
- `node --check apps/companion-web/src/app.js`
- `node --check scripts/smoke-web.mjs`
- `node --check scripts/smoke-browser.mjs`
- `node --check scripts/smoke-source-resume.mjs`
- `node --check scripts/smoke-text-fragment-browser.mjs`
- `node --check scripts/agent-study-loop-check.mjs`
- `node --check scripts/external-source-validation-browser.mjs`
- `node --check scripts/validate-external-source-privacy-review.mjs`
- `node --check scripts/validate-ko-evidence.mjs`
- `node --check scripts/smoke-bilingual-runtime-browser.mjs`
- `node --check scripts/smoke-harmony-scaffold.mjs`
- `npm run demo:morning` -> `morning_demo_ok`
- `npm run check:static-return` -> `static_return_loop_ok`
- `npm run morning:receipts` -> `morning_receipts_ok`
- `npm run mac:manual:validate:smoke` -> pending receipt valid, 27 rows all `NT`
- `npm run windows:static:validate:smoke` -> pending receipt valid, 10 rows all `NT`
- `npm run harmony:device:validate:smoke` -> pending receipt valid, 10 rows all `NT`
- Wrapped negative check for Mac/Windows/Harmony platform QA templates with one `PASS` row and empty Notes -> `platform_qa_empty_note_negative_ok`
- Wrapped positive check for Mac/Windows/Harmony platform QA templates with one `PASS` row and an evidence Notes value -> `platform_qa_evidence_note_positive_ok`
- Wrapped negative check for Mac/Windows/Harmony platform QA templates with one `PASS` row and `- todo: capture screenshot` Notes -> `platform_qa_wrapped_placeholder_note_negative_ok`
- Wrapped positive check for Mac/Windows/Harmony platform QA templates with one `PASS` row and concrete Notes -> `platform_qa_concrete_note_positive_ok`
- `npm run smoke` -> `smoke_web_ok`
- `npm run smoke:harmony` -> `smoke_harmony_schema_ok`, `smoke_harmony_scaffold_ok`
- `npm run smoke:bilingual-browser` -> `.codex-tmp/bilingual-browser-smoke/receipt.json`
- `npm run smoke:browser` -> `smoke_browser_ok`
- `npm run smoke:source-resume` -> `smoke_source_resume_ok`
- `npm run smoke:text-fragment` -> `smoke_text_fragment_browser_ok`
- `npm run agent:study-loop` -> `.codex-tmp/agent-study-loop-smoke/receipt.json`
- `npm run external:validate:selftest` -> local fixture receipt under `.codex-tmp/external-source-validation/`
- `npm run external:privacy-review:selftest` -> local privacy-review contract self-test under `.codex-tmp/external-source-privacy-review-selftest/`
- `npm run external:privacy-template` is now candidate-only; local fixture and public dry-run receipts are rejected before a privacy template is written.
- `npm run external:validate:public-dry-run -- --run-label public-wikipedia-mdn-video-preflight ...` -> real public dry-run receipt under `.codex-tmp/external-source-validation/20260615T121613Z-public-wikipedia-mdn-video-preflight/receipt.json`, non-claiming
- Wrapped negative check for `npm run external:privacy-template -- --receipt .codex-tmp/external-source-validation/20260615T121613Z-public-wikipedia-mdn-video-preflight/receipt.json ...` -> `public_dry_run_privacy_template_rejected_ok`
- `npm run ko:next -- --refresh` -> refreshes `.codex-tmp/ko-evidence/current-status.json` with `--allow-missing`, then prints a readable next-action summary showing approved material URL inputs, privacy-review commands, and platform QA blockers
- `npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json` -> non-claiming platform execution handoff; summarizes Mac/Windows/Harmony pending receipts without running platform QA
- `npm run ko:validate:selftest` -> local KO gate self-test under `.codex-tmp/ko-evidence-selftest/`
- `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json` -> current status report with `canClaimKo: false`, including platform QA and approved-source blockers
- `node scripts/validate-ko-evidence.mjs --allow-missing --external .codex-tmp/external-source-privacy-review-selftest/20260615T100006Z/claim.json --out .codex-tmp/ko-evidence/reject-old-selftest-claim.json` -> old self-test claim-shaped artifact rejected
- `npm run check:morning` -> `morning_offline_check_ok`
- `git diff --check`

Most recent focused rerun after the main-loop bilingual expansion passed `node --check apps/companion-web/src/app.js`, `node --check scripts/smoke-bilingual-runtime-browser.mjs`, `node --check scripts/smoke-web.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `npm run smoke:bilingual-browser`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, and `git diff --check`. The current status file still reports `canClaimKo: false`.

Most recent focused rerun after adding platform QA status summaries passed `node --check scripts/validate-ko-evidence.mjs`, `npm run ko:validate:selftest`, and `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`. The refreshed status file still reports `canClaimKo: false`, with native Mac, Windows, and HarmonyOS platform receipts classified as `PENDING_NOT_RUN`.

Most recent focused rerun after expanding static shell chrome browser coverage passed `node --check apps/companion-web/src/app.js`, `node --check scripts/smoke-bilingual-runtime-browser.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run smoke:bilingual-browser`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, and `npm run ko:next`. The refreshed status file still reports `canClaimKo: false`, with approved external reading/video evidence and all three platform QA receipts still missing or pending.

Most recent focused rerun after localizing Chinese-mode new session defaults passed `node --check apps/companion-web/src/app.js`, `node --check scripts/smoke-bilingual-runtime-browser.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run smoke:bilingual-browser`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The refreshed status file still reports `canClaimKo: false`, with `newSessionDefaultZh: true` recorded in the bilingual runtime evidence.

Most recent focused rerun after localizing the Synthesis overwrite confirmation passed `node --check apps/companion-web/src/app.js`, `node --check scripts/smoke-bilingual-runtime-browser.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run smoke:bilingual-browser`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The refreshed status file still reports `canClaimKo: false`, with `synthesisOverwriteConfirmZh: true` recorded in the bilingual runtime evidence.

Most recent focused rerun after localizing the mirror bundle import confirmation passed `node --check apps/companion-web/src/app.js`, `node --check scripts/smoke-bilingual-runtime-browser.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run smoke:bilingual-browser`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The refreshed status file still reports `canClaimKo: false`, with `mirrorImportConfirmZh: true` recorded in the bilingual runtime evidence.

Most recent focused rerun after adding the approved source input-intake command passed `node --check scripts/external-source-validation-browser.mjs`, `node --check scripts/ko-next-action-summary.mjs`, `node --check scripts/smoke-web.mjs`, `npm run external:source-intake -- --input <valid reading/video/time block>`, a wrapped private-URL rejection check for `npm run external:source-intake`, `npm run external:source-help`, `npm run ko:next`, `npm run smoke`, and `npm run external:validate:selftest`. The KO status remains `canClaimKo: false`; this slice only validates source input and prints next commands, and it does not create approved-source evidence.

Most recent focused rerun after adding external-source run context passed `node --check scripts/external-source-validation-browser.mjs`, `node --check scripts/validate-external-source-privacy-review.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run external:validate:selftest`, `npm run external:privacy-review:selftest`, `npm run ko:validate:selftest`, `npm run smoke`, and `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`. The refreshed KO status still has `canClaimKo: false`.

Most recent focused rerun after tightening approved-source URL boundaries passed `node --check scripts/external-source-validation-browser.mjs`, `node --check scripts/validate-external-source-privacy-review.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run external:validate:selftest`, `npm run external:privacy-review:selftest`, `npm run ko:validate:selftest`, `npm run smoke`, and `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`. The refreshed KO status still has `canClaimKo: false`.

Most recent focused rerun after hardening human privacy-review fields passed `node --check scripts/validate-external-source-privacy-review.mjs`, `node --check scripts/smoke-web.mjs`, `npm run external:privacy-review:selftest`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The refreshed KO status still has `canClaimKo: false`; exact approved external reading/video URLs and a real human review remain required.

Most recent focused rerun after blocking privacy-review self-test artifact paths passed `node --check scripts/validate-external-source-privacy-review.mjs`, `node --check scripts/smoke-web.mjs`, `npm run external:privacy-review:selftest`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The refreshed KO status still has `canClaimKo: false`; self-test receipt/review paths cannot be privacy-reviewed into approved-source KO evidence.

Most recent focused rerun after hardening platform QA row evidence passed `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `node --check scripts/validate-mac-manual-qa.mjs`, `node --check scripts/validate-windows-static-qa.mjs`, `node --check scripts/validate-harmony-device-qa.mjs`, `node --check scripts/build-morning-demo.mjs`, `node --check scripts/validate-morning-receipts.mjs`, `npm run ko:validate:selftest`, `npm run smoke`, `npm run mac:manual:validate:smoke`, `npm run windows:static:validate:smoke`, `npm run harmony:device:validate:smoke`, the wrapped empty-Notes negative check, the wrapped evidence-Notes positive check, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, and `npm run ko:next`. The refreshed KO status still has `canClaimKo: false`; real approved external evidence and real Mac/Windows/Harmony platform QA remain required.

Most recent focused rerun after rejecting placeholder platform QA Notes passed `node --check scripts/validate-mac-manual-qa.mjs`, `node --check scripts/validate-windows-static-qa.mjs`, `node --check scripts/validate-harmony-device-qa.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run ko:validate:selftest`, `npm run smoke`, `npm run mac:manual:validate:smoke`, `npm run windows:static:validate:smoke`, `npm run harmony:device:validate:smoke`, the wrapped `- todo: capture screenshot` Notes negative check, the numbered `1. todo: capture screenshot` Notes negative check, the blockquote `> todo: capture screenshot` Notes negative check, the wrapped concrete Notes positive check, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The KO self-test covers Mac, Windows, and Harmony placeholder receipt paths. The refreshed KO status still has `canClaimKo: false`; pending all-`NT` platform receipts remain valid but non-claiming.

Most recent focused rerun after hardening platform QA session fields passed `node --check scripts/validate-mac-manual-qa.mjs`, `node --check scripts/validate-windows-static-qa.mjs`, `node --check scripts/validate-harmony-device-qa.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/build-morning-demo.mjs`, `node --check scripts/smoke-web.mjs`, `npm run smoke`, `npm run ko:validate:selftest`, `npm run mac:manual:validate:smoke`, `npm run windows:static:validate:smoke`, `npm run harmony:device:validate:smoke`, the wrapped platform QA session-field runtime checks, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. Platform receipts with filled rows now need ISO Date/time with timezone, concrete Reviewer, and concrete platform environment fields; filled but non-claimable rows stay `PARTIAL_PLATFORM_QA`, while only full expected all-PASS platform runs with passing gates, empty `errors`, and matching claim boundary can record `MANUAL_PLATFORM_QA`. The KO gate also rejects hand-edited receipts whose summary counts, Area rows, tier, errors, or claim booleans do not match derived evidence. The refreshed KO status still has `canClaimKo: false`.

Most recent source-intake handoff update adds `--out` to `npm run external:source-intake` so an approved-source input block can be normalized into `learning-companion.external-source-intake-handoff.v1` with `SOURCE_INTAKE_HANDOFF_ONLY`, normalized URL/timestamp fields only, next dry-run / approved-candidate / privacy-review commands, approval requirements, privacy checklist, and an explicit no-browser/no-screenshot/no-approval boundary. This is handoff metadata only and cannot satisfy KO evidence.

Most recent focused rerun after adding the platform QA handoff passed `node --check scripts/platform-qa-handoff.mjs`, `node --check scripts/ko-next-action-summary.mjs`, `node --check scripts/smoke-web.mjs`, `npm run smoke`, a wrapped `npm run platform:qa-handoff -- --out` missing-path negative check, `npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json`, a wrapped JSON shape/mode check for `.codex-tmp/platform-qa-handoff/current.json`, `npm run ko:next`, `npm run ko:validate:selftest`, and `git diff --check`. The generated handoff has `PLATFORM_QA_HANDOFF_ONLY`, `canClaimKo: false`, `rawQaMarkdownRetained: false`, `rowNotesRetained: false`, mode `0600`, and reports all platform templates as pending (`27/27`, `10/10`, and `10/10` rows still `NT`).

Most recent focused rerun after adding the KO next-action refresh path passed `node --check scripts/ko-next-action-summary.mjs`, `node --check scripts/smoke-web.mjs`, `npm run ko:next -- --refresh`, a wrapped missing-value negative check for `npm run ko:next -- --status`, `npm run smoke`, and `git diff --check`. The refresh path uses the existing KO validator with `--allow-missing`, keeps `canClaimKo: false` while evidence is missing, and only prevents stale local status summaries.

Most recent rerun on 2026-06-15 covered the HarmonyOS visible scaffold, focused browser bilingual runtime, full browser runtime, source-resume, text-fragment, controlled agent-loop, external-source harness self-test, privacy-review contract self-test, and top-level KO gate self-test slices with `node --check` gates, `npm run smoke`, `npm run smoke:harmony`, `npm run smoke:bilingual-browser`, `npm run smoke:browser`, `npm run smoke:source-resume`, `npm run smoke:text-fragment`, `npm run agent:study-loop`, `npm run external:validate:selftest`, `npm run external:privacy-review:selftest`, `npm run ko:validate:selftest`, `npm run check:morning`, and `git diff --check`.

After tightening the KO gate to include platform QA receipts, the focused rerun passed `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `node scripts/validate-ko-evidence.mjs --allow-missing --external .codex-tmp/external-source-privacy-review-selftest/20260615T100006Z/claim.json --out .codex-tmp/ko-evidence/reject-old-selftest-claim.json`, `npm run smoke`, and `git diff --check`.

## Not Run

- Swift build/native Mac GUI manual QA were not run.
- Local dev server and build commands were not run.
- Real approved external reading/video screenshot validation was not run because exact approved non-private source URLs were not provided in the current turn.
- Real Windows static/manual QA and HarmonyOS device/toolchain QA were not run; their receipts remain pending `NT`.
- External systems, remote branches, permissions, and production targets were not written.

## Next Best Action

1. Get exact approved reading and video source URLs plus the intended video timestamp, then run `npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --approval-note "<current-turn approval>"`.
2. Generate and fill the privacy review with `npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>`, then validate it with `npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>`.
3. Generate the non-claiming platform execution handoff with `npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json`, then fill and validate native Mac manual QA, Windows static/manual QA, and HarmonyOS device/toolchain QA receipts from real runs.
4. Run the top-level gate with `npm run ko:validate -- --external <ko-evidence-review.json> --out .codex-tmp/ko-evidence/final.json` only after the external artifact and all three platform receipts pass.
