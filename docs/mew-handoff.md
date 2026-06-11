# Mew Handoff

Updated: 2026-06-11

## Purpose

This repository is being prepared for continuation on `.21` with Mew. The Mac copy remains the source for the current sync. The `.21` copy should be treated as a full project checkout for follow-up work, not as proof that browser, device, or external-source validation has been completed.

## Sync Target

- Host: `jinzheng.architect@10.37.126.21`
- Target path: `/data00/home/jinzheng.architect/mew-projects/learning-companion`
- Current local code checkpoint before this handoff document: `bf178d7 docs: record paused goal state`
- The synced checkout must preserve `.git` history and verify that target `git rev-parse HEAD` matches the Mac source HEAD used for the sync.

## Mew Personal Space

- Server: `https://mew.bytedance.net`
- Workspace: `jinzheng.architect's Space`
- Workspace ID: `07c4dced-30dd-4f8c-947b-f0eae3c9d798`
- Tracking issue: `Learning Companion / Go 继续迭代`
- Issue ID: `b51a1223-bbf1-43ae-8e95-2e1785064935`
- Issue status after creation: `todo`
- Future run source type: `issue`
- Future run workdir: `/data00/home/jinzheng.architect/mew-projects/learning-companion`

No Mew run, chat, automation, service restart, or daemon change was started for this project handoff. The issue is a continuation container only.

## What To Sync

Sync the project source, docs, scripts, apps, and git history. Exclude local generated artifacts and transient evidence:

- `/.codex-tmp/`
- `/.mira-review/`
- `/dist/`
- `/node_modules/`
- `/.build/`
- `/build/`
- `/coverage/`
- `/logs/`
- `/.DS_Store`
- `/{`
- `*.log`

The root-level `{` file is a pre-existing zero-byte untracked file and should not be copied or deleted unless the user explicitly asks.

## Current Project State

Latest completed slices:

- static mirror index bilingual copy,
- static Review/Inbox chrome plus runtime return-loop bilingual copy,
- generated `TODAY.md` and Review Pack bilingual shell copy,
- import/return receipt display bilingual copy,
- per-session Markdown, synthesis draft, and mirror `README.md` bilingual shell copy.

Preserved invariants:

- English source-of-truth labels remain present for compatibility.
- User-authored notes, captures, questions, review-card prompts/answers, source URLs, mirror file paths, schema names, role strings, and byte counts are not translated.
- Browser DOM switching, external reading/video screenshot validation, QA receipt templates, native Mac shell copy, Windows/HarmonyOS surfaces, and document exports remain outside the completed boundary.

## Verified Locally Before Sync

The latest completed project checkpoint recorded in `docs/context/todo.md` passed:

```bash
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check apps/companion-web/src/model.js
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check apps/companion-web/src/app.js
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check scripts/smoke-web.mjs
git diff --check
/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/smoke-web.mjs
```

Do not treat these as browser/device validation. Browser smoke, dev server startup, external reading/video screenshots, native shell build, Windows, and HarmonyOS were not run in the paused state.

## Recommended Mew Entry Points

1. Read `docs/context/todo.md` and `docs/context/status.md`.
2. Run syntax and smoke verification on `.21` with the available Node runtime.
3. Pick one next slice:
   - bilingual QA receipt templates / document exports,
   - browser-executed DOM switching checks,
   - external reading/video screenshot validation after approved non-private URLs are provided,
   - native Mac shell copy or Windows/HarmonyOS surface audit.
4. Keep completed work and not-run validation partitioned in final reports.

## Post-Sync Checks

Run on `.21` after sync:

```bash
cd /data00/home/jinzheng.architect/mew-projects/learning-companion
git status --short
git rev-parse HEAD
test ! -e '{'
test ! -d .codex-tmp
test ! -d .mira-review
test ! -d dist
/path/to/node --check apps/companion-web/src/model.js
/path/to/node --check apps/companion-web/src/app.js
/path/to/node --check scripts/smoke-web.mjs
du -sh .
```
