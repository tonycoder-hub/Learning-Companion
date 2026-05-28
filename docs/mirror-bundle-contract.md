# Mirror Bundle Contract

## Status

`learning-companion.mirror-bundle.staging.v1` is an experimental export and restore boundary. It is not the final Feishu Drive folder layout.

## Authority

- `workspace.json` is canonical for restore.
- `README.md` is derived documentation.
- `sessions/*.md` is derived human-readable material.
- `sessions/*.feishu.json` is a derived sidecar reserved for future round-trip sync.

Future importers should restore from `workspace.json` first. They may use derived files for diagnostics, previews, or migration help, but not as the primary source of truth.

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
