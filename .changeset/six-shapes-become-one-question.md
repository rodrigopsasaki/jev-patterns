---
"jev-patterns": minor
---

Remove the six named distribution shapes (`dominant`, `paired`, `split`, `clustered`, `flat`, `mixed`), `.shape`, `match()`, `MatchHandlers`, `ShapeDetails`, `ShapeResults`, and `DistributionFor`. A v0.3 evaluation on 356 labeled judge answers found the named shapes add no information about a top answer's correctness beyond `maximumProbability` alone (`dominant` at its default floor is exactly `maximumProbability >= 0.8`; `clustered` at its defaults is exactly `prominent.count >= 3 && prominent.probability >= 0.75`; `flat` never occurred in the corpus; `paired`'s apparent value is fully reproduced by a shape-agnostic `maximumProbability` band). With the classification carrying no demonstrated value, the whole discriminant is removed rather than deprecated.

**Migration:**

- Replace any `.shape` read or `match()` dispatch with the observations you actually need (`maximumProbability`, `gap`, `prominent`, `massSet`, `metrics`) and your own application logic, or with `.is(predicate)` using one of the structural predicate factories below.
- `dominant`, `paired`, `split`, `clustered`, `flat` are unchanged as predicate factories usable through `.is(predicate)` — their default parameters and boolean behavior are exactly as before. Their documentation now says plainly that they have no demonstrated predictive value on their own; validate against your own labeled data before gating a real decision on one.
- `Distribution<Option>` is now `DistributionData<Option>` plus `profile` and `is(predicate)` — no `.shape`, `.summary`, or `.match()`.
- The profile id is now `descriptive-v3`. `profile.thresholds` is removed: predicate default thresholds now live only next to each predicate factory in `src/predicates.ts`, since there is no classification decision left for them to version.

Add `rank(probabilities, options?)`: a new primitive that orders a probability map by probability, optionally excluding labels (e.g. an "other" catch-all or a none-sentinel) and limiting to the top N. It shares `analyze()`/`massSet()`'s validation and deterministic tie order, and does not renormalize after exclusion — excluded entries' neighbors keep their original model probability. With a typed probability map, excluding a literal outside its option keys is a compile error; untyped input has no closed vocabulary to check an excluded label against, so an absent label is silently ignored. There is no separate "top-1 excluding X" helper: that is `rank(p, { exclude, limit: 1 })[0]`.

This changeset also carries forward the not-yet-released fixes from the prior `## Unreleased` section (folded in here rather than split into a separate patch changeset, since they describe the same not-yet-published release and one of them — the `match()` return-type cast removal — is now moot given `match()` itself is removed above):

- `input.normalized` is now reported only once a distribution's total differs from 1 beyond a declared `normalizedAbsolute` tolerance (`1e-12`), surfaced under `profile.numericTolerances`. Summation-order float noise (e.g. `analyze({ a: 0.1, b: 0.2, c: 0.7 })`) no longer reports normalization; deliberate drift within the existing `1e-8` input-sum tolerance still does. Rescaling remains unconditional.
- Choice answers (`readAnswer`/`parse`) are built without mutating an already-returned `Distribution`: `is()` on a Choice answer closes over the one object constructed with its `type`/`choice`/`confidence`/`raw` fields already in place, rather than a plain `Distribution` that later had those fields assigned onto it.
