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
- Mirror home now also surfaces a single `Next from this export` action. Due review wins because review debt is the most time-sensitive exported work; then the latest open question links into prefilled Inbox answer mode, and only a clear queue falls back to device capture. Mixed due+question states show the open-question count as a secondary line, and the action includes the export timestamp so phone/Windows folder use feels actionable without implying live sync.
- Mira's follow-up critique identified fixed return filenames and mobile tab loss as real manual-flow risks. The static Review and Inbox pages now save timestamped return JSON filenames and warn before leaving when local review/capture work has not been saved or copied.
- The Mac import picker now accepts multiple return JSON files at once and shows a combined `Return JSON imported` receipt, so a phone review file and a Windows inbox file can close the loop together. Batch import uses a stable inbox-before-review order and continues past wrong-type files with per-file errors.
- Return Files receipts now surface stale mirror bases with a `mirror base changed` marker when the return JSON was created from an older return-base fingerprint. Batch receipts include the affected return JSON filenames, keeping manual phone/Windows transfer honest without hard-rejecting append-only captures or review events that still pass their own duplicate/version checks.
- Older Return JSON files that predate `source.returnBaseFingerprint` now show `legacy mirror check`, making the compatibility path visible without treating the file as failed.
- Legacy return receipts now explain that old Return JSON was accepted through the compatibility check, but the next phone/Windows pass should start from a fresh mirror export. This advisory only triggers when a Return JSON lacks `source.returnBaseFingerprint`; files that carry both old and new fingerprints use the newer return-base check.
- Return File imports now route the Mac UI back to Today, open the Device Flow receipt, and pulse that panel. This accepts Seed's critique that return JSON must rejoin Learning Flow, while rejecting background Downloads scanning.
- The separate `Start Here`, `Next Move`, and `Return Files` cards have been consolidated into one `Learning Flow` panel. The high-frequency Mac track now starts with `Read source`, then `Capture on Mac`, then `Close the loop`; the cross-device route is a lower-frequency `Device Flow` drawer labeled `Manual transfer`.
- `Read source` stays compact when a source is merely linked, becomes prominent only when a concrete timestamp can resume the browser/video moment or when the topic still needs a source, and routes the empty-source action through the same Source URL focus path as Quick Capture. This accepts Mira's duplication critique without hiding the always-available source strip.
- Sidecar layout now gets a compressed `Source` / `Capture` / `Loop` rail inside the activity strip. It only appears after the side panels are hidden, reuses the same Learning Flow state, hides the dashboard metric row and Focus Brief fact chips in that focused layout, and labels the clear-loop exit as `Today` before leaving sidecar mode. The activity strip now follows the same boundary: `Capture` and `Resume` stay inside sidecar and focus Quick Capture, while saved-capture/detail actions still say `Exit + ...` when they need hidden panels.
- Return File imports with new captures or review updates now surface a temporary `Returned from phone/Windows` card inside Learning Flow. It only reads the current in-memory import receipt, does not persist sync state, hides for duplicate-only imports, and can jump to returned captures or open import details before being dismissed.
- The detail-heavy Today ledgers (`Open Questions`, `Parked Questions`, `Answers Today`, `Closed Today`, and `Recent Captures`) now live in a `Study Details` drawer with open/parked/recent count badges. Section-map and queue actions open the drawer before jumping so the information stays reachable without flattening the first screen.
- Browser smoke now pins the `Learning Flow`, `Read source`, `Next Move`, `Device Flow`, and `Study Details` drawer behavior, including all five nested section-map jumps.
- Device Flow now has a local handoff status, not a sync claim: it records the latest Mirror JSON/ZIP export in `uiPrefs`, compares that return-base fingerprint to the current Mac state, shows `Mirror current` or `Mac changed since mirror export`, derives `Waiting for return file` from export/import times instead of persisting a brittle flag, and leads the collapsed drawer with the next step before import counts.
- The same local state records the latest Return JSON import with file/new-item counts. It stays out of workspace JSON and mirror exports, preserving the portable data contract.
- Quick Capture source context now uses visible resume actions: `Resume @ time` when a video/article timestamp is known, `Open source` when only the URL is known, and `Set source` when the topic has no source yet. The no-source action focuses the Source URL field instead of leaving a disabled dead end.
- Source setup now has a visible, user-initiated `Paste Source` shortcut beside the URL field. It only reads clipboard text after a click, keeps the first safe `http/https` URL, strips supported video time from the stored source URL, syncs that time into Quick Capture, infers type locally, discards non-URL clipboard text, and keeps an existing topic's material type when it already has captures.
- Quick Capture now turns source type and staged time into local writing starters: timestamped videos show `Video moment` with transcript/moment placeholders, while doc/article/book topics prompt for an excerpt plus takeaway/question. This does not claim live browser or transcript access.
- Quick Capture now also has three local starter buttons: `Question`, `Answer`, and `Takeaway`. They only seed or convert the Thought draft prefix and focus the field; Capture/Card still control what gets committed, so the row lowers capture friction without changing the workspace schema or cross-device contract.
- Quick Capture save receipts now match the committed capture type instead of using generic `Capture saved` copy. Questions route to Today > Open Questions, linked answers route to Closed Today, standalone answers route to Answers Today, takeaways stay in the capture stack, and cards/cloze captures route to Review. Explicit `Question:` / `Q:` prefixes with a body count as question intent; bare `Question:` stays a local draft/capture. This accepts the flow critique without turning starter drafts into schema tags or live mobile sync. The receipt itself is Mac-local UI state and is not serialized into workspace JSON, Return JSON, static `inbox.html` / `review.html`, Harmony scaffolds, or Feishu mirror output.
- Quote-only saves now show `Highlight saved` instead of generic capture feedback, making the high-frequency read-highlight-continue loop explicit while clearly saying the source page is unchanged. The local `Add thought` form in Recent Stack and Captures lets Tony annotate that same highlight in place, so the read-highlight-continue loop has a natural deepen-later path without duplicating captures or claiming page annotation. If the highlight had already been inserted into Notes through the generated capture marker block, annotation refreshes that same block so durable notes do not drift behind the capture. That marker block is treated as a managed region: free-form Notes outside the markers are not touched, while edits inside the generated block may be replaced by the next refresh.
- Workflow/Seed review was attempted for this slice with 3 tasks at concurrency 3 on `ark/seed-code-0530`; that batch timed out with empty stdout/stderr. A narrower retry with 1 task at concurrency 1 succeeded. I accepted its concrete Cloze receipt coverage point, but rejected its `isLocal flag` recommendation because post-save receipts are in-memory activity, not model/export records.
- Static Review/Inbox pages now keep a stable per-draft return id and visible suggested filename, so Copy Return JSON and Save Return JSON point at the same file identity instead of generating a new patch id every time the preview renders.
- Static Review/Inbox pages now also include `Manual Copy` as the no-permission fallback: it only selects the preview Return JSON for manual copy when clipboard or picker access is blocked, without writing the clipboard, downloading a file, or starting any background scan.
- Static Review/Inbox return panels now keep a persistent next-step cue that counts review events or draft captures staged in the return file to bring back to Mac, with screen-reader-friendly status updates.
- Latest Mira/Seed review on the returned-work nudge was accepted for provenance-first copy, explicit dismiss, duplicate-only suppression, and review-only import-details routing. I rejected `synced` wording, 24-hour persistence, telemetry, and bottom-of-page demotion because they either overclaim live sync, add state without approval, or bury the immediate post-import learning action.
- Workspace backup copy no longer frames backup verification around Downloads. The app, Mac manual QA, and morning demo script now frame this as an exported/selected file so Downloads is not the default mental model; `exported` is intentionally destination-agnostic across native save panels, browser pickers, and the gated automation fallback.
- Captures with generated note blocks now show `In Notes` and expose `Update note` instead of another generic `Note` button, making the capture-to-notes state visible while keeping the marker block idempotent.
- `Note` / `Update note` now completes the capture-to-notes loop: the activity action says `View note`, switches Notes into preview, scrolls to the generated block, pulses it, and moves focus there. The Markdown preview only hides valid paired generated capture markers; unbalanced marker text stays visible, so a pasted or broken marker cannot eat the rest of the user's notes.

## Current Journey Assessment

Desktop/Mac:

- Usable as an internal dogfood loop.
- The strongest path is browser source plus sidecar capture plus Learning Flow/Focus Brief/Today review.
- Remaining gap: Mac GUI/manual QA is still not filled for selected-text capture, native save panels, and relaunch/persistence.

Harmony phone:

- Not a usable app yet.
- Current evidence is schema/scaffold only. The reader view now computes `readerNextAction` and optional `secondaryAction`, the ArkTS Index scaffold renders them as `Phone Next` plus one secondary button when the primary action hides another useful lane, and TopicDetail consumes `topicId` plus `section` params so those buttons land on the intended open-question or answers-today scaffold section. Those secondary sections are now explicitly across-topic lanes to avoid implying topic-filtered lists that the current reader view does not provide. The next useful step is still DevEco compile plus file-picker/import smoke on device.

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
