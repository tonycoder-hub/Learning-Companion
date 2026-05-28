# Mirror Bundle Contract

## Status

`learning-companion.mirror-bundle.staging.v1` is an experimental export and restore boundary. It is not the final Feishu Drive folder layout.

The app can also emit `learning-companion-feishu-mirror.zip`, a no-compression ZIP containing the same virtual files. The ZIP is a manual transport/package format; the JSON bundle and its `workspace.json` payload remain the contract authority.

ZIP is not a valid direct import source today. To restore from ZIP, extract `workspace.json` or use the JSON mirror bundle instead.

## Authority

- `workspace.json` is canonical for restore.
- `README.md` is derived documentation.
- `TODAY.md` and `index.html` are derived entry points and include a Focus Brief / Resume Here section for the active session.
- `inbox.html` is a derived, local-only mobile/Windows capture page that exports append-only `learning-companion.mobile-inbox-patch.v1` JSON.
- `review.html` is a derived, local-only mobile/Windows review page that exports append-only `learning-companion.review-progress-patch.v1` JSON.
- `sessions/*.md` is derived human-readable material.
- `sessions/*.feishu.json` is a derived sidecar reserved for future round-trip sync; it includes the same deterministic focus brief for that session.

Importers restore from `workspace.json` first. They may use derived files for diagnostics, previews, or migration help, but not as the primary source of truth.

## Snapshot Semantics

Each bundle is a full snapshot rebuilt from current app state. It is not an append-only log and not an incremental delta. A future uploader should translate a bundle into a Drive folder layout and remove stale generated files from previous snapshots.

## Path Rules

Virtual paths are POSIX-style relative paths. They must not contain leading `/`, `..`, control characters, empty segments, or Windows reserved names. Session filenames use a normalized title slug plus a short stable id suffix to avoid collisions.

## Fingerprints

`contentFingerprint` and `bundleFingerprint` are non-cryptographic FNV-1a labels for accidental-change detection. They are not security hashes and must not be used as tamper-proof signatures.

## Uploader Boundary

The future Feishu uploader should consume this bundle as input:

```text
workspace -> mirror staging bundle -> uploader -> Feishu Drive folder layout
```

It should not upload the staging JSON as the only final Drive artifact unless the user explicitly wants a backup blob.

Manual ZIP export is allowed before the uploader exists. A future uploader should still consume the bundle contract and write Drive files directly instead of treating ZIP generation as the sync layer.

`scripts/feishu-mirror-uploader.mjs` is the current credential-free adapter boundary. It validates the staging bundle, builds a `learning-companion.feishu-upload-plan.v1` plan with `planVersion`, `bundleFingerprint`, and structured auth status, and can materialize the Drive folder locally under `files/`. It can also consume that plan plus local files to emit a `learning-companion.feishu-upload-report.v1` dry-run report with `would-upsert` actions after checking bytes and content fingerprints. The dry-run report carries a boundary section saying no network call was made and a `wouldSend` envelope with virtual upsert paths, byte counts, and payload SHA-256 hashes. It is not an authenticated uploader and intentionally does not call Feishu OpenAPI or delete stale remote files. Local materialization rejects unsafe paths and does not overwrite existing files unless `--force` is passed.

## Mobile Inbox Patch

`learning-companion.mobile-inbox-patch.v1` is an append-only manual return path for captures created from `inbox.html`.

- Unknown patch schemas are rejected.
- Patches require `patchId`; each capture requires a stable `id`.
- The importer tracks patch ids in `workspace.importedPatches` and also skips duplicate capture ids.
- `workspace.importedPatches` is pruned to the latest 200 patch ids to avoid unbounded workspace growth.
- Patch import resolves target by topic id, then exact title, then current active topic with a visible receipt.
- Patch URLs are treated as untrusted and sanitized with the same http/https-only rule as normal captures.
- The import receipt reports stripped source links when mobile patch URLs sanitize to empty.
- Patch size is checked against raw imported file bytes and the parsed payload cap.
- Patch import never overwrites notes, review cards, or existing captures.

## Review Progress Patch

`learning-companion.review-progress-patch.v1` is an append-only manual return path for review grades created from `review.html`.

- Unknown patch schemas are rejected.
- Patches require `patchId`; each event requires a stable `id`, session id, card id, `grade`, and `baseUpdatedAt`.
- `grade` is limited to `again` or `good`.
- The importer tracks patch ids in `workspace.importedReviewPatches`, pruned to the latest 200 ids.
- Review events apply only when the current card `updatedAt` still matches the event `baseUpdatedAt`.
- Stale/conflicting, missing, duplicate, or invalid events are skipped and counted in the visible receipt.
- Patch size and event count are capped before import.
- Patch import never overwrites notes, captures, session metadata, or the full workspace.
