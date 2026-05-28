# Synthesis Loop

## Purpose

Synthesis mode turns a pile of captures into a small editable study brief. It is deliberately deterministic in the MVP: the app summarizes from Tony's own captured quotes, thoughts, open questions, and review cards without calling an external model.

## Flow

1. Capture source context while reading or watching.
2. Save quotes, transcript lines, questions, and short thoughts.
3. Promote high-signal fragments into review cards or Cloze cards.
4. Switch to `Synthesize`.
5. Build a draft from the current session.
6. Edit the draft if needed.
7. Insert it into Notes and preview the rendered Markdown.

If captured material changes after a draft is edited, the UI shows that the source changed since the last build. Rebuilding an edited draft asks for confirmation. Inserting twice replaces the previous generated block instead of duplicating it.

## Draft Shape

The generated draft contains:

- Source title and URL when available.
- A deterministic count of captures, questions, and review cards used.
- Key takeaways from the strongest recent captures.
- Evidence snippets when a capture has both quote and thought.
- Open questions extracted from captured thoughts.
- Review targets from existing cards.

## Why This Comes Before AI Summary

The first useful product needs trust. A deterministic draft makes it clear which captured material produced the study note, keeps the user in control, and avoids sending learning content to another service before sync and privacy boundaries are settled.

Later, an optional AI synthesizer can work from the same session model, but it should cite capture ids and remain editable before insertion.
