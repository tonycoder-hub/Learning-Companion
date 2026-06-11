# External Source Visual Validation

Purpose: prove the study loop can be used beside approved external reading or video material, without overstating broad website compatibility.

This is a live-evidence checklist, not a fixture. Leave any unobserved value as `TBD`.

## Authorization Boundary

Run this only when the current turn authorizes the required browser/server/network actions and every source material item is explicitly approved in the current turn. A public URL is necessary but not sufficient.

Eligible sources:

- public non-private pages,
- user-provided non-private URLs,
- local files explicitly provided for validation.

Do not use:

- authenticated or private pages,
- pages containing secrets, personal data, internal documents, cookies, or session identifiers,
- screenshots that expose account identity, tokens, private chat, private docs, or browser profiles.

## Artifact Location

Store each run under a concrete run folder:

```text
.codex-tmp/external-source-validation/<yyyymmddThhmmss>-<reading|video>-<short-source>/
```

Do not create the folder until an actual run starts. Keep unobserved values inside `run.md` as `TBD`.

Recommended files:

- `run.md`: completed run note,
- `01-source-and-app-before-capture.png`: source visible beside the app before capture,
- `02-capture-saved.png`: app showing the saved capture or activity feedback,
- `03-resume-source.png`: source opened or resumed from the app,
- `04-video-timestamp.png`: video timestamp evidence when relevant.

Screenshots are evidence of what was visible. They are not proof of broad platform compatibility, playback quality, or human comprehension unless the run note records the exercised behavior.

## Run Note Template

```markdown
# External Source Validation Run

Date: TBD
Operator: TBD
Run type: TBD

## Source

- URL: TBD
- Title: TBD
- Source type: TBD
- Approved URL/file: TBD
- Approval source: TBD
- Approval reference: TBD
- Approved at: TBD
- Privacy check: TBD

## Environment

- App URL or file path: TBD
- App commit SHA: TBD
- Dirty worktree: TBD
- Viewport / window layout: TBD
- Browser: TBD
- Browser profile mode: TBD
- Network mode: TBD

## Privacy Preflight

- Signed-out or guest browser where possible: TBD
- No visible account avatar/email/profile: TBD
- No private tabs/bookmarks/sidebar content visible: TBD
- No tokens/session IDs/private IDs in URL: TBD
- Final artifact privacy review: TBD

## Executed

- Opened source beside app: TBD
- Captured selected text or note into app: TBD
- Saved capture: TBD
- Resumed/opened source from app: TBD
- Video timestamp captured: TBD

## Evidence

- Source beside app screenshot: TBD
- Capture saved screenshot: TBD
- Resume source screenshot: TBD
- Video timestamp screenshot: TBD
- Captured timestamp: TBD
- Resume URL timestamp: TBD
- Observed resumed playback time: TBD
- Timestamp tolerance result: TBD

## Result

- Verdict: TBD
- Observed issue: TBD
- Follow-up: TBD

## Blocked / Not Run / Needs Decision

- TBD
```

## Reading Source Procedure

1. Open the approved reading source and the app side by side.
2. Use a signed-out or guest browser where possible.
3. Confirm there is no visible account avatar/email, private tab, private bookmark/sidebar content, token, session ID, or private identifier.
4. Select a short passage or write a note from the reading source.
5. Capture into the app with source title and URL preserved.
6. Save the capture.
7. Open or resume the source from the app.
8. Review every artifact for privacy before delivery.
9. Save the three required screenshots and complete `run.md`.

PASS requires:

- the source and app are visible together before capture,
- the saved capture keeps source title and URL context,
- resume/open-source action returns to the source,
- the approval source and privacy review are recorded,
- no private/sensitive content appears in artifacts.

## Video Source Procedure

1. Open the approved video source and the app side by side.
2. Use a signed-out or guest browser where possible.
3. Confirm there is no visible account avatar/email, private tab, private bookmark/sidebar content, token, session ID, or private identifier.
4. Start playback only if allowed by the source and current turn.
5. Capture a note while the video has a visible timestamp or while the app receives a timestamp.
6. Record the captured timestamp.
7. Save the capture.
8. Use the app source/resume action and record the resume URL timestamp plus observed resumed playback time when supported.
9. Review every artifact for privacy before delivery.
10. Save the required screenshots and complete `run.md`.

PASS requires:

- the video source and app are visible together before capture,
- the saved capture preserves source title and URL,
- timestamp evidence is captured when the platform exposes it,
- supported resume playback lands within 5 seconds of the captured timestamp,
- resume/open-source behavior is recorded,
- the approval source and privacy review are recorded,
- unsupported timestamp behavior is explicitly marked in `Blocked / Not Run / Needs Decision`.

## Claim Boundary

One successful reading run and one successful video run prove only that those approved sources worked in that environment. They do not prove:

- all video platforms work,
- all document sites work,
- authenticated pages are supported,
- browser extension compatibility,
- mobile or Windows compatibility.
