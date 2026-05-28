# Workspace Schema

`workspace.v1.schema.json` is the canonical portable data contract for the local web MVP, future Mac shell, HarmonyOS app, Windows use, and Feishu JSON sidecar export.

The application currently stores this schema in `localStorage` and exports the same structure as JSON. Future clients should preserve unknown fields for forward compatibility.

Compatibility rules:

- `schema` must be `learning-companion.workspace.v1`.
- `schemaVersion` and `version` are both `1` in v1 exports.
- Future clients should refuse unknown major versions instead of trying to coerce them.
- `clientId` identifies the local installation that created new entities.
- Every session, capture, and review card carries `originClientId` and `updatedAt` to support future merge/conflict logic.
- Normalized captures carry their own source title, source URL, material type, optional timestamp, and `sourceProvenance` so future clients can preserve source context even if the parent session later changes source.
- These capture source fields are optional in the v1 JSON Schema for compatibility with early local exports. Importers should backfill missing values from the parent session and mark `sourceProvenance` as `inherited`; new captures should use `snapshot`, while browser URL captures may use `inbound`.
- Time jump links currently support YouTube by writing `t=<seconds>s`. Other providers should be added deliberately behind `buildSourceJumpUrl` rather than by changing stored capture data.
