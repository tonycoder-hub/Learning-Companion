# Mirror Bundle Contract

## Status

`learning-companion.mirror-bundle.staging.v1` is an experimental export and restore boundary. It is not the final Feishu Drive folder layout.

The app can also emit `learning-companion-feishu-mirror.zip`, a no-compression ZIP containing the same virtual files. The ZIP is a manual transport/package format; the JSON bundle and its `workspace.json` payload remain the contract authority.

ZIP is not a valid direct import source today. To restore from ZIP, extract `workspace.json` or use the JSON mirror bundle instead.

## Authority

- `workspace.json` is canonical for restore.
- `README.md` is derived documentation.
- `TODAY.md` and `index.html` are derived entry points and include a Focus Brief / Resume Here section for the active session.
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
