# Nightly Status

## Current Branch

```text
main
```

## Stage Wording

Use [promotion-gates.md](promotion-gates.md) to distinguish local fixtures, dry-runs, schema prototypes, internal builds, and live integrations. Current Feishu work is local plan/dry-run, HarmonyOS work is a schema reader prototype, and the Mac shell is an internal build.

## What Works

- Local web MVP runs without installing dependencies.
- Installable web shell metadata and online-first service worker with cached offline fallback. When a newer cached shell is detected, the app surfaces an `App update ready` notice with a manual `Reload` action instead of silently leaving stale UI in place.
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
- HarmonyOS handoff now includes a DevEco/ArkTS scaffold directory plus a pure import/patch boundary module covered by `smoke:harmony`; it is structure/schema-parity checked, not SDK-compiled. The scaffold next-action contract matches the web Focus Brief shape, including `open_source`, detail, reason, open-question counts, optional `secondaryAction` for phone-side resume decisions, TopicDetail route-section handling for across-topic open questions or answers today, and a shared return-to-Mac contract that keeps phone work as append-only return JSON imported on Mac from Today > Return Files. Harmony patch envelopes now carry both `source.workspaceFingerprint` and `source.returnBaseFingerprint`, keeping future phone returns on the same return-base safety path as static Review/Inbox return files; when return-base is present, workspace fingerprint is not a merge-base decision input.
- Three-pane learning sidecar for Mac/browser workflow.
- Sidecar layout toggle that collapses navigation and inspector around the active session.
- Desk activity strip that keeps draft/save/review/synthesis feedback visible in focused sidecar mode.
- Deterministic Focus Brief in the desk with next action, visible reason, fresh capture-draft resume when review is not due, latest capture, source, workspace-review fallback, synthesis freshness signals, and sidecar-safe visibility.
- Workspace Find is deterministic local find over source titles, notes, captures, tags, and review cards, supports multi-term matches within the same candidate object, then jumps back to the matching session and surface.
- Today tab includes capture drafts, Return Files counts, latest import receipt, direct import/export handoff actions, and a device-labeled manual return path for phone/Windows return files. The device path now sits inside a `Manual transfer` Device Flow drawer below the daily Mac Learning Flow, so it does not pretend to be live sync. The export action opens the Mirror Folder controls, mirror saves record a handoff receipt, and the exported static mirror pages now label their return-file path back to Mac import. Review and Inbox return filenames carry timestamp/short-id suffixes, both static pages warn before leaving with unsaved local work, and the Mac import picker can process multiple return files with a combined receipt, stable inbox-before-review ordering, per-file errors, and `mirror base changed` warnings that name affected files when a return file came from an older return-base fingerprint.
- Today tab now has a Learning Flow panel before the section-map counters and denser sections. It keeps `Read source`, `Capture on Mac`, and `Close the loop` as the daily route, embeds the returning-user Next Move, makes first-run source setup/opening the primary Start Here action, leaves the device return path as a lower-frequency manual drawer, and folds heavier ledger sections into a `Study Details` drawer with count badges that section-map buttons can open.
- In the no-source first-open state, First Note now makes `Set source` the primary action, changes the capture step to `After source`, and keeps a secondary `Jot loose thought` escape hatch with explicit source-resume trade-off copy. The visual route is a lightweight inline sentence rather than a numbered checklist, so the opening screen points to a study action instead of another dashboard.
- In the empty first-note state, Today hides the manual Device Flow drawer unless there is already a mirror export/import/return signal. This keeps the first screen focused on source setup and first capture, while a lightweight `Other devices` route explains `Use phone or Windows later`, labels the path `Manual` and `No live sync`, gives the two-step mirror/return-file path, and exposes a `Phone/Windows` action that reveals full Device Flow on demand. Browser smoke proves Device Flow returns after the first real capture, remains visible for a first-note fixture with existing mirror handoff state, opens from the `Phone/Windows` action, and fits at 1024px, 620px, and 360px without page or route overflow.
- First Note's `Set up page clipper` path now lands on Export with setup copy that says to copy the clip, add it as a browser bookmark, and click it on a source page to send selected text, title, URL, and video time back. Browser smoke verifies the activity copy, selected bookmarklet textarea, and Browser Capture setup note.
- Sessions, clickable capture destination context, capture intent context, source context, timestamp, tags, and source-open jumps that honor a valid typed video time, extract supported YouTube/Bilibili/Vimeo time-link parameters into the local capture timestamp, and otherwise resume from the latest captured timestamp. The Quick Capture context button now says `Resume @ time`, `Open source`, or `Set source` so the source action is visible while reading beside a browser, the empty-state intent/placeholders adapt to video moments versus doc/article/book excerpts, and local `Question`/`Answer`/`Takeaway` starter buttons plus app-focused `Cmd/Ctrl+Shift+1/2/3` shortcuts seed the Thought draft without committing data.
- Capture-level source snapshots with source/time jump links.
- Quick capture quote/thought with per-session draft persistence, visible draft status, Today resume, and a clear-draft action. Today draft cards surface source drift before resume, and resuming a draft focuses the continuation field instead of always returning to Quote. Draft source snapshots now include source title, URL, and material type, so a sourced draft saved after the current session changed still commits with its original source/type until the user explicitly chooses `Use current`. Unanchored drafts keep material type empty until a completed safe source URL edit anchors them, and legacy source snapshots without a stored type fall back through a shared resolver instead of borrowing a drifted current type.
- Quick Capture keeps a Recent Stack in the main desk so sidecar mode still shows the latest captures plus Open, Note, Review/Card, confirmed Delete, and one-step `Undo 10s` for capture deletion without reopening the inspector; delete confirmation names the capture and linked-card count, and unrelated revealed review cards stay revealed.
- Captured question-thoughts are surfaced as Focus Brief signals and Recent Stack chips, then carried into synthesis as Open Questions.
- Today and `TODAY.md` include an Open Questions backlog across sessions so handoff does not hide unresolved study questions inside recent captures.
- Today and `TODAY.md` include Question Queue Health, making active, parked, and total unresolved question counts visible before the user chooses the next study action.
- Today Open Questions can create review cards directly while selecting the correct source session.
- Today Open Questions can be parked and resumed, keeping unresolved low-priority follow-up out of the active focus queue without losing the original capture.
- Captured questions can be marked resolved or reopened, and resolved questions stop counting in Focus Brief, synthesis, Today, HarmonyOS reader backlog, and handoff exports without losing the original capture.
- Local Quick Capture Answer drafts opened from a question preserve `answersQuestionCaptureId`; sufficiently detailed local answers close the original question, while weak answers such as `Answer: ok` stay non-closing drafts. The Answer action now refuses to overwrite an unrelated text draft, or a video timestamp-only draft, in that topic; it keeps parked questions parked until the draft is cleared and resumes an existing linked Answer draft without resetting partial text.
- Linked-source questions now carry a local reading loop after save: the Activity hint can resume the source, start a linked answer draft, close the question with that answer, refresh an existing question review card from the answer evidence, and then resume the source again after the card is current. The refresh-card hint is revalidated at render and click time so a removed card does not leave a dead action.
- One-click capture insertion into Notes with idempotent capture blocks.
- Confirmed delete for mistaken captures and review cards.
- Synthesis draft generation from captures into notes, with stale-source warning and idempotent insertion.
- Capture-to-review-card promotion.
- Cloze review card authoring from selected quote text.
- Workspace-wide due review queue with simple strength buckets.
- Self-graded Again/Good review outcomes with isolated scheduling policy.
- Review answers are reveal-gated before grading.
- Review grading keeps Activity aligned with the actual queue: after a graded card, `Next card` targets the next due card when one remains; after the last due card, `Review queue clear` returns the learner to Quick Capture and can resume the reviewed source.
- Desk-native review pane works in focused sidecar layout.
- Today tab summarizes workspace due review and recent captures.
- Static mirror `index.html` provides a portable folder home page for Today, Review, Restore, and sessions.
- Today and mirror exports include a Resume Here / Focus Brief section for mobile, Windows, and Feishu handoff, with source links resuming at the latest captured timestamp when available; mirror `index.html` also previews open questions before the recent-capture list.
- Static mirror `index.html` includes a Manual Return checklist so phone/Windows users can start from Today, choose Review or Inbox, and bring return files back to Mac without treating the mirror as live sync. The generated `index.html`, `review.html`, and `inbox.html` now show a static `Return-ready mirror` badge explaining that Review/Inbox return files include the Mac return-base check via `source.returnBaseFingerprint`.
- Static mirror `index.html` now puts `Next from this export` before the four general entry links, so phone/Windows users see the recommended next step before choosing among Today/Review/Inbox/Restore. Browser smoke checks the 390px mobile layout for this order, no horizontal overflow, and full-width entry links. Source-only mirrors now route first to `Read source on this device` or `Resume source on this device`, with a tappable `Then capture in Inbox.` secondary action; due review and open questions still outrank source reading, unsafe source URLs fall back to Inbox capture, and no-source mirrors still start at `Capture on this device`.
- Static mirror `review.html` supports due-card review on mobile/Windows and exports append-only review progress patch JSON.
- Static mirror `review.html` keeps mixed exported work visible after the user saves a review return file: if the same mirror still has open questions, the post-save panel links to the relative prefilled Inbox answer page.
- Static mirror `review.html` now keeps an in-memory review return patch and explicit Manual Copy/Save warning when `localStorage` is unavailable, matching the Inbox fallback path for locked-down `file://` or privacy-mode browsers.
- Static mirror `inbox.html` supports phone/Windows capture drafts and exports append-only mobile inbox patch JSON.
- Static mirror `inbox.html` keeps mixed exported work visible after the user saves an inbox return file: if the same mirror still has due cards, the post-save panel links back to relative `review.html`.
- Static mirror `inbox.html` now keeps an in-memory return draft and explicit Manual Copy/Save warning when `localStorage` is unavailable, so locked-down `file://` or privacy-mode browsers do not lose the visible patch preview or crash on Add Capture.
- Static Review/Inbox return actions now stack into full-width touch targets on phone-width screens, with browser smoke checking the generated pages at 390px for no horizontal overflow and usable return buttons.
- Return File imports route the Mac UI back to Today, open the Device Flow receipt, and pulse that panel so returned phone/Windows work reconnects to the Learning Flow.
- Return File import receipts now include a direct next-action button: returned captures can jump to `View latest capture`, returned review progress can open `Review status`, and import issues can open `Return Files`. The action reuses local rejoin targets and does not change the portable return-file format.
- Return Files now previews copied or selected inbox/review return JSON before applying it: Device Flow shows parsed deltas, Apply, and Discard; workspace content and imported patch ids stay unchanged until Apply. The preview is in-memory only and refreshes instead of applying if the Mac workspace changed after preview.
- Returned phone/Windows answer imports now carry answer-specific next steps into the `Returned from phone/Windows` card: resolved questions with refreshable cards put `Refresh cards` first, resolved questions without refreshable cards put `View closed questions` first, and ordinary returned captures still use `View captures`.
- Mirror home mixed due+question states now keep `Review due cards` as the primary `Next from this export` action while making the open-question lane a clickable secondary Inbox answer link, so phone/Windows users can continue the question loop without guessing where Inbox is. The static Inbox answer page now shows a visible answer-context banner for that linked question, changes the carried question to a read-only `Question from Mac` field, labels the writable answer as `Answer to return`, restores ordinary capture labels after the answer is staged, and preserves the append-only return-file contract.
- Browser smoke now creates a temporary UI-authored open question only for a dedicated answer mirror, verifies `index.html` click-through into `inbox.html?answerToCaptureId=...`, checks the landed answer field is writable while the carried Mac question stays read-only, stages a static Inbox answer return patch, imports that patch back into the matching Mac workspace, verifies the original question closes, then restores the main smoke baseline so the broader flow is not polluted.
- The same browser smoke also writes the dedicated answer mirror to a project-local `.codex-tmp/browser-smoke/.../answer mirror files/中文/` path, opens `index.html` through `file://`, and verifies the relative jump into `inbox.html?answerToCaptureId=...` still reaches answer mode. Real HarmonyOS/Windows storage and save behavior, Feishu Drive transfer, and multi-answer batch return files remain separate QA gaps.
- Static mirror answer links carry `answersQuestionCaptureId`; importing that answer patch can resolve the original same-topic question while preserving the new answer capture.
- Mobile inbox patch import appends captures with patch/capture id dedupe, target-resolution fallback, unsafe URL stripping with receipt counts, and a visible import receipt.
- Review progress patch import applies Again/Good events only when the card version still matches, and reports duplicates, missing cards, stale conflicts, and invalid events.
- Import failures leave a visible issue receipt for bad mirror payloads, malformed JSON, and oversized patch files, so return-path problems remain inspectable after the toast fades.
- Older return-file compatibility imports show `legacy mirror check` when the app had to compare the old full-workspace fingerprint instead of the newer return-base projection, and the receipt/Device Flow now tells the user to export an updated mirror before the next phone or Windows study pass.
- Markdown notes editor with autosave.
- Safe read-mode preview for notes.
- Safe formatting preview for capture thoughts and review answers.
- Markdown + JSON export for the active session.
- Export panel exposes full workspace copy/save with a collapsed JSON disclosure next to session, Today, mirror, ZIP, and bookmarklet outputs; browser Save prefers `showSaveFilePicker()` when available, Mac shell text saves route through native NSSavePanel, and unsupported/headless runtimes fall back to download.
- Storage notice prompts for a local workspace export after committed learning data changes, warns when the last matching export is older than seven days, and asks the user to verify the selected/exported JSON file rather than treating the click as durable backup proof.
- Copy/save `TODAY.md` directly from the Export panel.
- Credential-free Feishu mirror bundle with README, workspace restore payload, and per-session Markdown/JSON sidecars.
- Credential-free Feishu mirror ZIP containing the same readable folder files, including derived `index.html`, `TODAY.md`, `review.html`, and `inbox.html`.
- Import can restore either a raw workspace JSON, a Feishu mirror bundle, a mobile inbox patch, or a review progress patch from both the browser file input and Mac native import menu.
- Morning demo pack generator creates a fixture-only representative workspace, extracted mirror folder, ZIP, Feishu upload plan/local files/dry-run report, HarmonyOS reader view with open-question evidence, sample mobile inbox patch, sample review progress patch, `SOURCE_TIME_LINKS_RECEIPT.json`, `MORNING_REVIEW.md`, `STAGE.md`, `MAC_MANUAL_QA.md`, `WINDOWS_STATIC_QA.md`, `HARMONY_DEVICE_QA.md`, `HARMONY_DEVECO_HANDOFF.md`, and a provenance/hash `SUMMARY.json` with credential sweep results.
- Morning review dashboard self-labels as cross-end fixture-ready, includes a stage matrix, and enumerates what is not proven: live Feishu sync, real HarmonyOS behavior, Windows manual QA, off-Mac patch origination, and signed Mac packaging.
- `STAGE.md` includes named gates for Mac manual QA, Windows static QA, Harmony device QA, Feishu live write, Harmony device, Windows manual run, Mac signing, and patch intake fixture status. `WINDOWS_STATIC_QA.md` and `HARMONY_DEVICE_QA.md` are explicitly pending receipts, not QA/device evidence, until real Windows/HarmonyOS runs fill the rows.
- Copyable browser capture bookmarklet from the Export tab, including active video time.
- Full workspace JSON import/export.
- Browser bookmarklet and URL inbound capture contract.
- Browser inbound capture now routes by normalized source URL before falling back to conservative title-only matching or the active topic, and switches the desk back to capture focus.
- Workspace schema contract in `docs/schema/workspace.v1.schema.json`.
- Browser smoke test verifies capture -> card -> localStorage -> UI metrics.
- Browser smoke also verifies installable/offline shell metadata, sidecar layout toggling, desk-level activity feedback, Focus Brief updates, Quick Capture Recent Stack visibility/actions/delete recovery, captured-question signals/resolve/reopen, Today Open Questions backlog/card promotion, Workspace Find jump-to-capture behavior, Today tab/direct Today export/full workspace export/mirror home/study pack/static review pack/static review-progress patch/static inbox page, desk-native review in sidecar layout, mobile-width no-overflow behavior, capture source snapshots/time links, capture-to-notes insertion, per-session capture draft restore/clear, confirmed capture/card deletion, mobile inbox patch import, review progress patch import/duplicate receipts, DOM-visible issue receipts for bad mirror/malformed JSON/oversized patch imports, mirror ZIP affordance, Cloze cards, workspace-wide due review, reveal-before-grade review flow, synthesis insertion, stale-draft handling, capture formatting, mirror bundle generation/import, generated bookmarklet execution on virtual video/document/empty-selection pages, inbound bookmarklet capture, and notes preview rendering.
- Browser smoke routes its own download artifacts to the ignored project-local `.codex-tmp/browser-smoke/*/downloads` path only through an explicit smoke harness flag, keeps smoke roots by default, and only removes smoke-script-owned artifacts when `LC_CLEAN_SMOKE_ARTIFACTS=1` is explicitly set. It also includes a negative controlled-browser case so ordinary automation and non-picker browsers do not keep filling Downloads with JSON.
- Quote-only highlights can now be annotated in place from the activity strip, Recent Stack, or Captures. The `Highlight saved` activity action is `Add thought`; it opens the Captures inline form in the full desk and the Recent Stack form in sidecar without exiting compact reading layout. That activity route is gated to fresh quote-only captures; once a thought exists, the capture no longer reopens as an empty highlight. The inline path keeps the source page unchanged and updates the existing capture rather than creating a duplicate; when the capture already has a generated Notes block, that block is refreshed too.
- Capture note receipts now route to durable Notes preview: `View note` scrolls, pulses, and focuses the generated capture block, while the preview hides only valid paired system markers and leaves broken marker text visible.
- Sidecar activity actions now distinguish stay-in-place capture work from detail navigation: `Capture` and `Resume` focus Quick Capture, quote-only `Add thought` opens the Recent Stack annotation form, and actions that need hidden panels keep the `Exit + ...` copy.
- Focused sidecar layout suppresses the redundant Focus Brief card when the only next step is plain capture or source continue; the Source/Capture/Loop rail, source strip, and Quick Capture already carry that state. Drafts, warnings, due review, open questions, and other loop pressure still keep Focus Brief visible.
- Static return pages show stable suggested return-file names for Copy/Save, then reveal a post-action next-step panel after successful Copy or Save so a phone or Windows user knows to move the return file back to Mac and import or paste it from Today > Return Files.
- Static return pages include a `Manual Copy` fallback for locked-down browsers where clipboard or picker permissions are unavailable; it only selects the visible return-file JSON and does not create a download. The same return panel tells Windows users to press Ctrl+C, paste into a text editor such as Notepad, save with the suggested `.json` filename, and move that file back to Mac.
- Device Flow has local handoff status for the manual mirror loop: latest Mirror export, full mirror-content freshness, return-base safety for imports, derived waiting-for-return state, and latest return-file import counts. Its collapsed summary now leads with the next step (`Next: export mirror`, `Mirror ready`, `Mac changed`, or `Return imported`) before nonzero counts, so the drawer reads as a route instead of a ledger. When the Mac has changed since export, the drawer now itemizes authored content deltas under `Mirror contents changed` and uses a baseline fallback when only fingerprints moved, while explicitly saying manual transfer is not live sync. A successful return import records the post-import workspace fingerprint, preventing the returned phone/Windows work itself from being mislabeled as an unrelated Mac stale change; legacy return imports without that fingerprint are qualified as `legacy check`. The footer primary action and short next-step hint follow the same route: `Import Return Files` for a current waiting mirror and `Export Updated Mirror` when stale content or returned work requires a new device baseline. The state is kept in local UI preferences and is not serialized into workspace or mirror exports.
- Mac-side mirror handoff copy now tells the user to open `index.html` first on phone or Windows, then follow `Next from this export`, so the Mac export receipt matches the static mirror's due/question/source recommendation instead of sending the user directly to `inbox.html` or `review.html`.
- Service worker cache key is now `learning-companion-static-v5`; the activate handler only evicts older `learning-companion-static-*` caches. This was bumped after stale cached UI showed older sidecar/focus shell state while source files had already moved on. The web shell shows an `App update ready` reload notice when a new service worker is waiting or takes control after an already-controlled page. The worker still uses its existing `skipWaiting()` / `clients.claim()` behavior, while the app keeps page reload manual and does not unregister workers or clear browser state. The app script installs compatibility-only shell nodes so stale HTML plus newer JS does not crash on recently added non-data UI, and browser smoke exercises that path with a virtual stale shell.
- Source setup now has an explicit visible `Paste Source` clipboard shortcut beside URL. It is user-initiated, keeps only a safe copied URL, derives an editable title, infers material type locally when safe, syncs supported video timestamps into Time, keeps typed topics with existing captures from being silently reclassified, updates Quick Capture source-aware guidance from that context, and stays out of browser automation territory.
- Quick Capture context now includes a visible draft outcome summary, not just hover text. It states whether the current draft will enter Open Questions, Answers Today, close a linked question, save a highlight/takeaway/capture, and whether source resume is ready, timestamped, missing, or source-changed.
- Learning Flow now shows a temporary `Returned from phone/Windows` nudge after a return-file import with new captures or review updates. It is driven only by the current import receipt, suppresses duplicate-only returns, can jump to returned captures or import details, and has an explicit Dismiss action.
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
`check:morning` now runs `check:static-return`, `dogfood:validate:smoke`, `mac:manual:validate:smoke`, `windows:static:validate:smoke`, and `harmony:device:validate:smoke` after generating that pack, so the offline headline gate includes the static Review/Inbox return contract plus pending dogfood/Mac-manual/Windows-static/Harmony-device claim guards.
`check:morning` is the offline headline gate: web smoke, HarmonyOS smoke, capture-resume receipt, source-time link receipt, patch-intake negative receipt, demo pack generation, static return contract, pending dogfood/Mac-manual/Windows-static/Harmony-device validators, receipt contracts, adversarial gate fixtures, determinism, mirror integrity, perf budget, perf self-test, and git status.
`check:morning:native` runs the Mac SwiftPM build separately because SwiftPM may need toolchain/cache access outside restricted sandboxes.
`check:morning:browser` runs the local browser UX smoke separately because it binds `127.0.0.1`.

`windows:static:validate:smoke` writes `.codex-tmp/windows-static-qa/receipt.json`. The generated Windows receipt currently has `rows=10`, `nt=10`, `allRowsExecuted=false`, and `canClaimWindowsStaticLoopUsable=false`, which is intentional until a real Windows Edge/Chrome local-folder run fills the rows and session header. Negative validator fixtures reject all-PASS rows with header fields still `TBD` and FAIL/BLOCKED rows without QA notes.

`harmony:device:validate:smoke` writes `.codex-tmp/harmony-device-qa/receipt.json`. The generated HarmonyOS device receipt currently has `rows=10`, `nt=10`, `allRowsExecuted=false`, and `canClaimHarmonyDeviceRoundtripUsable=false`, which is intentional until a real DevEco/toolchain plus phone/emulator import, reader, patch export, and Mac Return Files pass fills the rows and session header. Negative validator fixtures reject all-PASS rows with header fields still `TBD` and FAIL/BLOCKED rows without QA notes.

Latest checks passed: JS syntax checks, `npm run smoke`, `npm run demo:morning`, `npm run check:morning`, `npm run check:morning:native`, `npm run mac:build`, and `npm run smoke:browser`. The browser gate was rerun after the Quick Capture intent, local Answer draft linkage, linked Answer readiness, smoke temp-download hygiene, save-picker export, and Mac-shell web save bridge work; it now covers capture destination/source/time/intent context, linked local answer save-and-close behavior, answer-draft readiness before closure, temporary download routing for automated export checks, picker-vs-fallback backup copy, persistent Review/Inbox return-file next-step cues, the destination-locate action from sidecar layout, native bridge capture labels in and out of sidecar, promoted native bridge review-card labeling, click-through to the saved capture, promoted stack labels, richer confirmation copy, canceling deletion, direct sidecar deletion, one-step capture restore, unrelated revealed-review preservation, the existing inspector delete path, and the earlier source-time parser/jump evidence without claiming live video-site playback QA. The Mac-shell bridge has SwiftPM build evidence, not manual NSSavePanel click-through QA.

Latest focused browser smoke also covers six high-friction learning-flow cases: empty first-note Today stays focused by hiding Device Flow until learning work or handoff state exists, while an `Other devices` route makes the later phone/Windows path visible without claiming live sync; First Note's page clipper setup jumps to Export, selects the bookmarklet, and explains the bookmark setup path; Today's `Close the loop` and `Next Move` share one due-review > open-question > draft > parked priority contract; Return Files rejects a single mistaken workspace JSON without replacing local state while ordinary sidebar single-file restore still works; source-drifted Quick Capture drafts commit their original source snapshot unless the user explicitly chooses `Use current`, including linked Answer drafts opened from Today questions; material-type drift is covered for video draft -> document session, document draft -> video session, and linked Answer from a video question while the current session is document; and no-source/timestamp-only first-note drafts keep an empty material type until a safe source URL change anchors them. The first-note device route is additionally measured at 1024px, 620px, and 360px for no page overflow, copy fit, button fit, and accessible action labeling.

Tonight's no-delete validation used normal `npm run smoke` and `npm run smoke:browser` after changing smoke scripts to keep project-local `.codex-tmp/` artifacts by default; both passed while leaving their run artifacts for later review. Cleanup now requires the explicit `LC_CLEAN_SMOKE_ARTIFACTS=1` switch and was not run tonight.

The full offline headline gate was also run in no-delete mode with `MORNING_DEMO_SKIP_CLEAN=1 LC_KEEP_CHECK_ARTIFACTS=1 npm run check:morning`, and it returned `morning_offline_check_ok`. `LC_KEEP_CHECK_ARTIFACTS=1` keeps project-local `.codex-tmp` gate run directories instead of deleting them.

After the latest Today priority, Return Files guard, and draft source snapshot fixes, the same no-delete headline gate was rerun and returned `morning_offline_check_ok`; the static-return receipt was kept at `.codex-tmp/static-return-loop-check/static-return-loop-1780517469153/receipt.json`.

After the static mirror source-first route, `npm run check:static-return` returned `static_return_loop_ok` and kept `.codex-tmp/static-return-loop-check/static-return-loop-1780522725669/receipt.json`, whose summary includes `sourceFirstDeviceRoute=true` with no-source fallback, source-only read-first, source links opening in a new tab/window, timestamp resume, unsafe-source fallback, and open-question-priority checks.

After the source-only mirror mobile browser coverage was added, `node --check scripts/smoke-browser.mjs`, `git diff --check`, and `npm run smoke:browser` passed. The controlled Chrome gate now opens a source-only static mirror at 320px and verifies `Read source on this device`, `_blank` plus `noreferrer noopener`, the `Then capture in Inbox.` secondary action, and no horizontal overflow. The follow-up static Inbox source-context slice also passed `node --check apps/companion-web/src/model.js`, `node --check scripts/smoke-web.mjs`, `node --check scripts/static-return-loop-check.mjs`, `node --check scripts/smoke-browser.mjs`, `git diff --check`, `npm run smoke`, `npm run smoke:browser`, and `npm run check:static-return`; latest kept receipt: `.codex-tmp/static-return-loop-check/static-return-loop-1780523980606/receipt.json`. Browser smoke now verifies source-only Inbox at 320px shows the selected topic source, has `aria-describedby` from Topic to the hint, flips to override copy when Source is typed, keeps Source/URL fields empty by default, and still writes the inherited source into the return patch. This is browser-smoke evidence only, not real HarmonyOS/Windows/iPhone QA.

The current in-app browser tab remained on stale service-worker/app-shell state tonight, and cleanup was intentionally deferred. The update notice path is covered by static and controlled browser smoke, but its real-world appearance on that stale tab should be rechecked after tomorrow's browser/service-worker reset.

Workflow/Seed fanout used `ark/seed-code-0602` with three read-only tasks at concurrency 3. Two workers reached the max-turn cap without useful output; the PWA stale-update worker succeeded. I accepted its concrete stale-shell runtime coverage gap and added a virtual stale-shell browser smoke case for the JS compat shim only, while treating the broader service-worker lifecycle/cache regression smoke as a follow-up.

The latest Workflow/Seed fanout for cross-device UX used `ark/seed-code-0602`, three read-only tasks, and concurrency 3 via `/Users/bytedance/.codex/skills/workflow/scripts/seed_batch.py`. Only `phone-harmony-return-critique` succeeded; `mac-daily-loop-critique` and `windows-feishu-manual-flow-critique` returned `Error: Reached max turns (10)`. Accepted from the successful worker: add "come back to this mirror tab" source-first copy, keep `file://`/device behavior as unproven, add a `noscript` fallback, and make post-save return-file transport copy lead with phone-friendly Manual Copy steps.

The `noscript` fallback slice then passed `node --check apps/companion-web/src/model.js`, `node --check scripts/static-return-loop-check.mjs`, `git diff --check`, `npm run smoke`, `npm run smoke:browser`, `MORNING_DEMO_SKIP_CLEAN=1 npm run demo:morning`, and `npm run check:static-return`. The first `check:static-return` attempt failed because `dist/morning-demo/mirror-folder/index.html` was stale; it passed after regenerating the morning demo in no-clean mode. Latest kept static-return receipt: `.codex-tmp/static-return-loop-check/static-return-loop-1780524272987/receipt.json`.

The phone-friendly return transport copy then passed `node --check apps/companion-web/src/model.js`, `node --check scripts/smoke-web.mjs`, `node --check scripts/smoke-browser.mjs`, `node --check scripts/static-return-loop-check.mjs`, `git diff --check`, `npm run smoke`, `npm run smoke:browser`, `MORNING_DEMO_SKIP_CLEAN=1 npm run demo:morning`, and `npm run check:static-return`. Latest kept static-return receipt: `.codex-tmp/static-return-loop-check/static-return-loop-1780524594008/receipt.json`. The copy now says to use Copy or Manual Copy on a phone, paste the return JSON into a note/email/message, send it to Mac, then import or paste from Today > Return Files; AirDrop/USB/file share/manual Feishu Drive are framed as options after the JSON file is saved.

The morning review pack now includes `DOGFOOD_RUNBOOK.md` as a first-class pending gate before `MAC_MANUAL_QA.md` and `WINDOWS_STATIC_QA.md`. It tells the reviewer to record step count, time, and every failure for one real Mac study session and the optional phone/Windows manual device loop; all rows remain `NT` until an actual run fills them, and the artifact is labeled `EVIDENCE: PENDING_USER_GATE`. Mira reviewed the first runbook slice as `PASS_WITH_NOTES`; accepted follow-up fixes added time budgets, required friction fields, a BLOCKED-needs-reason validator, manual transport recording, a project-local HTTP server for opening the generated dashboard without relying on `file://`, a Return File import dry-run CLI for replaying selected return JSON through the real model import functions without writing the updated workspace, and `scripts/validate-dogfood-runbook.mjs` for turning a filled runbook into a machine-readable receipt. This slice passed `node --check scripts/build-morning-demo.mjs`, `node --check scripts/validate-morning-receipts.mjs`, `node --check scripts/serve-morning-demo.mjs`, `node --check scripts/return-file-import-dry-run.mjs`, `node --check scripts/validate-dogfood-runbook.mjs`, `git diff --check`, `MORNING_DEMO_SKIP_CLEAN=1 npm run demo:morning`, `npm run morning:receipts`, `npm run demo:morning:serve:smoke`, `npm run demo:return-import-dry-run:smoke`, `npm run dogfood:validate:smoke`, and `MORNING_DEMO_SKIP_CLEAN=1 LC_KEEP_CHECK_ARTIFACTS=1 npm run check:morning`; latest kept static-return receipt: `.codex-tmp/static-return-loop-check/static-return-loop-1780543358567/receipt.json`, dry-run receipt: `.codex-tmp/return-import-dry-run/receipt.json`, and dogfood validator receipt: `.codex-tmp/dogfood-runbook/receipt.json`. The dogfood receipt currently has `pass=0`, `nt=11`, `canClaimMacDogfoodUsable=false`, and `canClaimManualDeviceLoopUsable=false`, which is intentional until a real run fills the rows. The in-app Browser refused to open the generated `file://` dashboard under its URL policy, so the supported review path is now `npm run demo:morning:serve -- --port 5174` and `http://127.0.0.1:5174/`.

The long browser smoke has hit a `Runtime.evaluate` timeout during extended local CDP runs and then passed unchanged on rerun. Current evidence treats that as browser-control flake rather than product failure; the harness now gives each evaluate 25s before failing, and this should be revisited if the same block becomes reproducible.

## Review Notes Absorbed

Latest Mira status:

- 2026-06-04 Paste Return File preview review returned `PASS_WITH_NOTES` with `cleanup_succeeded=true`, `logid_present=true`, model `re-o-47`, and mode `deep`. Accepted: tighten preview copy to concrete deltas, add pending-preview lifecycle smoke for re-paste and discard, add workspace-fingerprint refresh guard before Apply, and extend the same preview/apply model to file-picker `Import Return Files`. Deferred: dry-run/real-import parity test and real device evidence.
- 2026-06-04 no-source first-open Today review returned `PASS_WITH_NOTES` with `cleanup_succeeded=true`, `logid_present=true`, model `re-o-47`, and mode `deep`. Accepted: keep `Set source` primary, soften the escape hatch from `Capture without source` to `Jot loose thought`, and replace the numbered route with lighter inline guidance. Deferred: real fresh-profile dogfood, returning-user stale-source design, and telemetry.
- 2026-06-04 first-note Device Flow focus review returned `PASS_WITH_NOTES` with `cleanup_succeeded=true`, `logid_present=true`, model `re-o-47`, and mode `deep`. Accepted: add cross-state smoke for first-note + existing mirror handoff, and add a lightweight `Phone/Windows` first-note entry. Deferred: non-Mac UA-specific rendering and an appearance transition/highlight.
- 2026-06-04 static mirror source-first device route review returned `PASS_WITH_NOTES` with `cleanup_succeeded=true`, `logid_present=true`, model `re-o-47`, and mode `deep`. Accepted: source-only mirror should prioritize reading before capture; add unsafe-source, Resume-source, and source+open-question ordering smokes; make the secondary Inbox link visibly tappable. Deferred: real HarmonyOS/Windows/iPhone visual QA.
- 2026-06-04 static Inbox topic source context review returned `PASS_WITH_NOTES` with `cleanup_succeeded=true`, `logid_present=true`, model `re-o-47`, and mode `deep`. Accepted: shorter source hint copy, live Source/URL override hint, `aria-describedby` from Topic to the hint, and browser-smoke assertions for title, override, and inherited return-patch source. Deferred: real device, RTL, and large-font QA.
- 2026-06-04 first-note device route review returned `PASS_WITH_NOTES` with `cleanup_succeeded=true`, `logid_present=true`, model `re-o-47`, and mode `deep`. Accepted: user-facing naming, manual/no-live-sync prominence, two-step mirror/return microcopy, aria labeling, and multi-breakpoint layout assertions. Rejected for now: a separate first-capture route state after real work, because the app leaves First Note and restores full Device Flow with the export action.
- 2026-06-04 targeted reviews for Today priority alignment, Return Files single-file guard, and draft source snapshot commit all returned `PASS_WITH_NOTES` with `cleanup_succeeded=true`, `logid_present=true`, model `re-o-47`, and mode `deep`.
- 2026-06-04 draft material-type snapshot and unanchored draft type reviews returned `PASS_WITH_NOTES` with `cleanup_succeeded=true`, `logid_present=true`, model `re-o-47`, and mode `deep`. The first packet was rejected locally by the broker sanitizer as `SECRET_DETECTED`; the reduced v2 packet succeeded.
- The restricted Hermes SSH broker path was re-smoked on 2026-06-02 with `re-o-47` / `deep`: `ok=true`, `verdict=PASS_WITH_NOTES`, `logid_present=true`, and `cleanup_succeeded=true`.
- Earlier `SSH_FAILED`/timeout notes remain historical evidence for those specific increments, not the current broker state.

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
- Keep Today primary navigation and the visible loop step on one shared priority contract, so mixed states do not show conflicting next actions.
- Keep Return Files stricter than generic restore, especially for single-file mistakes from phone/Windows handoff.
- Commit draft source snapshots into saved captures and linked Answer captures, instead of only warning about source drift in the UI.
- Keep draft material type with the source snapshot, so saved captures and linked Answer captures do not silently inherit the current session's type after source drift.
- Keep unanchored drafts type-neutral until a safe source URL anchors them, and route legacy source-without-type drafts through the shared resolver so reverse document-to-video drift does not borrow the current video type.
- Keep empty first-note Today focused on source/capture, while retaining Device Flow when handoff state already exists and exposing it through a lightweight `Phone/Windows` action.
- Make the first-note phone/Windows path scannable as `Other devices`: manual, no live sync, two steps, and verified small-screen fit without restoring the full Device Flow drawer to the opening task.

Deferred:

- Real Feishu OpenAPI sync. One-way export should come before sync.
- Native Mac shell beyond the thin wrapper: production packaging, permission onboarding, richer browser URL bridge beyond title/URL, multi-display sidecar polish, and packaged menu polish.
- AI-generated synthesis. The deterministic draft should prove the workflow before adding another model.
- Full timezone boundary matrix for Today pack; current implementation stamps the local day window and due cutoff, but browser/device cross-timezone behavior still deserves manual QA.
- Focus Brief's next-action ladder is intentionally simple; adaptive ranking and cross-session recommendations are deferred until real usage shows the current ladder is too blunt.
- Mobile inbox and review progress patches should be called Mac-import-verified, not HarmonyOS-verified, until a real phone roundtrip passes.
- Add broader negative-path demo-generator assertions, such as malformed JSON and oversized patch files; browser smoke already covers visible issue receipts for those cases, while the current demo generator covers duplicate inbox patches, stale review conflicts, unsafe URL stripping, and unsupported inbox patch schema rejection.
- Keep HarmonyOS import/patch boundary logic pure until DevEco is available; the current module is executable smoke evidence, not a native app. Open-question parity is schema-verified locally, not device-verified.
- Stress save-time source/type race behavior only if a reproducible browser/device case appears; current source/type resolution is shared and covered for no-source, safe-link anchoring, video-to-document drift, document-to-video drift, and legacy source-without-type fallback.
- Add a synthetic canceled-picker follow-up for Return Files import mode; current browser smoke proves strict single-file guard and generic restore non-regression, not native picker cancel behavior.
- Decide whether non-Mac UA-specific Device Flow behavior is worth adding after real Harmony/Windows browser evidence.
- Add telemetry or dogfood notes before making draft freshness override open questions; current priority intentionally favors unresolved questions over unfinished drafts.

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
