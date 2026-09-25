# Pattern matching over uncertainty

Status: experimental descriptive-v3 contract, 2026-09-24. v0.3 removes the named-shape classification layer described in the history section below; historical review reports retain their original source snapshots.

## v0.3: removing the named-shape layer, adding rank()

A board evaluated `descriptive-v2`'s named shapes against 356 labeled judge answers (Jev plus two local judges) and found they add no information about top-answer correctness beyond `maximumProbability` alone:

- `dominant` (`floor: 0.8`) is exactly the predicate `maximumProbability >= 0.8` — bin purity 1.0. It is a restatement of that threshold, not a discovered pattern.
- `paired`'s apparent "check the runner-up" value is fully reproduced by a shape-agnostic `maximumProbability` band: for `0.5 <= maximumProbability < 0.8`, the top answer is correct 66% of the time versus 93% for the top two (n=61) — the same lift `paired` claims to add.
- `split` and `clustered` are undetermined for lack of labeled data in those bins; `clustered`, under its own default parameters, is itself the predicate `prominent.count >= 3 && prominent.probability >= 0.75` — again a restatement of existing scalars.
- `flat` never occurred in the 356-answer corpus.
- `maximumProbability`, `gap`, and entropy predict correctness about equally well (AUROC ≈ .79–.80), and only for a *validated* judge model: one of the two local judges was at chance, so these numbers are not universal or self-validating.

With five of six named shapes carrying no demonstrated value and the sixth (`mixed`) an explicit non-classification, the shape discriminant (`.shape`, `match()`, `MatchHandlers`, `ShapeDetails`) had nothing left to classify, so v0.3 removes that whole layer rather than deprecating it. `Distribution` is now `DistributionData` (observations) plus `profile` and `is(predicate)`. The structural predicate factories (`dominant`, `paired`, `split`, `clustered`, `flat`, and the scalar `maximumProbabilityAtLeast`/`gapAtLeast`) stay, with their existing default parameters and behavior unchanged, but their documentation now says plainly that they have no demonstrated predictive value on their own — see [the predicates and matching history](#history-the-descriptive-v2-named-shape-layer-removed-in-v03) below and `src/predicates.ts`'s own doc comment.

Separately, the first real consumer of this library hand-rolled, twice, the pattern "rank options excluding some labels (e.g. an 'other' catch-all or a none-sentinel), then take the top 1 or top N" — and never branched on a shape at all, only ever compared a scalar to a floor. `rank(probabilities, { exclude?, limit? })` is the one new primitive v0.3 adds for that pattern. It shares `analyze()`/`massSet()`'s validation and tie order, does not renormalize after exclusion, and narrows a typed input's option union at the type level when `exclude` is supplied (excluding a literal outside a typed probability map's keys is a compile error, not a silent no-op). See the [rank type/behavior contracts](../test/type-contracts.test.ts) and [`test/rank.test.mjs`](../test/rank.test.mjs).

The profile id is now `descriptive-v3`. Predicate default thresholds (`dominant`'s floor, `clustered`'s ratio, and so on) moved out of `profile` and now live only next to each predicate factory in `src/predicates.ts`: with no classification decision left to version, they are the predicates' own opt-in parameters, not analysis output, so publishing them on `profile` no longer earned its place.

`measureThresholds(observations, options?)` adds an empirical measurement boundary without adding an application decision. Given caller-labeled scores, it reports coverage, correct counts, precision, Wilson score intervals, and AUROC for explicit floors or every observed score. The caller still chooses the floor, and measurements must be repeated when the judge model or version changes; the API does not calibrate scores or recommend an action.

## Authority boundary

Jev supplies probabilities over allowed answers. The library measures and describes their geometry. Application code assigns domain names and actions. The library does not determine whether a choice is correct, safe or acceptable. A concentrated distribution can still be wrong, and all offered options can be wrong.

Prioritize the data model and composable predicates before threshold tuning. The seam must survive changes in heuristic cutoffs. Do not add acceptAtFloor, isSafe or shouldProceed: `maximumProbabilityAtLeast` and application code that reads `is()`/observations directly expose the intended separation.

This boundary applies to the descriptive core. A future opt-in task recipe may supply an explicit, versioned application policy and return a task result with an optional receipt. See [V2 task verbs and recipes](task-recipes.md): its proposed wrapper and offline paths share one pure interpreter. It requires no new runtime API in v0.

## Question semantics

A Choice distributes model probability across alternatives for one requested selection. A split of probability can motivate inspecting or retrieving several alternatives, but does not establish that both are correct, that the model is calibrated, or why it is divided. Real-world concepts can overlap even when the question requests one primary label.

For several labels that may apply simultaneously, ask a separate Noul question for each label. Those yes probabilities need not sum to one; normalizing them together changes their meaning. Separate questions do not establish statistical independence. Preserve each proposition and its yes/no distribution. In particular, a Noul near zero has a dominant **no**, so a label suggestion policy must inspect `.yes`, not just `maximumProbability`.

The v0 README demonstrates clarification, retrieval and label suggestions as caller-defined policies. It does not add a combined multi-label observation or claim that effective counts estimate the number of true answers. This clarification leaves the API and descriptive-profile thresholds unchanged. See the provider's [Choice](https://docs.typesafe.ai/primitives/choice) and [Noul](https://docs.typesafe.ai/primitives/noul) contracts.

## Two layers

1. `DistributionData<Option>` contains observations: sorted outcomes, largest/second-largest probability, gap, ties, shortlist and spread metrics. `Outcome<Option>` preserves the application's literal option names.
2. `Distribution<Option>` adds `profile` and `is(predicate)`. `is()` runs a caller-supplied structural predicate against the observations and returns a boolean; it does not itself decide, classify or act.

`first` means the first entry in descending probability order, with deterministic ordering of ties. `uniqueMaximum` means a unique highest-probability option. Neither means correctness. `second` is the second sorted entry and may have probability zero.

Choice answers expose `Distribution` directly. Noul and Score keep their native semantics and put the categorical view under `distribution`.

## History: the descriptive-v2 named-shape layer (removed in v0.3)

This section is kept as a historical record of v0.1–v0.2's classification layer; see [the v0.3 section](#v03-removing-the-named-shape-layer-adding-rank) above for why it was removed. None of the following is current API.

The labels described concentration: `dominant` meant one outcome held most of the probability; `paired` meant two substantial unequal shares; `split` meant two substantial similar shares; `clustered` meant several outcomes held most of the probability; `flat` meant similar probabilities across positive support; `mixed` was an explicit escape hatch for distributions the vocabulary didn't capture.

| Shape | Illustrative distribution (%) | Structural reading |
| --- | --- | --- |
| dominant | 91, 5, 3, 1 | One answer holds most probability |
| paired | 64, 25, 7, 4 | Two substantial, unequal shares |
| split | 51, 45, 3, 1 | Two substantial, similar shares |
| clustered | 41, 34, 22, 3 | Several outcomes hold most of the probability |
| flat | 28, 26, 24, 22 | Little separation across positive support |
| mixed | 60, 10, 10, 10, 10 | None of the named patterns fits |

Defaults lived in `src/predicates.ts` and were returned under `profile.thresholds`. Dominant: maximum >= .8 and gap >= .2 with a unique maximum. Paired: maximum >= .5, second >= .2 and gap >= .15. Split: gap <= .1 and combined first-two probability >= .75. Clustered: at least three options at half the maximum probability collectively hold >= .75. Flat: at least three positive options, smallest/maximum >= .75. Classification precedence was dominant, flat, clustered, split, paired, mixed, with a prominent third outcome taking precedence over a small gap between the two largest probabilities.

`Distribution<Option>` added a descriptive `shape` discriminant, `profile`, `summary`, `is(predicate)` and `match(handlers)`. `match()` was exhaustive in TypeScript, checked own function handlers at runtime for JavaScript callers, and invoked exactly one caller-supplied handler per shape, preserving its return value, promise or exception. The shape factories themselves (`dominant`, `paired`, `split`, `clustered`, `flat`) survive v0.3 unchanged as ordinary `(data: DistributionData) => boolean` predicates usable through `is()`; only the classification discriminant and `match()` were removed.

## Literal names and runtime validation

`analyze()` and `massSet()` infer option names from typed probability maps, including named interfaces and unions. Erased keys and broad numeric indices conservatively widen to strings. Numeric literal keys become their string representation, matching JavaScript enumeration.

`parse()` has a typed Jev-response overload and an unknown-input overload. Known question IDs and answer kinds are preserved. String, numeric and template-pattern index signatures include undefined on lookup even when a consumer does not enable noUncheckedIndexedAccess. Unknown input cannot fabricate a closed vocabulary. Runtime validation still occurs on both overloads.

Typed key preservation assumes that the typed map enumerates its actual keys. TypeScript's structural typing permits extra runtime keys after widening; no function can reconstruct an erased type from such an object. Use unknown input when the static object contract is untrusted.

Probabilities must be normalized, finite and within [0,1]. Percentages are converted explicitly in examples, never guessed. Accepted sum drift is `inputSumAbsolute` (0.02), sized from measurement rather than from the 1e-8 float-noise figure this tolerance previously held: real Jev responses (and every other observed judge) round each option to two decimal places on the wire, so a genuine answer's total commonly lands a cent or two off 1 — a 3-option `{0.05, 0.93, 0.01}` answer or a ~200-option answer both sum to 0.99. Measured across 1,752 real probability maps recorded from Jev calls, drift tops out at 0.01 and does not grow with option count (2 to 200+ options all show the same ceiling, because only a handful of options ever carry enough probability for their rounding error to matter); 0.02 is twice that observed ceiling, not an `n * 0.005` bound, which would accept almost anything at 200 options. It still rejects a grossly wrong sum such as 0.9, 1.1, or an unconverted percentage split like 51/45/4 (the last already fails the per-value [0,1] check before the sum is considered). `input.normalized` reports drift only once it exceeds a separate, much tighter `normalizedAbsolute` (1e-12) tolerance, so summation-order float noise (e.g. `0.1 + 0.2 + 0.7`) is not reported as normalization while genuine wire-rounding drift is. Rescaling itself is unconditional: dividing by a total within noise of 1 is a no-op in practice, so probabilities are always divided by the observed total regardless of whether the drift crosses that reporting tolerance. Ties use absolute 1e-12 probability tolerance, comparisons use relative 1e-12 tolerance, and non-full mass boundaries use absolute 1e-12 tolerance. These are numeric tolerances, not statistical indistinguishability.

The parser accepts same-realm decoded JSON objects and null-prototype maps. Foreign-realm objects must first be decoded locally. Results are readonly in TypeScript, not deeply frozen at runtime; treat them as immutable. Raw snapshots are independent copies. Score discrepancy is preserved in scoreDifference rather than silently corrected.

## How many prominent outcomes?

The returned shortlist uses `p >= prominenceRatio * maximumProbability`, default .5, excluding zeros. It reports retained and remaining probability. This gives one prominent outcome for 97/1/1/1 and two for 42/41/10/7, with 83% retained in the latter. Altering the shortlist ratio changes only the prominent group; it does not change the other observations (`gap`, `metrics`, `maxima`, and so on).

## Ranking

`rank(probabilities, options?)` orders the same probability map by probability, using `analyze()`/`massSet()`'s validation and deterministic tie order. `options.exclude` filters out labels (e.g. an "other" catch-all or a none-sentinel) without renormalizing the remaining probabilities: an excluded entry's neighbors keep their original model mass. `options.limit` keeps only the top N. There is deliberately no separate "top-1 excluding X" helper: that is `rank(p, { exclude, limit: 1 })[0]`. With a typed probability map, excluding a literal outside its option keys is a compile error; untyped input has no closed vocabulary to check an excluded label against, so an absent label is silently ignored.

`massSet(probabilities, target)` returns a sorted prefix reaching a requested model mass within the declared numerical tolerance, including boundary ties. Target 1 retains every strictly positive entry. At 80%, 42/41/10/7 needs two; at 90%, three. This is model mass, not an empirical coverage guarantee or a confidence interval.

Advanced effective counts remain available without becoming the primary API. Exponential Shannon entropy and inverse Simpson concentration both equal k for k equal probabilities and one for a point mass. For 42/41/10/7 they are about 3.15 and 2.78. Neither is the integer number of valid answers. Exact zero padding preserves these measurements; splitting labels changes what the distribution means.

## Verification and publication

Individual answers are a public composition boundary through `inspectAnswer()` (v0.2.0). Applications can inspect answers from adapters and batches without recreating the wire envelope. Missing, unavailable, and malformed inputs remain distinct; nullable confidence never becomes distribution strength. Strict `parse()` and the descriptive profile's numeric rules remain unchanged by inspection. See [the inspection contract](answer-inspection.md).

Tests cover the numerical regressions, `rank()`'s ordering/tie/exclusion/limit invariants and its typed compile-time contracts, overlapping predicates, short-circuit composition, literal-key preservation and cautious unknown/indexed-input typing. Synthetic examples check a spread of concentration profiles. They do not establish calibration or universal defaults.

The package is MIT, independent of the provider's HTTP client and dependency-free at runtime. The first experimental GitHub release was `jev-patterns` v0.1.0; v0.2.0 is the first npm release. JavaScript/declaration builds, installed-package tests, a CI matrix and a release policy are implemented. The public name replaces the working name `jev-lens`, which was already registered on npm. See testing.md and release-policy.md for the contribution and release gates. Python and domain evaluation come later. No private Jev inputs are public fixtures.

## Sources

- [TypeSafe confidence](https://docs.typesafe.ai/confidence): the provider exposes the full distribution behind confidence.
- [TypeSafe API](https://docs.typesafe.ai/api): wire response schemas.
- [TypeSafe Score](https://docs.typesafe.ai/primitives/score): ordered levels and weighted positions.
- [Jost, Entropy and diversity (2006)](https://doi.org/10.1111/j.2006.0030-1299.14714.x): effective-number interpretations.
- [SciPy entropy reference](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.entropy.html): Shannon formula.
