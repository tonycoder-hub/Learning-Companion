# Workspace Schema

`workspace.v1.schema.json` is the canonical portable data contract for the local web MVP, future Mac shell, HarmonyOS app, Windows use, and Feishu JSON sidecar export.

The application currently stores this schema in `localStorage` and exports the same structure as JSON. Future clients should preserve unknown fields for forward compatibility.
