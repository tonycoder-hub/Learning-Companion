# Promotion Gates

This project now has several useful local capabilities. This document keeps the wording honest: a local fixture, a dry-run report, or a schema prototype is not the same as a live integration.

## Mac Shell

| Stage | Meaning | Current Evidence | Promotion Gate |
| --- | --- | --- | --- |
| Local internal shell | SwiftPM WKWebView shell runs the web app and exposes native capture/window/file commands. | `swift build --package-path apps/companion-mac`, `npm run check:morning` | Keep iterating. |
| Tony dogfood build | Tony can use the shell for a real study session without terminal-only workarounds. | Missing live GUI matrix. | Manual QA for sidecar, clipboard capture, selected-text capture, browser context, import/export, relaunch. |
| Signed package | Installable `.app` suitable for repeated daily use. | Not started. | App bundle, signing/notarization decision, permission onboarding, update/export safety. |

Current wording: "Mac shell internal build", not "production Mac app".

## Feishu

| Stage | Meaning | Current Evidence | Promotion Gate |
| --- | --- | --- | --- |
| Mirror bundle | Credential-free JSON/ZIP snapshot with readable Markdown and restore payload. | `npm run smoke`, `npm run check:morning` | Keep using for manual inspection. |
| Upload plan | Credential-free local adapter boundary that maps bundle files to one-way upserts. | `learning-companion.feishu-upload-plan.v1`, negative path tests. | Stable enough for dry-run executor. |
| Dry-run report | Local verifier consumes plan + files and reports `would-upsert` actions after byte/fingerprint checks. | `learning-companion.feishu-upload-report.v1`, morning demo report. | Define real OpenAPI auth/config boundary. |
| Live one-way Drive writer | Authenticated Feishu OpenAPI upload writes the planned files. | Not implemented. | Explicit credential setup, scopes, remote folder id, retry/report shape, stale-file strategy. |
| Round-trip sync | Feishu or phone edits reconcile with Mac canonical workspace. | Not implemented. | Conflict model, remote IDs, tombstones, edit provenance, human recovery. |

Current wording: "Feishu local upload plan/dry-run", not "Feishu sync".

## HarmonyOS

| Stage | Meaning | Current Evidence | Promotion Gate |
| --- | --- | --- | --- |
| Schema reader prototype | Plain JS reader turns workspace or mirror bundle into read-only phone view model. | `npm run smoke:harmony`, `learning-companion.harmony-reader-view.v1` | Use this as ArkTS view-model reference. |
| DevEco shell | Minimal HarmonyOS app imports workspace/mirror JSON and renders active topic/review/captures. | Not started. | SDK/project setup, file picker, local storage, basic navigation. |
| Device roundtrip | Real phone can read mirror, create inbox patch, and Mac imports it. | Not verified. | Manual HarmonyOS test with exported patch receipt. |
| Feishu-backed phone workflow | Phone gets mirror from Feishu and returns append-only patches safely. | Not implemented. | Live Feishu folder access plus patch transport policy. |

Current wording: "HarmonyOS schema reader prototype", not "HarmonyOS app".

## Morning Review Rule

Every morning-facing artifact should name its stage:

- `local fixture`
- `dry-run`
- `schema prototype`
- `internal build`
- `live integration`

If an artifact cannot prove a stage, it must not claim that stage.
