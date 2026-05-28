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
- Source panel for URL, title, material type, and video timestamp.
- Quick capture for quote + note + tags.
- Capture-level source snapshots and source/time jump links.
- One-click capture insertion into Notes, without duplicate blocks.
- Confirmed cleanup for mistaken captures and review cards.
- Synthesis draft generation from captures, questions, and review cards.
- Markdown note editor with autosave.
- Highlight/capture stream grouped by session.
- Sidecar layout that temporarily collapses session navigation and the inspector.
- Desk-level activity strip for last capture/review/synthesis feedback.
- Deterministic Focus Brief that suggests review, workspace review, synthesis, capture, continue, or source setup from the current session state.
- Today study pack with due review and recent captures across the workspace.
- Review cards generated from captures.
- A simple review queue with due cards and strength buckets.
- Desk-native review pane for focused sidecar review without relying on the inspector.
- Feishu export preview: Markdown, JSON payload, and full mirror bundle.
- Direct `TODAY.md` copy/save for a quick mobile or Feishu handoff.
- Feishu mirror ZIP export for manual Drive upload or extraction.
- Mirror bundle includes `TODAY.md` as a derived mobile/Windows reading entry point.
- Today and mirror exports include the active session's Focus Brief so cross-device handoff starts at "resume here."
- Mirror bundle includes static `index.html` as a folder home page for Today, Review, Restore, and sessions.
- Mirror bundle includes static `review.html` for reveal-only due-card review on phone or Windows.
- Portable import/export of the full workspace JSON and mirror bundle.
- Responsive layout for Mac sidecar width and mobile review.
- Minimal macOS WKWebView shell scaffold that loads the web MVP.
- App-focused Mac clipboard-to-capture menu command.

## Explicit Non-Goals For Tonight

- Real Feishu OpenAPI upload.
- Real browser extension.
- Production-packaged native shell with signing, menu commands, hotkeys, and browser automation.
- OCR/PDF annotation engine.
- HarmonyOS ArkTS project.
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
      createdAt
      promotedToReview
    reviewCards[]
      id
      prompt
      answer
      sourceCaptureId
      dueAt
      strength
```

## First UX Bet

The main screen should not be a landing page. It should open directly into a working learning desk:

- Left: sessions and search.
- Middle: current source, quick capture, editor.
- Right: captures, review cards, Feishu export.

The app should remain useful even before any automation exists: Tony can paste a URL or selected quote, take notes, export Markdown, and review later.
