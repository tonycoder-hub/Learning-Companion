# User Flow Audit

Date: 2026-06-01

## Mainline Goal

Learning Companion is a Mac-first study sidecar, not a generic note app. The main loop should stay simple:

1. Open beside a browser source.
2. Capture a quote, thought, timestamp, question, or answer without losing focus.
3. Turn unresolved questions into answers, cards, synthesis, review, or parked follow-up.
4. Export a readable mirror for Harmony phone, Windows, and Feishu folders without pretending manual transport is live sync.

## External Review Status

- Earlier Mira packets failed at `SSH_FAILED`, but the Hermes SSH broker path has since been restored and re-smoked with `re-o-47` / `deep`.
- A focused Mira review on the phone+computer journey returned `PASS_WITH_NOTES`: it accepted the need for a flow rail, but criticized a symmetric four-step rail because daily Mac capture/review is high-frequency while device transfer is lower-frequency.
- Seed / Doubao review also criticized the cross-device route for making users manually hunt for return JSON files and for weak stale-package guardrails. I accepted the route-clarity critique but deferred Downloads auto-scan because app automation should not keep dropping files into Downloads and browser static pages cannot safely scan local folders.

## What I Accept

- The app has a strong core loop on Mac: source setup, Quick Capture, review, question closure, and export are connected enough to dogfood.
- Today had too many equal-weight sections. It needed a returning-user anchor above the dashboard.
- `Patch Intake` was developer language. The user-facing surface is now `Return Files`, matching the phone/Windows JSON return path.
- Cross-device copy must keep saying "manual mirror / append-only return files" until Feishu live sync and Harmony device behavior are proven.

## What I Reject Or Defer

- Seed overstates the issue by treating Today as the only primary screen. The actual Mac desk already has Focus Brief and Quick Capture above the inspector.
- I am not moving Export out of the inspector tonight. Export is still a key manual handoff surface while Feishu sync is not real.
- I am not hiding Answers Today or Closed Today yet. They are useful for the question loop, but they should stay below the new primary action.
- I am not adding new global shortcuts until Mac manual QA catches up.
- Mira correctly flagged full-workspace stale-base fingerprints as potentially noisy. I first accepted clearer `mirror base changed` copy plus match/null smoke coverage, then added a narrower `source.returnBaseFingerprint` projection so ordinary non-question Mac captures after mirror export do not make phone/Windows Return JSON look stale. Older return files still fall back to `source.workspaceFingerprint`.

## Changes Made From The Audit

- Added a `Next Move` route for returning users. It chooses one primary action in this order: due review, capture draft, open question, parked question, recent capture, or capture setup.
- Kept empty-workspace `Start Here` as the first-run path instead of showing `Next Move`, then moved both paths into the unified Learning Flow panel.
- Renamed the Today handoff card from `Patch Intake` to `Return Files`, and changed the import button to `Import Return Files`.
- Added the explicit Return Files manual transfer path with device labels: export mirror on Mac, use `inbox.html` or `review.html` on phone/Windows, then import the returned JSON back on Mac. The card now calls Feishu a file-sharing route, not sync.
- Device Flow now lists USB, AirDrop, email, or file share before manual Feishu Drive upload, so Feishu reads as a manual carrier rather than a live integration.
- `Export Mirror` now opens the Export tab at the Mirror Folder section, focuses Save Mirror, and records a handoff activity receipt instead of dropping the user into an undifferentiated export panel.
- Saving Mirror JSON or ZIP now records a handoff receipt that tells the user to move the file through USB, AirDrop, email, file share, or manual Feishu Drive upload and use `inbox.html` or `review.html` to create a return JSON.
- The exported `index.html`, `review.html`, and `inbox.html` now repeat the return-file contract on the device side: static mirror, no live sync, save a return JSON, move it back to Mac, import from Today > Return Files.
- Mirror home now turns that contract into a three-step Manual Return checklist: Read Today, work in Review/Inbox, then return JSON back to Mac. Static mirror pages now show a `Return-ready mirror` badge before device-side work starts, so phone/Windows users can see that this export's Review/Inbox Return JSON carries the Mac return-base check without implying live sync.
- Mira's follow-up critique identified fixed return filenames and mobile tab loss as real manual-flow risks. The static Review and Inbox pages now save timestamped return JSON filenames and warn before leaving when local review/capture work has not been saved or copied.
- The Mac import picker now accepts multiple return JSON files at once and shows a combined `Return JSON imported` receipt, so a phone review file and a Windows inbox file can close the loop together. Batch import uses a stable inbox-before-review order and continues past wrong-type files with per-file errors.
- Return Files receipts now surface stale mirror bases with a `mirror base changed` marker when the return JSON was created from an older return-base fingerprint. Batch receipts include the affected return JSON filenames, keeping manual phone/Windows transfer honest without hard-rejecting append-only captures or review events that still pass their own duplicate/version checks.
- Older Return JSON files that predate `source.returnBaseFingerprint` now show `legacy mirror check`, making the compatibility path visible without treating the file as failed.
- Legacy return receipts now explain that old Return JSON was accepted through the compatibility check, but the next phone/Windows pass should start from a fresh mirror export. This advisory only triggers when a Return JSON lacks `source.returnBaseFingerprint`; files that carry both old and new fingerprints use the newer return-base check.
- Return File imports now route the Mac UI back to Today, open the Device Flow receipt, and pulse that panel. This accepts Seed's critique that return JSON must rejoin Learning Flow, while rejecting background Downloads scanning.
- The separate `Start Here`, `Next Move`, and `Return Files` cards have been consolidated into one `Learning Flow` panel. The high-frequency Mac track shows `Capture on Mac` and `Close the loop`; the cross-device route is a lower-frequency `Device Flow` drawer labeled `Manual transfer`.
- Return File imports with new captures or review updates now surface a temporary `Returned from phone/Windows` card inside Learning Flow. It only reads the current in-memory import receipt, does not persist sync state, hides for duplicate-only imports, and can jump to returned captures or open import details before being dismissed.
- The detail-heavy Today ledgers (`Open Questions`, `Parked Questions`, `Answers Today`, `Closed Today`, and `Recent Captures`) now live in a `Study Details` drawer with open/parked/recent count badges. Section-map and queue actions open the drawer before jumping so the information stays reachable without flattening the first screen.
- Browser smoke now pins the `Learning Flow`, `Next Move`, `Device Flow`, and `Study Details` drawer behavior, including all five nested section-map jumps.
- Device Flow now has a local handoff status, not a sync claim: it records the latest Mirror JSON/ZIP export in `uiPrefs`, compares that return-base fingerprint to the current Mac state, shows `Mirror current` or `Mac changed since mirror export`, derives `Waiting for return file` from export/import times instead of persisting a brittle flag, and leads the collapsed drawer with the next step before import counts.
- The same local state records the latest Return JSON import with file/new-item counts. It stays out of workspace JSON and mirror exports, preserving the portable data contract.
- Quick Capture source context now uses visible resume actions: `Resume @ time` when a video/article timestamp is known, `Open source` when only the URL is known, and `Set source` when the topic has no source yet. The no-source action focuses the Source URL field instead of leaving a disabled dead end.
- Static Review/Inbox pages now keep a stable per-draft return id and visible suggested filename, so Copy Return JSON and Save Return JSON point at the same file identity instead of generating a new patch id every time the preview renders.
- Static Review/Inbox pages now also include `Manual Copy` as the no-permission fallback: it only selects the preview Return JSON for manual copy when clipboard or picker access is blocked, without writing the clipboard, downloading a file, or starting any background scan.
- Latest Mira/Seed review on the returned-work nudge was accepted for provenance-first copy, explicit dismiss, duplicate-only suppression, and review-only import-details routing. I rejected `synced` wording, 24-hour persistence, telemetry, and bottom-of-page demotion because they either overclaim live sync, add state without approval, or bury the immediate post-import learning action.

## Current Journey Assessment

Desktop/Mac:

- Usable as an internal dogfood loop.
- The strongest path is browser source plus sidecar capture plus Learning Flow/Focus Brief/Today review.
- Remaining gap: Mac GUI/manual QA is still not filled for selected-text capture, native save panels, and relaunch/persistence.

Harmony phone:

- Not a usable app yet.
- Current evidence is schema/scaffold only. The next useful step is DevEco compile plus file-picker/import smoke on device.

Windows:

- Usable only as a static mirror reader/reviewer through exported HTML files.
- Return path is append-only JSON file export, then manual transfer/import on Mac.
- The morning pack now includes `WINDOWS_STATIC_QA.md` as a pending receipt for the real Windows Edge/Chrome folder launch, `review.html`/`inbox.html` Return JSON creation, and Mac Return Files import. It stays `PENDING_USER_GATE` until a real Windows pass fills the rows.

Feishu:

- Useful as a readable folder/mirror destination.
- Not sync. Not live write. Not a credentialed transport yet.

## Next Product Moves

1. Fill Mac manual QA rows for capture, source context, native saves, import, and relaunch.
2. Add the same post-save receipt coverage for Mac-shell native NSSavePanel manual QA.
3. Verify the static mirror on a real Windows browser and fill `dist/morning-demo/WINDOWS_STATIC_QA.md`.
4. Compile the Harmony scaffold in DevEco before calling the phone path usable.
5. Retry Mira once the SSH broker is healthy, but do not block local progress on that path.
