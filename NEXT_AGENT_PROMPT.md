# Learning Companion - Next-Major Continuation Prompt

Copy everything below this line and send it to any coding agent in the repo root.

---

You are working on **Learning Companion**, a local-first learning app. Read
`AGENTS.md` first. Keep the current objective intact:

> Advance the project to the next-major pre-release state, with every remaining
> evidence gate either genuinely passing or explicitly blocked/not run.

## Current Mainline

The mainline is no longer general feature polish. The mainline is the
next-major evidence closure:

1. Keep `bilingualRuntime` passing.
2. Keep `controlledLearningLoop` passing.
3. Obtain current-turn approval for the exact public learning-material sources.
4. Run approved external-source browser evidence only after that approval.
5. Complete the human privacy review and validate the external-source KO
   evidence artifact.
6. Run real Native Mac manual QA.
7. Run real Windows static/manual return-loop QA.
8. Run real HarmonyOS DevEco/device/toolchain QA.
9. Run the final KO gate only after the approved external evidence and all real
   platform receipts exist.

Do not treat self-tests, dry-runs, source approval requests, platform handoffs,
readiness packets, or operator packets as KO evidence.

## First Commands

Use these commands to inspect the current state without running build,
deployment, platform QA, approved external capture, or remote acceptance:

```bash
git status --short
npm run ko:next -- --source-approval-request .codex-tmp/external-source-validation/source-approval-request.json --operator .codex-tmp/next-major-operator/current.json
npm run next:operator -- --refresh --out .codex-tmp/next-major-operator/current.json --markdown-out .codex-tmp/next-major-operator/current.md
```

If the operator packet reports stale public-source or platform-handoff inputs,
refresh the non-claiming packets before asking for approval or running real QA:

```bash
npm run external:validate:public-dry-run -- --reading-url 'https://en.wikipedia.org/wiki/Spaced_repetition' --video-url 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' --video-timestamp '00:03' --dry-run-note 'Refresh public source preflight for the current clean HEAD.'
npm run external:approval-request -- --dry-run-receipt <public-dry-run-receipt.json> --out .codex-tmp/external-source-validation/source-approval-request.json --markdown-out .codex-tmp/external-source-validation/source-approval-request.md
npm run next:readiness -- --refresh --out .codex-tmp/next-major-readiness/current.json --markdown-out .codex-tmp/next-major-readiness/current.md
npm run platform:qa-handoff -- --status .codex-tmp/ko-evidence/current-status.json --out .codex-tmp/platform-qa-handoff/current.json --markdown-out .codex-tmp/platform-qa-handoff/current.md
npm run next:operator -- --refresh --out .codex-tmp/next-major-operator/current.json --markdown-out .codex-tmp/next-major-operator/current.md
```

## Current Approval Gate

Before running `npm run external:validate -- --approved-current-turn`, the user
must approve the exact text emitted by `ko:next` or
`.codex-tmp/external-source-validation/source-approval-request.json`.

Do not infer approval from a general continuation request. Do not edit the
approval text. Do not run approved external-source capture until approval is
present in the current turn.

After exact approval, use the `Approved candidate command after exact
current-turn approval` line printed by `npm run ko:next`, then continue:

```bash
npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>
npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>
```

The privacy template alone is not enough; a completed human privacy review is
required before the external-source row can satisfy KO evidence.

## Real Platform QA Gates

Real platform QA is still separate from local smoke:

```bash
npm run mac:manual:validate -- --qa dist/morning-demo/MAC_MANUAL_QA.md --out .codex-tmp/mac-manual-qa/real-run-receipt.json
npm run windows:static:validate -- --qa dist/morning-demo/WINDOWS_STATIC_QA.md --out .codex-tmp/windows-static-qa/real-run-receipt.json
npm run harmony:device:validate -- --qa dist/morning-demo/HARMONY_DEVICE_QA.md --out .codex-tmp/harmony-device-qa/real-run-receipt.json
```

Only receipts filled from real named-platform runs with all rows `PASS` can
satisfy these lanes. Pending all-`NT` receipts, fixture receipts, local browser
smoke, static contract checks, scaffold checks, SwiftPM build success alone, or
non-target-platform inspection must stay non-claiming.

## Final KO Gate

Run the final KO gate only after the approved external-source KO evidence review
and all three real platform receipts exist:

```bash
npm run ko:validate -- --external <ko-evidence-review.json> --mac-manual .codex-tmp/mac-manual-qa/real-run-receipt.json --windows-static .codex-tmp/windows-static-qa/real-run-receipt.json --harmony-device .codex-tmp/harmony-device-qa/real-run-receipt.json --out .codex-tmp/ko-evidence/final.json
npm run next:readiness -- --refresh --out .codex-tmp/next-major-readiness/current.json --markdown-out .codex-tmp/next-major-readiness/current.md
npm run next:operator -- --refresh --out .codex-tmp/next-major-operator/current.json --markdown-out .codex-tmp/next-major-operator/current.md
```

Only claim next-major pre-release readiness when current evidence proves every
gate. Readiness does not authorize build, package, deployment, Mew-Test, main
site, or remote acceptance unless the user explicitly asks for that scope.

## Allowed Local Verification

These are allowed local checks and do not build/package/deploy:

```bash
node --check scripts/ko-next-action-summary.mjs
node --check scripts/next-major-operator-packet.mjs
node --check scripts/platform-qa-handoff.mjs
node --check scripts/validate-ko-evidence.mjs
npm run smoke
git diff --check
```

Do not run `npm run mac:build`, packaging, deployment, Mew-Test/main-site checks,
or remote acceptance unless the current user request explicitly asks for them.

## Delivery Rules

Every delivery must split:

- `Executed`: commands/files actually changed or verified.
- `Blocked / Not Run / Needs Decision`: approval, privacy review, real platform
  QA, build/deploy/remote acceptance, or any other missing evidence.

Unknown values are `TBD`, not guesses.
