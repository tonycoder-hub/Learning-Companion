# Learning Companion TODO / Handoff

Updated: 2026-06-23

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

The generated QA receipt bilingual slice is locally verified:

- `scripts/build-morning-demo.mjs`: generated `MAC_MANUAL_QA.md`, `WINDOWS_STATIC_QA.md`, and `HARMONY_DEVICE_QA.md` now include adjacent Chinese titles, stage/evidence boundaries, fill instructions, section aliases, preconditions, notes, validation commands, claim-gate guidance, and detailed row-level Chinese intent guides while preserving English validator field keys, English Test Matrix tables, and result tokens.
- `scripts/validate-morning-receipts.mjs`: receipt assertions now guard Chinese shell-copy and row-guide anchors for the three generated QA receipts while keeping pending rows all `NT`.
- `scripts/static-return-loop-check.mjs`: static-return validation now accepts bilingual generated mirror headings and still checks English contract anchors, Chinese heading aliases, relative return links, local-file boundaries, and no external script/style behavior.

The export-panel/document-export shell-copy slice is locally verified:

- `apps/companion-web/index.html`: export panel static headings and notes now have stable IDs for language-aware rendering.
- `apps/companion-web/src/app.js`: export panel section titles, local-backup boundary text, workspace JSON disclosure, copy/save buttons, copy/save/download/failure toasts, workspace backup completion notices, and mirror handoff Activity copy now render in English or Chinese without changing export filenames, schema names, generated document contents, or mirror handoff kind values.
- `scripts/smoke-web.mjs`: source-level smoke assertions guard Chinese export anchors and prevent the copy handlers from regressing to hard-coded English-only messages.

The native Mac shell-copy slice is locally verified at source/string level:

- `apps/companion-mac/Sources/LearningCompanionMac/main.swift`: core AppKit menus, capture status labels, import/export/open-review panel titles, save-panel titles, native alerts, and missing-web-root guidance now use `nativeText(en, zh)` from the system preferred language.
- `scripts/smoke-web.mjs`: source-level smoke assertions guard Chinese native shell anchors and native save-bridge anchors while preserving hotkeys, suggested filenames, and bridge mechanics.

The HarmonyOS visible scaffold bilingual slice is locally verified at source/string level:

- `apps/companion-harmony-dev/entry/src/main/ets/pages/Index.ets`, `TopicDetail.ets`, `ReviewQueue.ets`, and `ImportReceipt.ets`: visible page headings, stats, empty states, import receipt copy, and manual-return guidance now use adjacent English / Chinese copy.
- `apps/companion-harmony-dev/entry/src/main/ets/model/harmonyReaderView.ets`, `services/exportPatch.ets`, `services/importPortableData.ets`, and `resources/base/element/string.json`: reader fallback copy, return-to-Mac export contract text, picker contract/limitation copy, and resource descriptions now include Chinese alongside English.
- `scripts/smoke-harmony-scaffold.mjs`: source-level assertions cover Chinese visible-page, picker-contract, resource-description, and return-contract anchors while preserving schema/route boundaries.

The browser-executed bilingual runtime slice is locally verified and now includes the main web study shell:

- `apps/companion-web/src/app.js`: document title, sidebar/search chrome, import/export workspace actions, storage/update/import receipt buttons, landmark aria labels, synthesis shell controls, and search/capture/synthesis placeholders now respond to the active UI language.
- `apps/companion-web/src/app.js`: Chinese-mode new-session creation now generates `新建学习主题`, and default-title source paste still recognizes both English and Chinese generated defaults as replaceable.
- `apps/companion-web/src/app.js`: the edited Synthesis draft overwrite confirmation now uses Chinese copy in Chinese mode.
- `apps/companion-web/src/app.js`: mirror bundle import replacement confirmation now uses Chinese copy in Chinese mode and keeps the cancel path unchanged.
- `apps/companion-web/src/app.js`: source strip labels, material type options, focus-mode buttons, inspector tabs, Quick Capture shell, Notes actions, Today stats/map/sections/Learning Flow/Study Details/Question Queue Health, Review toolbar/card controls, returned-work nudges, import receipt dismissal, return-file preview title/details/actions, and export/import runtime copy now respond to the active UI language.
- `apps/companion-web/src/app.js`: the same slice now also covers main-loop capture feedback, Activity next-step hints, Recent Stack, Captures details, Search results, source/time adjustment feedback, and note/review/delete actions.
- `scripts/smoke-bilingual-runtime-browser.mjs`: headless Chromium switches English / Chinese mode and exercises the static shell chrome, Chinese-mode new-session default title, Synthesis overwrite confirmation, mirror bundle import confirmation/cancel path, main study shell, a real quote-only capture in Chinese mode, Activity hint, Recent Stack, Captures details, Search results, Today Learning Flow, Study Details drawer, Review toolbar, Export panel, mobile inbox import receipt, Returned Work nudge, return-file preview, and desktop overflow check. It writes `.codex-tmp/bilingual-browser-smoke/receipt.json`.
- `scripts/validate-ko-evidence.mjs`: the bilingual runtime receipt must now include `staticShellChromeZh`, `staticShellChromeEnAfterSwitch`, `newSessionDefaultZh`, `synthesisOverwriteConfirmZh`, `mirrorImportConfirmZh`, `studyShellZh`, `studyShellEnAfterSwitch`, `todayLearningFlowZh`, `reviewToolbarZh`, `mainLoopCaptureZh`, `recentStackZh`, `searchResultsZh`, and `activityHintZh` before the top-level KO gate can ever pass.

The full browser runtime slice is locally verified again:

- `scripts/smoke-browser.mjs`: browser discovery now uses `CHROME_PATH`, Linux Chromium/Chrome paths, or macOS Chrome instead of a hard-coded macOS path, so the full browser smoke runs in the current Chromium environment.
- `scripts/smoke-browser.mjs`: static mirror, file-backed mirror navigation, Review/Inbox return-file runtime branches, mobile layout checks, patch import receipts, and negative import cases were updated to accept the current bilingual static-page copy while preserving schema/file/route assertions.
- `scripts/smoke-web.mjs`: source-level guards now prevent the full browser smoke from regressing to a single hard-coded macOS Chrome path.

The source-resume and controlled-loop browser evidence scripts are locally verified again:

- `scripts/smoke-source-resume.mjs`: runs in local Chromium and verifies saved-capture source resume, text-fragment source jumps, and video timestamp resume URLs.
- `scripts/smoke-text-fragment-browser.mjs`: runs in local Chromium and verifies browser text-fragment scrolling on a generated source page.
- `scripts/agent-study-loop-check.mjs`: runs in local Chromium and writes `.codex-tmp/agent-study-loop-smoke/receipt.json` for the controlled sidecar/capture/question/answer/notes loop.
- `scripts/smoke-web.mjs`: source-level guards now prevent these scripts from regressing to a single hard-coded macOS Chrome path.

The external-source validation harness is locally self-tested:

- `scripts/external-source-validation-browser.mjs`: requires `--approved-current-turn`, `--reading-url`, `--video-url`, and `--approval-note` for approved real-source candidate runs.
- `scripts/external-source-validation-browser.mjs` and `scripts/ko-next-action-summary.mjs`: source URL help now explains in English and Chinese that URL means a public learning-material webpage link, and shows the shortest user input shape `阅读：https://... / 视频：https://... / 时间：00:15`.
- `scripts/external-source-validation-browser.mjs`: `--source-intake` mode now parses that pasted input shape without launching Chromium, rejects invalid/private/sensitive URLs via the same approved-source checks, normalizes the timestamp, and prints the next public dry-run and approved-candidate commands without creating KO evidence. With `--out`, it also writes a `learning-companion.external-source-intake-handoff.v1` JSON handoff with `SOURCE_INTAKE_HANDOFF_ONLY`, `canClaimExternalKo: false`, normalized URL/timestamp fields only, next commands, approval requirements, privacy checklist, and an explicit no-browser/no-screenshot/no-approval boundary.
- `scripts/external-source-validation-browser.mjs`: `--approval-request` mode reads either a source-intake handoff or a `PUBLIC_SOURCE_DRY_RUN` receipt and writes a non-claiming `learning-companion.external-source-approval-request.v1` JSON/Markdown packet with the exact approval text needed from the user, plus the approved-candidate command to run only after that approval appears in the current turn. It uses `SOURCE_APPROVAL_REQUEST_ONLY`, keeps `canClaimExternalKo: false`, and does not launch a browser, grant approval, capture screenshots, or run privacy review.
- `scripts/external-source-validation-browser.mjs`: also supports `--public-source-dry-run` with public `--reading-url`, `--video-url`, `--video-timestamp`, and `--dry-run-note` so real public sources can be preflighted before approval without becoming KO evidence. Dry-runs now reject browser network error pages and pages with too little visible content, and the privacy-template command rejects them.
- Real video candidate runs also require `--video-timestamp`, keeping timestamp/resume evidence mandatory for the harness path.
- `npm run external:validate:selftest`: uses generated local reading/video fixtures to verify screenshot capture, source resume, receipt generation, and the `canClaimExternalKo: false` claim boundary.
- `scripts/validate-external-source-privacy-review.mjs`: generates a human privacy-review template and validates completed reviews into a derived `APPROVED_SOURCE_PRIVACY_REVIEWED` artifact only for real approved-source candidate receipts. It refuses local fixture self-tests, privacy-review self-test artifact paths, and requires screenshot review PASS, source approval confirmation, source-context preservation, video timestamp evidence, non-placeholder reviewer / approval reference / notes, and an ISO `reviewedAt` date-time with timezone. Its self-test writes a fixture-only summary with `canClaimExternalKo: false`, not a claim-shaped KO artifact.
- `docs/external-source-validation.md`: documents the self-test, the real approved-source command, privacy-review template generation, and privacy-review validation. The self-test cannot fill the approved external reading/video evidence rows.
- `scripts/external-source-validation-browser.mjs`: writes `runContext` into candidate receipts and `run.md`, including app URL/root, git HEAD, dirty-worktree status, git-status summary, throwaway browser profile, viewport sizes, and local/remote network mode.
- `scripts/external-source-validation-browser.mjs`: removes the throwaway Chromium profile after capture and records `profileRetained: false` plus cleanup status in `runContext`.
- `scripts/validate-external-source-privacy-review.mjs` and `scripts/validate-ko-evidence.mjs`: reject external-source KO artifacts that do not carry the run context, and now require app revision, run-context review, and browser-profile cleanup proof. Their self-tests include retained-profile and cleanup-failed negative claim fixtures.
- The real-source harness, privacy-review validator, and KO gate now reject localhost, private/link-local IPs, IPv4-mapped local IPv6 literals, single-label intranet hosts, reserved example domains, and exact normalized sensitive URL query keys, including common signed URL keys such as `X-Amz-Signature` and `X-Goog-Signature`, as approved external source URLs while allowing benign public query keys such as `keyword`. Local files require a separate explicit runbook and cannot become `APPROVED_SOURCE_CANDIDATE` through this harness; public dry-run receipts are also rejected by the privacy-review path.

The top-level KO evidence gate is locally self-tested:

- `scripts/validate-ko-evidence.mjs`: combines the bilingual browser runtime receipt, controlled learning-loop receipt, native Mac manual QA, Windows static/manual QA, HarmonyOS device/toolchain QA, and privacy-reviewed approved-source external evidence artifact into one KO status report.
- `scripts/ko-next-action-summary.mjs`: use `npm run ko:next -- --refresh` when resuming, so `.codex-tmp/ko-evidence/current-status.json` is regenerated from current local receipts with `--allow-missing` before the next-action summary is printed.
- `scripts/platform-qa-handoff.mjs`: reads the current KO status plus the generated Mac, Windows, and HarmonyOS QA templates and can write a `learning-companion.platform-qa-handoff.v1` JSON handoff plus a readable Markdown execution packet with `PLATFORM_QA_HANDOFF_ONLY`, `canClaimKo: false`, exact validation commands, required session-field names, row/result counts, and explicit no-platform-run boundaries. It does not retain raw QA Markdown or row Notes, run platform QA, or satisfy KO evidence.
- `.codex-tmp/platform-qa-handoff/current.md`: generated platform handoff Markdown is now the readable operator packet for real Mac/Windows/HarmonyOS QA execution. It lists missing KO requirements, required fields, commands, non-substitute evidence sources, row areas, and final gate commands, but it is still a handoff only.
- `scripts/next-major-readiness.mjs`: writes a non-claiming `learning-companion.next-major-readiness.v1` JSON/Markdown readiness packet with `NEXT_MAJOR_READINESS_SUMMARY_ONLY` and `releaseActionAuthorized: false`. It refreshes the KO status when requested, summarizes current requirements and platform statuses, and lists exact next commands, but it does not run approved external-source validation, privacy review, platform QA, build, package, deployment, Mew-Test, main-site, remote acceptance, or authorize release. Its not-run boundary is unconditional because the packet summarizes readiness; it never becomes proof that release/build/deploy/platform work ran. `npm run smoke` includes a claimable KO fixture to verify this boundary stays present even when the packet reports `PRE_RELEASE_EVIDENCE_READY`.
- `scripts/next-major-operator-packet.mjs`: writes a non-claiming `learning-companion.next-major-operator-packet.v1` JSON/Markdown operator packet with `NEXT_MAJOR_OPERATOR_PACKET_ONLY` and `releaseActionAuthorized: false`. It can refresh the local KO status, readiness packet, and platform handoff, then combines them with the current source approval request into one lane-ordered execution packet. It does not grant current-turn source approval, run browser evidence, perform privacy review, run Mac/Windows/HarmonyOS QA, build, package, deploy, or satisfy KO evidence. `npm run smoke` includes a fixture CLI run to verify the operator packet remains non-claiming and writes `0600` outputs.
- `scripts/validate-ko-evidence.mjs`, `scripts/ko-next-action-summary.mjs`, and `scripts/platform-qa-handoff.mjs`: real platform QA receipt paths are now aligned. The handoff writes real-run commands to `.codex-tmp/mac-manual-qa/real-run-receipt.json`, `.codex-tmp/windows-static-qa/real-run-receipt.json`, and `.codex-tmp/harmony-device-qa/real-run-receipt.json`; `ko:next -- --refresh` and `ko:validate` auto-read those paths when present, falling back to pending smoke receipts only before real QA exists.
- External-source screenshots/run notes/source-intake handoffs, privacy-review templates/claims, top-level KO status/final JSON, and Mac/Windows/Harmony platform QA receipt JSON outputs are written as `0600` files after creating new parent directories with `0700`; existing outputs are chmodded to `0600` before overwrite, and path-valued CLI flags reject bare boolean use so missing paths do not turn into accidental output locations.
- External-source browser runs clean up their throwaway Chromium profile before the receipt is written. A real approved-source claim must retain the profile path in run context for review but prove the profile itself was not retained.
- The bilingual receipt requirement now includes static shell chrome, Chinese-mode new-session default, Synthesis overwrite confirmation, mirror bundle import confirmation, and expanded main-shell checks: `staticShellChromeZh`, `staticShellChromeEnAfterSwitch`, `newSessionDefaultZh`, `synthesisOverwriteConfirmZh`, `mirrorImportConfirmZh`, `studyShellZh`, `studyShellEnAfterSwitch`, `todayLearningFlowZh`, `reviewToolbarZh`, `mainLoopCaptureZh`, `recentStackZh`, `searchResultsZh`, and `activityHintZh`.
- `platformQaStatus` in the KO status report now classifies native Mac, Windows, and HarmonyOS receipts as `PENDING_NOT_RUN`, `PARTIAL_OR_BLOCKED_RUN`, `PASSING_REAL_RUN`, `INVALID`, or `INVALID_OR_INCOMPLETE`, with row counts, gate booleans, reviewer/environment fields, and blocking reasons.
- Platform QA validators and the top-level KO gate require every non-`NT` platform row to carry a concrete Notes evidence reference; `PASS`, `FAIL`, or `BLOCKED` rows with empty or placeholder Notes such as `TBD`, `N/A`, `none`, `no evidence`, `placeholder`, `todo`, or wrapped/decorated variants like `- todo: capture screenshot`, `1. todo: capture screenshot`, and `> todo: capture screenshot` are invalid rather than partially claimable.
- Platform QA validators and the top-level KO gate also require any receipt with filled platform rows to record an ISO Date/time with timezone, a concrete Reviewer, and a concrete platform environment field (`macOS version`, `Windows browser/device`, or `HarmonyOS device/build`). Pending all-`NT` receipts stay `PENDING_USER_GATE`; filled but non-claimable rows stay `PARTIAL_PLATFORM_QA`; only full expected all-PASS platform runs with passing gates, empty `errors`, and matching claim boundary can record `MANUAL_PLATFORM_QA`.
- `npm run ko:validate:selftest`: validates the positive gate shape in memory and negative cases for missing external evidence, fixture-only external evidence, missing external run context, pending platform evidence, platform rows without evidence Notes, platform rows with exact/decorated/numbered/blockquote placeholder evidence Notes, placeholder platform reviewer, relative platform Date/time, platform summary/row mismatches, truncated platform row sets, non-empty receipt errors, nonclaimable manual tiers, and platform-status classification.
- Current status report `.codex-tmp/ko-evidence/current-status.json` has `canClaimKo: false` because native Mac manual QA, Windows static/manual QA, HarmonyOS device/toolchain QA, and the real privacy-reviewed approved-source artifact are still missing or pending. The current platform statuses are all `PENDING_NOT_RUN`.
- Self-test artifacts under `.codex-tmp/external-source-privacy-review-selftest/` are rejected by the privacy-review validator before claim generation and by the KO gate if an old claim-shaped artifact is supplied.

Verification commands:

```bash
node --check scripts/build-morning-demo.mjs
node --check scripts/validate-morning-receipts.mjs
node --check scripts/static-return-loop-check.mjs
node --check apps/companion-web/src/model.js
node --check apps/companion-web/src/app.js
node --check scripts/smoke-web.mjs
node --check scripts/smoke-browser.mjs
node --check scripts/smoke-source-resume.mjs
node --check scripts/smoke-text-fragment-browser.mjs
node --check scripts/agent-study-loop-check.mjs
node --check scripts/external-source-validation-browser.mjs
node --check scripts/validate-external-source-privacy-review.mjs
node --check scripts/validate-ko-evidence.mjs
node --check scripts/platform-qa-handoff.mjs
node --check scripts/smoke-bilingual-runtime-browser.mjs
node --check scripts/smoke-harmony-scaffold.mjs
npm run demo:morning
npm run check:static-return
npm run morning:receipts
npm run mac:manual:validate:smoke
npm run windows:static:validate:smoke
npm run harmony:device:validate:smoke
# wrapped Mac/Windows/Harmony empty-Notes negative check
# wrapped Mac/Windows/Harmony evidence-Notes positive check
# wrapped Mac/Windows/Harmony decorated-placeholder-Notes negative check
# wrapped Mac/Windows/Harmony concrete-Notes positive check
npm run smoke
npm run smoke:harmony
npm run smoke:bilingual-browser
npm run smoke:browser
npm run smoke:source-resume
npm run smoke:text-fragment
npm run agent:study-loop
npm run external:validate:selftest
npm run external:privacy-review:selftest
npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json --markdown-out .codex-tmp/platform-qa-handoff/current.md
npm run ko:validate:selftest
node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json
node scripts/validate-ko-evidence.mjs --allow-missing --external .codex-tmp/external-source-privacy-review-selftest/20260615T100006Z/claim.json --out .codex-tmp/ko-evidence/reject-old-selftest-claim.json
npm run check:morning
git diff --check
```

All commands above passed across the latest local verification set. On 2026-06-15, the HarmonyOS visible scaffold, focused browser bilingual runtime, full browser runtime, source-resume, text-fragment, controlled agent-loop, external-source harness self-test, privacy-review contract self-test, and top-level KO gate self-test slices were rerun through the listed `node --check` gates, `npm run smoke`, `npm run smoke:harmony`, `npm run smoke:bilingual-browser`, `npm run smoke:browser`, `npm run smoke:source-resume`, `npm run smoke:text-fragment`, `npm run agent:study-loop`, `npm run external:validate:selftest`, `npm run external:privacy-review:selftest`, `npm run ko:validate:selftest`, `npm run check:morning`, and `git diff --check`. `npm run check:morning` completed with `morning_offline_check_ok`. Swift build/native Mac GUI manual QA, local dev server startup, and real approved external source screenshot validation were not run.

After the KO gate was tightened to require platform QA receipts, the focused rerun passed `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `node scripts/validate-ko-evidence.mjs --allow-missing --external .codex-tmp/external-source-privacy-review-selftest/20260615T100006Z/claim.json --out .codex-tmp/ko-evidence/reject-old-selftest-claim.json`, `npm run smoke`, and `git diff --check`.

After the main-loop bilingual browser expansion, the focused rerun passed `node --check apps/companion-web/src/app.js`, `node --check scripts/smoke-bilingual-runtime-browser.mjs`, `node --check scripts/smoke-web.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `npm run smoke:bilingual-browser`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, and `git diff --check`. The refreshed KO status still has `canClaimKo: false`.

After the static shell chrome browser expansion, the focused rerun passed `node --check apps/companion-web/src/app.js`, `node --check scripts/smoke-bilingual-runtime-browser.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run smoke:bilingual-browser`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, and `npm run ko:next`. The refreshed KO status still has `canClaimKo: false`.

After the Chinese-mode new-session default update, the focused rerun passed `node --check apps/companion-web/src/app.js`, `node --check scripts/smoke-bilingual-runtime-browser.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run smoke:bilingual-browser`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The refreshed KO status still has `canClaimKo: false`.

After the Synthesis overwrite-confirm update, the focused rerun passed `node --check apps/companion-web/src/app.js`, `node --check scripts/smoke-bilingual-runtime-browser.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run smoke:bilingual-browser`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The refreshed KO status still has `canClaimKo: false`.

After the mirror bundle import-confirm update, the focused rerun passed `node --check apps/companion-web/src/app.js`, `node --check scripts/smoke-bilingual-runtime-browser.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run smoke:bilingual-browser`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The refreshed KO status still has `canClaimKo: false`.

After the approved source input-intake update, the focused rerun passed `node --check scripts/external-source-validation-browser.mjs`, `node --check scripts/ko-next-action-summary.mjs`, `node --check scripts/smoke-web.mjs`, `npm run external:source-intake -- --input <valid reading/video/time block>`, a wrapped private-URL rejection check for `npm run external:source-intake`, `npm run external:source-help`, `npm run ko:next`, `npm run smoke`, and `npm run external:validate:selftest`. The refreshed KO status still has `canClaimKo: false`; this was an input-validation slice, not approved-source evidence.

After the platform QA status summary update, the focused rerun passed `node --check scripts/validate-ko-evidence.mjs`, `npm run ko:validate:selftest`, and `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`. The refreshed KO status still has `canClaimKo: false`, with native Mac, Windows, and HarmonyOS receipts classified as `PENDING_NOT_RUN`.

After the external-source run-context update, the focused rerun passed `node --check scripts/external-source-validation-browser.mjs`, `node --check scripts/validate-external-source-privacy-review.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run external:validate:selftest`, `npm run external:privacy-review:selftest`, `npm run ko:validate:selftest`, `npm run smoke`, and `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`. The refreshed KO status still has `canClaimKo: false`.

After the approved-source URL boundary update, the focused rerun passed `node --check scripts/external-source-validation-browser.mjs`, `node --check scripts/validate-external-source-privacy-review.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run external:validate:selftest`, `npm run external:privacy-review:selftest`, `npm run ko:validate:selftest`, `npm run smoke`, and `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`. The refreshed KO status still has `canClaimKo: false`.

After the human privacy-review field hardening update, the focused rerun passed `node --check scripts/validate-external-source-privacy-review.mjs`, `node --check scripts/smoke-web.mjs`, `npm run external:privacy-review:selftest`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The refreshed KO status still has `canClaimKo: false`.

After the privacy-review self-test artifact path hardening update, the focused rerun passed `node --check scripts/validate-external-source-privacy-review.mjs`, `node --check scripts/smoke-web.mjs`, `npm run external:privacy-review:selftest`, `npm run smoke`, `npm run ko:validate:selftest`, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The refreshed KO status still has `canClaimKo: false`.

After the platform QA row-evidence hardening update, the focused rerun passed `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `node --check scripts/validate-mac-manual-qa.mjs`, `node --check scripts/validate-windows-static-qa.mjs`, `node --check scripts/validate-harmony-device-qa.mjs`, `node --check scripts/build-morning-demo.mjs`, `node --check scripts/validate-morning-receipts.mjs`, `npm run ko:validate:selftest`, `npm run smoke`, `npm run mac:manual:validate:smoke`, `npm run windows:static:validate:smoke`, `npm run harmony:device:validate:smoke`, the wrapped empty-Notes negative check, the wrapped evidence-Notes positive check, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, and `npm run ko:next`. The refreshed KO status still has `canClaimKo: false`.

After the placeholder platform QA Notes hardening update, the focused rerun passed `node --check scripts/validate-mac-manual-qa.mjs`, `node --check scripts/validate-windows-static-qa.mjs`, `node --check scripts/validate-harmony-device-qa.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/smoke-web.mjs`, `npm run ko:validate:selftest`, `npm run smoke`, `npm run mac:manual:validate:smoke`, `npm run windows:static:validate:smoke`, `npm run harmony:device:validate:smoke`, the wrapped `- todo: capture screenshot` Notes negative check, the numbered `1. todo: capture screenshot` Notes negative check, the blockquote `> todo: capture screenshot` Notes negative check, the wrapped concrete Notes positive check, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The KO self-test covers Mac, Windows, and Harmony placeholder receipt paths. The refreshed KO status still has `canClaimKo: false`.

After the platform QA session-field hardening update, the focused rerun passed `node --check scripts/validate-mac-manual-qa.mjs`, `node --check scripts/validate-windows-static-qa.mjs`, `node --check scripts/validate-harmony-device-qa.mjs`, `node --check scripts/validate-ko-evidence.mjs`, `node --check scripts/build-morning-demo.mjs`, `node --check scripts/smoke-web.mjs`, `npm run smoke`, `npm run ko:validate:selftest`, `npm run mac:manual:validate:smoke`, `npm run windows:static:validate:smoke`, `npm run harmony:device:validate:smoke`, the wrapped platform QA session-field runtime checks, `node scripts/validate-ko-evidence.mjs --allow-missing --out .codex-tmp/ko-evidence/current-status.json`, `npm run ko:next`, and `git diff --check`. The KO gate now derives row counts and claimability from the expected platform row matrix instead of trusting hand-edited summary or claim booleans. The refreshed KO status still has `canClaimKo: false`.

## Next Entry Point

Continue with external source validation and the remaining platform proof. Review/Inbox runtime return-loop copy, generated `TODAY.md` / Review Pack shell copy, per-session Markdown, synthesis drafts, mirror `README.md`, import/return receipt display copy, QA receipt guidance, export-panel shell copy, native Mac shell copy, HarmonyOS visible scaffold copy, main web shell / Today / Review / Recent Stack / Search browser runtime switching, the broader browser runtime smoke, source resume, text-fragment source jumps, the controlled agent loop, external-source harness self-test, privacy-review contract self-test, and top-level KO gate self-test all have local coverage.
The KO gate is ready for a real approved-source artifact, but the next true KO blocker is still real approved external reading/video screenshot validation plus a filled human privacy review. The remaining platform-surface evidence gaps are Windows static/manual proof, HarmonyOS device/toolchain proof, and native Mac runtime/manual proof.
The KO gate now enforces those platform gaps directly; a future external-source artifact alone cannot make `canClaimKo: true`. Use `platformQaStatus` in `.codex-tmp/ko-evidence/current-status.json` or `npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json --markdown-out .codex-tmp/platform-qa-handoff/current.md` to tell whether each platform receipt is still not run, partially filled/blocked, invalid, or claimable after real QA.

Goal paused note on 2026-06-11:

- User paused the active goal after checkpoint `91371f1 feat: add bilingual generated artifact shells`.
- Worktree was clean except the pre-existing untracked `?? {` before this pause note was written; leave that file untouched unless the user explicitly asks.
- No subagents are left running from the latest generated-artifact slice.
- Resume by choosing either: provide approved non-private reading/video URLs for external-source validation, or continue remaining platform evidence for Windows static/manual proof, HarmonyOS device/toolchain proof, and native Mac runtime/manual proof.
- Do not claim full bilingual support until Windows static/manual proof, HarmonyOS device/toolchain proof, native Mac runtime/manual proof, and external source validation are covered or explicitly marked out of scope.
- For `.21` / Mew continuation, use [Mew Handoff](../mew-handoff.md) as the sync and entry-point checklist.

## User Priorities

1. Make the product bilingual at minimum: English and Chinese should be first-class surfaces, not a partial demo label swap.
2. During validation, actively use approved external reading/video material and capture screenshots to prove the app can work while the user is reading a document or watching a video.

## Immediate TODO

- Run `npm run ko:next -- --refresh` first to regenerate the current pass/missing evidence summary from local receipts and print next commands.
- In this context, `URL` means the public learning-material link. 中文：URL 就是网页链接。Needed inputs are one approved reading material link, one approved video material link, and the video timestamp to capture. The shortest user input shape is `阅读：https://... / 视频：https://... / 时间：00:15`.
- Run `npm run external:source-help` when the expected source-link inputs need to be shown plainly.
- Run `npm run external:source-intake -- --input "阅读：https://... 视频：https://... 时间：00:15"` to validate a pasted source-input block and print the next exact dry-run / approved-candidate commands before launching browser evidence.
- Add `--out .codex-tmp/external-source-validation/source-intake-handoff.json` to keep a handoff-only JSON for the next approved run; this is not KO evidence and cannot replace screenshots or privacy review.
- Run `npm run external:approval-request -- --intake-handoff .codex-tmp/external-source-validation/source-intake-handoff.json --out .codex-tmp/external-source-validation/source-approval-request.json --markdown-out .codex-tmp/external-source-validation/source-approval-request.md` to produce the exact approval text to request from the user before any approved-source candidate run.
- Current-head non-claiming preflight was refreshed at `.codex-tmp/external-source-validation/20260622T210546Z-public-source-dry-run/receipt.json` using `https://en.wikipedia.org/wiki/Spaced_repetition`, `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4`, and timestamp `00:03`; it removed the throwaway browser profile after capture and cannot be privacy-reviewed into KO evidence.
- Capture one approved reading-source screenshot run and one approved video-source screenshot run using `npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --approval-note "<current-turn approval>"` once exact approved URLs are available.
- Before exact approval is available, use `npm run external:validate:public-dry-run -- --reading-url <public-reading-url> --video-url <public-video-url> --video-timestamp <observed-timestamp> --dry-run-note "<pre-approval source preflight>"` to verify real public material mechanics without creating KO evidence.
- Approved URLs for that command must be public, non-private http(s) URLs, not localhost, private IP, IPv4-mapped local IPv6 literals, single-label intranet hosts, reserved example domains, or URLs with exact sensitive query keys.
- Generate and fill the privacy review with `npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>`, then validate it with `npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>`. The review must confirm `runContextReviewed` and `appRevisionRecorded`, use an ISO `reviewedAt` date-time with timezone, and replace reviewer / approval reference / notes placeholders with concrete review evidence.
- Generate the platform execution handoff with `npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json --markdown-out .codex-tmp/platform-qa-handoff/current.md`; this only summarizes pending Mac/Windows/HarmonyOS real-run work and cannot satisfy KO evidence.
- Generate the consolidated readiness packet with `npm run next:readiness -- --refresh --out .codex-tmp/next-major-readiness/current.json --markdown-out .codex-tmp/next-major-readiness/current.md`; this only snapshots current missing evidence and commands for handoff/review.
- Generate the single operator packet with `npm run next:operator -- --refresh --out .codex-tmp/next-major-operator/current.json --markdown-out .codex-tmp/next-major-operator/current.md`; this combines source approval, platform QA, readiness, and final gate lanes for the next human/device execution pass.
- Fill and validate native Mac manual QA, Windows static/manual QA, and HarmonyOS device/toolchain QA from real runs. Every non-`NT` row must include a concrete Notes evidence reference such as screenshot path, command output path, observed device/browser state, returned JSON path, or blocker; placeholder Notes such as `TBD`, `N/A`, `none`, `no evidence`, `placeholder`, `todo`, and decorated/numbered/blockquote placeholder variants are rejected.
- Run `npm run ko:validate -- --external <ko-evidence-review.json> --out .codex-tmp/ko-evidence/final.json` only after the privacy-reviewed external evidence artifact and all three platform receipts pass. The default gate auto-selects real-run platform receipts when they exist; use explicit `--mac-manual`, `--windows-static`, and `--harmony-device` only for nonstandard receipt paths.
- Optionally add more explicit Chinese-mode assertions inside the full browser smoke; the focused Export/import/Returned Work/return-preview smoke already exercises active language switching.
- Treat `npm run agent:study-loop`, `npm run smoke:source-resume`, `npm run smoke:text-fragment`, `npm run external:validate:selftest`, `npm run external:privacy-review:selftest`, and `npm run ko:validate:selftest` as controlled/local prerequisites only; they cannot fill the approved external reading/video evidence rows.
- Keep the coverage boundary honest: do not claim full bilingual support until Windows/HarmonyOS device/static proof, native Mac runtime/manual proof, and external source validation are covered or explicitly marked out of scope.
- External validation evidence should record:
  - approved source URL and title,
  - source type: reading or video,
  - video timestamp when relevant,
  - viewport and sidecar/full-desk state,
  - screenshot showing source beside the app during capture,
  - screenshot showing resume context after saving,
  - run context: app git HEAD, dirty-worktree status, viewport, throwaway browser profile, network mode,
  - throwaway browser profile cleanup status,
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

- External source validation needs exact approved public or user-provided non-private reading/video URLs before screenshots are captured.
- Persistent local dev server startup or video-page automation should be authorized in the current turn before running.
- Swift build/native Mac GUI manual QA were not run for the native shell-copy slice.
