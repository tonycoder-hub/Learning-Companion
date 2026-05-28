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
- Capture-to-review-card promotion.
- Cloze review card authoring from selected quote text.
- Due review queue with simple strength buckets.
- Markdown notes editor with autosave.
- Safe read-mode preview for notes.
- Safe formatting preview for capture thoughts and review answers.
- Markdown + JSON export for Feishu mirror.
- Full workspace JSON import/export.
- Browser bookmarklet and URL inbound capture contract.
- Workspace schema contract in `docs/schema/workspace.v1.schema.json`.
- Browser smoke test verifies capture -> card -> localStorage -> UI metrics.
- Browser smoke also verifies Cloze cards, capture formatting, and notes preview rendering.

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

Deferred:

- Native Mac shell. The local learning loop needs a little more product truth first.
- Real Feishu OpenAPI sync. One-way export should come before sync.
- Native Mac shell. The local learning loop is now stronger, but shell work should still add OS capture rather than just wrap the UI.

## Next Best Commits

1. Add a real Feishu one-way export adapter after credentials are explicitly configured.
2. Start Mac shell exploration with global capture and sidecar window as the first native affordances.
3. Start HarmonyOS schema reader prototype after one-way export is stable.
4. Test bookmarklet capture on YouTube, Feishu Docs, and developer docs.

## Known Risks

- `localStorage` is still a temporary store; export often.
- Bookmarklet behavior should be tested on YouTube, Feishu Docs, and common documentation sites.
- Safari/Firefox localStorage quota behavior is not verified.
- HarmonyOS app is not started yet; schema is ready for exploration.
