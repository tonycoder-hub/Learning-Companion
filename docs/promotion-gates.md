# Promotion Gates

This project now has several useful local capabilities. This document keeps the wording honest: a local fixture, a dry-run report, or a schema prototype is not the same as a live integration.

For the current next-major work, start with `npm run ko:next -- --source-approval-request .codex-tmp/external-source-validation/source-approval-request.json --operator .codex-tmp/next-major-operator/current.json`. This is the shortest human-readable view of the remaining gates. It reads the current KO status, current source-approval request, and current operator packet; it does not make any missing evidence pass.

For the remaining platform work, refresh the KO status first, then run `npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json --markdown-out .codex-tmp/platform-qa-handoff/current.md` to generate a non-claiming execution handoff. The handoff reads the current KO status plus the Mac, Windows, and HarmonyOS QA templates, writes a machine-readable JSON packet plus a human-readable Markdown execution packet, but it does not run platform QA, retain raw QA Markdown/Notes, or satisfy any KO evidence row by itself.

To snapshot all remaining next-major readiness gates without running build, deployment, platform QA, external-source capture, or privacy review, run `npm run next:readiness -- --refresh --out .codex-tmp/next-major-readiness/current.json --markdown-out .codex-tmp/next-major-readiness/current.md`. This packet is `NEXT_MAJOR_READINESS_SUMMARY_ONLY`; it is a current-state checklist, not release evidence, and it does not authorize a release action. Its not-run boundary is emitted even if KO inputs later become claimable.

For the single operator view of all remaining next-major gates, run `npm run next:operator -- --refresh --out .codex-tmp/next-major-operator/current.json --markdown-out .codex-tmp/next-major-operator/current.md`. This packet is `NEXT_MAJOR_OPERATOR_PACKET_ONLY`; it consolidates readiness, source approval request, and platform QA handoff data, but it does not grant approval, run source capture, perform privacy review, run platform QA, build, deploy, or satisfy KO evidence. If a source approval request is based on a stale or dirty public dry-run, the operator packet marks it for fresh dry-run / approval-request regeneration before asking for current-turn approval.

## Mac Shell

| Stage | Meaning | Current Evidence | Promotion Gate |
| --- | --- | --- | --- |
| Local internal shell | SwiftPM WKWebView shell runs the web app and exposes native capture/window/file commands. | `npm run check:morning:native`, plus offline pack evidence from `npm run check:morning` | Keep iterating. |
| Tony dogfood build | Tony can use the shell for a real study session without terminal-only workarounds. | Missing live GUI matrix; `npm run mac:manual:validate:smoke` only proves the pending receipt stays non-claiming. | Manual QA for sidecar, clipboard capture, selected-text capture, browser context, import/export, relaunch, then `npm run mac:manual:validate -- --qa dist/morning-demo/MAC_MANUAL_QA.md --out .codex-tmp/mac-manual-qa/real-run-receipt.json`. |
| Signed package | Installable `.app` suitable for repeated daily use. | Not started. | App bundle, signing/notarization decision, permission onboarding, update/export safety. |

Current wording: "Mac shell internal build", not "production Mac app".

## Windows Static Mirror

| Stage | Meaning | Current Evidence | Promotion Gate |
| --- | --- | --- | --- |
| Portable static mirror | Generated local folder/ZIP can be inspected as a manual Windows route candidate. | `npm run check:static-return`, `WINDOWS_STATIC_QA.md` pending receipt, and `npm run windows:static:validate:smoke` only prove the receipt stays non-claiming. | Keep using for contract checks. |
| Windows static loop | A real Windows Edge/Chrome local-folder run can review, capture in Inbox, return JSON files to Mac, and import them without workspace overwrite. | Not verified. | Fill `dist/morning-demo/WINDOWS_STATIC_QA.md` from a real Windows run, then `npm run windows:static:validate -- --qa dist/morning-demo/WINDOWS_STATIC_QA.md --out .codex-tmp/windows-static-qa/real-run-receipt.json`. |

Current wording: "Windows static mirror pending receipt", not "Windows compatibility".

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
| Schema reader prototype | Plain JS reader turns workspace or mirror bundle into read-only phone view model with active topic, due review, recent captures, and open questions. | `npm run smoke:harmony`, `learning-companion.harmony-reader-view.v1` | Use this as ArkTS view-model reference. |
| ArkTS scaffold handoff | DevEco-shaped project files, schema constants, page names, import boundary, reader session, and append-only patch service names exist for review. | `apps/companion-harmony-dev/`, `HARMONY_SCAFFOLD_REPORT.json`, and `npm run smoke:harmony`; HANDOFF_ONLY, no SDK compile. | Keep schema/page contracts aligned with the JS prototype. |
| DevEco compile | Minimal HarmonyOS app compiles in DevEco or HarmonyOS command-line toolchain. | Not verified; `HARMONY_DEVICE_QA.md` and `npm run harmony:device:validate:smoke` only keep the pending receipt non-claiming. | Fill the DevEco/toolchain row and session fields from a real toolchain run, then validate the receipt. |
| Device roundtrip | Real phone can read mirror, create inbox/review patches, and Mac imports them. | Not verified; `HARMONY_DEVICE_QA.md` is all `NT` until a real phone/emulator run fills it. | Fill `dist/morning-demo/HARMONY_DEVICE_QA.md` from a real run, then `npm run harmony:device:validate -- --qa dist/morning-demo/HARMONY_DEVICE_QA.md --out .codex-tmp/harmony-device-qa/real-run-receipt.json`. |
| Feishu-backed phone workflow | Phone gets mirror from Feishu and returns append-only patches safely. | Not implemented. | Live Feishu folder access plus patch transport policy. |

Current wording: "HarmonyOS schema reader prototype + ArkTS scaffold handoff", not "compiled HarmonyOS app" or "device-verified HarmonyOS app".

Reader-view schema note: `learning-companion.harmony-reader-view.v1` may gain additive fields while the HarmonyOS consumer is scaffold-only. Removing or renaming fields should bump the derived reader-view schema. Open-question handoff is therefore JSON/scaffold contract evidence until DevEco compile and device import/render gates pass.

## Morning Review Rule

Every morning-facing artifact should name its stage:

- `local fixture`
- `dry-run`
- `schema prototype`
- `internal build`
- `live integration`

If an artifact cannot prove a stage, it must not claim that stage.
