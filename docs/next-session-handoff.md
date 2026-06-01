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

Latest local work makes answer resolution visible in import receipts:

- `formatInboxReceipt()` now reports when an imported answer resolved a question.
- The same receipt reports skipped answer targets with reason counts, such as `invalid: 1`.
- Browser smoke covers both visible invalid-target skip feedback and an answer patch that closes the original open question.
- The answer-patch resolver remains hardened from the prior commit: bounded ASCII ids, reason-tagged skips, duplicate idempotency, cross-topic negatives, already-closed targets, self-reference, and same-patch reference coverage.

## Verified Locally

These passed after the receipt UI update:

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

## Next Local Work

1. Continue the study loop:
   - Consider a question-conversion receipt: active, parked, answered/resolved, and promoted-to-review counts.
   - Consider a tighter Today surface for "answers imported today" so the user sees closure after patch import without opening import history.
   - Consider a small "closed today" section that keeps resolved questions visible briefly, then fades into review.

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
