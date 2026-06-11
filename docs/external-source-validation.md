# External Source Visual Validation

Purpose: prove the study loop can be used beside approved external reading or video material, without overstating broad website compatibility.

This is a live-evidence checklist, not a fixture. Leave any unobserved value as `TBD`.

## Authorization Boundary

Run this only when the current turn authorizes the required browser/server/network actions and the source material is approved.

Allowed sources:

- public non-private pages,
- user-provided non-private URLs,
- local files explicitly provided for validation.

Do not use:

- authenticated or private pages,
- pages containing secrets, personal data, internal documents, cookies, or session identifiers,
- screenshots that expose account identity, tokens, private chat, private docs, or browser profiles.

## Artifact Location

Store each run under:

```text
.codex-tmp/external-source-validation/TBD/
```

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
- Approved by: TBD
- Privacy check: TBD

## Environment

- App URL or file path: TBD
- Viewport / window layout: TBD
- Browser: TBD
- Network mode: TBD

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

## Result

- Verdict: TBD
- Observed issue: TBD
- Follow-up: TBD

## Blocked / Not Run / Needs Decision

- TBD
```

## Reading Source Procedure

1. Open the approved reading source and the app side by side.
2. Confirm the screenshot has no private or sensitive content.
3. Select a short passage or write a note from the reading source.
4. Capture into the app with source title and URL preserved.
5. Save the capture.
6. Open or resume the source from the app.
7. Save the three required screenshots and complete `run.md`.

PASS requires:

- the source and app are visible together before capture,
- the saved capture keeps source title and URL context,
- resume/open-source action returns to the source,
- no private/sensitive content appears in artifacts.

## Video Source Procedure

1. Open the approved video source and the app side by side.
2. Confirm the screenshot has no private or sensitive content.
3. Start playback only if allowed by the source and current turn.
4. Capture a note while the video has a visible timestamp or while the app receives a timestamp.
5. Save the capture.
6. Use the app source/resume action and verify the target opens near the captured moment when supported.
7. Save the required screenshots and complete `run.md`.

PASS requires:

- the video source and app are visible together before capture,
- the saved capture preserves source title and URL,
- timestamp evidence is captured when the platform exposes it,
- resume/open-source behavior is recorded,
- unsupported timestamp behavior is explicitly marked in `Blocked / Not Run / Needs Decision`.

## Claim Boundary

One successful reading run and one successful video run prove only that those approved sources worked in that environment. They do not prove:

- all video platforms work,
- all document sites work,
- authenticated pages are supported,
- browser extension compatibility,
- mobile or Windows compatibility.
