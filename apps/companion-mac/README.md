# Learning Companion Mac Shell

This is a minimal native macOS shell for the local web MVP. It deliberately has no package dependencies and loads `apps/companion-web/index.html` in a `WKWebView`.

It is a WKWebView shell, not the finished Mac app: no browser-context capture, no notarization, and not redistributable yet.

## Run

From this directory:

```bash
swift run LearningCompanionMac ../companion-web
```

Or from the repository root:

```bash
swift run --package-path apps/companion-mac LearningCompanionMac apps/companion-web
```

## Current Scope

- Opens the existing local-first web app in a resizable Mac window.
- Adds `Capture > Save Clipboard as Capture` (`Ctrl+Option+Cmd+C`) plus a matching best-effort global hotkey. Copy text in another app, press the shortcut, and the shell brings Learning Companion forward and saves the clipboard text into the active topic.
- Adds a local `Capture > Fill Capture From Clipboard` command (`Cmd+Shift+V`) that places clipboard text into Quick Capture without requiring global hotkey permissions.
- Shows the global hotkey registration status in the Capture menu so shortcut collisions are visible during development.
- Adds app-focused `File > Export Workspace...` (`Shift+Cmd+E`) and `File > Import Workspace...` (`Cmd+O`) commands for local JSON backup/restore without browser downloads.
- Adds `Window > Enter Sidecar Window` (`Option+Cmd+]`) and `Window > Restore Desk Window` (`Option+Cmd+[`) so the shell can snap into a narrow right-side study panel next to a browser or document.
- Adds `Window > Keep Window Above Others` as a manual floating-window toggle for focused study sessions.
- Uses WebKit's default persistent website data store, so the web MVP keeps its existing localStorage behavior.
- Uses a deterministic `file://` origin. It does not silently fall back to `127.0.0.1`, because that would create a separate localStorage bucket.
- Opens external `http` and `https` links in the system browser.

## Not Yet

- No active browser URL bridge.
- No selected-text capture without copying first; the global hotkey reads the clipboard only after you press it.
- No packaged `.app` menu polish beyond the current capture, sidecar, and workspace file commands.
- No packaged `.app` signing/notarization flow.

Those should be added only after the web MVP's learning loop is stable.
