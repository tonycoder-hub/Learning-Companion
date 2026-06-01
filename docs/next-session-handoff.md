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

Current uncommitted work adds a Question Loop summary:

- `buildTodayPack()` now emits `questionLoop`, a derived summary of active, parked, closed-today, answer-linked closed-today, and question-sourced review-card counts.
- Today UI shows `Question Loop` as a flow card after `Question Queue Health`, with Today, Backlog, and Lifetime lines so day-window and lifetime metrics are not mixed.
- `TODAY.md` includes a `## Question Loop` section with a one-line timescale legend for Feishu/Windows/mobile handoff.
- Mira reviewed the first version as `PASS_WITH_NOTES`; accepted fixes renamed ambiguous `answered` copy to `answer-linked closure`, separated stock/backlog from flow, and pinned same-session answer-link behavior.
- Smoke coverage includes quiet, active, reopened, closed, overflow, and cross-session-answer edge cases.

## Verified Locally

These passed after the `Question Loop` update:

- `npm run smoke`
- `npm run smoke:browser`
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
- Defer `evidenceCaptureId` and weak-card quality gating as explicit follow-ups instead of smuggling in a schema change.

Latest absorbed Mira notes for `Question Loop`:

- Keep `Question Queue Health` as stock/backlog and make `Question Loop` a flow/transition card.
- Rename ambiguous `answered` wording to `answer-linked closure`.
- Separate Today metrics from Lifetime review-card totals in both UI and Markdown.
- Add a Markdown legend because Feishu/Windows/mobile handoff loses hover/tooltips.
- Pin same-session answer-link semantics; cross-session answers do not count as answer-linked closures.

## Next Local Work

1. Continue the study loop:
   - Consider a question-conversion receipt: active, parked, answered/resolved, and promoted-to-review counts.
   - Consider an "answers imported today" micro-surface if the user needs to inspect answer captures separately from resolved questions.
   - Consider `evidenceCaptureId` or equivalent provenance so future review cards can jump to both the original question and the answer evidence.
   - Consider weak-card gating for answer captures that are too short or empty to become useful review cards.

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
