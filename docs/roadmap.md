# Roadmap

## Phase 0: Usable Local MVP

- Static sidecar app.
- Installable/offline web shell.
- Sidecar layout for focused browser-adjacent study.
- Desk activity feedback for hidden-inspector mode.
- Capture-level source snapshots and time jump links.
- Idempotent capture-to-notes insertion.
- Manual Feishu mirror ZIP export.
- Today study pack in the app and Feishu mirror.
- Desk-native review pane for focused sidecar mode.
- Minimal macOS WKWebView shell scaffold.
- Local workspace persistence.
- Capture, notes, synthesis, review, export.
- Credential-free Feishu mirror bundle.
- Credential-free Feishu upload plan boundary.
- HarmonyOS read-only schema reader prototype.
- HarmonyOS DevEco handoff contract.
- Smoke tests and visual checks.

## Phase 1: Mac Shell

- Wrap the web app in a Mac shell.
- Add native menu commands.
- Add floating sidecar window.
- Add global capture hotkey.
- Add clipboard and active browser URL bridge.
- Move persistence to SQLite plus Markdown vault.

## Phase 2: Feishu Sync

- Use the credential-free mirror bundle as the adapter input.
- Add Feishu Drive upload after explicit app credential setup.
- Store Markdown mirror and JSON sidecar.
- Add conflict detection based on session/capture IDs and updated timestamps.

## Phase 3: HarmonyOS

- Keep `apps/companion-harmony/src/schema-reader.mjs` as the shared view-model prototype until a DevEco project exists.
- Use `apps/companion-harmony/DEVECO_HANDOFF.md` as the first scaffold contract.
- Build ArkTS app against the shared schema.
- Implement capture inbox, session detail, and review.
- Sync through Feishu mirror or direct JSON payload.

## Phase 4: Learning Intelligence

- Generate summaries from captures.
- Suggest review cards.
- Surface related captures/backlinks.
- Add spaced repetition scheduling.

## Open Questions

- Which Mac shell should we choose after the web MVP proves itself: Tauri, Electron, or SwiftUI?
- Should Feishu sync write to Drive as files first, or to Docs as block documents first?
- How much automatic browser context can we reliably capture without becoming intrusive?
- Should HarmonyOS sync through Feishu only, or support local LAN/import-export as a fallback?
