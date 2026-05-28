# Feishu Mirror Bundle

## Goal

Use Feishu Drive as a readable cross-device mirror before any authenticated OpenAPI sync exists. The mirror bundle is credential-free: the app generates a single JSON staging file containing the files that a future uploader can translate into a Feishu Drive folder.

## Current Manual Flow

1. Open the app.
2. Go to `Export`.
3. Use `Save Mirror`.
4. Upload `learning-companion-feishu-mirror.json` to Feishu Drive, or keep it in any shared folder.
5. On another device, download the bundle and use the app's import button. The importer reads `workspace.json` from the bundle and restores the workspace.

## Bundle Layout

```text
learning-companion.mirror-bundle.staging.v1
  README.md
  workspace.json
  sessions/
    <session-title>-<id>.md
    <session-title>-<id>.feishu.json
```

Each bundled file has:

- `path`
- `mediaType`
- `encoding`
- `role`
- `sessionId`
- `bytes`
- `contentFingerprint`
- `content`

`workspace.json` is the canonical restore payload and can be imported by the app directly from the mirror bundle. Markdown files are for human reading in Feishu Drive or Docs. Per-session JSON sidecars preserve enough structure for future round-trip sync.

The bundle is always a full snapshot rebuilt from current app state. It is not an incremental delta. Generated paths use normalized POSIX-style paths with title slugs plus short ids to avoid collisions.

## Why This Comes Before OpenAPI Sync

This proves the file contract without asking for approvals, app credentials, Drive scopes, or token handling. Once the bundle shape feels right, a real Feishu uploader can translate these virtual files into Drive files and later add conflict detection around ids and `updatedAt`.

## Next Integration Boundary

The first authenticated adapter should consume this bundle instead of reading UI state directly:

```text
workspace -> mirror staging bundle -> Feishu Drive uploader -> Drive folder layout
```

That keeps the sync layer replaceable for Windows, HarmonyOS, local LAN import/export, or another cloud mirror.
