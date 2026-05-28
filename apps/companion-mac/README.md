# Learning Companion Mac Shell

This is a minimal native macOS shell for the local web MVP. It deliberately has no package dependencies and loads `apps/companion-web/index.html` in a `WKWebView`.

It is a WKWebView shell, not the finished Mac app: no global hotkey, no browser-context capture, no notarization, and not redistributable yet.

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
- Adds a local `Capture > Fill Capture From Clipboard` command (`Cmd+Shift+V`) that places clipboard text into Quick Capture without requiring global hotkey permissions.
- Adds app-focused `File > Export Workspace...` (`Shift+Cmd+E`) and `File > Import Workspace...` (`Cmd+O`) commands for local JSON backup/restore without browser downloads.
- Uses WebKit's default persistent website data store, so the web MVP keeps its existing localStorage behavior.
- Uses a deterministic `file://` origin. It does not silently fall back to `127.0.0.1`, because that would create a separate localStorage bucket.
- Opens external `http` and `https` links in the system browser.

## Not Yet

- No active browser URL bridge.
- No global capture hotkey when the app is not focused.
- No packaged `.app` menu polish beyond the current capture and workspace file commands.
- No packaged `.app` signing/notarization flow.

Those should be added only after the web MVP's learning loop is stable.
