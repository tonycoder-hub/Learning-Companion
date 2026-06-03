# Next Session Handoff

Date: 2026-06-01

## Mainline Goal

Build a Mac-first learning companion for browser-based study. The core loop is:

- Read or watch in a browser while a calm sidecar stays nearby.
- Capture quotes, thoughts, timestamps, questions, and follow-up cards without breaking focus.
- Turn open questions into answers, cards, synthesis, review material, or parked follow-up.
- Mirror useful study state across Mac, Harmony phone, Windows, and Feishu-backed folders without pretending unverified integrations are done.

The product bias is a study cockpit, not a generic note app. Every feature should help the user decide what to inspect, capture, close, or review next.

## 2026-06-04 Continuation Addendum

Current branch: `main`.

Latest committed product slices:

- `cb16b41 feat: continue after review grading`
- `3062b88 feat: resume source after refreshing cards`
- `297e72d feat: refresh cards after linked answers`

Current real evidence:

- `node --check apps/companion-web/src/app.js`
- `node --check scripts/smoke-browser.mjs`
- `git diff --check`
- `npm run smoke` -> `smoke_web_ok`
- `npm run smoke:browser` -> `smoke_browser_ok`
- In-app Browser sanity on `http://127.0.0.1:5173/`: Learning Companion page visible, Quick Capture visible, Today visible, no horizontal overflow.

What changed:

- A linked answer that closes a question with an existing review card now prioritizes `Refresh card` over `Resume source`, because stale review evidence is a learning-correctness risk.
- The refresh-card hint is checked at render time and click time; if the card disappears before click, the hint hides or fails safely.
- Refreshing the card replaces stale evidence with the linked answer evidence, opens Review, then offers `Resume source` so the learner can return to reading.
- Review grading now aligns Activity with the actual review queue: `Next card` targets the next due card, and the last graded card produces `Review queue clear` with a return to Quick Capture plus guarded source resume when available.

External review status:

- Mira returned `PASS_WITH_NOTES` on all three slices above, with no blockers.
- Accepted notes: stale-evidence replacement assertion, no-Resume-source negative assertion while refresh is needed, new-tab safety assertions, cleaner post-resume primary action label, and next-card/queue-clear smoke coverage.
- Deferred notes: Seed/Doubao critique retry, telemetry, screenshot strips, rapid double-click semantics, and no-source queue-clear focus specialization.

Current scratch/cleanup status:

- Working tree should be clean except for the root untracked file named `{`, which Tony asked not to delete tonight.
- `.mira-review/*response.md` and failed sanitizer status files from these reviews are ignored runtime artifacts and are listed in `.codex-tmp/pending-cleanup.md`.
- Do not use `/tmp`, `/private/tmp`, `$TMPDIR`, or Downloads for new artifacts; keep using project-local `.codex-tmp/` and `.mira-review/`.

## 2026-06-03 Continuation Addendum

Current branch: `main`, ahead of `origin/main` by local product commits. Latest committed slice is `c55c774 fix: label static return save capability`.

Current scratch and cleanup rules:

- Keep all Codex/Mira/Seed/smoke runtime artifacts under project-local `.codex-tmp/`.
- Do not use `/private/tmp`, `/tmp`, `$TMPDIR`, or Downloads for new working files unless Tony explicitly re-approves that path in the moment.
- Tony asked not to delete files tonight and not to request deletion approvals. Queue cleanup candidates in `.codex-tmp/pending-cleanup.md`.
- Do not clear browser caches or service-worker state tonight. The in-app browser may still show stale shell state; controlled smoke remains the evidence path until tomorrow's reset.

Latest committed product changes:

- `c55c774 fix: label static return save capability`
- `fdc1c50 docs: refresh continuation handoff`
- `e2c92e1 feat: rejoin returned work at target`
- `06f0861 docs: record flow continuity reviews`
- `4af47c9 fix: make sidecar entry explicit`

Latest return-flow change:

- Mac Return File import now derives `localRejoinTargets` after import from actual imported Mac state.
- The returned-work nudge can open the exact returned capture or pulse the exact Closed Today card for a returned answer.
- This does not change the portable phone/Windows return-file format, workspace export format, or static mirror pages.
- The persisted Device Flow handoff summary remains field-whitelisted and browser smoke asserts it does not contain the local rejoin list.

Latest Mira status:

- Static return save-mode review returned `PASS_WITH_NOTES` with `cleanup_succeeded=true`, `logid_present=true`, and model `re-o-47` / mode `deep`. Accepted: button/cue/note lockstep and explicit no-disk-save no-picker copy. Deferred: real HarmonyOS/Windows visual/storage checks.
- The first return-rejoin review packet was rejected by the Hermes broker sanitizer with `SECRET_DETECTED`; that was a broker rejection, not a Mira verdict.
- A sanitized second packet returned `PASS_WITH_NOTES` with `cleanup_succeeded=true`, `logid_present=true`, and model `re-o-47` / mode `deep`.
- Accepted: rename the transient field to `localRejoinTargets`, add a shared capture-card marker helper, and add persisted-handoff exclusion coverage.
- Rejected/deferred: TTL/debug logging and portable return-format expansion tonight; the current list is capped and external device regression is still pending.

Latest verification for `c55c774`:

- `git diff --check`
- `node --check apps/companion-web/src/model.js`
- `node --check scripts/smoke-browser.mjs`
- `node --check scripts/smoke-web.mjs`
- `npm run smoke` -> `smoke_web_ok`
- `npm run smoke:browser` -> `smoke_browser_ok`

Next useful non-approval slices:

- Continue tightening the real user journey from source reading to capture to returned-work rejoin, using local smoke and Mira review where useful.
- Keep static phone/Windows paths honest: manual return files, no live sync, no background Downloads scan.
- Update docs/product state when a slice changes actual behavior; do not count Seed attempts that hit max turns as evidence.

## 2026-06-02 Continuation Snapshot

Current branch is `main`, ahead of `origin/main` with local product commits.

Local scratch rule: keep all Codex/Mira/Seed/smoke temporary artifacts under the project-ignored `.codex-tmp/` directory. Do not use `/private/tmp`, `/tmp`, `$TMPDIR`, or Downloads for new working files unless the user explicitly re-approves that path in the moment.

No-delete night rule: Tony asked not to delete files tonight. Smoke scripts now keep their project-local `.codex-tmp/` run directories by default. Do not run the explicit cleanup switch tonight; tomorrow, if Tony approves cleanup, use `LC_CLEAN_SMOKE_ARTIFACTS=1` for smoke-script-owned `.codex-tmp/` cleanup paths only.

Service-worker update visibility: cache key is now `learning-companion-static-v5`. The web shell surfaces an `App update ready` notice with a manual `Reload` action when an already-controlled page detects a newer service worker. The service worker still uses its existing `skipWaiting()` / `clients.claim()` activation behavior; the product boundary is that the app does not auto-reload the page, unregister workers, or clear browser state. Browser verification exposed a real stale-HTML/new-JS mismatch, so `app.js` now installs compatibility-only shell nodes for the update notice and sidecar rail before first render, and browser smoke now loads a virtual stale shell to exercise that JS shim only. This is not a full stale-SW cache regression test.

In-app browser caveat: the visible `127.0.0.1:5173` tab still had old service-worker/app-shell state during tonight's check; a cache-busted `src/app.js?...` request returned app HTML rather than the current JS source. Do not clear it tonight. Tomorrow, reset the browser/service-worker state or restart the local serving path, then repeat the visual verification.

Latest commits:

- `feat: distinguish quote-only highlights` (current slice)
- `fix: avoid downloads wording for backup exports` (current slice)
- `fix: keep controlled downloads out of downloads`
- `f7f8474 feat: label legacy return file checks`
- `dcb0b00 docs: refresh continuation handoff`
- `73671c5 feat: reconnect return imports to today flow`
- `b9b6375 feat: add mirror return checklist`
- `028fd6a feat: name stale return files in batch receipts`
- `0e6fa06 feat: narrow return file base drift checks`
- `b2a2e2a feat: flag stale return file bases`
- `46e261c feat: fold today ledgers into study details`
- `64787f5 feat: add learning flow to today`

What changed in this continuation:

- Today now has one primary `Learning Flow` panel instead of separate onboarding/next-move/device cards.
- Dense ledgers moved into a `Study Details` drawer with count badges and section-map jumps that open the drawer before scrolling.
- Return Files import now exposes stale mirror-base drift through receipt fields and `mirror base changed` copy.
- New static `inbox.html` / `review.html` return files carry `source.returnBaseFingerprint`; old files still fall back to `source.workspaceFingerprint`.
- The return-base projection ignores ordinary non-question Mac captures, so normal Mac-side note-taking after mirror export does not stale phone/Windows return files.
- Batch receipts now name which return files came from a changed mirror base.
- Mirror `index.html` has a three-step Manual Return checklist: Read Today, work in Review/Inbox, return files back to Mac.
- Mirror `index.html` also has a `Next from this export` action that routes phone/Windows users to Review when cards are due, prefilled Inbox answer mode when questions are open, or plain Inbox capture when the queue is clear, with the export timestamp shown at the action. Due+question states keep the open-question count visible as a secondary line. In static Inbox answer mode, the carried Mac question is read-only and labeled `Question from Mac`, the answer field is labeled `Answer to return`, and the form restores ordinary capture labels after the answer is staged in the local return draft.
- Harmony reader view now includes a shared `readerNextAction` contract rendered as `Phone Next` in the ArkTS Index scaffold. It routes imported snapshots to review, question answering, answers-today review, topic resume, or import guidance without claiming DevEco/device verification.
- Harmony `readerNextAction` now also has optional `secondaryAction`, rendered as a second Index button when the primary phone action hides another useful lane such as due review plus open questions. This remains JSON/scaffold evidence only, not a DevEco compile or device run.
- Harmony TopicDetail now consumes scaffold route params: `topicId` chooses the requested topic and `section` lands secondary actions on `Open Questions Across Topics` or `Answers Today Across Topics` instead of a generic detail page. Mira flagged the global/topic scope mismatch; accepted fix is explicit across-topic copy plus empty states and stronger smoke, while a new global `ReaderLane` page is deferred until DevEco compile evidence makes another route worth the surface area.
- Return File imports now route the Mac UI back to Today, open Device Flow, and pulse the receipt panel.
- Device Flow now keeps a local handoff status in `uiPrefs`: `Mirror current`, `Mac changed since mirror export`, `Waiting for return file`, and `Last return imported`. This is local Mac state only and is intentionally not written into workspace or mirror exports.
- Quick Capture context now uses explicit source actions: `Resume @ time` for timestamped sources, `Open source` for untimed URLs, and `Set source` for empty topics. `Set source` focuses the URL field and pulses the source strip, which keeps this as a local Mac focus aid rather than a native-permission feature.
- Old return files still import through the legacy mirror check, but the in-app receipt, returned-work nudge, and Device Flow now say to re-export the mirror before the next phone/Windows pass.
- Newly generated static mirror pages (`index.html`, `review.html`, `inbox.html`) show a `Return-ready mirror` badge explaining that Review/Inbox return files include the Mac return-base check via `source.returnBaseFingerprint` while remaining static/no-live-sync.
- The morning pack now generates `WINDOWS_STATIC_QA.md` as a `PENDING_USER_GATE` receipt for Windows Edge/Chrome static mirror launch, Review/Inbox return-file creation, and Mac Return Files import. It is a pending receipt, not QA evidence, until a real Windows pass fills the rows.
- Workspace backup receipts now avoid steering users toward Downloads: directed saves still say `Backup saved - verify the selected file`, and fallback export copy says `Backup export requested - verify the exported file`.
- Mac manual QA and the generated morning demo script now ask reviewers to verify the exported JSON file instead of assuming a Downloads-based path.
- `npm run smoke:browser` gives Chrome target startup and the final post-save learning-flow block a slightly larger timeout budget, because that end-to-end browser path was flaking before any product assertion failed.
- Mira returned `PASS_WITH_NOTES` for the backup-export copy slice. Accepted notes: prove the browser-smoke assertion exercises the non-directed branch, comment the two timeout budgets, statically pin `downloadBlob()` behind the explicit automation fallback, and document that `exported` is intentionally destination-agnostic.
- Quote-only saves now surface as `Highlight saved` with next-step copy that says the highlight is local, the source page is unchanged, and the next useful moves are adding a thought or making a card. The activity action itself is now `Add thought`: in the full desk it opens the Captures inline form, and in sidecar it opens the Recent Stack form without leaving the compact reading layout. This activity route is quote-only-gated; once a capture already has a thought, it no longer reopens as an empty highlight through the activity strip. `Add thought` updates the same capture in place, so annotation is a real local path rather than a duplicate Quick Capture. If the highlight was already inserted into Notes, annotation refreshes that existing generated note block instead of leaving durable notes stale. This absorbs the highlight-plus-annotation pattern from reader/clipper tools without adding browser automation, live sync, or a new schema field.
- Captures with generated note blocks now show `In Notes`, and the button becomes `Update note`; browser smoke verifies the marker block remains idempotent.
- Note activities now complete the durable-notes loop: `View note` switches Notes to preview, scrolls/pulses/focuses the generated capture block, and the preview hides only valid paired system markers. Unbalanced or hand-pasted marker text remains visible and cannot swallow following user notes.
- Sidecar activity now treats Quick Capture and quote-only highlight annotation as stay-in-place targets: the strip shows `Capture` or `Resume` for Quick Capture, `Add thought` for fresh highlights, and does not leave compact sidecar for those paths. Saved capture/detail actions still use `Exit + ...` when they need hidden panels. Mira returned `PASS_WITH_NOTES`; accepted helper centralization and simpler aria copy, rejected `lastActivity` rehydration because activity is not persisted.
- Focused sidecar now suppresses the redundant Focus Brief card when Source/Capture/Loop already says the only next step is plain capture or source continue. This keeps the reading screen to rail + Quick Capture + Notes, while drafts, warnings, due review, questions, synthesis, and other loop work still bring Focus Brief back.
- Latest Mira review for static Inbox answer labels returned `PASS_WITH_NOTES`. Accepted: the carried question should not be silently editable, post-add banner/CTA/schema should be pinned, and label IDs are load-bearing. Implemented read-only `Question from Mac`, writable `Answer to return`, post-add return to ordinary labels, browser assertions for schema/CTA/banner, and static label-id/read-only checks. Deferred: closed/answered question static answer-link cases, because current exports should not generate those links and the broader import resolver already reports closed targets.
- Browser smoke now covers the missing mirror-home answer return loop. It generates a dedicated answer mirror by creating a real open-question capture through the UI, verifies `index.html` links into `inbox.html?answerToCaptureId=...`, lands in read-only `Question from Mac` / writable `Answer to return` mode, proves the answer textarea accepts input, stages a static Inbox answer return patch, imports that patch back into the matching Mac workspace, verifies the original question closes, and restores the main smoke baseline so the broader flow keeps its original no-open-question state.
- Coverage boundary for that loop: it proves the local static HTML/HTTP harness contract, Mac import resolver compatibility, and a local Chrome `file://` relative-link/query pass from a path containing spaces and Chinese characters for `index.html` -> `inbox.html?answerToCaptureId=...`. It still does not prove HarmonyOS/Windows browser storage/download quirks, Feishu Drive transport, or multi-answer batch return files.
- Static mirror `index.html` now puts `Next from this export` before the general Today/Review/Inbox/Restore entry grid, so the phone/Windows home page leads with a recommendation instead of a choice grid. Browser smoke opens that generated page at 390px and checks no horizontal overflow, next-before-entry order, and full-width entry links.
- Static Review/Inbox now have storage-failure paths: if `localStorage` get/set fails, each page keeps the current return patch in memory, keeps the preview usable, and tells the user to use Manual Copy or Save before closing. Browser smoke blocks `localStorage` before loading both static return pages and verifies Review grading plus Inbox Add Capture still produce valid return patches; it also forces clipboard and save-picker fallback failure so the visible JSON preview is selected for manual copy.
- The Review storage-failure browser fixture now uses a dedicated two-due-card static Review page generated through the real model path, so blocked persistence is covered for multiple in-memory review events in one return patch.
- Mac Return Files now supports `Paste Return File` for copied static return JSON. It is user-triggered, accepts only inbox/review return files, rejects full workspace JSON in that panel with an `Import Return Files` hint, gives distinct empty/blocked/non-JSON clipboard receipts, and reuses the same import receipt/rejoin path as file import without scanning Downloads.
- The Return Files footer now groups the outbound `Export Mirror` action apart from the inbound `Import Return Files` / `Paste Return File` actions, which keeps the manual device loop directional without changing the data contract.

External review / critique absorbed:

- Mira broker is healthy again through the restricted Hermes SSH path; latest targeted reviews returned `PASS_WITH_NOTES` with `cleanup_succeeded=true` and `logid_present=true`.
- Accepted Mira's critique that full-workspace stale-base fingerprints were too noisy; implemented the narrower return-base projection.
- Accepted Mira's per-file batch receipt critique; batch stale-base receipts now show affected filenames.
- Seed/Doubao criticized the post-return chain as disconnected. Accepted the "rejoin Learning Flow" point, but rejected background Downloads/LC_Returns scanning because it conflicts with the no-Downloads automation boundary and would need approval/permissions.

Latest verification:

- `npm run smoke` -> `smoke_web_ok`
- `npm run smoke:browser` -> `smoke_browser_ok`
- `npm run check:morning` -> `morning_offline_check_ok`
- `npm run mac:build` -> SwiftPM build complete
- `git diff --check` -> clean before the latest commits

Next useful slices:

- Record a Windows-browser manual run for extracted mirror `index.html`, `review.html`, and `inbox.html` by filling `dist/morning-demo/WINDOWS_STATIC_QA.md`.
- Do not add background folder scanning or Downloads automation without a separate user-approved design.
- Do not turn Device Flow handoff status into a hard import validator. Return JSON validation remains based on the file's own `source.returnBaseFingerprint`; the local handoff state is just user guidance.

## Current Branch State

Branch: `product/mvp-learning-sidecar`

Recent local work on top of `origin/product/mvp-learning-sidecar`:

- `466cf05 feat: save web exports through Mac shell`
- `059acd4 feat: prefer save picker for exports`
- `0789ee2 test: keep browser smoke downloads temporary`
- `4a4ff79 fix: align linked answer readiness`
- `36d56ad feat: link local answer drafts to questions`
- `f32d1e1 feat: show quick capture intent`
- `0118db8 feat: locate quick capture destination`
- `03e360f feat: show quick capture destination`
- `77707f2 fix: show capture undo expiry`
- `db712b1 feat: undo capture deletion from sidecar`
- `589e346 fix: scope recent stack delete state`
- `f51d254 feat: delete captures from recent stack`
- `ba679fa feat: surface draft source drift in focus brief`
- `09bd884 feat: open review cards from capture stack`
- `ef36e17 feat: reanchor drifted capture drafts`
- `74d5b20 feat: warn on capture draft source drift`
- `0463b81 docs: record zero time nudge handoff`
- `41b1ab7 feat: clarify zero time nudge feedback`
- `9198d20 docs: refresh sidecar continuation handoff`
- `571f1d6 test: pin time nudge mobile layout`
- `f356125 feat: support keyboard time nudges`
- `9173f34 docs: prioritize capture sidecar review`
- `dbcfb63 feat: add capture time nudges`
- `ae27a96 feat: show capture source context`
- `92b4b33 feat: surface source time staging`
- `836ca08 feat: add keyboard quick capture focus`
- `6fd3c83 docs: surface harmony session evidence in morning pack`
- `c0818d6 feat: align harmony pages to reader session`
- `6eca901 feat: add harmony reader session state`
- `ded3eb1 feat: define harmony import file contract`
- `4a257ca feat: make focus question signal actionable`
- `7a2c0d6 test: harden focus question signal`
- `3717aa4 test: verify focus question browser path`
- `1badbf9 feat: add morning inspection path`
- `24caecf feat: seed answers from open questions`
- `1760d58 feat: link mirror questions to inbox answers`
- `de3d3cd test: harden mirror answer prefill`
- `e383e5f feat: add parked question queue`
- `c4dadd8 feat: add question queue health cue`
- `3e2af15 feat: resolve questions from answer patches`
- `68ed5f3 test: harden answer patch resolution`
- `43b3f9a feat: show answer resolution in import receipts`
- `9fca328 feat: show questions closed today`
- `11bb044 feat: build review cards from answered questions`
- `ba2dd9f feat: show answer summaries for closed questions`
- `c6e09bf feat: refresh answered question review cards`
- `62dbffb test: surface closed answers in morning demo`
- `cd1e6c3 feat: add question loop summary`
- `94432b9 feat: surface answer captures in harmony reader`
- `dc8cb2e feat: add today section map`
- `5f8d3d3 feat: add first-run start card`

Recent committed work makes answer resolution visible in import receipts:

- `formatInboxReceipt()` now reports when an imported answer resolved a question.
- The same receipt reports skipped answer targets with reason counts, such as `invalid: 1`.
- Browser smoke covers both visible invalid-target skip feedback and an answer patch that closes the original open question.
- The answer-patch resolver remains hardened from the prior commit: bounded ASCII ids, reason-tagged skips, duplicate idempotency, cross-topic negatives, already-closed targets, self-reference, and same-patch reference coverage.

Latest local work keeps resolved questions visible in Today:

- Today now has a `Closed Today` section for questions whose `questionResolvedAt` lands inside the current local day window.
- Data-layer fields use `resolved` naming (`resolvedQuestionsToday`, `resolvedQuestionItems`, `resolvedQuestionOverflow`) while the UI keeps friendlier `Closed Today` copy.
- The local day window is centralized through `resolveTodayWindow()` and surfaced in Today/TODAY.md so cross-device handoff does not hide the timezone assumption.
- Closed cards provide View/Reopen and stay excluded from active/open question counts.
- Smoke coverage now includes answer-import closure, Reopen removing a closed card and restoring the open question, same-day re-resolve latest-wins semantics, overflow, and Today/TODAY.md window agreement.

Recent committed work turns answered questions into stronger review cards:

- `promoteCapture()` now detects same-session answer captures linked by `answersQuestionCaptureId`.
- When promoting an answered question, the card prompt uses the original question and the card answer uses the latest linked answer capture.
- Leading `Q:` / `Question:` is stripped before wrapping the prompt.
- If a question was promoted before an answer arrived, the old card remains stable until the user taps `Refresh card` from Closed Today; refresh preserves card id/due date/strength and updates prompt/answer from the linked answer.
- Smoke coverage includes promoted-before-answered, multiple linked answers, quote-only answer captures, and equal-timestamp answer tie-breaking.
- Closed Today/TODAY.md now also show the linked answer summary, with leading `Answer:` stripped to avoid duplicated labels.

Recent committed work adds a Question Loop summary:

- `buildTodayPack()` now emits `questionLoop`, a derived summary of active, parked, closed-today, answer-linked closed-today, and question-sourced review-card counts.
- Today UI shows `Question Loop` as a flow card after `Question Queue Health`, with Today, Backlog, and Lifetime lines so day-window and lifetime metrics are not mixed.
- `TODAY.md` includes a `## Question Loop` section with a one-line timescale legend for Feishu/Windows/mobile handoff.
- Mira reviewed the first version as `PASS_WITH_NOTES`; accepted fixes renamed ambiguous `answered` copy to `answer-linked closure`, separated stock/backlog from flow, and pinned same-session answer-link behavior.
- Smoke coverage includes quiet, active, reopened, closed, overflow, and cross-session-answer edge cases.

Latest local work adds answer evidence provenance for review cards:

- `reviewCards[]` can now carry optional `evidenceCaptureId`.
- `sourceCaptureId` remains the original question/capture source; `evidenceCaptureId` points to the answer capture used as the card's answer evidence.
- Refreshing an answered-question card updates prompt, answer, and evidence id while preserving card id, due date, strength, and review history.
- Deleting the original source capture still deletes the card; deleting the answer evidence capture keeps the card and clears only `evidenceCaptureId`.
- Review UI shows `Answer evidence` only after the card is revealed, so the existence of a linked answer does not leak before recall.
- Browser smoke pins the reveal-gated evidence button and the jump back to the answer capture.

Latest local work also adds an `Answers Today` micro-surface:

- `buildTodayPack()` now emits `answerItems`, `answerOverflow`, and `answerDefinition`.
- `getStudyPackStats()` reports `answerCapturesToday`.
- Today UI and `TODAY.md` show `Answers Today` before `Closed Today`, so answer captures can be inspected before closing out the loop.
- Answer classification is explainable: linked question, tagged answer, or answer-prefix draft with enough body text.
- Imported inbox answers use import/update time for the local day window, so a phone answer captured earlier still appears when it is imported today.
- Overflow and `TODAY.md` output are pinned in smoke coverage.

Latest local work gates weak answers out of review-card answer generation:

- `reviewOverridesFromAnsweredQuestion()` now chooses the latest review-ready linked answer, not merely the latest linked answer.
- Very short answers such as `Answer: ok` do not replace review-card content or become `evidenceCaptureId`.
- If a newer answer is too weak but an older linked answer is useful, the review card uses the older useful answer.

Latest local work adds question-conversion receipts to the activity strip:

- Question actions now append a compact loop receipt to the activity detail.
- The receipt reports active questions, parked questions, questions closed today, and question cards made today.
- Browser smoke pins the receipt after Park, Answer draft, Make card, Resolve, Reopen, Refresh card, and Reopen-after-answer.

Latest local work ports `Answers Today` into the Harmony reader contract:

- `buildHarmonyReaderView()` now emits `localDayWindow`, `workspace.answerCaptureCountToday`, `answersToday`, and `answersTodayOverflow`.
- Harmony answer items carry `answeredAt` plus `answeredAtSource`, so the phone can explain whether the Today attribution came from `capturedAt`, `createdAt`, or an inbox patch landing through `updatedAt`.
- The ArkTS scaffold model and Index sample include read-only `Answers Today` fields.
- The Harmony import receipt includes `answerCaptureCountToday`.
- Smoke coverage pins workspace/mirror parity, inbox-import answer timing, old local answer edits that should not appear today, and the count/list/overflow invariant.
- This remains JSON contract/scaffold evidence only; DevEco compile, device rendering, file picker import, Feishu sync, and live login are still not proven.

Latest local work adds a Today section map for density:

- Today now keeps Learning Flow as the first action surface after the summary stats, then shows a compact section map for jumping into the denser ledgers.
- The map shows Due, Questions, Parked, Answers, Closed, Recent, and Drafts only when drafts exist.
- Each chip has a stable `data-today-map-target`, count, accessible jump label, and clicks to the matching `data-today-section` with a pulse.
- Browser smoke clicks the Recent chip and verifies the Recent Captures section pulses.
- Visual QA covered 1440x900 and 390x844 viewports with no horizontal overflow or button text overflow.

Latest local work folds first-run Start Here into Learning Flow:

- When the workspace has no captures, cards, due items, questions, answers, closed questions, or capture drafts, Today shows `Learning Flow` with `Capture on Mac`, `Close the loop`, and an embedded `Start Here` action row.
- Actions are concrete and local: the primary source action reuses `Read source` (`Open source`, `Resume source`, or `Set source`), `Capture this thought` focuses Quick Capture, `Ask about this` seeds a `Question: ` draft, and `Set up page clipper` opens Export with the bookmarklet selected.
- Browser smoke pins Learning Flow as the first Today content block, plus copy, button actions, Quick Capture focus, and capture pane pulse.
- Visual QA covered 1440x900 and 390x844; the Today map's minimum chip width was raised so `Questions` does not split awkwardly on mobile.

Latest local work makes the Mac learning route start from the source:

- Today > Learning Flow now starts with `Read source`, followed by `Capture on Mac` and `Close the loop`.
- A linked source without a timestamp stays compact as `Source linked`; a timestamped source becomes `Resume @ time`; a missing source becomes `Needs source` and focuses the Source URL field.
- The source step uses existing `buildResumeSource()` and `promptForSource()` paths, so it does not add workspace schema, sync state, or playback verification claims.
- Browser smoke pins source/capture/loop ordering, the no-source `Set source` focus path, timestamped `Resume source`, action aria labels, and the `.codex-tmp/browser-smoke` download route.
- Mira follow-up accepted the direction after deduping the source-ready state; Seed's second review misread the diff as a non-existent `href`/4th-step implementation, so those findings were rejected.

Latest local work makes sidecar focus keep the same route:

- When sidecar layout hides the sidebar and inspector, the activity strip now shows a compact `Source` / `Capture` / `Loop` rail.
- The rail reuses `resolveSourceSessionState()`, `focusQuickCapture()`, and `resolveCloseLoopState()`, so it is a focused view of the existing Learning Flow rather than another dashboard model.
- The rail stays hidden in the full three-column desk. Sidecar mode hides the dashboard metric row and Focus Brief fact/signal chips; the rail is `aria-live="off"` so it does not turn the activity live region into a noisy action dump.
- Browser smoke pins its sidecar-only visibility, source/capture/loop order, hidden metrics, collapsed Focus Brief facts/signals, clear-loop `Today` label, and disappearance after `Exit + Details`.
- Mira returned `PASS_WITH_NOTES`; accepted fixes were hierarchy reduction, explicit clear-loop exit copy, and live-region containment. Deferred: keyboard rail navigation and local telemetry.
- Mira follow-up returned `PASS` after the Focus Brief compacting change; its only remaining notes were optional narrow-width visual baseline and future keyboard rail navigation.
- Seed/Workflow was attempted twice on `ark/seed-code-0530`: a 2-worker batch returned one timeout and one tool-call-only response, and a narrower retry timed out with empty output. No Seed finding was accepted for this slice.

Latest local work adds clipboard-assisted source setup:

- The URL field now has a visible `Paste Source` button. It reads clipboard text only after the user clicks, extracts the first safe `http/https` URL, derives an editable source title, infers material type locally when safe, and pulls supported video timestamps into Time.
- If an existing topic already has captures, Paste Source keeps the current material type and explains that in the activity strip instead of silently reclassifying a `Doc` topic as `Video`.
- This is not active browser automation: no browser cookie/session/profile access, no page scraping, and no background clipboard monitoring.
- Browser smoke covers a copied YouTube URL with `t=95s`, confirming Source, URL, Video type, `01:35`, source-strip pulse, Quick Capture focus, non-URL rejection, and the existing-capture type guardrail.

Latest local work adds source-aware Quick Capture starters:

- Empty Quick Capture state now follows the bound source context: timestamped videos show `Video moment`, untimed videos show `Video note`, text sources show `Article excerpt`, `Doc excerpt`, or `Book excerpt`, and source-less topics fall back to generic `Ready`.
- Quote/thought placeholders change with that same context, so a video moment asks for a transcript/key phrase and question/takeaway/answer, while text sources ask for an excerpt and takeaway/question/application.
- The capture pane now has `Question`, `Answer`, and `Takeaway` starter buttons under a visible `Start draft` label. They only seed/convert the local Thought draft prefix and focus the field; Capture/Card still decide what gets committed.
- The same starter actions now have app-focused `Cmd/Ctrl+Shift+1/2/3` shortcuts that are ignored inside editable fields, so reading beside a source can stay keyboard-first without creating hidden captures.
- Starter buttons reflect the current Thought prefix with active styling and `aria-pressed`, so manual prefix edits and starter clicks stay visually aligned.
- After Capture, the local activity strip now gives a type-aware next step: questions open Today > Open Questions, linked answers open Closed Today, standalone answers open Answers Today, takeaways return to the capture stack, and card/cloze captures open Review. This is navigation feedback from committed captures only, not synced state.
- `Question:` / `Q:` with a non-empty body is now treated as an explicit question signal even without a literal `?`; a bare prefix still stays draft-like. Browser smoke also verifies that linked answer saves set the source question's resolved state before using the `Closed` action label.
- Workflow/Seed was attempted for post-save flow review. The first `ark/seed-code-0530` batch (3 tasks, concurrency 3) timed out with empty output; a narrower retry (1 task, concurrency 1) succeeded. Accepted: add explicit Cloze receipt coverage. Rejected: an `isLocal flag` recommendation that does not match the app's in-memory activity model.
- Uncommitted starter drafts stay local to the Mac/web instance and are excluded from Harmony/Windows static mirrors, Return JSON, workspace JSON, and Feishu mirror exports.
- The helper is local and resume-driven only; it does not read the browser, transcripts, cookies, sessions, or any external source state.
- Browser smoke now covers Paste Source video guidance, source-time staging guidance, article/book text guidance, starter button draft behavior, mobile starter-row no-overflow, and source-cleared fallback to `Ready`.
- Mira returned `PASS_WITH_NOTES`; accepted P1 fixes were distinct article/doc/book labels and removing hidden DOM reads from `captureGuidanceFor`. Deferred notes: sourceTitle-only still counts as source context for manual title-first setup, and visual cross-viewport confirmation remains manual QA.

Local agent temp convention:

- Use the project-local ignored `.codex-tmp/` directory for Seed batches, Mira packets/responses, transient receipts, and smoke scratch files.
- Do not route new local temp artifacts through the macOS private temp root; on this machine that path triggers avoidable approval prompts.
- Mira packets/responses stay in `.codex-tmp/mira-review/`; do not commit them or route through system temp paths.

Latest local work folds Today ledgers into Study Details:

- `Open Questions`, `Parked Questions`, `Answers Today`, `Closed Today`, and `Recent Captures` now sit inside a `Study Details` drawer below the primary decision cards, with open/parked/recent count badges in the summary.
- Today section-map buttons and Question Queue/Loop actions open the drawer before jumping to a nested section, so the details remain reachable without flattening the first screen.
- Browser smoke verifies the drawer starts closed and opens when each nested chip jumps to `Open Questions`, `Parked Questions`, `Answers Today`, `Closed Today`, or `Recent Captures`.

Latest local work tightens the generated morning review pack around those entry points:

- `review-start-here.html` now puts `First-Run Start Here` and `Today Section Map` before the older Focus Loop path, so morning review starts with the concrete app entry points Tony asked for.
- `MORNING_REVIEW.md` now points reviewers to the Start Here and Today map rows in `MAC_MANUAL_QA.md` without claiming the generator proves manual UI behavior.
- `MAC_MANUAL_QA.md` now has explicit `NT` rows for empty-workspace Start Here behavior and Today map chip jumps at sidecar/mobile widths.
- `validate-morning-receipts.mjs` pins these strings so the morning evidence pack cannot silently drift back to a generic artifact checklist.

Latest local work makes the Harmony file-picker/import contract concrete:

- The JS Harmony import boundary now validates a foreground file candidate before parsing: `.json` only, 5 MB max, unsupported type and oversize error codes pinned.
- The ArkTS scaffold mirrors that contract with `HARMONY_IMPORT_MAX_BYTES`, `validatePortableFileCandidate()`, and `describeImportPickerContract()`.
- The scaffold Index and ImportReceipt pages now tell the future DevEco implementer exactly what to accept, reject, and display without claiming the real picker has run.
- `DEVECO_HANDOFF.md` now spells out the foreground-only picker flow, accepted schemas, rejection receipts, and the rule that phone patch files stay on the export path.
- A targeted Mira review returned `PASS_WITH_NOTES`; accepted fixes tightened empty/invalid file-size handling, uppercase `.JSON` behavior, `size` vs `byteLength` precedence, receipt error-code copy, 5 MB rationale, and the caveat that ArkTS parity is a scaffold mirror rather than a behavior test.
- Deferred Mira notes: BOM/CRLF fixture parsing and smoke-guard self-mutation tests are useful later, but not blockers for this local contract increment.
- This remains scaffold/contract evidence only: no DevEco compile, no device picker, no device storage, and no Feishu-backed transport are claimed.

Latest local work adds the Harmony import-to-reader session handoff:

- `apps/companion-harmony/src/import-session.mjs` is now the executable JS source of truth for reader session state.
- Accepted imports move to `accepted-pending-persist`, replace `currentView`, keep the import receipt, and mark storage as `pending-device-persistence`.
- Rejected imports move to `rejected-kept-current` when a prior view exists, so selecting a bad patch/unsupported file cannot blank the phone reader.
- `markHarmonyReaderSessionPersisted()` names the future device-storage transition without claiming that HarmonyOS storage has run.
- ArkTS scaffold mirrors the same contract in `readerSessionState.ets`, and Index now surfaces the reader session summary/status rather than only a naked sample view.
- Mira returned `PASS_WITH_NOTES`; accepted fixes added reject-from-empty coverage, reject identity/deep-equal guards, no-view persist guards, JS/ArkTS status-literal parity, and the single-slot receipt rule.
- This is still scaffold evidence: no DevEco compile, no real picker, and no device persistence are claimed.

Latest local work aligns Harmony scaffold pages around the reader session:

- `readerSessionState.ets` now owns the shared scaffold sample view/session instead of each page inventing its own placeholder.
- Index, TopicDetail, and ReviewQueue all derive their visible data from `ReaderSessionState.currentView`.
- TopicDetail now names next action, latest capture, topic counts, and append-only capture-patch boundary.
- ReviewQueue now reads `dueReview` from the session, reveals the first due answer when available, and keeps grading framed as review-progress patch export.
- Scaffold smoke pins these page-to-session references; this is still not a DevEco compile/device rendering claim.

Latest local work improves Mac-first capture focus:

- `Cmd/Ctrl + Shift + C` is now the app-focused Quick Capture shortcut.
- It switches the active session back to Capture mode, opens the Captures tab, preserves sidecar layout, focuses Quote for an empty capture, and focuses Thought for a quote-only draft.
- Activity strip copy is draft-aware: `Quick Capture ready` for empty state and `Capture draft ready` when a local draft exists.
- Browser smoke verifies the sidecar-preserving path, editable-field dispatch, `preventDefault`, repeat pulse feedback, and quote-only draft focus.
- Product docs note the conflict boundary: this is not a system-wide hotkey and can conflict with browser DevTools or password/clipboard utilities that own the same chord.

Latest local work also clarifies source time staging:

- Quick Capture now has a compact source/time context strip so the capture surface itself shows the current source title, staged time, and a local Open action.
- The Time field now has local `-15` and `+15` nudge buttons plus ArrowDown/ArrowUp nudges while the Time field is focused, for correcting lecture timestamps while staying in the sidecar.
- Pasting a supported timestamped video URL into the source URL field now makes the hidden extraction visible with `Source time staged` in the activity strip and a pulse on the Time field.
- The extracted time is saved into the device-local capture draft, the source-open button reports the same local time target, and the stored session source URL strips only the time parameter so future source matching remains canonical.
- Browser smoke pins the input-before-change behavior, stored URL normalization, visible activity receipt, Time-field pulse, Quick Capture context source/time, context Open href, typed-but-unblurred Time reads, mouse and keyboard time nudges, empty/invalid Time fallback to latest capture time, `00:00` no-op feedback, empty-source disabled behavior, draft status, source-open title, stripped URL after blur/change, and a 390px sidecar/mobile layout where the Time row does not overflow and both nudge buttons stay at least 44px wide.
- The morning manual QA pack now has a `Source time staging` row; this remains Mac/web local URL-parser evidence, not Harmony/Windows reader UI parity and not live playback QA against external video sites.

Latest local work adds Quick Capture draft source drift protection:

- Device-local capture drafts now store a local source title/URL snapshot in UI prefs, still outside canonical workspace JSON and mirror exports.
- The snapshot is treated as the draft origin and stays stable until the draft is captured or cleared; later typing does not silently re-anchor it.
- If the current session source no longer matches the draft origin, the capture status changes to `Source changed`, receives a warn class, and exposes a status/title hint for accessibility.
- Today Capture Draft cards now also show `Source changed`, the draft origin, and the current source before the user resumes; Resume focuses the continuation field and carries that source-drift detail into the activity strip.
- `Use current` appears only while the draft source has drifted; it explicitly re-anchors the local draft to the current source and records `Draft source updated` in the activity strip.
- If a fresh local draft owns the Focus Brief next action, the Focus Brief also surfaces `Source changed` and the draft's original source, so the risk is visible before the user reopens Quick Capture.
- Source comparison reuses the existing URL matching normalization, so source-time query noise and title-only refreshes do not create warnings when the canonical URL is the same.
- Browser smoke pins source drift warning, Today draft-card drift visibility, same-source Today draft-card no-warning, title-only no-warning, source restore clearing the warning, source URL normalization, explicit re-anchor, clear-after-reanchor, Focus Brief drift surfacing, and post-capture snapshot reset.
- Mira returned `PASS_WITH_NOTES`; accepted fixes included stable first-source snapshot semantics, URL/title normalization, status accessibility, source restore coverage, title-only refresh coverage, and post-capture reset coverage. Deferred notes: real YouTube/Feishu-doc manual switching remains a manual QA item, not proven by local smoke.
- Latest Mira review for Today source-drift draft cards also returned `PASS_WITH_NOTES`; accepted follow-up was the negative same-source assertion. Rejected/deferred: collapsing the card detail further, because current copy is still one source warning line plus the existing device-local marker; deleted-origin and visual density checks remain manual/follow-up.

Latest local work closes the Recent Stack review hop:

- Promoted captures in the Quick Capture Recent Stack now show an enabled `Review` action instead of a disabled `Card` button.
- Clicking it selects the linked review card, switches the desk-native focus mode to Review, keeps the review hidden until reveal, and records `Review card opened` in the activity strip.
- Browser smoke pins the promoted capture stack actions, the Review hop, and the cleanup flow now expecting the stack Review action rather than a disabled card button.

Latest local work adds Recent Stack mistake recovery:

- Quick Capture Recent Stack rows now include the same confirmed `Delete` action as the capture inspector.
- Captures with linked review cards label the action as `Delete + N card(s)` and route through the existing `deleteCapture()` cascade, so the sidecar does not invent a second deletion rule.
- Canceling the confirmation leaves captures, cards, and stack rows intact.
- Deleting a stack-only mistaken capture removes it from the metrics and Recent Stack while recording `Capture deleted` in the activity strip.
- Mira returned `PASS_WITH_NOTES`; accepted fixes resolve the clicked session/capture from the current workspace, scope review reveal-state cleanup only to deleted linked cards, include the capture summary in the confirm prompt, and precompute linked-card counts for the stack render.
- Browser smoke pins promoted stack labels, richer confirm copy, cancel behavior, direct stack deletion, unrelated revealed review cards surviving a stack delete, and the existing inspector delete path.
- The deferred soft-undo note is now implemented as a local sidecar recovery affordance: after a capture delete, the activity strip shows `Undo 10s` for a short in-memory window and restores the capture plus prior review reveal state if clicked.
- Any subsequent `persistAndRender()` action clears the undo by default, and `scheduleSave()` also clears it when the user starts autosaved edits, so the old workspace snapshot is not kept after new learning work begins.
- Browser smoke pins the stack-only delete -> Undo -> restore -> re-delete loop, including metrics, stack text, activity copy, Undo visibility, and Undo hiding after restore.
- A targeted Mira review packet for the soft-undo state machine timed out through the broker (`error_code: TIMEOUT`, `error_stage: ssh`, elapsed about 630s, no logid). No Mira verdict was available for this increment, so rely on local tests plus code review until a later retry succeeds.

Latest local work clarifies the Quick Capture destination:

- The Quick Capture context strip now starts with `To <session title>`, so the sidecar tells the user where a quote/thought will be saved before they type.
- The destination chip updates with session title changes and session switches, sitting beside the existing source, timestamp, and Open controls.
- Clicking the destination chip exits sidecar layout, opens the Captures surface, focuses/pulses the active session row, and records `Capture destination shown` in the activity strip.
- Browser smoke pins the destination for the main fixture session and for a brand-new empty session, the sidecar destination-locate path, and the existing mobile-width capture-context no-overflow check covers the wider strip.

Latest local work clarifies Quick Capture intent:

- The Quick Capture context strip now includes an intent chip beside destination/source/time: `Ready`, `Quote`, `Thought`, `Capture`, `Question`, `Answer draft`, or `Answer`.
- The chip uses existing model semantics where possible: question detection uses `captureHasQuestion()`, and answer detection uses `captureHasAnswer()`; a short `Answer:` prefix is explicitly labeled `Answer draft` rather than pretending it will close a question.
- Browser smoke pins the empty ready state, question intent, short answer draft, review-ready answer intent, and the empty new-session intent.

Latest local work links local Answer drafts back to their questions:

- `Answer` from an open or parked question now seeds a local Quick Capture draft with `answersQuestionCaptureId`, and autosave preserves that target while the thought still begins with `Answer:`.
- If the source topic already has an unrelated quote/thought draft, or a video timestamp-only draft, the Answer action preserves that draft, focuses Quick Capture with `Finish current draft before answering`, and does not unpark a parked question yet.
- If the existing draft already targets the same question, clicking Answer resumes the draft and keeps partial answer text instead of resetting it to `Answer:`.
- Saving a sufficiently detailed local answer writes a linked answer capture and closes the original question in the target session, clearing parked state at the same time.
- Weak local answers such as `Answer: ok` can still be saved as answer drafts but do not close the linked question or pretend to be review-ready evidence.
- The UI now uses the model-layer `captureHasReviewReadyAnswer()` check for linked Answer intent and save readiness, so long-but-not-useful one-word answers still stay as `Answer draft` instead of showing `Answer saved`.
- Browser smoke pins the full UI path by blocking overwrite of an unrelated text draft and a video timestamp-only draft, resuming a partial linked answer draft, saving a real linked answer, verifying the question closes, and restoring the pre-save workspace snapshot before the rest of the question-flow assertions continue.
- Model smoke pins both weak-answer non-closure and strong-answer closure, plus capture-draft normalization for valid and invalid answer targets.

Latest local export work separates real saves from temporary downloads:

- Browser Save/Export buttons now prefer `window.showSaveFilePicker()` when the runtime supports it, so real Chromium users can choose the destination instead of silently filling Downloads.
- Inside the Mac shell, text-based web Save buttons now use a WK message bridge to call native NSSavePanel and report completion back into the web app; workspace JSON, review pack, current-session Markdown/JSON, Today, and mirror JSON all use this path.
- The native bridge sanitizes suggested filenames, limits text exports to 25 MB, maps common content types to `UTType`, and returns `false` on cancel so the web UI does not claim a save.
- Browsers without the File System Access API no longer silently fall back to Downloads. They must use Copy, a picker/native bridge, or an explicit smoke-only download flag.
- Static `review.html` and `inbox.html` now make `Copy Return File` the primary action; `Save Return File` is secondary and picker-first.
- Static return pages keep a stable per-draft return id and show `Suggested JSON file: ...`, so Copy and Save refer to the same timestamped return filename while the primary action still says Return File.
- Static return pages also expose `Manual Copy`, which only selects the preview return-file JSON when clipboard or picker permissions are unavailable; it does not write the clipboard, download a file, or start any background scan.
- Static Review/Inbox return panels now show a locked-down browser fallback: use `Manual Copy`, press `Ctrl+C`, paste into a text editor such as Notepad, save with the suggested `.json` filename, and move that file back to Mac. This addresses the Windows no-picker path without Downloads automation.
- Return imports with new work now show `Returned from phone/Windows` inside Learning Flow. The nudge is in-memory only, suppresses duplicate-only receipts, names captures/review updates separately, exposes `Import details`, and can be dismissed without altering workspace or mirror data.
- Workspace backup copy is now explicit about the path: picker success says `Backup saved - verify the selected file`, while fallback says `Backup export requested - verify the exported file`.
- Other save buttons use `saved` copy only for picker-backed saves and `download requested` copy only for explicit smoke fallback saves.
- ZIP export is intentionally not sent through the text bridge; it continues through save picker or explicit smoke fallback to avoid large binary payloads in the WK message body.
- `npm run smoke:browser` now creates a private ignored `.codex-tmp/browser-smoke/*/` root with separate Chrome profile and `downloads/` directory.
- Chrome's CDP download behavior is set to that temporary download path, and the page receives an explicit `window.__LC_ALLOW_AUTOMATED_DOWNLOADS__ = true` harness flag before the test clicks export/return buttons.
- Browser smoke also includes a negative return-file save case: when that explicit flag is absent in a controlled session, clicking `Save Return File` creates no download file and surfaces Copy guidance.
- The script waits for Chrome to exit before deleting the current smoke root, and a startup janitor removes stale `lc-browser-smoke-*` roots older than 30 minutes.
- A plain web page still cannot write arbitrary files into a chosen local scratch directory; `.codex-tmp/` routing is only for automated smoke fallback downloads. The Mac shell `File > Export Workspace...` remains the native NSSavePanel path.

## Verified Locally

These passed after the linked Answer readiness update:

- `npm run smoke`
- `npm run smoke:browser`
- `git diff --check`

These passed after the browser smoke temp-download update:

- `npm run smoke:browser`
- `git diff --check`

These passed after the save-picker export update:

- `npm run smoke`
- `npm run smoke:browser`
- `git diff --check`

These passed after the Mac-shell web save bridge:

- `npm run smoke`
- `npm run smoke:browser`
- `npm run mac:build`
- `git diff --check`

The last full offline headline gate before this handoff was:

- `npm run check:morning` (includes Harmony, mirror, perf, and morning receipt gates)

Approval-gated or environment-gated checks were intentionally skipped tonight:

- Mac native build or manual app QA.
- DevEco/Harmony compile and device validation.
- Real Feishu write/sync verification.
- Push or GitHub remote operations if network/approval is unavailable.

## Mira Review Stance

Mira is now available as a Tony-only external review gate through the Hermes broker path. Use it for important artifacts, especially architecture, permission boundaries, data contracts, and risky UX claims.

Current local operating model:

- The `mira-review` skill is internal to Tony's Codex environment, not part of this repository.
- Codex sends only a sanitized review packet through `hermes-mira-review`.
- The SSH path is constrained to a forced-command `codex-mira` entry, which forwards JSON over a broker socket to an openclaw-owned Hermes service.
- The broker owns Mira/Feishu session handling and returns only sanitized JSON verdict/status plus optional sanitized response text.
- `.mira-review/` stays ignored. Do not commit packets, responses, or broker status files.

Operational stance:

- Ask Mira for targeted criticism, blockers, evidence gaps, and concrete fixes.
- Accept only findings that can be tied to code, tests, docs, or risk posture.
- Do not blindly follow Mira. Reject generic advice that conflicts with tonight's no-approval constraint or the actual code evidence.
- Never send secrets, raw auth material, unsanitized logs, customer data, or high-risk personal data.

Latest absorbed Mira notes for mirror question answer links:

- Keep the link framed as a draft, not as completed answering.
- Treat every `inbox.html` query param as untrusted.
- Validate `topicId` against known topics and surface fallback.
- Add hostile escaping and round-trip tests beyond only `sourceUrl`.
- Document CSP and query-prefill boundaries.

Latest absorbed Mira notes for parked question loop:

- Normalize illegal `resolved + parked` state to resolved-only.
- Add Harmony unresolved-question count so active-only open questions do not hide parked unresolved questions.
- Let parked questions show when they were parked and provide a direct Answer path.
- Pin transition coverage for Park, Answer-from-parked, Resolve, Reopen, and Resume.

Latest absorbed Mira notes for `Closed Today`:

- Keep `resolved` as the data-layer name and `Closed Today` as UI copy.
- Centralize the local day window instead of duplicating `new Date(year, month, day)` boundaries.
- Surface the local window in UI/Markdown because Feishu, Windows, and Harmony may render later or in a different timezone.
- Assert Reopen state transitions, same-day re-resolve behavior, and overflow instead of only testing the happy path.
- Defer DST-specific and visual screenshot work as follow-up; tonight's local gates are enough for this increment.

Latest absorbed Mira notes for answered-question review cards:

- Pin the promoted-before-answered contract so no duplicate or silent stale-card replacement occurs.
- Pin multi-answer ordering and equal-time tie-breaking.
- Normalize `Q:` / `Question:` prompt prefixes.
- Cover quote-only answer captures, not only thought+quote answers.
- The earlier follow-ups for `evidenceCaptureId` and weak-card quality gating have now landed as small, additive local changes.

Latest absorbed Mira notes for Answer draft collision protection:

- Accepted the P1 timestamp-only critique for video topics: a bare time anchor can be an in-flight study draft, so Today > Answer now guards it instead of overwriting it.
- Accepted clearer guard context: the activity detail now names the target question short text before showing the preserved draft summary.
- Kept quote-only focus moving to Thought, with a code comment documenting the highlight-to-reflection contract.
- Rejected duplicate parked-state/focus test work as already covered after adding the explicit timestamp-only browser branch.

Latest absorbed Mira notes for `Question Loop`:

- Keep `Question Queue Health` as stock/backlog and make `Question Loop` a flow/transition card.
- Rename ambiguous `answered` wording to `answer-linked closure`.
- Separate Today metrics from Lifetime review-card totals in both UI and Markdown.
- Add a Markdown legend because Feishu/Windows/mobile handoff loses hover/tooltips.
- Pin same-session answer-link semantics; cross-session answers do not count as answer-linked closures.

Latest absorbed Mira notes for answer evidence provenance:

- Keep `sourceCaptureId`, `answersQuestionCaptureId`, and `evidenceCaptureId` as separate invariants; the code and docs now state their roles.
- Avoid showing `Answer evidence` before reveal, because it leaks the presence of an answer and weakens recall.
- Preserve cards when only the answer evidence capture is deleted; clear the evidence pointer instead of deleting review history.
- Add schema description/length for `evidenceCaptureId` and pin same-session plus tie-break behavior in tests/docs.
- Do not blindly drop unresolved `evidenceCaptureId` during normalization; partial cross-device sync can make a valid evidence capture temporarily absent. The UI only renders the button when the capture is resolvable, and explicit deletion clears the pointer.

Latest absorbed Mira notes for `Answers Today`:

- Keep the surface, because unlinked/staged/cross-device answer captures do not fit inside Closed Today.
- Make answer classification explainable and stricter than a plain `A:` prefix.
- Put Answers Today before Closed Today so it reads as a pending inspection surface rather than only a historical trail.
- Pin overflow and Markdown behavior.
- Defer classifier corpus metrics, rule-versioning, and broader mirror UI surfaces; the offline mirror integrity gate and TODAY.md coverage are enough for this local increment.

Latest absorbed Mira notes for Harmony `Answers Today`:

- Add `answeredAtSource` so the generated view explains whether `answeredAt` came from capture time, create time, or inbox patch landing time.
- Keep `answersToday` top-level because this matches the existing reader-view pattern: `workspace` carries counts while top-level arrays carry display collections such as `dueReview`, `openQuestions`, and `parkedQuestions`.
- Document that `answeredAt` is Today attribution time, not necessarily the original human answer time.
- Document that `localDayWindow` is the reader generator's local window and must not be silently recomputed as phone-local time.
- Pin negative coverage for an old local answer edited today that should not reappear in `Answers Today`.
- Pin the invariant `answerCaptureCountToday === answersToday.length + answersTodayOverflow` for the current limit.

Latest Mira note for Today section map:

- A targeted Mira review was attempted for the map/density UX but timed out at the SSH broker layer after roughly 630s (`error_code: TIMEOUT`, `error_stage: ssh`).
- No Mira verdict was available for this increment. Local code review accepted the small readability fix from `Active Q` to `Questions`; no broader information-architecture rewrite was made.

Latest absorbed Mira notes for Harmony import/file-picker contract:

- Keep the contract, but make zero-byte and invalid-size failures diagnostic before JSON parsing.
- Pin case-insensitive `.json` extension behavior and `size` precedence over `byteLength`.
- Include every returned candidate-validation code in ImportReceipt copy, including `INVALID_FILE_SIZE`.
- State that ArkTS `validatePortableFileCandidate()` is scaffold parity only until DevEco/device tests execute it.
- Add rationale and revisit trigger for the 5 MB limit; current cap is conservative for read-only MVP fixtures.
- Defer BOM/CRLF and smoke self-mutation checks until a real picker or broader import corpus makes them worth the extra surface.

Latest absorbed Mira notes for Recent Stack delete:

- Keep the commit; no blocker for a local Mac-first MVP increment.
- Resolve `session` and `capture` by id at click time instead of trusting render-time closures.
- Only clear `activeReviewKey` / `revealedReviewCards` for review cards actually linked to the deleted capture.
- Include the capture summary and linked-card count in the confirmation prompt.
- Pin the cancel path, direct stack delete, and unrelated revealed-review preservation in browser smoke.
- Track broader undo history as a future mistake-recovery improvement before this delete helper spreads to more surfaces; the first local one-step capture-delete undo has landed.

Latest absorbed Mira notes for native sidecar capture:

- Keep the native bridge sidecar invariant: a selected-text or clipboard capture from the Mac shell should stay in compact sidecar mode, keep the Capture tab active, and keep the Source / Capture / Loop rail visible.
- Replace the verb-shaped native capture action label with an artifact-shaped label: normal native saves now point to `Saved capture`, while promoted native saves point to `Review card`.
- Pin click-through behavior in browser smoke so the sidecar activity action exits sidecar and highlights the saved capture by `targetId`.
- Pin the promoted native branch so the new `actionLabel` ternary is covered by both capture and review-card paths.
- Defer transient rail acknowledgement for the latest save; persistent flow state stays in the rail, while ephemeral save feedback stays in the activity strip.
- Native macOS Accessibility/Automation GUI QA remains a manual gate; current evidence covers the Web bridge path plus SwiftPM build.

Latest absorbed Mira notes for static Return next-step cue:

- Keep the persistent cue because phone/Windows users need a stable answer to "what is staged in the file I must bring back to Mac?"
- User-facing cue copy now says `return file` instead of `Return JSON`; schema/docs terminology remains precise where the JSON payload itself matters.
- Avoid implying Copy/Save always succeeds; the cue now says to use Copy or Save to take the return file back to Mac, while existing status/fallback paths report failures.
- Add `role="status"` and `aria-live="polite"` to the cue because it is the "do not lose work" anchor on static device pages.
- Browser smoke now asserts both increment and clear/decrement behavior for review progress and inbox drafts.
- Real Harmony/Windows Copy/Save success remains a manual/device gate, not claimed by this local smoke.

## Next Local Work

1. Continue the study loop:
   - Prefer one more Mac-first dogfood polish around source/timestamp capture or sidecar focus before broadening claims.
   - A good next local increment is to tighten the capture context around actual browser study use: what changed, where the note will land, and how to resume the source without touching approval-gated native APIs.
   - A useful local follow-up is to harden the new soft-undo affordance with a visible expiry cue or a broader one-step undo pattern for review-card deletion, if the current capture-only undo feels good in dogfood.
   - Consider a local persisted-view adapter stub only if it helps the Harmony/Windows handoff without claiming device storage has run.
   - Run the separate native/browser gates when approvals/network/device conditions allow; do not let those block local product increments.

2. Keep the cross-end story honest:
   - Mac/web offline path is strongest today.
   - Harmony remains schema/scaffold plus fixture evidence until compile/device gates run.
   - Feishu mirror is a dry-run/contract path until real write sync is verified.

3. Record approval-gated TODOs instead of stalling:
   - Mac build/manual QA.
   - Harmony device compile.
   - Feishu authenticated write test.
   - Push/GitHub actions if network is unavailable.
   - Mira broker auth/session maintenance, if the broker reports `AUTH_EXPIRED`, `AUTH_UNAVAILABLE`, or `TIMEOUT`.

## Resume Commands

Start with:

```bash
git status --short --branch
git log --oneline -8
```

If continuing local validation:

```bash
npm run smoke
npm run smoke:browser
npm run check:morning
git diff --check
```

If preparing another review packet, use Mira for sharp critique and then decide what to absorb yourself.
