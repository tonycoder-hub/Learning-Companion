# Bilingual UI Plan

Date: 2026-06-11

## Goal

Make Learning Companion usable in English and Chinese without claiming full i18n before every generated artifact and manual QA surface is covered.

## Rollout Order

1. Add a persisted UI language preference with English as the default.
2. Translate the high-frequency study loop surface first: Learning Flow, Activity, Quick Capture context, and capture guidance.
3. Extend the same switchable copy model to Today, Device Flow, Return Files, static mirror pages, generated packs, and QA receipts.
4. Add English and Chinese layout checks at sidecar and mobile widths, including long-copy fit and no horizontal overflow.
5. Only after generated packs, receipts, static pages, and app UI all use the same language boundary, consider claiming full bilingual coverage.

## First Slice Boundary

The first implementation slice covers only:

- local UI preference persistence,
- a visible English / Chinese selector,
- Learning Flow labels and actions,
- Quick Capture context, source state, guidance placeholders, and starter controls,
- a focused browser smoke proving Chinese mode can render and persist before switching back to English.

The second implementation slice extends the same boundary to:

- default Activity strip states and action labels for source/Quick Capture entry,
- Today `Next Move` card labels and actions,
- the first-run `First Note` card and its primary buttons,
- the collapsed first-run `Other devices later` route copy.

The third implementation slice extends the app UI surface to:

- the expanded `Device Flow` / `Return Files` panel,
- manual transfer steps and device-transfer guide cards,
- mirror handoff status and primary import/export/paste actions,
- the mirror-export Activity feedback opened from Return Files.

It does not cover static mirrors, generated receipts, QA runbooks, native Mac shell copy, Windows/HarmonyOS surfaces, or full document export language.

The fourth implementation slice should cover the static mirror entry point:

- bilingual static mirror index heading, generated summary, next action, and return-ready guidance,
- bilingual manual return instructions,
- bilingual resume/source/session summary labels,
- static smoke assertions proving both English and Chinese copy are emitted.

This slice still must not be treated as full bilingual coverage until generated Review/Inbox static pages, receipts, native shells, Windows/HarmonyOS surfaces, and document exports are also covered or explicitly marked out of scope.

The fifth implementation slice starts static Review/Inbox coverage:

- bilingual language switch and static chrome for `review.html` and `inbox.html`,
- bilingual return-ready badge and return-to-Mac guidance,
- bilingual initial form labels, initial action buttons, card control labels, and return-file preview guidance,
- bilingual startup-safe save-mode button/help, Inbox answer-mode labels/placeholders, and active answer-context title/help,
- bilingual Review/Inbox runtime return-loop status, after-save guidance, follow-up links, manual-copy errors, and source/empty hints,
- static smoke assertions proving both English and Chinese copy are emitted while return-file schema/fingerprint behavior remains stable.

This slice still does not cover generated receipts, native shells, Windows/HarmonyOS surfaces, document exports, or browser-executed DOM switching proof for every runtime branch.

The sixth implementation slice starts generated Markdown pack coverage:

- bilingual shell copy for generated `TODAY.md`,
- bilingual shell copy for `Learning Companion Review Pack`,
- English source-of-truth labels preserved for compatibility, with adjacent Chinese aliases/notes,
- smoke assertions proving Chinese generated-pack anchors are emitted.

This slice still does not cover per-session Markdown, mirror `README.md`, synthesis drafts, import receipts, QA receipt templates, native shells, Windows/HarmonyOS surfaces, document exports, or browser-executed DOM switching proof.

## External Source Visual Validation

Future study-loop validation should include public or user-approved non-private reading/video material and store screenshots under project-local `.codex-tmp/`.

Record for each run:

- source URL and title,
- whether the material is reading or video,
- timestamp when video timing is relevant,
- viewport size and sidecar/full-desk state,
- screenshot showing the source beside the app during capture,
- screenshot showing source resume after saving.

Do not use authenticated/private pages, cookies, or sensitive content. A screenshot is visual evidence only; it is not proof of live playback, platform compatibility, or human comprehension unless the test actually exercises and records that behavior.

## Continuation TODO

Use [docs/context/todo.md](context/todo.md) as the local handoff for the next iteration. The static mirror index, Review/Inbox static and runtime return-loop copy, and the generated `TODAY.md` / review-pack shell copy are locally verified with string-level smoke coverage. The next step is external document/video screenshot validation with approved non-private sources, then receipt/display formatters and platform-specific surfaces.
