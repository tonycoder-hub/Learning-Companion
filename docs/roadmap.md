# Roadmap

## Phase 0: Usable Local MVP

- Static sidecar app.
- Local workspace persistence.
- Capture, notes, review, export.
- Smoke tests and visual checks.

## Phase 1: Mac Shell

- Wrap the web app in a Mac shell.
- Add floating sidecar window.
- Add global capture hotkey.
- Add clipboard and active browser URL bridge.
- Move persistence to SQLite plus Markdown vault.

## Phase 2: Feishu Sync

- Add credential-free export flow first.
- Add Feishu Drive upload after explicit app credential setup.
- Store Markdown mirror and JSON sidecar.
- Add conflict detection based on session/capture IDs and updated timestamps.

## Phase 3: HarmonyOS

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
