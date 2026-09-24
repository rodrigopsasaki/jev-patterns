---
"jev-patterns": patch
---

`rank()` now accepts an empty probability map and one that does not sum to 1, instead of throwing. Ranking is invariant to scale, so it never needed `analyze()`/`massSet()`'s stricter precondition (nonempty, sum within tolerance, rescaled) — it only needs each value to be a finite number in `[0, 1]`. The first real consumer calls `rank()` on maps from two judge kinds: one normalized, and an LLM-backed judge validated per-value but only asked to "sum to ~1", so its maps can legitimately sum to 0.93 or 1.2. Under the old shared precondition, `rank()` threw on those and failed a whole classification even though the ranking itself was perfectly well-defined.

`rank(probabilities)` returns `[]` for an empty map, and for an unnormalized map returns entries in the same descending-probability, then-ascending-key order as before, with each `Outcome.probability` exactly the input value — never rescaled. Per-value validation, `exclude`/`limit` semantics, tie-breaking, and all TypeScript types are unchanged. `analyze()` and `massSet()` are unaffected: they still require a nonempty map summing to 1 within `numericTolerances.inputSumAbsolute` (`0.02`), and still rescale.

Nothing that used to succeed changes; `rank()` now succeeds on some maps that used to throw.
