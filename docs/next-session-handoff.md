# Next Session Handoff

Date: 2026-06-01

## Mainline Goal

Build a Mac-first learning companion for browser-based study. The core loop is:

- Read or watch in a browser while a calm sidecar stays nearby.
- Capture quotes, thoughts, timestamps, questions, and follow-up cards without breaking focus.
- Turn open questions into answers, cards, synthesis, review material, or parked follow-up.
- Mirror useful study state across Mac, Harmony phone, Windows, and Feishu-backed folders without pretending unverified integrations are done.

The product bias is a study cockpit, not a generic note app. Every feature should help the user decide what to inspect, capture, close, or review next.

## Current Branch State

Branch: `product/mvp-learning-sidecar`

Recent local work on top of `origin/product/mvp-learning-sidecar`:

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

- Today now shows a compact section map after the summary stats and before Patch Intake.
- The map shows Due, Questions, Parked, Answers, Closed, Recent, and Drafts only when drafts exist.
- Each chip has a stable `data-today-map-target`, count, accessible jump label, and clicks to the matching `data-today-section` with a pulse.
- Browser smoke clicks the Recent chip and verifies the Recent Captures section pulses.
- Visual QA covered 1440x900 and 390x844 viewports with no horizontal overflow or button text overflow.

Latest local work adds a first-run Start Here card:

- When the workspace has no captures, cards, due items, questions, answers, closed questions, or capture drafts, Today shows a compact `Start Here` action card.
- Actions are concrete and local: `Capture first point` focuses Quick Capture, `Write first question` seeds a `Question: ` draft, and `Browser clipper` opens Export with the bookmarklet selected.
- Browser smoke pins the card copy, button actions, Quick Capture focus, and capture pane pulse.
- Visual QA covered 1440x900 and 390x844; the Today map's minimum chip width was raised so `Questions` does not split awkwardly on mobile.

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
- `Use current` appears only while the draft source has drifted; it explicitly re-anchors the local draft to the current source and records `Draft source updated` in the activity strip.
- If a fresh local draft owns the Focus Brief next action, the Focus Brief also surfaces `Source changed` and the draft's original source, so the risk is visible before the user reopens Quick Capture.
- Source comparison reuses the existing URL matching normalization, so source-time query noise and title-only refreshes do not create warnings when the canonical URL is the same.
- Browser smoke pins source drift warning, title-only no-warning, source restore clearing the warning, source URL normalization, explicit re-anchor, clear-after-reanchor, Focus Brief drift surfacing, and post-capture snapshot reset.
- Mira returned `PASS_WITH_NOTES`; accepted fixes included stable first-source snapshot semantics, URL/title normalization, status accessibility, source restore coverage, title-only refresh coverage, and post-capture reset coverage. Deferred notes: real YouTube/Feishu-doc manual switching remains a manual QA item, not proven by local smoke.

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
- Browser smoke pins the destination for the main fixture session and for a brand-new empty session, and the existing mobile-width capture-context no-overflow check covers the wider strip.

## Verified Locally

These passed after the Quick Capture destination update:

- `npm run smoke`
- `npm run smoke:browser`
- `npm run check:morning` (includes Harmony, mirror, perf, and morning receipt gates)
- `git diff --check`

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
