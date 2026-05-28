# Nightly Status

## Current Branch

```text
product/mvp-learning-sidecar
```

## Stage Wording

Use [promotion-gates.md](promotion-gates.md) to distinguish local fixtures, dry-runs, schema prototypes, internal builds, and live integrations. Current Feishu work is local plan/dry-run, HarmonyOS work is a schema reader prototype, and the Mac shell is an internal build.

## What Works

- Local web MVP runs without installing dependencies.
- Installable web shell metadata and static offline cache.
- Minimal macOS WKWebView shell scaffold builds with SwiftPM.
- Mac shell has an app-focused clipboard-to-capture menu command.
- Mac shell can save selected text directly as a capture with `Ctrl+Option+Cmd+X` when macOS Accessibility access and the frontmost app expose `AXSelectedText`, with a labeled clipboard fallback only when the clipboard has changed since the last native capture.
- Mac shell can save clipboard text directly as a capture with `Ctrl+Option+Cmd+C` via a best-effort global hotkey, with registration status visible in the Capture menu.
- Mac shell hotkey capture can attach active Safari/Chromium-family page title and URL when macOS automation access is available, then route through the same source-aware matching path as bookmarklet captures.
- Mac shell has app-focused workspace JSON import/export menu commands (`Cmd+O`, `Shift+Cmd+E`) that reuse the web import bridge, including append-only mobile inbox and review progress patches.
- Mac shell can open the generated morning review dashboard (`dist/morning-demo/review-start-here.html`) from `File > Open Morning Review Pack`.
- Mac shell has native sidecar window commands: enter a narrow right-side panel (`Option+Cmd+]`), restore the desk (`Option+Cmd+[`), and manually keep the window above others.
- Credential-free Feishu uploader boundary can validate a mirror bundle, build an upload plan, materialize the Drive folder locally, and emit a dry-run upload report without reading live credentials.
- HarmonyOS preparation has a credential-free schema reader prototype that turns workspace JSON or mirror bundles into a read-only phone view model.
- Three-pane learning sidecar for Mac/browser workflow.
- Sidecar layout toggle that collapses navigation and inspector around the active session.
- Desk activity strip that keeps save/review/synthesis feedback visible in focused sidecar mode.
- Deterministic Focus Brief in the desk with next action, latest capture, source, workspace-review fallback, synthesis freshness signals, and sidecar-safe visibility.
- Workspace Find searches source titles, notes, captures, tags, and review cards, then jumps back to the matching session and surface.
- Sessions, source context, timestamp, tags.
- Capture-level source snapshots with source/time jump links.
- Quick capture quote/thought.
- One-click capture insertion into Notes with idempotent capture blocks.
- Confirmed delete for mistaken captures and review cards.
- Synthesis draft generation from captures into notes, with stale-source warning and idempotent insertion.
- Capture-to-review-card promotion.
- Cloze review card authoring from selected quote text.
- Workspace-wide due review queue with simple strength buckets.
- Self-graded Again/Good review outcomes with isolated scheduling policy.
- Review answers are reveal-gated before grading.
- Desk-native review pane works in focused sidecar layout.
- Today tab summarizes workspace due review and recent captures.
- Static mirror `index.html` provides a portable folder home page for Today, Review, Restore, and sessions.
- Today and mirror exports include a Resume Here / Focus Brief section for mobile, Windows, and Feishu handoff.
- Static mirror `review.html` supports due-card review on mobile/Windows and exports append-only review progress patch JSON.
- Static mirror `inbox.html` supports phone/Windows capture drafts and exports append-only mobile inbox patch JSON.
- Mobile inbox patch import appends captures with patch/capture id dedupe, target-resolution fallback, unsafe URL stripping with receipt counts, and a visible import receipt.
- Review progress patch import applies Again/Good events only when the card version still matches, and reports duplicates, missing cards, stale conflicts, and invalid events.
- Markdown notes editor with autosave.
- Safe read-mode preview for notes.
- Safe formatting preview for capture thoughts and review answers.
- Markdown + JSON export for the active session.
- Export panel exposes full workspace copy/save with a collapsed JSON disclosure next to session, Today, mirror, ZIP, and bookmarklet outputs.
- Copy/save `TODAY.md` directly from the Export panel.
- Credential-free Feishu mirror bundle with README, workspace restore payload, and per-session Markdown/JSON sidecars.
- Credential-free Feishu mirror ZIP containing the same readable folder files, including derived `index.html`, `TODAY.md`, `review.html`, and `inbox.html`.
- Import can restore either a raw workspace JSON, a Feishu mirror bundle, a mobile inbox patch, or a review progress patch from both the browser file input and Mac native import menu.
- Morning demo pack generator creates a fixture-only representative workspace, extracted mirror folder, ZIP, Feishu upload plan/local files/dry-run report, HarmonyOS reader view, sample mobile inbox patch, sample review progress patch, `MORNING_REVIEW.md`, and a provenance/hash `SUMMARY.json` with credential sweep results.
- Copyable browser capture bookmarklet from the Export tab, including active video time.
- Full workspace JSON import/export.
- Browser bookmarklet and URL inbound capture contract.
- Browser inbound capture now routes by normalized source URL before falling back to conservative title-only matching or the active topic, and switches the desk back to capture focus.
- Workspace schema contract in `docs/schema/workspace.v1.schema.json`.
- Browser smoke test verifies capture -> card -> localStorage -> UI metrics.
- Browser smoke also verifies installable/offline shell metadata, sidecar layout toggling, desk-level activity feedback, Focus Brief updates, Workspace Find jump-to-capture behavior, Today tab/direct Today export/full workspace export/mirror home/study pack/static review pack/static review-progress patch/static inbox page, desk-native review in sidecar layout, mobile-width no-overflow behavior, capture source snapshots/time links, capture-to-notes insertion, confirmed capture/card deletion, mobile inbox patch import, review progress patch import receipt, mirror ZIP affordance, Cloze cards, workspace-wide due review, reveal-before-grade review flow, synthesis insertion, stale-draft handling, capture formatting, mirror bundle generation/import, generated bookmarklet execution on virtual video/document/empty-selection pages, inbound bookmarklet capture, and notes preview rendering.
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
```

`smoke:browser` uses local Chrome headless and a temporary profile.
`mac:build` uses local SwiftPM and does not package or sign an `.app` yet.
`demo:morning` writes a credential-free inspection pack to `dist/morning-demo/`.
`check:morning` runs the web smoke, browser UX smoke, Mac shell build, demo pack generation, and prints git status.

Latest checks passed: JS syntax checks, `npm run smoke`, `npm run smoke:browser`, `npm run demo:morning`, `npm run mac:build`, and `npm run check:morning`.

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
- Add a Mac shell clipboard-to-capture command as a local, permission-free step toward native capture.
- Add Mac shell workspace import/export as permission-light local file commands, without introducing a second persistence format.
- Pin Focus Brief as a pure model-layer object, with deterministic next-action rules shared by desk UI and portable exports; add workspace-due fallback and synthesis-source freshness.
- Keep review progress patches conflict-aware: apply only against unchanged card versions, and skip stale events with a receipt instead of overwriting Mac-side review state.
- Add Workspace Find as a local-only jump surface, with result text rendered via `textContent`, capped queries, and read-only navigation into captures/review/notes.
- Keep the morning demo pack clearly fixture-only, with sample file names, provenance, per-file hashes, credential sweep results, and explicit "does not prove live sync/device behavior" boundaries.
- Route browser inbound captures by normalized source before using the active topic, preserving matched-session source fields so focus mistakes in the sidecar do not silently attach or rewrite the wrong learning material.

Deferred:

- Real Feishu OpenAPI sync. One-way export should come before sync.
- Native Mac shell beyond the thin wrapper: production packaging, permission onboarding, richer browser URL bridge beyond title/URL, multi-display sidecar polish, and packaged menu polish.
- AI-generated synthesis. The deterministic draft should prove the workflow before adding another model.
- Full timezone boundary matrix for Today pack; current implementation stamps the local day window and due cutoff, but browser/device cross-timezone behavior still deserves manual QA.
- Focus Brief's next-action ladder is intentionally simple; adaptive ranking and cross-session recommendations are deferred until real usage shows the current ladder is too blunt.
- Mobile inbox and review progress patches should be called Mac-import-verified, not HarmonyOS-verified, until a real phone roundtrip passes.
- Add broader negative-path demo assertions, such as malformed patch payloads and oversized patch files; the current demo generator only covers duplicate inbox patches, stale review conflicts, and unsafe URL stripping.

## Next Best Commits

1. Add real Feishu OpenAPI transport behind explicit credential configuration and approval.
2. Add GUI/manual QA evidence for selected-text capture and browser context on Tony's Mac.
3. Turn the HarmonyOS reader view into a minimal DevEco screen once SDK/project setup is available.
4. Manually test bookmarklet capture on YouTube, Feishu Docs, and developer docs; automated smoke now covers virtual video/document pages but not real-site CSP, popup, or DOM quirks.

## Known Risks

- `localStorage` is still a temporary store; export often.
- Focus Brief workspace-review tie-break currently inherits the due queue ordering; document or expose that policy before making it adaptive.
- Static `inbox.html` is designed for HarmonyOS/Windows manual capture, but real-device storage and download behavior are still unverified.
- Mobile inbox patch is still manual transport; it is not real sync and depends on the user importing the patch on Mac.
- Feishu uploader boundary is local-folder/plan only; it does not authenticate or write to Feishu Drive yet.
- Review progress patch is conflict-safe but still manual transport; real device review behavior is not HarmonyOS-verified.
- Workspace Find is simple substring search; larger workspaces will need debounce/indexing and more per-result navigation assertions.
- Bookmarklet behavior should be tested on YouTube, Feishu Docs, and common documentation sites.
- Safari/Firefox localStorage quota behavior is not verified.
- Today pack timezone behavior across Mac, HarmonyOS, and Windows is not manually verified yet; mobile-width layout is covered by smoke, not real-device touch QA.
- Mac shell is currently a thin WKWebView wrapper with best-effort selected-text capture, labeled clipboard fallback, browser title/URL context, sidecar window commands, and workspace file commands; packaged permission onboarding and live GUI evidence are still missing.
- Mac shell launch/relaunch persistence has not been manually smoke-tested inside the GUI tonight.
- Mac shell AppKit import/export panels build successfully, but panel cancel/oversize/invalid-file paths are not GUI-automated tonight.
- `File > Open Morning Review Pack` is a developer shortcut over the generated fixture; it shows an alert when the demo pack is missing and does not generate, sync, or validate live integrations.
- HarmonyOS native app is not started yet; the read-only schema reader prototype is local JavaScript and still needs DevEco/file-picker integration.
- Sidecar layout still hides full inspector details; the desk review pane handles core review, while bulk review management still lives in the inspector.
- Activity strip messages are intentionally ephemeral UI state; after reload or session switch they fall back to derived latest-capture/review-queue summaries.
