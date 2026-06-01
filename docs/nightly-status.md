# Nightly Status

## Current Branch

```text
product/mvp-learning-sidecar
```

## Stage Wording

Use [promotion-gates.md](promotion-gates.md) to distinguish local fixtures, dry-runs, schema prototypes, internal builds, and live integrations. Current Feishu work is local plan/dry-run, HarmonyOS work is a schema reader prototype, and the Mac shell is an internal build.

## What Works

- Local web MVP runs without installing dependencies.
- Installable web shell metadata and online-first service worker with cached offline fallback.
- Minimal macOS WKWebView shell scaffold builds with SwiftPM.
- Mac shell has an app-focused clipboard-to-capture menu command.
- Mac shell can save selected text directly as a capture with `Ctrl+Option+Cmd+X` when macOS Accessibility access and the frontmost app expose `AXSelectedText`, with a labeled clipboard fallback only when the clipboard has changed since the last native capture.
- Mac shell can save clipboard text directly as a capture with `Ctrl+Option+Cmd+C` via a best-effort global hotkey, with registration status visible in the Capture menu.
- Mac shell hotkey capture can attach active Safari/Chromium-family page title and URL when macOS automation access is available, then route through the same source-aware matching path as bookmarklet captures.
- Mac shell has app-focused workspace JSON import/export menu commands (`Cmd+O`, `Shift+Cmd+E`) that reuse the web import bridge, including append-only mobile inbox and review progress patches.
- Mac shell can open the generated morning review dashboard (`dist/morning-demo/review-start-here.html`) from `File > Open Morning Review Pack`.
- Mac shell has native sidecar window commands: enter a narrow right-side panel (`Option+Cmd+]`), restore the desk (`Option+Cmd+[`), and manually keep the window above others.
- Credential-free Feishu uploader boundary can validate a mirror bundle, build an upload plan, materialize the Drive folder locally, and emit a dry-run upload report without reading live credentials.
- Feishu dry-run report records a no-network `wouldSend` envelope and target tree with virtual upsert paths, folder hierarchy, byte counts, and payload SHA-256 hashes.
- Morning review pack now emits `EVIDENCE_TIERS.json` and visible `EVIDENCE:` badges so dry-run, handoff-only, and user-gated artifacts are not mistaken for live readiness.
- Morning receipt contract validator checks generated JSON receipts for schema names, evidence tiers, and critical booleans before the offline gate passes.
- Adversarial gate report proves determinism and mirror-integrity checks fail on deliberately corrupted fixtures.
- Capture-to-resume receipt proves three synthetic browser captures written through `addCapture` appear in the generated Today resume pack and move Focus Brief to synthesis without requiring GUI permissions.
- Patch intake negative receipt proves malformed JSON, unsupported patch schemas, oversized inbox/review patches, duplicate review patches, and stale review conflicts fail safely without credentials.
- Mirror integrity report walks the generated static mirror and checks every internal HTML/Markdown link before the morning pack is accepted.
- Morning determinism report runs the generator twice in isolated temp directories and compares output bytes.
- Deferred gates manifest lists the approval/device/signing/live-write checks that are intentionally not proven by green offline gates.
- Performance budget report times the morning generator in an isolated output directory, checks file-count/byte-size limits, and has a self-test proving violations fail.
- HarmonyOS preparation has a credential-free schema reader prototype that turns workspace JSON or mirror bundles into a read-only phone view model, including open-question backlog counts and resolved-question status.
- HarmonyOS handoff now includes a DevEco/ArkTS scaffold directory plus a pure import/patch boundary module covered by `smoke:harmony`; it is structure/schema-parity checked, not SDK-compiled. The scaffold next-action contract matches the web Focus Brief shape, including `open_source`, detail, reason, and open-question counts for phone-side resume decisions.
- Three-pane learning sidecar for Mac/browser workflow.
- Sidecar layout toggle that collapses navigation and inspector around the active session.
- Desk activity strip that keeps draft/save/review/synthesis feedback visible in focused sidecar mode.
- Deterministic Focus Brief in the desk with next action, visible reason, fresh capture-draft resume when review is not due, latest capture, source, workspace-review fallback, synthesis freshness signals, and sidecar-safe visibility.
- Workspace Find is deterministic local find over source titles, notes, captures, tags, and review cards, supports multi-term matches within the same candidate object, then jumps back to the matching session and surface.
- Today tab includes capture drafts, Return Files counts, latest import receipt, direct import/export handoff actions, and a device-labeled manual return path for phone/Windows JSON files. The Return Files export action opens the Mirror Folder controls, and mirror saves record a handoff receipt.
- Today tab now has a returning-user Next Move card above the denser sections, so due review, capture drafts, open questions, parked questions, recent captures, or capture setup get one visible primary action.
- Sessions, clickable capture destination context, capture intent context, source context, timestamp, tags, and source-open jumps that honor a valid typed video time, extract supported YouTube/Bilibili/Vimeo time-link parameters into the local capture timestamp, and otherwise resume from the latest captured timestamp.
- Capture-level source snapshots with source/time jump links.
- Quick capture quote/thought with per-session draft persistence, visible draft status, Today resume, and a clear-draft action.
- Quick Capture keeps a Recent Stack in the main desk so sidecar mode still shows the latest captures plus Open, Note, Review/Card, confirmed Delete, and one-step `Undo 10s` for capture deletion without reopening the inspector; delete confirmation names the capture and linked-card count, and unrelated revealed review cards stay revealed.
- Captured question-thoughts are surfaced as Focus Brief signals and Recent Stack chips, then carried into synthesis as Open Questions.
- Today and `TODAY.md` include an Open Questions backlog across sessions so handoff does not hide unresolved study questions inside recent captures.
- Today and `TODAY.md` include Question Queue Health, making active, parked, and total unresolved question counts visible before the user chooses the next study action.
- Today Open Questions can create review cards directly while selecting the correct source session.
- Today Open Questions can be parked and resumed, keeping unresolved low-priority follow-up out of the active focus queue without losing the original capture.
- Captured questions can be marked resolved or reopened, and resolved questions stop counting in Focus Brief, synthesis, Today, HarmonyOS reader backlog, and handoff exports without losing the original capture.
- Local Quick Capture Answer drafts opened from a question preserve `answersQuestionCaptureId`; sufficiently detailed local answers close the original question, while weak answers such as `Answer: ok` stay non-closing drafts.
- One-click capture insertion into Notes with idempotent capture blocks.
- Confirmed delete for mistaken captures and review cards.
- Synthesis draft generation from captures into notes, with stale-source warning and idempotent insertion.
- Capture-to-review-card promotion.
- Cloze review card authoring from selected quote text.
- Workspace-wide due review queue with simple strength buckets.
- Self-graded Again/Good review outcomes with isolated scheduling policy.
- Review answers are reveal-gated before grading.
- Desk-native review pane works in focused sidecar layout.
- Today tab summarizes workspace due review and recent captures.
- Static mirror `index.html` provides a portable folder home page for Today, Review, Restore, and sessions.
- Today and mirror exports include a Resume Here / Focus Brief section for mobile, Windows, and Feishu handoff, with source links resuming at the latest captured timestamp when available; mirror `index.html` also previews open questions before the recent-capture list.
- Static mirror `review.html` supports due-card review on mobile/Windows and exports append-only review progress patch JSON.
- Static mirror `inbox.html` supports phone/Windows capture drafts and exports append-only mobile inbox patch JSON.
- Static mirror answer links carry `answersQuestionCaptureId`; importing that answer patch can resolve the original same-topic question while preserving the new answer capture.
- Mobile inbox patch import appends captures with patch/capture id dedupe, target-resolution fallback, unsafe URL stripping with receipt counts, and a visible import receipt.
- Review progress patch import applies Again/Good events only when the card version still matches, and reports duplicates, missing cards, stale conflicts, and invalid events.
- Import failures leave a visible issue receipt for bad mirror payloads, malformed JSON, and oversized patch files, so return-path problems remain inspectable after the toast fades.
- Markdown notes editor with autosave.
- Safe read-mode preview for notes.
- Safe formatting preview for capture thoughts and review answers.
- Markdown + JSON export for the active session.
- Export panel exposes full workspace copy/save with a collapsed JSON disclosure next to session, Today, mirror, ZIP, and bookmarklet outputs; browser Save prefers `showSaveFilePicker()` when available, Mac shell text saves route through native NSSavePanel, and unsupported/headless runtimes fall back to download.
- Storage notice prompts for a local workspace export after committed learning data changes, warns when the last matching export is older than seven days, and asks the user to verify the selected/downloaded JSON file rather than treating the click as durable backup proof.
- Copy/save `TODAY.md` directly from the Export panel.
- Credential-free Feishu mirror bundle with README, workspace restore payload, and per-session Markdown/JSON sidecars.
- Credential-free Feishu mirror ZIP containing the same readable folder files, including derived `index.html`, `TODAY.md`, `review.html`, and `inbox.html`.
- Import can restore either a raw workspace JSON, a Feishu mirror bundle, a mobile inbox patch, or a review progress patch from both the browser file input and Mac native import menu.
- Morning demo pack generator creates a fixture-only representative workspace, extracted mirror folder, ZIP, Feishu upload plan/local files/dry-run report, HarmonyOS reader view with open-question evidence, sample mobile inbox patch, sample review progress patch, `SOURCE_TIME_LINKS_RECEIPT.json`, `MORNING_REVIEW.md`, `STAGE.md`, `MAC_MANUAL_QA.md`, `HARMONY_DEVECO_HANDOFF.md`, and a provenance/hash `SUMMARY.json` with credential sweep results.
- Morning review dashboard self-labels as cross-end fixture-ready, includes a stage matrix, and enumerates what is not proven: live Feishu sync, real HarmonyOS behavior, Windows manual QA, off-Mac patch origination, and signed Mac packaging.
- `STAGE.md` includes named gates for Mac manual QA, Feishu live write, Harmony device, Windows manual run, Mac signing, and patch intake fixture status.
- Copyable browser capture bookmarklet from the Export tab, including active video time.
- Full workspace JSON import/export.
- Browser bookmarklet and URL inbound capture contract.
- Browser inbound capture now routes by normalized source URL before falling back to conservative title-only matching or the active topic, and switches the desk back to capture focus.
- Workspace schema contract in `docs/schema/workspace.v1.schema.json`.
- Browser smoke test verifies capture -> card -> localStorage -> UI metrics.
- Browser smoke also verifies installable/offline shell metadata, sidecar layout toggling, desk-level activity feedback, Focus Brief updates, Quick Capture Recent Stack visibility/actions/delete recovery, captured-question signals/resolve/reopen, Today Open Questions backlog/card promotion, Workspace Find jump-to-capture behavior, Today tab/direct Today export/full workspace export/mirror home/study pack/static review pack/static review-progress patch/static inbox page, desk-native review in sidecar layout, mobile-width no-overflow behavior, capture source snapshots/time links, capture-to-notes insertion, per-session capture draft restore/clear, confirmed capture/card deletion, mobile inbox patch import, review progress patch import/duplicate receipts, DOM-visible issue receipts for bad mirror/malformed JSON/oversized patch imports, mirror ZIP affordance, Cloze cards, workspace-wide due review, reveal-before-grade review flow, synthesis insertion, stale-draft handling, capture formatting, mirror bundle generation/import, generated bookmarklet execution on virtual video/document/empty-selection pages, inbound bookmarklet capture, and notes preview rendering.
- Browser smoke routes its own download artifacts to a private `$TMPDIR/lc-browser-smoke-*/downloads` path and cleans the smoke root after Chrome exits, with a startup janitor for stale smoke roots, so automated export checks do not keep filling Downloads with JSON.
- Browser smoke includes decoy-session inbound capture cases to prove bookmarklet clips do not get saved into the wrong active session when an existing source URL matches elsewhere, source fields are preserved on matched sessions, tracking/query-order noise still matches, title collisions with unrelated URLs do not misroute, and staged clips survive a routing-driven session switch.

## Run

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Verify

```bash
npm run smoke
npm run smoke:browser
npm run demo:morning
npm run mac:build
npm run check:morning
npm run check:morning:native
npm run check:morning:browser
```

`smoke:browser` uses local Chrome headless and a temporary profile.
`mac:build` uses local SwiftPM and does not package or sign an `.app` yet.
`demo:morning` writes a credential-free inspection pack to `dist/morning-demo/`.
`check:morning` is the offline headline gate: web smoke, HarmonyOS smoke, capture-resume receipt, source-time link receipt, patch-intake negative receipt, demo pack generation, receipt contracts, adversarial gate fixtures, determinism, mirror integrity, perf budget, perf self-test, and git status.
`check:morning:native` runs the Mac SwiftPM build separately because SwiftPM may need toolchain/cache access outside restricted sandboxes.
`check:morning:browser` runs the local browser UX smoke separately because it binds `127.0.0.1`.

Latest checks passed: JS syntax checks, `npm run smoke`, `npm run demo:morning`, `npm run check:morning`, `npm run check:morning:native`, `npm run mac:build`, and `npm run smoke:browser`. The browser gate was rerun after the Quick Capture intent, local Answer draft linkage, linked Answer readiness, smoke temp-download hygiene, save-picker export, and Mac-shell web save bridge work; it now covers capture destination/source/time/intent context, linked local answer save-and-close behavior, answer-draft readiness before closure, temporary download routing for automated export checks, picker-vs-fallback backup copy, the destination-locate action from sidecar layout, promoted stack labels, richer confirmation copy, canceling deletion, direct sidecar deletion, one-step capture restore, unrelated revealed-review preservation, the existing inspector delete path, and the earlier source-time parser/jump evidence without claiming live video-site playback QA. The Mac-shell bridge has SwiftPM build evidence, not manual NSSavePanel click-through QA.

## Review Notes Absorbed

Latest Mira status:

- A targeted Mira review for the capture-delete soft undo timed out at the SSH broker layer after roughly 630s (`error_code: TIMEOUT`, `error_stage: ssh`).
- No Mira verdict was available for that increment. The change is currently supported by local code review plus `npm run smoke`, `npm run smoke:browser`, `npm run check:morning`, and `git diff --check`.
- A targeted Mira review for the save-picker export boundary returned `SSH_FAILED` at the broker layer before review execution (`error_stage: ssh`, elapsed about 1s). No verdict was available, so the change is supported by local code review plus `npm run smoke`, `npm run smoke:browser`, and `git diff --check`.

Accepted from Mira:

- Harden URL inbound and reject unsafe schemes.
- Add schema/version contract.
- Add localStorage size and stale-backup warning/export prompt.
- Make the review loop real enough to test.
- Move user/page-sourced text away from `innerHTML`.
- Add browser-level smoke coverage.
- Add self-grading before pretending the review loop is real.
- Harden Synthesize with stale-source warning, edit overwrite confirmation, generated counts, and idempotent insertion.
- Treat Feishu mirror export as a staging bundle, with explicit canonical/derived authority and snapshot semantics.
- Keep the sidecar layout local-only, guard its keyboard shortcut inside editable fields, and keep a visible way back when panels are hidden.
- Add desk-level activity feedback so hidden inspector panels do not swallow the user's sense of what changed.
- Make the activity action explicit when it exits focus mode, use `aria-live`, and scroll/highlight the referenced capture or card where possible.
- Keep capture source snapshot fields optional in the v1 schema, add source provenance, and harden source jump URL handling.
- Move core review actions into the desk for sidecar focus, keep reveal state coherent across inspector/desk surfaces, and add keyboard grading shortcuts.
- Add a derived Today study pack from one pure builder, with explicit generated/window metadata, relative session links, and `workspace.json` as source of truth.
- Keep the Mac shell honest as a thin WKWebView wrapper: deterministic file origin, external-link handoff, and no silent localhost fallback.
- Add a Mac shell clipboard-to-capture command as a local, permission-free step toward native capture.
- Add Mac shell workspace import/export as permission-light local file commands, without introducing a second persistence format.
- Pin Focus Brief as a pure model-layer object, with deterministic next-action rules shared by desk UI and portable exports; add workspace-due fallback and synthesis-source freshness.
- Keep review progress patches conflict-aware: apply only against unchanged card versions, and skip stale events with a receipt instead of overwriting Mac-side review state.
- Add Workspace Find as a local-only jump surface, with result text rendered via `textContent`, capped queries, and read-only navigation into captures/review/notes.
- Keep the morning demo pack clearly fixture-only, with sample file names, provenance, per-file hashes, credential sweep results, and explicit "does not prove live sync/device behavior" boundaries.
- Make stage labels visible on the morning dashboard itself, not only in docs or commit history; every generated pack now includes `STAGE.md`.
- Put dry-run boundaries inside artifacts, including a Feishu upload report field stating that no network call was made.
- Route browser inbound captures by normalized source before using the active topic, preserving matched-session source fields so focus mistakes in the sidecar do not silently attach or rewrite the wrong learning material.

Deferred:

- Real Feishu OpenAPI sync. One-way export should come before sync.
- Native Mac shell beyond the thin wrapper: production packaging, permission onboarding, richer browser URL bridge beyond title/URL, multi-display sidecar polish, and packaged menu polish.
- AI-generated synthesis. The deterministic draft should prove the workflow before adding another model.
- Full timezone boundary matrix for Today pack; current implementation stamps the local day window and due cutoff, but browser/device cross-timezone behavior still deserves manual QA.
- Focus Brief's next-action ladder is intentionally simple; adaptive ranking and cross-session recommendations are deferred until real usage shows the current ladder is too blunt.
- Mobile inbox and review progress patches should be called Mac-import-verified, not HarmonyOS-verified, until a real phone roundtrip passes.
- Add broader negative-path demo-generator assertions, such as malformed JSON and oversized patch files; browser smoke already covers visible issue receipts for those cases, while the current demo generator covers duplicate inbox patches, stale review conflicts, unsafe URL stripping, and unsupported inbox patch schema rejection.
- Keep HarmonyOS import/patch boundary logic pure until DevEco is available; the current module is executable smoke evidence, not a native app. Open-question parity is schema-verified locally, not device-verified.

## Next Best Commits

1. Fill `dist/morning-demo/MAC_MANUAL_QA.md` with GUI/manual QA evidence for selected-text capture, browser context, Mac import, and relaunch on Tony's Mac.
2. Verify `apps/companion-harmony-dev/` in DevEco Studio once SDK/project setup is available; until then keep the schema reader honest as the executable prototype.
3. Manually test bookmarklet capture on YouTube, Feishu Docs, and developer docs; automated smoke now covers virtual video/document pages but not real-site CSP, popup, or DOM quirks.
4. Add real Feishu OpenAPI transport only behind explicit credential configuration and approval.

## Known Risks

- `localStorage` is still a temporary store; the app now prompts after committed learning data changes, but the user still needs to complete real file exports.
- Focus Brief workspace-review tie-break is now exposed as earliest due, then topic title; adaptive ranking is still deferred until real usage shows the simple queue is too blunt.
- Static `inbox.html` is designed for HarmonyOS/Windows manual capture, but real-device storage and download behavior are still unverified.
- Mobile inbox patch is still manual transport; it is not real sync and depends on the user importing the patch on Mac.
- Feishu uploader boundary is local-folder/plan only; it does not authenticate or write to Feishu Drive yet.
- Review progress patch is conflict-safe but still manual transport; real device review behavior is not HarmonyOS-verified.
- Workspace Find now supports multi-term cross-field matching, but larger workspaces will still need debounce/indexing and broader per-result navigation assertions.
- Bookmarklet behavior should be tested on YouTube, Feishu Docs, and common documentation sites.
- Safari/Firefox localStorage quota behavior is not verified.
- Offline fallback is generated and smoke-checked, but a full airplane-mode PWA relaunch is still manual QA.
- Today pack timezone behavior across Mac, HarmonyOS, and Windows is not manually verified yet; mobile-width layout is covered by smoke, not real-device touch QA.
- Mac shell is currently a thin WKWebView wrapper with best-effort selected-text capture, labeled clipboard fallback, browser title/URL context, sidecar window commands, and workspace file commands; packaged permission onboarding and live GUI evidence are still missing.
- Mac shell launch/relaunch persistence has not been manually smoke-tested inside the GUI tonight.
- Mac manual QA now has a generated receipt template with default `NT` rows; `STAGE.md` reports the filled/total count, but the receipt is not filled until a real dogfood run.
- Mac shell AppKit import/export panels build successfully, but panel cancel/oversize/invalid-file paths are not GUI-automated tonight.
- `File > Open Morning Review Pack` is a developer shortcut over the generated fixture; it shows an alert when the demo pack is missing and does not generate, sync, or validate live integrations.
- HarmonyOS native app is scaffolded but not DevEco-compiled; the read-only schema reader prototype is still the executable evidence and still needs file-picker integration.
- Sidecar layout still hides full inspector details; the desk review pane handles core review, while bulk review management still lives in the inspector.
- Activity strip messages are intentionally ephemeral UI state; after reload or session switch they fall back to derived latest-capture/review-queue summaries.
