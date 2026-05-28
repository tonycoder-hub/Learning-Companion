# Review Loop

The MVP review system is deliberately small but real enough to guide learning behavior.

## Card Lifecycle

1. A capture can be promoted into a review card.
2. New cards are due immediately.
3. `Review Next` surfaces the earliest due card.
4. `Again` lowers strength and keeps the card close.
5. `Good` increases strength and schedules the next review.

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

## Why This Matters

Learning Companion should not become a storage bin for highlights. Captures need a path into recall. The review queue is that first path.
