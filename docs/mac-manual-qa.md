# Mac Manual QA Receipt

Use this during dogfood review of the internal WKWebView shell. It is not evidence of signed packaging, notarization, or live Feishu/HarmonyOS behavior.

Result values: `PASS`, `FAIL`, `BLOCKED`, or `NT`. This is not evidence until the Result column is filled from an actual Mac GUI run.

`Exported` is intentionally destination-agnostic here: the path may be a native save panel, browser picker, or a gated automation fallback, but reviewers should not assume Downloads is the default destination.

## Session Header

| Field | Value |
| --- | --- |
| Date/time | TBD |
| Reviewer | TBD |
| Mac build/source | TBD |
| macOS version | TBD |
| Browser/source used | TBD |
| Native build gate result | TBD |
| Browser smoke gate result | TBD |
| Total elapsed time | TBD |
| Permission prompts observed | TBD |
| Native save/import friction observed | TBD |
| Biggest friction | TBD |

## Preconditions

- Run `npm run check:morning` from the repository root for the offline headline gate.
- Run `npm run check:morning:native` separately when SwiftPM toolchain/cache access is allowed.
- Run `npm run check:morning:browser` separately when local browser port binding is allowed.
- Launch the shell with `swift run --package-path apps/companion-mac LearningCompanionMac apps/companion-web`.
- Import `dist/morning-demo/sample-workspace.json`.
- Open `dist/morning-demo/review-start-here.html`.
- Do not enter Feishu credentials; Feishu evidence is dry-run only.

## Test Matrix

| Area | Steps | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| Launch | Open the Mac shell. | App loads the local workspace UI without localhost fallback. | NT |  |
| Morning pack shortcut | Use `File > Open Morning Review Pack`. | Browser opens the generated review dashboard, or missing pack shows an alert. | NT |  |
| Sidecar | Use `Window > Enter Sidecar Window`, then `Window > Restore Desk Window`. | Native window and web layout narrow/restore together. | NT |  |
| Floating | Toggle `Window > Keep Window Above Others`. | Window level changes only when manually toggled. | NT |  |
| Clipboard capture | Copy text elsewhere, then use `Capture > Save Clipboard as Capture`. | Capture appears in the active topic with clipboard source. | NT |  |
| Quick Capture draft persistence | Type a quote, thought, and time in Quick Capture without saving; switch to another session and return. | Draft text and time are restored, and the capture surface shows a local draft status. | NT |  |
| Today draft resume | Leave a non-empty Quick Capture draft, open Today, then use the draft Resume action. | Today shows a device-local/not-exported draft card and Resume returns focus to Quick Capture. | NT |  |
| Focus Brief draft precedence | In a workspace with both a due review and a fresh Quick Capture draft, open Focus Brief. | Due review stays the primary next action; the draft remains recoverable from Today instead of being treated as synced/exported data. | NT |  |
| Focus Brief question signal | In a topic with an open question and due review or synthesis, click the Focus Brief open-question signal. | The primary Focus Brief action stays Review or Build, while the signal opens Today at Open Questions and exits sidecar layout if needed. | NT |  |
| Open question handoff | After importing `dist/morning-demo/sample-workspace.json`, open Today and the mirror home. | The Rust traits question appears in Today Open Questions and in `mirror-folder/index.html` as an Open Question Preview. | NT |  |
| Question close loop | In Today, use the open question's Park, Answer, Make card, then Resolve and Reopen on a question capture. | Park moves it to Parked Questions without resolving; Answer starts an `Answer:` Quick Capture draft in the source topic; Make card creates a review card in that topic; Resolve removes it from Open Questions; Reopen restores it. | NT |  |
| Source timestamp jump | Enter a current Time value on a session with a video source, then open the source. | Browser target includes the current timestamp when the source supports timestamp jumps. | NT |  |
| Selected text capture | Select text in Safari/Chrome/docs, then use `Capture > Save Selected Text as Capture`. | Selected text is captured when Accessibility exposes it. | NT |  |
| Clipboard fallback guard | Trigger selected-text capture with no exposed selection and unchanged clipboard. | No stale clipboard capture is imported. | NT |  |
| Browser context | Capture while Safari or Chrome is frontmost on an HTTP(S) page. | Title/URL attach when Automation is available, otherwise text-only capture succeeds. | NT |  |
| Native import success | Import `dist/morning-demo/patches/sample-mobile-inbox-patch.json`. | Return Files/receipt shows imported inbox patch without overwriting notes/cards. | NT |  |
| Native import failure | Import malformed JSON. | Alert and in-app issue receipt explain the failure. | NT |  |
| Export backup | After adding a capture, confirm the storage notice appears; then use `File > Export Workspace...`. | Notice asks for export before backup and then asks you to verify the exported JSON file yourself. | NT |  |
| Relaunch persistence | Quit and relaunch. | Workspace persists through WebKit localStorage. | NT |  |

Permission prompts are expected for Accessibility or browser Automation; record them instead of treating them as automatic failures.

Use `PASS`, `FAIL`, `BLOCKED`, or `NT` for the native build and browser smoke gate result fields; both must be `PASS` before this receipt can support a Mac manual-QA usability claim.

Cannot be filled from controlled browser smoke, SwiftPM build success, or fixture receipts; only a real Mac GUI run can change `NT` rows.

Validate a filled generated receipt with:

```bash
npm run mac:manual:validate -- --qa dist/morning-demo/MAC_MANUAL_QA.md --out .codex-tmp/mac-manual-qa/real-run-receipt.json
```
