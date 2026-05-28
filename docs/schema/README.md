# Workspace Schema

`workspace.v1.schema.json` is the canonical portable data contract for the local web MVP, future Mac shell, HarmonyOS app, Windows use, and Feishu JSON sidecar export.

The application currently stores this schema in `localStorage` and exports the same structure as JSON. Future clients should preserve unknown fields for forward compatibility.

Compatibility rules:

- `schema` must be `learning-companion.workspace.v1`.
- `schemaVersion` and `version` are both `1` in v1 exports.
- Future clients should refuse unknown major versions instead of trying to coerce them.
- `clientId` identifies the local installation that created new entities.
- Every session, capture, and review card carries `originClientId` and `updatedAt` to support future merge/conflict logic.
