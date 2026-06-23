# External Source Visual Validation

Purpose: prove the study loop can be used beside approved external reading or video material, without overstating broad website compatibility.

This is a live-evidence checklist, not a fixture. Leave any unobserved value as `TBD`.

## Authorization Boundary

Run this only when the current turn authorizes the required browser/server/network actions and every source material item is explicitly approved in the current turn. A public URL is necessary but not sufficient.

Here, `URL` means the public learning-material link, not a repository or deployment URL.
中文：URL 就是网页链接。这里需要的是公开学习材料链接，不是仓库、部署地址、本机地址或内部页面。

The shortest approved-input shape is:

```text
阅读：https://<public-reading-material>
视频：https://<public-video-material>
时间：00:15
```

Eligible sources:

- public non-private pages,
- user-provided non-private URLs.

Do not use:

- authenticated or private pages,
- localhost, private IP, single-label intranet hosts, or reserved example domains as approved external sources,
- local files in the browser harness path; handle any explicitly provided local file through a separate runbook and do not convert it into `APPROVED_SOURCE_CANDIDATE`,
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
- `02b-video-learning-tools.png`: video notes/bookmark/playback-rate evidence when relevant,
- `03-resume-source.png`: source opened or resumed from the app,
- `04-video-timestamp.png`: video timestamp evidence when relevant.

Screenshots are evidence of what was visible. They are not proof of broad platform compatibility, playback quality, or human comprehension unless the run note records the exercised behavior.

## Browser Harness

The project includes a gated browser harness for repeatable local evidence capture:

```bash
npm run external:source-help
npm run external:validate:selftest
```

`external:source-help` prints the expected learning-material links and modes. The self-test uses generated local reading and video fixtures. It verifies the harness and receipt shape only; it cannot satisfy the approved external reading/video evidence rows.

Before running browser evidence, a pasted user input block can be parsed and validated without launching Chromium:

```bash
npm run external:source-intake -- --input "阅读：https://<public-reading-material> 视频：https://<public-video-material> 时间：00:15"
```

This command checks that the reading/video links are public http(s) learning-material URLs, rejects local/private/internal/reserved/sensitive-query URLs, normalizes the timestamp, and prints both a non-claiming public dry-run command and the approved-candidate command to run after explicit current-turn approval.

Add `--out .codex-tmp/external-source-validation/source-intake-handoff.json` to write a machine-readable handoff for the next approved run:

```bash
npm run external:source-intake -- --input "阅读：https://<public-reading-material> 视频：https://<public-video-material> 时间：00:15" --out .codex-tmp/external-source-validation/source-intake-handoff.json
```

The handoff uses `schema: learning-companion.external-source-intake-handoff.v1`, `evidenceTier: SOURCE_INTAKE_HANDOFF_ONLY`, and `canClaimExternalKo: false`. It records only the normalized URLs/timestamp, next dry-run / approved-candidate / privacy-review commands, approval requirements, privacy checklist, and the exact boundary that no browser, local app server, screenshots, current-turn approval, or privacy review were executed. It does not retain the raw pasted input text.

To turn a validated intake or a public dry-run receipt into a concise approval prompt, generate a non-claiming approval request:

```bash
npm run external:approval-request -- --intake-handoff .codex-tmp/external-source-validation/source-intake-handoff.json --out .codex-tmp/external-source-validation/source-approval-request.json --markdown-out .codex-tmp/external-source-validation/source-approval-request.md
```

or:

```bash
npm run external:approval-request -- --dry-run-receipt <public-dry-run-receipt.json> --out .codex-tmp/external-source-validation/source-approval-request.json --markdown-out .codex-tmp/external-source-validation/source-approval-request.md
```

The approval request uses `schema: learning-companion.external-source-approval-request.v1`, `evidenceTier: SOURCE_APPROVAL_REQUEST_ONLY`, and `canClaimExternalKo: false`. It contains the exact reading URL, video URL, timestamp, requested current-turn approval text, and the approved-candidate command to run only after that exact approval appears in the current turn. It does not grant approval, launch a browser, capture screenshots, perform privacy review, or satisfy KO evidence.

When exact approval is not available yet, a real public-source preflight can exercise the same browser/source/resume mechanics without creating approved evidence:

```bash
npm run external:validate:public-dry-run -- --reading-url <public-reading-url> --video-url <public-video-url> --video-timestamp <observed-timestamp> --dry-run-note "<why this is only a dry run>"
```

The dry-run path still rejects local/private/internal/reserved URLs and sensitive query keys, rejects Chromium network error pages or pages with too little visible content, writes screenshots plus `runContext`, and keeps `canClaimExternalKo: false`. It writes `evidenceTier: PUBLIC_SOURCE_DRY_RUN`, `approvedCurrentTurn: false`, and `PUBLIC_SOURCE_DRY_RUN_NOT_APPROVED` source markers. After capture, the harness shuts down Chromium and removes the throwaway browser profile; the receipt records `profileRetained: false` and cleanup status. The privacy-review template and review validators reject this receipt tier; it is useful for checking real public material behavior before approval, not for KO evidence.

For real approved sources, use the same harness only when the current turn explicitly approves the exact URLs:

```bash
npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --approval-note "<current-turn approval>"
```

Optional source details can be provided with `--reading-title`, `--reading-quote`, `--reading-thought`, `--reading-language`, `--video-title`, `--video-quote`, `--video-thought`, and `--video-language`.

The harness writes `receipt.json`, `run.md`, and evidence screenshots under `.codex-tmp/external-source-validation/`. `01-source-and-app-before-capture.png` is a composed two-pane image generated from source and app screenshots captured in the same headless browser run. The receipt also records `runContext`: app URL/root, git HEAD, dirty-worktree status, git-status summary, throwaway browser profile path, cleanup result, viewport sizes, and local/remote network mode. Treat approved actual-source output as candidate evidence until a human privacy review confirms that no private account, token, cookie, internal document, sensitive identifier, retained browser profile, or unreviewed run-context mismatch is present. The receipt intentionally keeps `canClaimExternalKo: false` until that review is recorded.

After a real approved-source candidate run, generate a privacy-review template:

```bash
npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>
```

Template generation is candidate-only. Local fixture self-tests and `PUBLIC_SOURCE_DRY_RUN` receipts are rejected before a privacy template is written. Fill every `TBD` / `false` field from a human artifact review. Then validate the completed review:

```bash
npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>
```

The privacy template includes the approved reading URL, approved video URL, and approved video timestamp from the candidate receipt binding. Do not edit those values unless you are deliberately invalidating the review; the validator requires them to match both the current-turn approval request and the captured video timestamp evidence.

The harness and validators reject localhost, private/link-local IPs, IPv4-mapped local IPv6 literals such as `::ffff:127.0.0.1`, single-label intranet hosts, reserved example domains, and exact normalized sensitive URL query keys such as `token`, `access_token`, `id_token`, `session_id`, `auth_token`, `authorization`, `api_key`, `password`, `jwt`, `sig`, `signature`, `X-Amz-Signature`, `X-Goog-Signature`, `Expires`, `Key-Pair-Id`, or `Policy` for real approved-source candidates. Benign public query keys such as `keyword` are allowed. The validator refuses local fixture self-tests, requires an `APPROVED_SOURCE_CANDIDATE` receipt, requires one approved reading run and one approved video run with timestamp evidence, video timestamp-note insertion, video bookmark creation, and playback-rate preference persistence, verifies the listed screenshots still exist and are non-empty, requires the human screenshot review list to exactly cover those candidate files with `PASS`, matching `bytes`, matching `sha256`, and no duplicate or extra entries, verifies `runContext` has app revision / throwaway profile / cleanup / viewport / network fields, and only writes `canClaimExternalKo: true` in the derived review artifact after the human privacy review has `PASS` verdict and all privacy plus execution-review booleans are true. The derived KO artifact carries the reviewed screenshot file list plus `bytes` / `sha256`, and the top-level KO gate recomputes those non-empty file values, rechecks the concrete reviewer plus ISO `reviewedAt`, and requires the reading/video screenshot filename matrix including `02b-video-learning-tools.png` and `04-video-timestamp.png` before accepting the external-source claim.

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
- Git status summary: TBD
- Viewport / window layout: TBD
- Browser: TBD
- Browser profile mode: TBD
- Browser profile retained after run: TBD
- Browser profile cleanup: TBD
- Network mode: TBD

## Privacy Preflight

- Signed-out or guest browser where possible: TBD
- No visible account avatar/email/profile: TBD
- Throwaway browser profile cleaned after capture: TBD
- No private tabs/bookmarks/sidebar content visible: TBD
- No tokens/session IDs/private IDs in URL: TBD
- Final artifact privacy review: TBD

## Executed

- Opened source beside app: TBD
- Captured selected text or note into app: TBD
- Saved capture: TBD
- Resumed/opened source from app: TBD
- Video timestamp captured: TBD
- Video timestamp note inserted: TBD
- Video bookmark saved: TBD
- Playback speed preference saved: TBD
- Run context reviewed: TBD
- App revision recorded: TBD

## Evidence

- Source beside app screenshot: TBD
- Capture saved screenshot: TBD
- Video learning tools screenshot: TBD
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
8. Insert the captured timestamp into notes, save a video bookmark at the same timestamp, and change playback speed to prove the video learning controls persist.
9. Use the app source/resume action and record the resume URL timestamp plus observed resumed playback time when supported.
10. Review every artifact for privacy before delivery.
11. Save the required screenshots and complete `run.md`.

PASS requires:

- the video source and app are visible together before capture,
- the saved capture preserves source title and URL,
- timestamp evidence is captured when the platform exposes it,
- the app records a timestamp note, a video bookmark, and a playback-rate preference for the approved video run,
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

The final KO gate also requires the browser bilingual runtime receipt, the controlled learning-loop receipt, native Mac manual QA, Windows static/manual QA, and HarmonyOS device/toolchain QA. It rereads the privacy-review artifact referenced by the external KO claim and verifies the review schema, receipt path, `PASS` verdict, KO-use flag, source-approval fields, reviewer/reviewedAt, privacy/execution booleans, and reviewed screenshot `bytes` / `sha256`. A privacy-reviewed approved-source artifact is necessary but not sufficient for `canClaimKo: true`.
