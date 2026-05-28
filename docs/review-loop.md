# Review Loop

The MVP review system is deliberately small but real enough to guide learning behavior.

## Card Lifecycle

1. A capture can be promoted into a review card.
2. A selected span inside a quote can become a cloze card.
3. New cards are due immediately.
4. Cloze cards are self-graded. There is no typed answer matching in v1.
5. `Review Next` surfaces the earliest due card.
6. `Again` lowers strength and keeps the card due now when strength returns to 0.
7. `Good` increases strength and schedules the next review.

## Scheduling Buckets

The first scheduler uses simple strength buckets:

```text
strength 0 -> due now
strength 1 -> 1 day
strength 2 -> 3 days
strength 3 -> 7 days
strength 4 -> 14 days
strength 5 -> 30 days
```

This is not a full spaced-repetition algorithm yet. It is intentionally explainable and easy to port to HarmonyOS.

## Cloze Semantics

V1 cloze cards use self-grading:

- selected text becomes the answer
- the quote with the selected text replaced by `____` becomes the prompt
- answer comparison is human/self-graded, not automatic

If typed answer checking is added later, it should be a schema v2 migration with explicit trim, Unicode normalization, and case rules.

## Why This Matters

Learning Companion should not become a storage bin for highlights. Captures need a path into recall. The review queue is that first path.
