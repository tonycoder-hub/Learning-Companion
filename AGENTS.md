# AGENTS.md — Guide for AI Agents Working on Learning Companion

This file is the single source of truth for any agent (Claude Code, Codex, Cursor, etc.) modifying this repo. Read it first.

## What This Project Is

**Learning Companion** is a local-first, zero-dependency learning app. Core vision:
- Document/video **in the center** of the UI (the "reader")
- Notes support **voice / typing / handwriting**
- Multi-platform: **web** (primary), Mac (shell scaffold), HarmonyOS (scaffold), Windows (static mirror)
- Data/progress sync via local JSON files (mirror bundles + patches), no cloud backend

## Hard Rules

1. **Zero npm dependencies.** No React, no Vite, no bundler. Vanilla ES modules served directly by a Node http server. If you think you need a package, you don't — write it yourself or use a browser API.
2. **No build step.** Files in `apps/companion-web/src/` are served as-is. `import` paths are relative, no aliases.
3. **i18n is EN + ZH only.** Every user-facing string must have both languages. Use the `langText(en, zh)` helper or the `STRINGS` pattern in viewer.js. Default language auto-detects from `navigator.language`.
4. **Privacy-first.** No third-party analytics, no CDN scripts in production, no telemetry. The bookmarklet and all data stay local.
5. **Server-side proxy has SSRF protection.** If you add a new fetch endpoint, it MUST block private/local IPs (see the existing blocklist in `scripts/dev-server.mjs`).
6. **Service worker must NOT cache `/api/` responses.** Always go to network for API calls.
7. **Smoke tests must pass** before committing: `npm run smoke`.

## Project Structure

```
learning-companion/
├── apps/
│   ├── companion-web/          # PRIMARY app (vanilla JS ES modules)
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── service-worker.js   # Cache: learning-companion-static-v9
│   │   ├── manifest.webmanifest
│   │   ├── bookmarklet.js
│   │   ├── assets/
│   │   └── src/
│   │       ├── app.js          # Main SPA controller (DOM, events, render)
│   │       ├── model.js        # ALL business logic (pure functions, no DOM)
│   │       ├── viewer.js       # Material viewer (video/content/iframe/fallback)
│   │       ├── reader.js       # HTML sanitize, readability, markdown, quote capture
│   │       ├── voice.js        # Web Speech API wrapper
│   │       ├── canvas.js       # Handwriting canvas (pen/eraser/save)
│   │       ├── markdown.js     # Markdown rendering utilities
│   │       ├── seed-workspaces.js  # In-app demo/case-study seeds
│   │       └── generated/      # Generated JSON (case study data)
│   ├── companion-mac/          # Mac SwiftUI shell (scaffold)
│   ├── companion-harmony/      # HarmonyOS schema/import tooling (Node)
│   └── companion-harmony-dev/  # Actual HarmonyOS ArkTS project (scaffold)
├── scripts/
│   ├── dev-server.mjs          # Dev server + API endpoints (port 5173)
│   ├── smoke-*.mjs             # Smoke tests (run with `npm run smoke`)
│   ├── build-*.mjs             # Demo/case-study builders
│   └── case-studies/           # Course data (ecom-psych, etc.)
├── docs/                       # Architecture, MVP, roadmap docs
├── dist/                       # Build outputs (gitignored except committed demos)
└── package.json                # Zero deps, scripts only
```

## Architecture: The Three Layers

### Layer 1 — `model.js` (Pure Logic)
- ALL data shapes, schemas, and business rules live here.
- No DOM, no `document`, no `window`. Pure functions only.
- Key exports: `createSession`, `addCapture`, `sanitizeWorkspace`, `gradeCard`, `generateMarkdown`, `buildResumeSource`, `isYouTubeHost`, etc.
- Schema versions: `WORKSPACE_SCHEMA_VERSION = 2`, `UI_PREFS_SCHEMA_VERSION = 6` (in app.js).
- If you add a new data field, update `createSession`, `sanitizeWorkspace`, and the appropriate normalize function.

### Layer 2 — `app.js` (DOM Controller)
- Imports from model.js + feature modules (viewer, reader, voice, canvas, markdown).
- Single `render()` function re-renders the UI from state.
- State lives in module-level `workspace` and `uiPrefs` objects, persisted to `localStorage`.
- DOM refs are centralized in a `dom` object at the top.
- i18n via `langText(en, zh)` and `setText(selector, en, zh)` helpers.
- Keyboard shortcuts are registered on `document.addEventListener("keydown", ...)`.

### Layer 3 — Feature Modules
| Module | Purpose | Exports |
|--------|---------|---------|
| `viewer.js` | Renders material in center pane | `renderViewer(container, session, opts)`, `buildEmbedUrl()`, `resolveViewerMode()` |
| `reader.js` | Article/doc rendering | `sanitizeHtml()`, `extractReadableContent()`, `markdownToSimpleHtml()`, `renderReaderContent()` |
| `voice.js` | Speech-to-text | `isVoiceSupported()`, `createVoiceInput(opts)` |
| `canvas.js` | Handwriting pad | `initNotesCanvas(canvasEl, toolbarEl, opts)` |
| `markdown.js` | Markdown rendering for notes/preview | (markdown utilities) |

## Viewer Modes

`resolveViewerMode(sourceUrl, materialType)` returns one of:
- `"video-embed"` — YouTube/Bilibili/Vimeo URLs or `materialType === "video"`. Uses iframe embed with YouTube IFrame API for time sync.
- `"content"` — Feishu/Lark URLs or `materialType === "doc"/"article"`. Fetches via `/api/fetch-doc` or `/api/fetch-url`, sanitizes, and renders reader.
- `"iframe-embed"` — `materialType === "course"`. Sandboxed iframe.
- `"fallback"` — Everything else. Shows card with "open externally" button.
- `"none"` — No source URL.

## Dev Server API Endpoints

All endpoints are GET-only, CORS `*`, `cache-control: no-store`.

| Endpoint | Description |
|----------|-------------|
| `/api/fetch-doc?url=<feishu-url>` | Shells out to `lark-cli docs +fetch --api-version v2`, parses JSON response, returns `{ok, html, title}`. 30s timeout, 500KB limit. |
| `/api/fetch-url?url=<http-url>` | Server-side fetch (bypasses CORS). SSRF-protected. Returns `{ok, html}`. |

Static files served from `apps/companion-web/` with MIME detection and path-traversal protection.

## Data Model (Workspace)

```js
// Stored in localStorage key "learning-companion.workspace.v1"
{
  schema: "learning-companion.workspace.v1",
  version: 2,
  sessions: [{
    id, title, createdAt, updatedAt,
    sourceUrl, sourceTitle, materialType,  // article|video|doc|course|book|other
    viewerOpen, viewerMode, viewerPosition,
    tags: [string],
    captures: [{ id, createdAt, kind, quote, thought, timestamp, ... }],
    reviewCards: [...],
    notes: string,           // Markdown notes
    notesCanvas: string,     // dataURL of handwriting canvas
    ...
  }],
  activeSessionId,
  ...
}
```

UI prefs stored separately: key `learning-companion.ui.v1`, version 6.

## Common Tasks

### Adding a new feature to the capture pane
1. Add HTML to `apps/companion-web/index.html` in the `#capturePane` section.
2. Add DOM ref to the `dom` object in `app.js`.
3. Wire event listeners after DOM setup.
4. Add styles to `styles.css`.
5. If new data needs persistence, update `model.js` (createSession, sanitizeWorkspace).
6. Run `npm run smoke`.

### Adding a new i18n string
- In app.js: use `langText("English text", "中文文本")`.
- In viewer.js: add to the `STRINGS` object under both `en` and `zh`.
- For setText patterns: `setText("#selector", "English", "中文")`.

### Adding a new API endpoint
1. Add handler in `scripts/dev-server.mjs`.
2. Add SSRF protection if it fetches arbitrary URLs.
3. Return JSON with `{ok: true/false, ...}`.
4. The service worker already skips caching for `/api/*` paths.
5. Test with curl.

### Bumping service worker cache
- Increment `CACHE_NAME` version (e.g., `v8` → `v9`).
- Add new static assets to `STATIC_ASSETS`.
- The old cache is auto-cleaned on activate.
- Update the smoke test regex if needed (it matches `/learning-companion-static-v\d+/`).

### Adding a new material type
1. Add to `MATERIAL_TYPES` Set in `model.js`.
2. Add to `<select id="materialType">` in `index.html`.
3. Add i18n labels in viewer.js `STRINGS.typeLabels` and app.js `setText` calls.
4. Update `resolveViewerMode()` in viewer.js if it needs special rendering.
5. Update auto-detection in `app.js` `updateSessionFromFields()` if URL patterns map to it.

## Running the App

```bash
npm run dev          # Start dev server on http://127.0.0.1:5173
npm run smoke        # Run all smoke tests (fast, <5s)
npm run smoke:browser  # Browser-based smoke tests (requires Chromium)
```

The dev server auto-falls back to port 5174+ if 5173 is busy. Override with `LC_DEV_PORT=1234 npm run dev`.

## Code Style

- **2-space indent**, semicolons, `const`/`let` (no `var`).
- ES modules: `import`/`export`, no CommonJS in browser code.
- Server code uses Node built-ins only: `node:http`, `node:fs`, `node:path`, `node:url`, `node:child_process`.
- No TypeScript, no JSX, no preprocessors.
- Functions are small and named; prefer pure functions in model.js.
- Comments in English; user-facing strings in both EN and ZH.

## Git

- Main branch: `main`
- Remote: `git@github-learning-companion:tonycoder-hub/Learning-Companion.git`
- SSH config alias is `github-learning-companion` (in `~/.ssh/config`)
- Commit messages: concise, present tense. Prefix with `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- Co-author line for AI-generated commits: `Co-Authored-By: Claude <noreply@anthropic.com>`

## Platform Targets Status

| Platform | Status | Location |
|----------|--------|----------|
| Web (PWA) | **Primary, feature-complete** | `apps/companion-web/` |
| Mac | Shell scaffold | `apps/companion-mac/` |
| HarmonyOS | ArkTS scaffold | `apps/companion-harmony-dev/` |
| Windows | Static mirror + manual return files | (via `scripts/build-morning-demo.mjs`) |

## What NOT to Do

- Don't add npm dependencies.
- Don't add a build step or bundler.
- Don't hard-code Chinese strings without English (or vice versa).
- Don't fetch arbitrary URLs from the server without SSRF protection.
- Don't cache API responses in the service worker.
- Don't put secrets, tokens, or API keys in the repo.
- Don't modify files in `dist/` that are build outputs (regenerate them instead).
- Don't break existing smoke tests.

## Testing

- `npm run smoke` — fast static validation (must pass before every commit).
- Manual test: start dev server, open in Chrome, verify reader loads Feishu docs, video plays, voice button appears, canvas draws.
- Browser smoke tests require Chromium at `/usr/bin/chromium` or `CHROME_PATH` env var.
