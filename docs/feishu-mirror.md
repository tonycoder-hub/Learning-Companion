# Feishu Mirror Bundle

## Goal

Use Feishu Drive as a readable cross-device mirror before any authenticated OpenAPI sync exists. The mirror bundle is credential-free: the app generates a JSON staging file for restore and a ZIP artifact containing the same virtual files for manual Drive upload or extraction.

## Current Manual Flow

1. Open the app.
2. Go to `Export`.
3. Use `Save Mirror` when you want the single JSON restore bundle.
4. Use `Save ZIP` when you want real files (`README.md`, `workspace.json`, `sessions/*.md`, `sessions/*.feishu.json`) that can be uploaded or extracted as a readable Drive folder.
5. Upload either artifact to Feishu Drive, or keep it in any shared folder.
6. On another device, download the JSON bundle and use the app's import button. If you only have the ZIP, extract `workspace.json` first.

## Credential-Free Uploader Boundary

The first uploader-shaped adapter is local only:

```bash
node scripts/feishu-mirror-uploader.mjs \
  --bundle learning-companion-feishu-mirror.json \
  --out .codex-tmp/feishu-upload \
  --json
```

It validates a `learning-companion.mirror-bundle.staging.v1` file, emits a `learning-companion.feishu-upload-plan.v1`, materializes the folder files under `files/`, and can produce a `learning-companion.feishu-upload-report.v1` dry-run report that verifies local bytes and fingerprints. The plan and report both carry `EVIDENCE: DRY_RUN` metadata. The report includes the literal boundary statement "No network call was made; this report only verifies local files." It also records a no-network `wouldSend` envelope with virtual upsert paths, payload byte counts, and payload SHA-256 hashes, plus a `targetTree` with directories, filenames, byte counts, and per-file SHA-256 hashes so the future uploader contract is reviewable without credentials. It does not call Feishu OpenAPI, does not read credentials, and does not remove stale remote files. That keeps tonight's work useful for Feishu Drive folder QA without pretending real cloud sync is ready.

Non-goals for this boundary:

- No Feishu OpenAPI calls.
- No credential loading.
- No remote stale-file deletion.
- No overwrite of existing local materialized files unless `--force` is passed.

Dry-run report example:

```bash
node scripts/feishu-mirror-uploader.mjs \
  --plan .codex-tmp/feishu-upload/feishu-upload-plan.json \
  --files-dir .codex-tmp/feishu-upload/files \
  --report-out .codex-tmp/feishu-upload/feishu-upload-report.json \
  --json
```

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

The ZIP export uses the same file list as the JSON bundle and stores files without compression. It is a convenience packaging format, not a new source of truth.

## Why This Comes Before OpenAPI Sync

This proves the file contract without asking for approvals, app credentials, Drive scopes, or token handling. Once the bundle shape feels right, a real Feishu uploader can translate these virtual files into Drive files and later add conflict detection around ids and `updatedAt`.

## Next Integration Boundary

The first authenticated adapter should consume this bundle instead of reading UI state directly:

```text
workspace -> mirror staging bundle -> Feishu Drive uploader -> Drive folder layout
```

That keeps the sync layer replaceable for Windows, HarmonyOS, local LAN import/export, or another cloud mirror.
