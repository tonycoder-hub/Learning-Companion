# Learning Companion MVP

## Main Goal

Build a Mac-first learning sidecar for reading or watching in the browser while keeping a focused note workspace beside it. The first useful product should help Tony capture learning context, turn fragments into durable notes, and keep the data portable enough for HarmonyOS, Windows, and Feishu-based sync later.

## Reference Patterns

The product borrows selectively from strong existing tools:

- Readwise Reader: keyboard-first reading, low-friction highlighting, tagging, notes in the margin, and review as a later memory loop.
  Source: https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes
- MarginNote: one excerpt can become a note, a map node, and a flashcard; study sets connect PDFs, EPUBs, videos, and audio.
  Source: https://www.marginnote.com/
- Obsidian Web Clipper: browser capture should save highlights without locking the user into a proprietary cloud.
  Source: https://obsidian.md/clipper
- Capacities: model learning material as typed objects with properties and backlinks, instead of only loose files.
  Source: https://capacities.io/product/
- Logseq: blocks and flashcards are useful when they stay close to the original note-taking flow.
  Source: https://logseq.com/
- Feishu Drive/Docs: Feishu can be the readable sync surface, but app data should stay local-first and exportable.
  Source: https://open.feishu.cn/document/ukTMukTMukTM/uUjM5YjL1ITO24SNykjN

## Product Principles

- Sidecar first: the app should feel natural when it occupies the right side of a Mac screen next to a browser, video, PDF, or docs page.
- Focus can contract: the current session should be able to hide surrounding navigation when Tony is reading beside another window.
- Capture without breaking focus: selected text, URL, timestamp, and a short thought should become a note in one motion.
- Feedback stays in the desk: when navigation or inspector chrome is hidden, the current learning surface should still show what was just saved and how to open details.
- Context is part of the note: every note should know its source title, URL, material type, optional video timestamp, and session.
- Source context is snapshotted at capture time so later session edits do not detach an excerpt from its original material.
- Synthesis stays editable: generated study briefs should be drafts made from captured evidence, not opaque final answers.
- Local-first by default: the first store is browser/local app state; the durable model is JSON plus Markdown export, then SQLite in the native shell.
- Review loop is built in: highlights should be promotable into review cards without opening another app.
- Feishu is a mirror, not the source of truth: sync should publish readable Markdown and a structured payload, while the canonical local model remains ours.
- HarmonyOS is not an afterthought: mobile should support capture, review, and light editing against the same data contract.

## Tonight MVP Scope

Build a runnable local web app that is ready to be wrapped by a Mac shell later:

- Session list for learning topics.
- Workspace Find for jumping from source titles, notes, captures, and review cards back into the right session, including multi-term matches across fields like source type plus title or tag plus excerpt.
- Source panel for URL, title, material type, and video timestamp, with source-open jumps that respect a typed time, extract supported video time links, or fall back to the latest captured timestamp.
- Quick capture for quote + note + tags, with per-session draft recovery and a Today resume entry while switching learning contexts.
- Keyboard-first capture focus that returns from Today, Review, Export, or hidden side panels to Quick Capture without leaving sidecar layout.
- Capture-level source snapshots and source/time jump links.
- Browser inbound capture routes clips to an existing normalized source match before falling back to the active topic.
- One-click capture insertion into Notes, without duplicate blocks.
- Confirmed cleanup for mistaken captures and review cards.
- Synthesis draft generation from captures, questions, and review cards.
- Captured questions stay visible as Focus Brief signals and Recent Stack chips before being folded into synthesis.
- Focus Brief keeps review and synthesis as the primary next action, but its open-question signal is actionable and opens the Today question queue so questions are easy to close without hijacking reading flow.
- Today study pack carries an Open Questions backlog across sessions for Feishu, Windows, and mobile handoff.
- Today includes Question Queue Health so active, parked, and total unresolved questions are visible before choosing the next study action.
- Today includes a Question Loop summary so active backlog, same-day closures, answer-linked closures, and question-sourced review cards are visible as flow rather than scattered counters.
- Today includes a compact section map so the heavier study cockpit can jump directly to due cards, questions, answers, closed items, drafts, and recent captures.
- Today includes a compact Learning Flow panel: the daily Mac track keeps `Capture on Mac` and `Close the loop` visible, while the lower-frequency device return path lives in a `Manual transfer` Device Flow drawer.
- The first-run Start Here actions and returning-user Next Move are embedded inside Learning Flow, so the entry point is one route instead of separate onboarding, next-action, and handoff cards.
- Today keeps the heavier ledger views (`Open Questions`, `Parked Questions`, `Answers Today`, `Closed Today`, and `Recent Captures`) inside a `Study Details` drawer with open/parked/recent count badges. Section-map and queue buttons open that drawer before jumping, so the detail is reachable without owning the first screen.
- Today includes an Answers Today section so answer captures remain inspectable even when they are separate from the closed-question card.
- Open questions in Today can seed an Answer draft in the source topic so the question becomes a focused capture rather than a context switch.
- Open questions in Today can be promoted directly into review cards, switching back to the source topic before creating the card.
- Open questions can be parked as unresolved-but-not-active follow-up, then resumed or answered when the study block has attention for them.
- Captured questions can be marked resolved and reopened so the Open Questions backlog stays bounded without deleting the original evidence.
- Question actions show an immediate loop receipt with active, parked, closed-today, and question-card counts so state transitions remain inspectable without opening another panel.
- HarmonyOS reader handoff carries the same open-question counts, `Answers Today`, and answer attribution source so phone resume does not flatten unresolved questions or newly imported answers into generic notes.
- Markdown note editor with autosave.
- Highlight/capture stream grouped by session.
- Sidecar layout that temporarily collapses session navigation and the inspector.
- Desk-level activity strip for draft/capture/review/synthesis feedback.
- Deterministic Focus Brief that suggests draft resume, review, workspace review, synthesis, capture, continue, or source setup from the current session state, with a visible reason for the chosen next action.
- Today study pack with due review and recent captures across the workspace.
- Review cards generated from captures.
- A simple review queue with due cards and strength buckets.
- Desk-native review pane for focused sidecar review without relying on the inspector.
- Feishu export preview: Markdown, JSON payload, and full mirror bundle.
- Export panel exposes full workspace copy/save with JSON collapsed by default so backup is not hidden behind the sidebar icon.
- Local storage backup notice appears after committed learning data changes or a stale seven-day matching export, and export asks the user to verify the requested JSON download rather than treating the click as durable backup proof.
- Direct `TODAY.md` copy/save for a quick mobile or Feishu handoff.
- Feishu mirror ZIP export for manual Drive upload or extraction.
- Mirror bundle includes `TODAY.md` as a derived mobile/Windows reading entry point, while `index.html` gives a shorter open-question preview for folder-first review.
- Today and mirror exports include the active session's Focus Brief so cross-device handoff starts at "resume here," including the latest captured timestamp when the source supports jumps.
- Mirror bundle includes static `index.html` as a folder home page for Today, Review, Restore, and sessions, with a Manual Return checklist that says to read Today, work in Review/Inbox, then bring Return JSON back to Mac because the mirror is not live sync.
- Mirror home open-question previews link into `inbox.html` with a prefilled Answer draft so phone/Windows/Feishu folder review can return an append-only answer patch.
- Answer patches that carry a same-topic `answersQuestionCaptureId` resolve the original open or parked question during Mac import while keeping the new answer capture as evidence.
- Answer import receipts report when an existing question review card is ready to refresh from the new answer evidence.
- Mirror bundle includes static `review.html` for due-card review on phone or Windows, with timestamped append-only return JSON export for Mac import and an unsaved-progress leave warning.
- Mirror bundle includes static `inbox.html` for phone/Windows capture drafts and timestamped append-only return JSON export for Mac import, plus an unsaved-draft leave warning.
- Import can merge mobile inbox patch JSON with id/title/active fallback, duplicate protection, stripped-link counts, and a visible receipt.
- Import can merge review progress patch JSON with optimistic card-version conflict handling and a visible receipt.
- Return Files can import multiple inbox/review return JSON files in one picker action and reports per-file batch counts for inbox additions, review grades, duplicates, and failures. Batch import applies inbox returns before review returns and continues past wrong-type files with per-file errors.
- Return Files receipts warn with `mirror base changed` when a phone/Windows return JSON came from an older return-base fingerprint, name the affected files in batch imports, and still allow append-only captures or version-matched review events to merge safely.
- Older Return JSON files that only carry a full workspace fingerprint are labeled `legacy mirror check` in receipts, so the user can tell the app used the compatibility path rather than the newer return-base projection.
- Import failures leave a visible issue receipt for bad mirror payloads, malformed JSON, and oversized patches.
- Today tab surfaces Return Files counts, latest receipt, and the manual device-labeled path inside Device Flow: export a mirror on Mac, transfer it yourself through USB, AirDrop, email, file share, or manual Feishu Drive upload, use `inbox.html` or `review.html` on phone/Windows, then import the returned JSON on Mac. The export action opens the Export tab directly at the Mirror Folder controls, and mirror saves leave a handoff receipt.
- Return File imports route back to Today, open the Device Flow receipt, and pulse the panel so phone/Windows work rejoins the Learning Flow instead of disappearing into a toast.
- Portable import/export of the full workspace JSON and mirror bundle.
- Responsive layout for Mac sidecar width and mobile review.
- Minimal macOS WKWebView shell scaffold that loads the web MVP.
- App-focused Mac clipboard-to-capture menu command.

## Explicit Non-Goals For Tonight

- Real Feishu OpenAPI upload.
- Real browser extension.
- Production-packaged native shell with signing, menu commands, hotkeys, and browser automation.
- OCR/PDF annotation engine.
- Device-verified HarmonyOS build, file picker, and live ArkTS app behavior beyond the local schema/scaffold handoff.
- Cloud account system.

These are integration points after the local product loop feels right.

## Data Model

```text
Workspace
  sessions[]
    id
    title
    sourceTitle
    sourceUrl
    materialType: article | video | doc | course | book | other
    tags[]
    focusMode: capture | synthesize | review
    notesMarkdown
    captures[]
      id
      quote
      thought
      timestamp
      sourceTitle
      sourceUrl
      materialType
      sourceProvenance: snapshot | inbound | inherited | unknown
      tags[]
      answersQuestionCaptureId?
      questionResolvedAt?
      questionParkedAt?
      createdAt
      promotedToReview
    reviewCards[]
      id
      prompt
      answer
      sourceCaptureId
      evidenceCaptureId?
      dueAt
      strength
```

## Draft Persistence Model

Quick Capture drafts are device-local UI state, not canonical workspace data. They live in browser/WebKit `localStorage` preferences, are keyed by session id, are capped to the latest 50 active-session drafts, and are cleared when the user captures quote/thought content, presses Clear, or restores/imports a workspace without that session. Fresh text drafts can appear in Today, the activity strip, and Focus Brief, but due review still outranks draft resume in Focus Brief and drafts older than 24 hours stop taking over the main action. Drafts keep a local source title/URL snapshot so the capture surface can warn `Source changed` when the current browser material no longer matches the source where the draft began; `Use current` explicitly re-anchors the local draft to the current source. Drafts do not roundtrip through workspace JSON, Feishu mirrors, Windows static folders, or HarmonyOS patches yet; that keeps sync artifacts focused on committed notes, captures, and review progress.

The web/Mac shell reserves `Cmd/Ctrl + Shift + C` for focusing Quick Capture inside the app. This is an app-focused shortcut, not a system-wide hotkey, and can conflict with browser DevTools or password/clipboard utilities when those tools own the same key chord.

Focus Brief resume links use the session source as canonical and add the latest capture timestamp when available, including when the primary next action is review. That keeps the review/capture decision separate from source recovery: the next action tells Tony what to do, while the source link returns to the most recent learning context. If a legacy or imported session lacks a session source URL, the latest capture source URL is used as a fallback and marked in the Focus Brief source provenance.

Focus Brief warnings are optional, navigation-only hints. A warning may include `actionLabel`, `targetTab`, and `targetSection` so clients can render a chip as a shortcut, but warnings never override `nextAction`. Unknown warning targets should degrade to passive chips.

The source-open button uses the same resume-source contract: a valid typed timestamp wins, otherwise the latest capture timestamp is used, otherwise the safe source URL opens without a time jump. Invalid timestamp text does not mask a known latest capture time. A safe source href is one accepted by the local URL sanitizer (`http` or `https`) and then passed through the provider-specific jump builder; current local-parser video jump providers are YouTube (`t`, `start`, `time_continue`, with `t` winning if several are present), Bilibili web/mobile URLs (`t` seconds), and Vimeo/player URLs (`#t=` duration fragments). Quick Capture mirrors that current source/time in a compact context strip so the sidecar capture surface shows where the next note will land without requiring a glance back to the source panel. The top source-open button and the Quick Capture context Open button are intentional mirrors backed by the same `buildResumeSource()` contract; if one changes behavior, the other should change with it. The Time field has local `-15` and `+15` nudges, plus ArrowDown/ArrowUp while the Time field is focused, for quickly correcting lecture timestamps without retyping the whole value. When Tony pastes a supported video URL with a time parameter, the app extracts that time into the local capture draft timestamp, reports `Source time staged` in the activity strip, pulses the Time field, and strips only the time parameter from the stored session source URL so source matching stays canonical while playlist, part/index, query, and parseable fragment context survive where the provider uses them. Non-key Vimeo fragments are preserved rather than overwritten. Explicit timestamp inputs from the browser route, native bridge, or Time field win; URL-extracted time is only a fallback. Unsupported short-link hosts such as `b23.tv` and unsupported provider time parameters are preserved until provider-specific support is added and manually verified.

Workspace Find is deterministic local find, not indexed or fuzzy search. It first preserves exact phrase matches inside one field. If that fails, the query is split on whitespace and common punctuation, lowercased, deduplicated, and capped to eight terms; every term must appear inside the same candidate object across its weighted fields. There is no minimum token length so Chinese/Japanese/Korean queries and short course identifiers still work, but tokens from different sessions or different captures must not combine into one result.

## First UX Bet

The main screen should not be a landing page. It should open directly into a working learning desk:

- Left: sessions and search.
- Middle: current source, quick capture, editor.
- Right: captures, review cards, Feishu export.

The app should remain useful even before any automation exists: Tony can paste a URL or selected quote, take notes, export Markdown, and review later.
