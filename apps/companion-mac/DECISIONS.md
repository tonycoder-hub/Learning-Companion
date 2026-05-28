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
- It has clipboard-to-capture menu commands and a best-effort global clipboard capture hotkey.
- No active browser URL bridge.
- No packaged `.app`, signing, notarization, auto-update, or menu bar workflow.

Guardrails:

- The shell uses a deterministic `file://` origin by default. It does not silently fall back to `http://127.0.0.1:5173/`, because that would split localStorage and look like data loss.
- External `http`/`https` navigation is handed to the system browser.
- Only files under the resolved web root are allowed to load inside the shell.
- Native import/export talks to an explicit web bridge and the same workspace JSON schema as the browser app. It does not add a second Mac-only persistence format.
- `Export Workspace...` uses `Shift+Cmd+E` rather than `Cmd+S` because this is a user-chosen JSON export, not a document save-to-current-file action.
- The web bridge is intentionally unprivileged: it only exposes workspace JSON import/export already available in the browser UI, while all native file access remains behind user-initiated AppKit panels.
- Import rejects files larger than 5 MB or non-UTF-8 content before handing text to WebKit, and surfaces those failures through an `NSAlert`.
- `Save Clipboard as Capture` reads the pasteboard only after an explicit menu command or `Ctrl+Option+Cmd+C` hotkey, then calls the same web-model capture path as the browser UI. It does not inspect browser state, browser cookies, or the current selection directly.
- Global hotkey registration is intentionally visible in the Capture menu. If another app owns the shortcut, the shell marks the hotkey unavailable and writes a short local diagnostic without any clipboard content.

Next decisions:

- Decide whether to grow this shell with native AppKit affordances or pivot to Tauri/Electron before adding user-visible Mac-only features.
- If this path continues, add global capture, menu commands, packaged `.app` creation, and a real browser-context bridge deliberately.
