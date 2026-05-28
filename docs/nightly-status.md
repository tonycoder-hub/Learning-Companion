# Nightly Status

## Current Branch

```text
product/mvp-learning-sidecar
```

## What Works

- Local web MVP runs without installing dependencies.
- Three-pane learning sidecar for Mac/browser workflow.
- Sessions, source context, timestamp, tags.
- Quick capture quote/thought.
- Synthesis draft generation from captures into notes, with stale-source warning and idempotent insertion.
- Capture-to-review-card promotion.
- Cloze review card authoring from selected quote text.
- Workspace-wide due review queue with simple strength buckets.
- Self-graded Again/Good review outcomes with isolated scheduling policy.
- Review answers are reveal-gated before grading.
- Markdown notes editor with autosave.
- Safe read-mode preview for notes.
- Safe formatting preview for capture thoughts and review answers.
- Markdown + JSON export for the active session.
- Credential-free Feishu mirror bundle with README, workspace restore payload, and per-session Markdown/JSON sidecars.
- Import can restore either a raw workspace JSON or a Feishu mirror bundle.
- Copyable browser capture bookmarklet from the Export tab, including active video time.
- Full workspace JSON import/export.
- Browser bookmarklet and URL inbound capture contract.
- Workspace schema contract in `docs/schema/workspace.v1.schema.json`.
- Browser smoke test verifies capture -> card -> localStorage -> UI metrics.
- Browser smoke also verifies Cloze cards, workspace-wide due review, reveal-before-grade review flow, synthesis insertion, stale-draft handling, capture formatting, mirror bundle generation/import, inbound bookmarklet capture, and notes preview rendering.

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
```

`smoke:browser` uses local Chrome headless and a temporary profile.

## Review Notes Absorbed

Accepted from Mira:

- Harden URL inbound and reject unsafe schemes.
- Add schema/version contract.
- Add localStorage size warning/export prompt.
- Make the review loop real enough to test.
- Move user/page-sourced text away from `innerHTML`.
- Add browser-level smoke coverage.
- Add self-grading before pretending the review loop is real.
- Harden Synthesize with stale-source warning, edit overwrite confirmation, generated counts, and idempotent insertion.
- Treat Feishu mirror export as a staging bundle, with explicit canonical/derived authority and snapshot semantics.

Deferred:

- Real Feishu OpenAPI sync. One-way export should come before sync.
- Native Mac shell. The local learning loop is now stronger, but shell work should still add OS capture rather than just wrap the UI.
- AI-generated synthesis. The deterministic draft should prove the workflow before adding another model.

## Next Best Commits

1. Add a real Feishu one-way uploader that consumes the mirror bundle after credentials are explicitly configured.
2. Start Mac shell exploration with global capture and sidecar window as the first native affordances.
3. Start HarmonyOS schema reader prototype after one-way export is stable.
4. Test bookmarklet capture on YouTube, Feishu Docs, and developer docs.

## Known Risks

- `localStorage` is still a temporary store; export often.
- Bookmarklet behavior should be tested on YouTube, Feishu Docs, and common documentation sites.
- Safari/Firefox localStorage quota behavior is not verified.
- HarmonyOS app is not started yet; schema is ready for exploration.
