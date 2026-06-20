# Learning Companion — Continue Iteration Prompt

Copy everything below this line and send it to any coding agent (Claude Code, Codex, Cursor, etc.) in the repo root.

---

You are working on **Learning Companion**, a local-first learning app. Read `AGENTS.md` at the repo root FIRST — it covers architecture, rules, code style, and what not to do. Key rules: zero npm deps, vanilla ES modules only, EN+ZH i18n for every user-facing string, privacy-first, SSRF-protect any server fetch, service worker must NOT cache `/api/` routes.

## Current State (as of June 17, 2026)

The core reading + notes experience is built and working:

- **Center reader**: `src/viewer.js` renders video (YouTube/Bili/Vimeo iframe embed), docs/articles (fetched via server proxy, sanitized, displayed in `src/reader.js`), or fallback card. Modes: `video-embed`, `content`, `iframe-embed`, `fallback`, `none`.
- **Server proxy**: `scripts/dev-server.mjs` serves static files + two API endpoints:
  - `GET /api/fetch-doc?url=<feishu-url>` — shells out to `lark-cli docs +fetch --api-version v2`, parses JSON response, returns clean HTML
  - `GET /api/fetch-url?url=<http-url>` — CORS proxy with SSRF protection (blocks private IPs)
- **Reader** (`src/reader.js`): HTML sanitization, readability extraction (scoring `<main>`/`<article>`/content-heavy divs), markdown-to-HTML, paste fallback textarea, select-to-capture floating button
- **Voice notes** (`src/voice.js`): Web Speech API wrapper, 🎤 button in capture pane, live interim text, zh/en auto-detect
- **Handwriting canvas** (`src/canvas.js`): pen/eraser/color/size/clear/save, high-DPI, mouse+touch, persists per session as dataURL
- **Shortcuts**: Cmd/Ctrl+Enter captures from anywhere (except notes editor), Cmd/Ctrl+Shift+1/2/3 for starters, Cmd/Ctrl+K for search
- **Auto-detect**: pasting a URL auto-sets materialType (video/doc/article)
- **i18n**: full EN/ZH, browser language auto-detect, visible EN/中 toggle in brand header
- **Service worker**: v8, caches static assets only, never caches API
- **Data**: localStorage, schema v2 (workspace) / v5 (UI prefs), export/import JSON mirror bundles
- **Smoke tests**: `npm run smoke` passes

## Run It

```bash
npm run dev          # http://127.0.0.1:5173
npm run smoke        # must pass before committing
```

## What to Iterate On Next

Pick from this prioritized list. Each item is independently actionable. Do as many as you can in one session. Start the dev server and test in a browser as you go.

### Priority 1: Reader Experience Polish

1. **Reader scroll position memory**: When switching sessions or collapsing/expanding the viewer, remember and restore scroll position in the article. Store in session state.
2. **Table of contents for long docs**: Auto-generate a floating TOC from `<h1>`/`<h2>`/`<h3>` headings in the rendered article. Click to scroll. Collapsible.
3. **Reading progress bar**: Thin progress bar at top of reader showing scroll %.
4. **Dark/sepia reading theme**: Add a reading mode toggle (light/sepia/dark) in the viewer toolbar. Persist in uiPrefs. Apply via CSS class on `.reader-scroll`.
5. **Font size controls**: A- / A+ buttons in viewer toolbar for reader font size (14px–20px). Persist in uiPrefs.

### Priority 2: Notes Power

6. **Markdown toolbar for notes**: Add a small toolbar above `#notesEditor` with Bold/Italic/Code/Link/List buttons that wrap selected text in markdown syntax.
7. **Quote-to-note drag**: Allow dragging selected text from reader into notes editor, inserting as blockquote with source attribution.
8. **Timestamp anchor in notes**: When watching video, a "insert timestamp" button that inserts `[12:34]()` linking back to that video time in the notes.
9. **Note tags/wikilinks**: Parse `[[topic]]` syntax in notes, make them clickable to filter captures by that tag/topic.
10. **Voice language auto-detect improvement**: Currently picks zh-CN/en-US based on UI language. Detect spoken language dynamically or add a toggle next to the mic.

### Priority 3: Multi-Platform Sync

11. **Auto-export to mirror folder**: Add a setting to auto-export the workspace JSON to a configurable local folder path (using the File System Access API `showDirectoryPicker`) on every change, so it can be synced via iCloud/Dropbox/OneDrive.
12. **Import diff view**: When importing a workspace file, show a diff summary (N new captures, M updated sessions) before applying, instead of silent merge.
13. **Conflict resolution UI**: If imported workspace has conflicting edits (same session updated in both places), show a simple side-by-side picker.

### Priority 4: Video Learning Features

14. **Video bookmarks**: When watching, save multiple timestamps with labels (e.g., "key insight", "review later"). Show as clickable chips under the video.
15. **Playback speed control**: Add 0.75x/1x/1.25x/1.5x/2x toggle in viewer toolbar for video mode.
16. **Auto-pause on capture**: When user hits capture (Cmd+Enter) while watching, auto-pause the video.

### Priority 5: Polish & Bug Fixes

17. **Mobile responsive**: The 3-column layout breaks on narrow screens. Add a mobile layout (<768px): sidebar becomes a slide-out drawer, inspector is tab-accessible only, reader takes full width.
18. **Keyboard shortcut cheatsheet**: Press `?` to show an overlay with all shortcuts.
19. **Undo/redo for notes editor**: Simple undo stack for the notes textarea (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z).
20. **Search ranking**: Current search is simple substring match. Boost matches in titles > quotes > thoughts, and highlight matched terms in results.

## How to Approach This

1. Read `AGENTS.md` fully.
2. Skim `src/app.js` top (imports, dom refs, event wiring) and `src/model.js` top (exports, schemas).
3. Pick 2-3 items from the priority list above (start with P1 if you can).
4. For each feature:
   - Add HTML elements to `index.html`
   - Add CSS to `styles.css`
   - Add logic in the appropriate module (new feature? create a new file in `src/`; DOM wiring goes in `app.js`; pure logic goes in `model.js`)
   - Add i18n strings (both EN and ZH)
   - If new static assets are added, update `service-worker.js` STATIC_ASSETS and bump cache version
   - If new API endpoints are added, add SSRF protection
5. Run `npm run smoke` after each change.
6. Start dev server and manually test in a browser.
7. Commit each feature separately with clear messages.
8. Push to `origin main` when done (SSH alias is `github-learning-companion`).

## Files You'll Touch Most

- `apps/companion-web/src/app.js` — DOM wiring, event handlers, render
- `apps/companion-web/src/model.js` — data model, pure functions, schemas
- `apps/companion-web/src/viewer.js` — viewer modes, toolbar
- `apps/companion-web/src/reader.js` — article rendering
- `apps/companion-web/index.html` — markup
- `apps/companion-web/styles.css` — all styles
- `apps/companion-web/service-worker.js` — offline cache
- `scripts/dev-server.mjs` — server + API (only if adding endpoints)

Don't ask for confirmation. Just build, test, commit, and push.
