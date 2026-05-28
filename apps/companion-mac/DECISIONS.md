# Mac Shell Decisions

## 2026-05-29: Start With AppKit + WKWebView

Decision:

- Use a thin AppKit `NSWindow` plus `WKWebView` shell for the first native Mac scaffold.
- Load the existing dependency-free web MVP from `apps/companion-web/index.html`.
- Keep `WKWebsiteDataStore.default()` so the shell preserves WebKit localStorage behavior.

Why this instead of Tauri/Electron tonight:

- No package download or native dependency approval is needed.
- The current product risk is still the learning loop, not native packaging.
- A thin shell is easy to discard if we later choose Tauri, Electron, or a deeper SwiftUI rewrite.

Boundaries:

- This is not yet the full Mac app.
- It has clipboard-to-capture menu commands, a best-effort global clipboard capture hotkey, and native window commands for a narrow sidecar layout.
- It has best-effort active browser title/URL capture and best-effort selected-text capture, but no deeper browser bridge.
- No packaged `.app`, signing, notarization, auto-update, or menu bar workflow.

Guardrails:

- The shell uses a deterministic `file://` origin by default. It does not silently fall back to `http://127.0.0.1:5173/`, because that would split localStorage and look like data loss.
- External `http`/`https` navigation is handed to the system browser.
- Only files under the resolved web root are allowed to load inside the shell.
- Native import/export talks to an explicit web bridge and the same workspace JSON schema as the browser app. It does not add a second Mac-only persistence format.
- `Export Workspace...` uses `Shift+Cmd+E` rather than `Cmd+S` because this is a user-chosen JSON export, not a document save-to-current-file action.
- `Open Morning Review Pack` opens the generated local fixture dashboard from `dist/morning-demo/review-start-here.html` when it exists. It is a developer review shortcut, not a cloud or production packaging feature.
- The web bridge is intentionally unprivileged: it only exposes workspace JSON import/export already available in the browser UI, while all native file access remains behind user-initiated AppKit panels.
- Import rejects files larger than 5 MB or non-UTF-8 content before handing text to WebKit, and surfaces those failures through an `NSAlert`.
- `Save Clipboard as Capture` reads the pasteboard only after an explicit menu command or `Ctrl+Option+Cmd+C` hotkey, then calls the same web-model capture path as the browser UI. It does not inspect browser state, browser cookies, or the current selection directly.
- `Save Selected Text as Capture` uses macOS Accessibility only after an explicit menu command or `Ctrl+Option+Cmd+X` hotkey, and asks macOS for Accessibility permission at that moment if needed. It reads `AXSelectedText` from the frontmost app, never falls back to the full focused-field value, never writes to the pasteboard, treats an exposed empty selection as "no selection" rather than fallback, and only degrades to clipboard capture when the pasteboard has changed since the last native capture. The fallback path uses an explicit activity label.
- Global hotkey registration is intentionally visible in the Capture menu. If another app owns the shortcut, the shell marks the hotkey unavailable and writes a short local diagnostic without any clipboard content.
- Browser page context is best-effort and copy-first: the global hotkey tries to ask the frontmost Safari/Chromium-family browser for active page title and URL before the shell activates, then sends those fields through the same source-aware routing path as bookmarklet captures. If macOS automation access is unavailable, the capture still saves without source context.
- Browser context is limited to `http` and `https` pages. Browser internal pages, local files, unsupported reading apps, no-tab states, and denied macOS Automation prompts degrade to text-only capture. Private/incognito windows are not detectable through this simple bridge; if a user captures there, the active page title/URL may be saved like any other page.
- If the browser URL does not match any existing topic, the capture intentionally lands in the active topic and updates that topic's source. The activity strip names this as "no matching topic" so a focus mistake is visible instead of silent.
- `Enter Sidecar Window` changes both layers together: the native window narrows to the right side of the current screen, and the web UI enters its existing sidecar layout through the unprivileged bridge. Normal and sidecar frame autosave names are split so a narrow panel does not overwrite the normal desk frame.
- `Keep Window Above Others` is manual rather than automatic, so the user decides when the sidecar should float over video or document windows. Default sidecar shortcuts use `Option+Cmd+]` to enter and `Option+Cmd+[` to restore, avoiding the common zoom-reset meaning of `Cmd+0`.

Manual QA checklist before treating the sidecar window as release-ready:

- Single display: enter sidecar, save a clipboard capture, restore desk.
- Dual display: enter sidecar on the display that currently hosts the app.
- Display change: unplug or move displays after entering sidecar, then restore desk.
- Cold launch: invoke Enter Sidecar Window immediately after launch and confirm the web layout eventually enters sidecar mode.
- Floating: toggle Keep Window Above Others on and off while a browser/video window is active.

Next decisions:

- Decide whether to grow this shell with native AppKit affordances or pivot to Tauri/Electron before adding user-visible Mac-only features.
- If this path continues, add packaged `.app` creation, permission onboarding, and a richer browser-context bridge deliberately.
