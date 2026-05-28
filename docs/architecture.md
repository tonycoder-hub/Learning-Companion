# Architecture Notes

## Near-Term Shape

The MVP is a dependency-free local web app in `apps/companion-web`. This is intentional:

- It runs immediately on Mac without package installation.
- It can be used on Windows through the same static app.
- It lets HarmonyOS use the same data contract before native ArkTS work begins.
- It can later be wrapped by Tauri, Electron, or a native Swift shell.

## Layers

```text
UI shell
  Vanilla HTML/CSS/JS for the MVP

State model
  Workspace JSON in localStorage
  Import/export as JSON
  Canonical schema in docs/schema/workspace.v1.schema.json

Learning artifacts
  Markdown notes
  Capture records
  Synthesis drafts
  Review cards
  Feishu export payload

Future native shell
  SQLite persistence
  Global hotkey
  Clipboard/selected-text capture
  Browser URL detection
  File-system vault

Future sync
  Feishu Drive upload for Markdown mirror
  Feishu Docs block conversion for readable docs
  Structured JSON sidecar for round-trip restore
```

## Why Not Start With Native Only

SwiftUI would be a good final Mac experience, but it slows cross-device validation. A static local app gives us the fastest path to product truth: can the capture, focus, review, and export loop feel right?

The native shell should come after the interaction model stabilizes. It should add OS affordances rather than define the product:

- floating sidecar window
- global capture hotkey
- menu bar quick note
- browser/clipboard bridge
- local SQLite and filesystem vault

## Feishu Sync Direction

Feishu should receive two outputs:

- Human-readable Markdown, suitable for Feishu Docs/Drive viewing.
- Machine-readable workspace JSON, suitable for restoration and cross-device sync.

The Feishu OpenAPI upload path requires authenticated app credentials and should stay behind an explicit integration boundary. Tonight's MVP only creates the export payload and documents the intended contract.

## HarmonyOS Direction

HarmonyOS should use the same workspace schema and start with three surfaces:

- Today/capture list.
- Session detail with notes and captures.
- Review cards.

The native HarmonyOS implementation should be ArkTS/ArkUI when we start it, but the data model should not depend on ArkTS-specific storage.
