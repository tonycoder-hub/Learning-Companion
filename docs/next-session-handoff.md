# Next Session Handoff

Date: 2026-05-29

## Mainline Goal

Build a Mac-first learning companion for browser-based study. The core loop is:

- Read or watch in a browser while keeping a focused sidecar nearby.
- Capture quick notes, quotes, timestamps, questions, and follow-up cards without breaking focus.
- Turn captures into synthesis, review material, and open-question queues.
- Mirror the useful study state across Mac, Harmony phone, Windows, and Feishu-backed folders without pretending unverified integrations are done.

The product bias is a calm study cockpit, not a generic note app. Every feature should help the user decide what to read, capture, close, or review next.

## Completed And Pushed

- `23999eb feat: expose open questions in harmony reader`
  - Harmony reader view now exports workspace/topic open-question counts, capped question lists, and resolved/reopened question state.
- `55ab17d test: show harmony questions in morning pack`
  - Morning fixture and receipts now include an open Rust traits question plus resolved question evidence.
- `b61883b feat: preview open questions in mirror home`
  - Mirror `index.html` shows a short open-question preview and count.
- `d453a64 test: harden mirror question preview`
  - Added escaping, overflow, and safe relative session-path coverage after Mira review.
- `f3d1e2a test: validate morning question evidence`
  - Morning receipts now assert Harmony, dashboard, stage, review, and mirror-home question evidence.
- `008d1f6 docs: add question loop to manual qa`
  - Manual QA now covers open-question handoff plus make-card, resolve, and reopen flows.

Latest remote-ready branch state before this handoff was clean at `origin/product/mvp-learning-sidecar`.

## Current Evidence

The following checks passed during the last working block:

- `npm run smoke:harmony`
- `npm run smoke`
- `npm run demo:morning`
- `npm run morning:receipts`
- `npm run check:morning`

The browser/native/manual gates were not rerun in this block because they are approval or GUI dependent. Do not block tonight on those if approvals are unavailable.

## Mira Review Notes

Use Mira as a sharp external reviewer for important delivery packets, especially architecture, permission, data-boundary, and test-risk decisions.

Operational stance:

- Ask Mira for targeted criticism, blockers, evidence gaps, and concrete fixes.
- Treat `PASS_WITH_NOTES` as useful only when the notes are specific enough to change tests, code, docs, or risk posture.
- Do not blindly follow Mira. Accept concrete findings; reject generic "run every possible QA gate" advice when the user has said approvals will not be available.
- Never send secrets, raw auth material, unsanitized logs, customer data, or high-risk personal data to Mira.

## Approval-Gated TODOs

Track these without blocking ordinary local progress:

- DevEco or Harmony compile/device validation.
- Real Feishu write/sync verification.
- Browser GUI smoke.
- Native Mac app manual QA.
- Any sudo/system-account/network operation.

## Suggested Next Local Work

1. Revisit Focus Brief open-question guidance carefully.
   - Do not repeat the half-finished experiment of adding `questions` as a next action without wiring the full stack.
   - If implemented, update action kind typing, button label mapping, app action handling, browser smoke, Harmony schema if needed, docs, and Mira review packet.
   - Consider a lower-risk alternative first: a Focus Brief signal or shortcut that jumps to Today/Open Questions while preserving review and synthesis priority.

2. Tighten the Today/Open Questions UX.
   - Make the open-question queue feel like a study loop: answer, make card, resolve, reopen, or park.
   - Keep count/list behavior honest across Harmony, mirror home, Today, and morning receipts.

3. Add a "what to inspect first" morning/dashboard section.
   - Use existing receipts to recommend the next inspection target without inventing state.

4. Keep cross-end claims honest.
   - Mac/web offline path is strongest today.
   - Harmony is schema/scaffold plus fixture evidence until compile/device gates run.
   - Feishu mirror is folder/contract oriented until live sync/write is verified.

## Resume Command Hints

Start with:

```bash
git status --short --branch
npm run check:morning
```

If working on Focus Brief next:

```bash
rg "chooseFocusNextAction|nextAction|FocusActionKind|runFocusBriefAction|focusBriefButtonLabel" apps harmony scripts docs
```

