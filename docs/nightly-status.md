# Nightly Status

## Current Branch

```text
product/mvp-learning-sidecar
```

## What Works

- Local web MVP runs without installing dependencies.
- Installable web shell metadata and static offline cache.
- Minimal macOS WKWebView shell scaffold builds with SwiftPM.
- Three-pane learning sidecar for Mac/browser workflow.
- Sidecar layout toggle that collapses navigation and inspector around the active session.
- Desk activity strip that keeps save/review/synthesis feedback visible in focused sidecar mode.
- Sessions, source context, timestamp, tags.
- Capture-level source snapshots with source/time jump links.
- Quick capture quote/thought.
- One-click capture insertion into Notes with idempotent capture blocks.
- Synthesis draft generation from captures into notes, with stale-source warning and idempotent insertion.
- Capture-to-review-card promotion.
- Cloze review card authoring from selected quote text.
- Workspace-wide due review queue with simple strength buckets.
- Self-graded Again/Good review outcomes with isolated scheduling policy.
- Review answers are reveal-gated before grading.
- Desk-native review pane works in focused sidecar layout.
- Today tab summarizes workspace due review and recent captures.
- Markdown notes editor with autosave.
- Safe read-mode preview for notes.
- Safe formatting preview for capture thoughts and review answers.
- Markdown + JSON export for the active session.
- Copy/save `TODAY.md` directly from the Export panel.
- Credential-free Feishu mirror bundle with README, workspace restore payload, and per-session Markdown/JSON sidecars.
- Credential-free Feishu mirror ZIP containing the same readable folder files, including derived `TODAY.md`.
- Import can restore either a raw workspace JSON or a Feishu mirror bundle.
- Copyable browser capture bookmarklet from the Export tab, including active video time.
- Full workspace JSON import/export.
- Browser bookmarklet and URL inbound capture contract.
- Workspace schema contract in `docs/schema/workspace.v1.schema.json`.
- Browser smoke test verifies capture -> card -> localStorage -> UI metrics.
- Browser smoke also verifies installable/offline shell metadata, sidecar layout toggling, desk-level activity feedback, Today tab/direct Today export/mirror study pack, desk-native review in sidecar layout, capture source snapshots/time links, capture-to-notes insertion, mirror ZIP affordance, Cloze cards, workspace-wide due review, reveal-before-grade review flow, synthesis insertion, stale-draft handling, capture formatting, mirror bundle generation/import, inbound bookmarklet capture, and notes preview rendering.

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
npm run mac:build
```

`smoke:browser` uses local Chrome headless and a temporary profile.
`mac:build` uses local SwiftPM and does not package or sign an `.app` yet.

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
- Keep the sidecar layout local-only, guard its keyboard shortcut inside editable fields, and keep a visible way back when panels are hidden.
- Add desk-level activity feedback so hidden inspector panels do not swallow the user's sense of what changed.
- Make the activity action explicit when it exits focus mode, use `aria-live`, and scroll/highlight the referenced capture or card where possible.
- Keep capture source snapshot fields optional in the v1 schema, add source provenance, and harden source jump URL handling.
- Move core review actions into the desk for sidecar focus, keep reveal state coherent across inspector/desk surfaces, and add keyboard grading shortcuts.
- Add a derived Today study pack from one pure builder, with explicit generated/window metadata, relative session links, and `workspace.json` as source of truth.
- Keep the Mac shell honest as a thin WKWebView wrapper: deterministic file origin, external-link handoff, and no silent localhost fallback.

Deferred:

- Real Feishu OpenAPI sync. One-way export should come before sync.
- Native Mac shell beyond the thin wrapper: production packaging, global hotkey, menu commands, OS capture, and browser URL bridge.
- AI-generated synthesis. The deterministic draft should prove the workflow before adding another model.
- Full timezone boundary matrix for Today pack; current implementation stamps the local day window and due cutoff, but browser/device cross-timezone behavior still deserves manual QA.

## Next Best Commits

1. Add a real Feishu one-way uploader that consumes the mirror bundle after credentials are explicitly configured.
2. Start Mac shell exploration with global capture and sidecar window as the first native affordances.
3. Start HarmonyOS schema reader prototype after one-way export is stable.
4. Test bookmarklet capture on YouTube, Feishu Docs, and developer docs.

## Known Risks

- `localStorage` is still a temporary store; export often.
- Bookmarklet behavior should be tested on YouTube, Feishu Docs, and common documentation sites.
- Safari/Firefox localStorage quota behavior is not verified.
- Today pack timezone behavior across Mac, HarmonyOS, and Windows is not manually verified yet.
- Mac shell is currently a thin WKWebView wrapper; it does not yet add global capture or browser context.
- Mac shell launch/relaunch persistence has not been manually smoke-tested inside the GUI tonight.
- HarmonyOS app is not started yet; schema is ready for exploration.
- Sidecar layout still hides full inspector details; the desk review pane handles core review, while bulk review management still lives in the inspector.
- Activity strip messages are intentionally ephemeral UI state; after reload or session switch they fall back to derived latest-capture/review-queue summaries.
