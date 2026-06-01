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

## Verified Locally

These passed after the Today section map update:

- `npm run smoke`
- `npm run smoke:browser`
- `npm run smoke:harmony`
- `npm run check:morning`
- `git diff --check`

Approval-gated or environment-gated checks were intentionally skipped tonight:

- Mac native build or manual app QA.
- DevEco/Harmony compile and device validation.
- Real Feishu write/sync verification.
- Push or GitHub remote operations if network/approval is unavailable.

## Mira Review Stance

Mira is now available as a Tony-only external review gate through the Hermes broker path. Use it for important artifacts, especially architecture, permission boundaries, data contracts, and risky UX claims.

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

## Next Local Work

1. Continue the study loop:
   - Consider whether the next useful increment is making the Harmony scaffold import/file-picker story more concrete without claiming device validation, or adding a small "start here" empty-state seed for first-run study flow.

2. Keep the cross-end story honest:
   - Mac/web offline path is strongest today.
   - Harmony remains schema/scaffold plus fixture evidence until compile/device gates run.
   - Feishu mirror is a dry-run/contract path until real write sync is verified.

3. Record approval-gated TODOs instead of stalling:
   - Mac build/manual QA.
   - Harmony device compile.
   - Feishu authenticated write test.
   - Push/GitHub actions if network is unavailable.

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
