# Third-Party Continuation Prompt

Use this prompt to hand the Learning Companion work to another capable coding/product agent.

---

You are taking over a long-running local product iteration for Tony. Work from evidence, not memory. Your job is to continue toward a usable Mac-first learning companion for browser-based study, not to merely summarize prior work.

## Repository And Current State

- Workspace: `/Users/bytedance/Documents/Codex/learning-companion`
- Branch: `main`
- Latest committed baseline before the Recall source-first handoff refresh: `b615148 test: add post-save hint visual receipt`
- Current known `git status --short`: only `?? {`
- The untracked root file named `{` is historical. Its origin is not verified; cleanup ownership stays with Tony. Do not delete, edit, or commit it unless Tony explicitly approves cleanup.
- Primary continuity file: `docs/next-session-handoff.md`
- Cleanup queue: `.codex-tmp/pending-cleanup.md`
- Project-local ignored artifact roots: `.codex-tmp/` and `.mira-review/`

Before making claims, re-run:

```bash
git status --short
git log --oneline -n 20
sed -n '1,220p' docs/next-session-handoff.md
```

## Non-Negotiable Operating Rules

Follow the Execution Covenant from `AGENTS.md` / Tony's instructions:

- No mock or fabricated facts. Fixture evidence is not live evidence.
- Unverified values must be `TBD` and placed under Not Run / Needs Decision.
- Do not print, persist, quote, or commit cookies, tokens, private keys, sessions, OAuth codes, QR tokens, or sensitive logs.
- Do not read browser cookies, `.env`, credential files, or hidden auth/session stores.
- Do not use `/tmp`, `/private/tmp`, `$TMPDIR`, or Downloads for new artifacts. Use project-local `.codex-tmp/` and `.mira-review/`.
- Do not delete files tonight. If cleanup is needed, append it to `.codex-tmp/pending-cleanup.md`.
- Do not stall on approvals. Tony will not approve things tonight. If a task needs approval, record a TODO/blocker and continue on non-blocked work.
- Project-local file edits do not require asking Tony.
- Keep commits frequent and scoped.
- Every delivery must separate `Executed` from `Blocked / Not Run / Needs Decision`.
- External review is required for high-value design, prompt, cross-device, architecture, permission, or broad product changes. Carry the returned `VERDICT` verbatim.

## Product Goal

Build a Mac-first learning companion for browser-based study.

The core loop is:

1. Read or watch in a browser while a calm sidecar stays nearby.
2. Capture quotes, thoughts, timestamps, questions, and follow-up cards without breaking focus.
3. Turn open questions into answers, cards, synthesis, review material, or parked follow-up.
4. Return to the source after capture, noting, answering, or review instead of getting trapped inside the note app.
5. Mirror useful state across Mac, HarmonyOS phone, Windows, and Feishu-backed folders only as manual/static flows until real sync is proven.

Product bias: this is a study cockpit, not a generic notes app. Every feature should help the learner decide what to inspect, capture, close, review, or return to next.

## Current Product Direction

The highest-value product insight so far:

- The app should preserve learning momentum.
- After saving to Notes or Recall, the default next move should usually be to return to source, not inspect the saved artifact.
- Source links, video timestamps, and text-fragment `Open at quote` behavior are core to the product.

Latest implemented slices include:

- Notes after-save is source-first:
  - New/update note with source: main action is `Open source`, `Open at quote`, or `Resume source`.
  - `View note` is a secondary hint.
  - After source resume, main action becomes `Focus field`.
- Recall-card after-save is source-first in reading/capture contexts:
  - Direct Save-for-recall and Recent Stack/capture-surface promotion use `Open at quote` / `Resume source` as the primary Activity action when a safe source can resume.
  - `Review card` is the secondary hint.
  - Today question-management card creation remains Review-first.
  - Unsafe/no-source paths remain Review-first and must not open unsafe source URLs.
- Static mirror/manual return flow is explicit and honest:
  - Generic mirror filenames are now `learning-companion-mirror.json` and `learning-companion-mirror.zip`.
  - Static Review/Inbox post-save hint leads with: `Move it to Mac, then import or paste it from Today > Return Files`.
  - Saved-file lookup and no-file fallback are separated.
  - HarmonyOS wording is softened to `Files app's Downloads folder`.
  - Feishu Drive is only a manual carrier with no live sync.
- Morning dogfood materials distinguish generated fixture status from real human dogfood.
- Controlled browser smoke exists for fast regression, but it is not real dogfood.

## Cross-Device Boundary

Current truth:

- Mac is canonical.
- Phone/Windows support is static mirror + append-only return JSON.
- Feishu Drive is a manual file carrier only.
- Feishu live sync is not verified.
- HarmonyOS app is scaffold/prototype, not device-verified.
- Windows and HarmonyOS real browser/device roundtrips are still Not Run.

Do not claim:

- live Feishu sync,
- automated Downloads scanning,
- real HarmonyOS app readiness,
- real Windows compatibility,
- signed production Mac app,
- human dogfood completion,
- source-first Notes flow verified by real users.

## Important Evidence Already Run Recently

For the latest completed Recall source-first slice after `b615148`:

- `node --check apps/companion-web/src/app.js` -> PASS
- `node --check scripts/smoke-browser.mjs` -> PASS
- `node --check scripts/post-save-hint-visual-check.mjs` -> PASS
- `git diff --check` -> PASS
- `npm run smoke:browser` -> `smoke_browser_ok`
- `npm run smoke:post-save-hints` -> initial sandbox `listen EPERM 127.0.0.1`, approved local-server rerun -> `post_save_hint_visual_ok /Users/bytedance/Documents/Codex/learning-companion/.codex-tmp/post-save-hint-visual/receipt.json`
- Mira broker for `.mira-review/recall-after-save-source-first-20260604.md` -> `VERDICT: PASS_WITH_NOTES`, request id `695d015b-df57-42ea-a5ee-4c260aad9428`

For the source-first Notes work:

- `npm run smoke`
- `npm run smoke:source-resume`
- `npm run agent:study-loop`
- `npm run smoke:browser`
- `MORNING_DEMO_SKIP_CLEAN=1 npm run demo:morning`
- `npm run dogfood:validate:smoke`
- `npm run morning:receipts`

Treat these as controlled/local evidence only. They do not prove real Mac/HarmonyOS/Windows dogfood.

The PASS bullets above are controlled/local evidence, not durable proof for future claims. Re-run the relevant command before citing it in a new delivery.

## Known Cleanup / Artifact Caveats

- Do not delete files tonight.
- `dist/morning-demo` may contain stale no-clean artifacts from prior filenames:
  - `sample-feishu-mirror.json`
  - `sample-learning-companion-feishu-mirror.zip`
- Current generated links point to:
  - `sample-mirror.json`
  - `sample-learning-companion-mirror.zip`
- Because deletion is deferred, `SUMMARY.json` / `EVIDENCE_TIERS.json` may include stale files when generated with no-clean mode. Record this caveat; do not hide it.
- `.codex-tmp/browser-smoke/` and `.mira-review/` contain many ignored runtime artifacts. Leave them unless Tony approves cleanup.

## External Review Channels

### Mira

Use Mira for design, prompt, product flow, architecture, docs, and cross-domain judgment.

Preferred command:

```bash
python3 /Users/bytedance/.codex/skills/mira-review/scripts/mira_ssh_broker_call.py \
  --prompt-file .mira-review/<packet>.md \
  --out .mira-review/<packet>-response.md \
  --status-out .mira-review/<packet>-status.json \
  --ssh-host hermes-mira-review \
  --model re-o-47 \
  --mode deep
```

Then parse:

```bash
python3 /Users/bytedance/.codex/skills/mira-review/scripts/mira_review.py parse \
  --response .mira-review/<packet>-response.md
```

Rules:

- Do not send secrets or sensitive logs.
- Do not read credentials.
- Mira is an external reviewer, not source of truth.
- Accept, reject, or defer its notes based on evidence.
- Carry its `VERDICT` verbatim.
- If the script or `hermes-mira-review` host is unavailable, record `external_review=unavailable` with the exact symptom; do not silently skip review or relabel a local self-check as Mira.

Recent useful Mira verdicts:

- Recall-card source-first after-save: `PASS_WITH_NOTES`
- Static return/manual carrier clarification: `PASS_WITH_NOTES`
- Notes/source-first after-save: `PASS_WITH_NOTES`
- Text-fragment source resume: `PASS_WITH_NOTES`
- Open-at-quote label: `PASS_WITH_NOTES`
- First-run / Device Flow / controlled smoke reviews: mostly `PASS_WITH_NOTES`

### Seed / Doubao Workflow

Use Seed for code/MR/product-flow critique when focused and read-only.

Script:

```bash
python3 /Users/bytedance/.codex/skills/workflow/scripts/seed_batch.py \
  --tasks <project-local-jsonl> \
  --out-dir <project-local-out-dir> \
  --concurrency 2 \
  --model ark/seed-code-0602 \
  --max-turns 16 \
  --timeout 900 \
  --cwd /Users/bytedance/Documents/Codex/learning-companion \
  --tools Bash,Read \
  --permission-mode bypassPermissions
```

Rules:

- Use project-local `.codex-tmp/...` paths.
- Failed Seed runs that hit max turns are not evidence.
- If the Seed script or requested model is unavailable, record `seed_review=unavailable` with the exact symptom; do not relabel a fallback as Seed.
- Useful prior Seed critique:
  - Add-to-Notes should make source return primary, not `View note`.
  - Static return/manual cross-device copy should not be phone-prefixed or Feishu-named.

Availability precheck before relying on review channels:

```bash
ls -l /Users/bytedance/.codex/skills/mira-review/scripts/mira_ssh_broker_call.py
ls -l /Users/bytedance/.codex/skills/mira-review/scripts/mira_review.py
ls -l /Users/bytedance/.codex/skills/workflow/scripts/seed_batch.py
ssh -G hermes-mira-review
```

`ssh -G` only checks local SSH config expansion. A real Mira review still requires the broker command to return `ok=true`.

## Best Next Work

Prioritize work that improves the natural user journey, not feature count.

Recommended next slices:

1. Prepare a morning dogfood pack that a human can execute without guessing.
   - Make `dist/morning-demo/review-start-here.html`, `DOGFOOD_RUNBOOK.md`, and app UI clearly say what is Not Run.
   - Keep generated fixture evidence separate from real dogfood.
   - Do not delete stale demo artifacts tonight; record caveats.
   - Definition of Done: generated review entry and runbook visibly label Not Run rows; validators still pass; no cleanup/deletion occurs; `docs/next-session-handoff.md` records any stale-artifact caveat.

2. Run or sharpen real Mac dogfood instead of adding more fixture-only claims.
   - The controlled smokes now cover source-first Notes and Recall paths, but no human has proven the flow beside a real lesson.
   - Keep Not Run rows explicit; do not convert fixture receipts into dogfood.
   - Definition of Done: a real runbook row is executed and validated, or the blocker and exact Not Run scope are recorded.

3. Improve rendered post-save return evidence only where a new behavior changes.
   - `npm run smoke:post-save-hints` now covers source-first Notes and Recall Activity strips at 390x760 and 1280x720.
   - Future copy/layout changes should refresh the receipt and screenshots rather than relying on old images.
   - Definition of Done: refreshed project-local receipt/screenshots under `.codex-tmp/post-save-hint-visual/`, or explicit Not Run blocker; relevant browser assertions pass.

4. Tighten first-run and sidecar flow only where it directly reduces friction.
   - Avoid adding explanatory marketing text.
   - The first screen should be usable learning flow, not a landing page.
   - Keep UI dense, calm, and action-oriented.
   - Definition of Done: changed copy/control flow has a focused smoke or browser evidence; no added landing-page or tutorial-only surface; no horizontal overflow claim unless actually checked.

5. Improve evidence surfaces, not claims.
   - Add focused smoke checks when behavior changes.
   - Add runbook fields for dogfood friction rather than fake telemetry.
   - Real device/Windows/Harmony/Feishu gates remain Not Run unless actually executed.
   - Definition of Done: new evidence artifact has an explicit schema/tier, a validator or smoke assertion, and a `doesNotProve`/Not Run boundary that prevents fixture evidence from becoming a product-readiness claim.

## Commands To Prefer

Use focused checks first:

```bash
node --check apps/companion-web/src/app.js
node --check apps/companion-web/src/model.js
node --check scripts/smoke-browser.mjs
node --check scripts/smoke-web.mjs
git diff --check
npm run smoke
npm run smoke:browser
npm run smoke:source-resume
npm run agent:study-loop
MORNING_DEMO_SKIP_CLEAN=1 npm run demo:morning
npm run check:static-return
npm run morning:receipts
```

Do not use cleanup switches tonight. Do not run commands that delete generated folders.

## How To Report Progress

When delivering, always include:

### Executed

- Files changed.
- Commit SHA if committed.
- Exact commands run and PASS/FAIL.
- External review verdicts verbatim.
- What was accepted/rejected/deferred from Mira/Seed.
- Whether external systems were written. If none, say `未写入`.

### Blocked / Not Run / Needs Decision

- Real dogfood not run unless Tony actually performed it.
- Real Windows/HarmonyOS device checks not run unless actually performed.
- Feishu live sync not run unless explicitly configured and verified.
- Screenshot/in-app Browser gaps if blocked by stale browser/service worker.
- Cleanup deferred because Tony said not to delete tonight.

## Immediate First Steps For You

1. Inspect current state:

```bash
git status --short
git log --oneline -n 20
sed -n '1,220p' docs/next-session-handoff.md
```

2. Confirm latest generated/demo caveats:

```bash
find dist/morning-demo -maxdepth 1 -type f -name '*mirror*' -print
rg -n "sample-feishu-mirror|learning-companion-feishu-mirror|sample-mirror|learning-companion-mirror" dist/morning-demo docs scripts apps/companion-web/src
```

3. Pick one narrow next slice from `Best Next Work`.

4. Before editing, state the edit target and why.

5. After editing, run focused checks, use Mira/Seed when triggered, commit, and update `docs/next-session-handoff.md`.

Do not mark the long-running goal complete. The real objective remains unfinished until a usable product is verified against real study/dogfood requirements.

## Evidence Appendix

This appendix records the local evidence observed while creating this handoff prompt. Treat it as a starting point, not a substitute for re-running commands in the successor session.

`git status --short` before this prompt was committed:

```text
?? docs/third-party-continuation-prompt.md
?? {
```

`git log --oneline -n 18` at prompt creation:

```text
8f52d73 fix: clarify manual mirror return flow
a8ff97f fix: keep notes flow source first
5bb397f test: count notes source-return dogfood friction
252570b fix: resume source after noting capture
f75bc25 fix: clarify notes recall decision
8a92da9 fix: label quote-anchored source resume
cb3055c feat: resume articles with text fragments
bc3bda6 fix: resume source after recall save
b33462e fix: review card after saving recall
401fd95 fix: clarify static return file locations
06c0a5a fix: clarify source-missing capture path
2b4793c fix: clarify capture action hierarchy
7427768 fix: simplify quick capture actions
3887199 docs: expose controlled study loop smoke
c62757e docs: record sidecar study loop smoke
e67b4f4 test: harden controlled study loop smoke
993c7ef test: add controlled study loop check
c63d4a0 fix: clarify sidecar capture rail action
```

Relevant handoff excerpt from `docs/next-session-handoff.md`:

```text
Mainline Goal:
Build a Mac-first learning companion for browser-based study.
The product bias is a study cockpit, not a generic note app.
Every feature should help the user decide what to inspect, capture, close, or review next.
```

Mira review for this handoff prompt:

```text
VERDICT: PASS_WITH_NOTES
ok=true
cleanup_succeeded=true
logid_present=true
model=re-o-47
mode=deep
```

External review availability precheck observed while creating this prompt:

```text
/Users/bytedance/.codex/skills/mira-review/scripts/mira_ssh_broker_call.py exists
/Users/bytedance/.codex/skills/mira-review/scripts/mira_review.py exists
/Users/bytedance/.codex/skills/workflow/scripts/seed_batch.py exists
ssh -G hermes-mira-review expands to:
  user codex-mira
  hostname 10.37.192.53
  identityfile ~/.ssh/codex_mira_review_ed25519
  requesttty false
```

This precheck does not prove the Mira broker will succeed forever. A real review still requires the broker call to return `ok=true`.

Mira notes accepted into this prompt:

- Added evidence appendix.
- Added review-channel availability precheck and failure handling.
- Added per-slice Definition of Done.
- Added "source-first Notes flow verified by real users" to the Do Not Claim list.
- Clarified that the untracked `{` file origin is not verified and Tony owns cleanup decision.

Not attached here:

- Full smoke/demo logs. The next agent must re-run relevant checks before citing PASS.
- Real Windows/HarmonyOS/Mac dogfood evidence. These remain Not Run unless Tony or the agent actually executes them.
