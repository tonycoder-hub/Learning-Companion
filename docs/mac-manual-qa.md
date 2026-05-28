# Mac Manual QA Receipt

Use this during dogfood review of the internal WKWebView shell. It is not evidence of signed packaging, notarization, or live Feishu/HarmonyOS behavior.

Result values: `PASS`, `FAIL`, `BLOCKED`, or `NT`.

## Preconditions

- Run `npm run check:morning` from the repository root.
- Launch the shell with `swift run --package-path apps/companion-mac LearningCompanionMac apps/companion-web`.
- Import `dist/morning-demo/sample-workspace.json`.
- Open `dist/morning-demo/review-start-here.html`.
- Do not enter Feishu credentials; Feishu evidence is dry-run only.

## Test Matrix

| Area | Steps | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| Launch | Open the Mac shell. | App loads the local workspace UI without localhost fallback. |  |  |
| Morning pack shortcut | Use `File > Open Morning Review Pack`. | Browser opens the generated review dashboard, or missing pack shows an alert. |  |  |
| Sidecar | Use `Window > Enter Sidecar Window`, then `Window > Restore Desk Window`. | Native window and web layout narrow/restore together. |  |  |
| Floating | Toggle `Window > Keep Window Above Others`. | Window level changes only when manually toggled. |  |  |
| Clipboard capture | Copy text elsewhere, then use `Capture > Save Clipboard as Capture`. | Capture appears in the active topic with clipboard source. |  |  |
| Selected text capture | Select text in Safari/Chrome/docs, then use `Capture > Save Selected Text as Capture`. | Selected text is captured when Accessibility exposes it. |  |  |
| Clipboard fallback guard | Trigger selected-text capture with no exposed selection and unchanged clipboard. | No stale clipboard capture is imported. |  |  |
| Browser context | Capture while Safari or Chrome is frontmost on an HTTP(S) page. | Title/URL attach when Automation is available, otherwise text-only capture succeeds. |  |  |
| Native import success | Import `dist/morning-demo/patches/sample-mobile-inbox-patch.json`. | Patch Intake/receipt shows imported inbox patch without overwriting notes/cards. |  |  |
| Native import failure | Import malformed JSON. | Alert and in-app issue receipt explain the failure. |  |  |
| Export backup | Use `File > Export Workspace...`. | JSON backup saves locally. |  |  |
| Relaunch persistence | Quit and relaunch. | Workspace persists through WebKit localStorage. |  |  |

Permission prompts are expected for Accessibility or browser Automation; record them instead of treating them as automatic failures.
