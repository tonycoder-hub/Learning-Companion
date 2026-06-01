# User Flow Audit

Date: 2026-06-01

## Mainline Goal

Learning Companion is a Mac-first study sidecar, not a generic note app. The main loop should stay simple:

1. Open beside a browser source.
2. Capture a quote, thought, timestamp, question, or answer without losing focus.
3. Turn unresolved questions into answers, cards, synthesis, review, or parked follow-up.
4. Export a readable mirror for Harmony phone, Windows, and Feishu folders without pretending manual transport is live sync.

## External Review Status

- Mira packet was prepared and submitted through the Hermes SSH broker twice. Both attempts failed at `SSH_FAILED` before Mira review execution, so there is no Mira verdict for this audit.
- Seed / Doubao review ran after network approval. The first batch partly emitted tool-call intent in no-tool mode, so only the information-architecture critique was usable. A second summary-only batch returned usable critiques for desktop flow, cross-device flow, and information architecture.

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

## Changes Made From The Audit

- Added a `Next Move` card to Today for returning users. It chooses one primary action in this order: due review, capture draft, open question, parked question, recent capture, or capture setup.
- Kept empty-workspace `Start Here` as the first-run path instead of showing `Next Move`.
- Renamed the Today handoff card from `Patch Intake` to `Return Files`, and changed the import button to `Import File`.
- Added the explicit Return Files manual transfer path with device labels: export mirror on Mac, use `inbox.html` or `review.html` on phone/Windows, then import the returned JSON back on Mac. The card now calls Feishu a file-sharing route, not sync.
- Browser smoke now pins the `Next Move` priority and the new `Return Files` copy.

## Current Journey Assessment

Desktop/Mac:

- Usable as an internal dogfood loop.
- The strongest path is browser source plus sidecar capture plus Focus Brief/Today review.
- Remaining gap: Mac GUI/manual QA is still not filled for selected-text capture, native save panels, and relaunch/persistence.

Harmony phone:

- Not a usable app yet.
- Current evidence is schema/scaffold only. The next useful step is DevEco compile plus file-picker/import smoke on device.

Windows:

- Usable only as a static mirror reader/reviewer through exported HTML files.
- Return path is append-only JSON file export, then manual transfer/import on Mac.

Feishu:

- Useful as a readable folder/mirror destination.
- Not sync. Not live write. Not a credentialed transport yet.

## Next Product Moves

1. Fill Mac manual QA rows for capture, source context, native saves, import, and relaunch.
2. Turn the `Return Files` steps into a full receipt after each mirror export and patch import.
3. Verify the static mirror on a real Windows browser and record limitations.
4. Compile the Harmony scaffold in DevEco before calling the phone path usable.
5. Retry Mira once the SSH broker is healthy, but do not block local progress on that path.
