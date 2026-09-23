# Pattern matching over uncertainty

Status: experimental descriptive-v1 contract, 2026-09-23. This supersedes the first prototype vocabulary. Historical review reports retain their original source snapshots.

## Authority boundary

Jev supplies probabilities over allowed answers. The library measures and describes their geometry. Application code assigns domain names and actions. The library does not determine whether a choice is correct, safe or acceptable. A concentrated distribution can still be wrong, and all offered options can be wrong.

Prioritize the data model, composable predicates and exhaustive `match()` before threshold tuning. The seam must survive changes in heuristic cutoffs. Do not add acceptAtFloor, isSafe or shouldProceed: topProbabilityAtLeast and application callbacks expose the intended separation.

## Three layers

1. `DistributionData<Option>` contains observations: ranked candidates, top/runner-up probability, margin, ties, shortlist and spread metrics. `Candidate<Option>` preserves the application's literal option names.
2. `Decision<Option>` adds a descriptive shape, profile, summary, `is(predicate)` and `match(handlers)`. The shape is a discriminant: dominant has a non-null leader, runner-up has two available leading entries, and contested has an explicit pair. Contested can include a tied top.
3. Handlers return domain facts or perform application actions. `match()` invokes exactly one caller-supplied handler, preserving its return value, promise or exception. There is no action default inside the library.

`top` means the first deterministic ranked entry, including in a tie. `leader` means a unique highest-probability option. Neither means correctness. `runnerUp` is the second ranked entry and may have probability zero.

Choice answers expose `Decision` directly. Noul and Score keep their native semantics and put the categorical view under `distribution`. Their distribution match callbacks still describe geometry, not ordinal units or a yes/no action policy.

## Shape vocabulary and provisional profile

| Shape | Illustrative distribution (%) | Structural reading |
| --- | --- | --- |
| dominant | 91, 5, 3, 1 | One answer holds most probability |
| runner-up | 64, 25, 7, 4 | One leader and a material alternative |
| contested | 51, 45, 3, 1 | Two leading answers are close |
| clustered | 41, 34, 22, 3 | Several meaningful contenders |
| flat | 28, 26, 24, 22 | Little separation across positive support |
| mixed | 60, 10, 10, 10, 10 | None of the named patterns fits |

Current defaults live in one module, `src/predicates.ts`, and are returned under `profile.thresholds`. Dominant: top >= .8 and margin >= .2 with a unique leader. Runner-up: top >= .5, second >= .2 and margin >= .15. Contested: margin <= .1 and combined top-two probability >= .75. Clustered: at least three options at half the top probability collectively hold >= .75. Flat: at least three positive options, smallest/top >= .75.

Classification precedence is dominant, flat, clustered, contested, runner-up, mixed. The third meaningful contender takes precedence over a close top-two gap. These cutoffs and precedence are an inspectable product policy; they are not significance tests or calibrated decision thresholds. We have not optimized them against a benchmark.

`mixed` is an explicit escape hatch. Forcing every distribution into a named pattern would conceal a classifier limitation. Consumers must handle it in exhaustive matching.

## Predicates and matching

The shape factories return ordinary `(data: DistributionData) => boolean` functions. Structural checks do not inspect the assigned label, so multiple checks can pass. For example, a uniform four-way distribution is both flat and clustered, but the descriptive profile calls it flat. A lower custom dominant floor may pass on a runner-up-shaped distribution. `.is()` therefore returns boolean; it does not claim a different shape via a TypeScript type guard.

`dominant({ floor, margin })` and `runnerUp({ floor, alternativeFloor, margin })` use minimum margins. `contested({ margin, combinedFloor })` uses a maximum margin. Options are validated at predicate construction. `topProbabilityAtLeast` and `marginAtLeast` express simpler structural policies. `allOf`, `anyOf` and `not` compose with short-circuit semantics. Empty allOf is true and empty anyOf is false.

`match()` is exhaustive in TypeScript and checks own function handlers at runtime for JavaScript callers. Each callback receives its shape-specific Decision type. Different callback return types form an inferred union; promises are preserved rather than implicitly awaited. Match can also return domain names, so a separate shape.as mapping API is unnecessary at this stage.

Defer the fluent `.when(...).otherwise(...)` builder, acceptance helpers, additional scalar measures, calibrated action policies, and elaborate domain-mapping objects. They are not required to validate this seam.

## Literal names and runtime validation

`analyze()` and `massSet()` infer option names from typed probability maps, including named interfaces and unions. Erased keys and broad numeric indices conservatively widen to strings. Numeric literal keys become their string representation, matching JavaScript enumeration.

`parse()` has a typed Jev-response overload and an unknown-input overload. Known question IDs and answer kinds are preserved. String, numeric and template-pattern index signatures include undefined on lookup even when a consumer does not enable noUncheckedIndexedAccess. Unknown input cannot fabricate a closed vocabulary. Runtime validation still occurs on both overloads.

Typed key preservation assumes that the typed map enumerates its actual keys. TypeScript's structural typing permits extra runtime keys after widening; no function can reconstruct an erased type from such an object. Use unknown input when the static object contract is untrusted.

Probabilities must be normalized, finite and within [0,1]. Percentages are converted explicitly in examples, never guessed. Accepted sum drift is 1e-8 and any normalization is reported. Ties use absolute 1e-12 probability tolerance, comparisons use relative 1e-12 tolerance, and non-full mass boundaries use absolute 1e-12 tolerance. These are numeric tolerances, not statistical indistinguishability.

The parser accepts same-realm decoded JSON objects and null-prototype maps. Foreign-realm objects must first be decoded locally. Results are readonly in TypeScript, not deeply frozen at runtime; treat them as immutable. Raw snapshots are independent copies. Score discrepancy is preserved in scoreDifference rather than silently corrected.

## How many contenders?

The returned shortlist uses `p >= contenderRatio * topProbability`, default .5, excluding zeros. It reports retained and remaining probability. This gives one contender for 97/1/1/1 and two for 42/41/10/7, with 83% retained in the latter. Altering the shortlist ratio does not alter the fixed descriptive shape profile.

`massSet(probabilities, target)` returns a ranked prefix reaching a requested model mass within the declared numerical tolerance, including boundary ties. Target 1 retains every strictly positive entry. At 80%, 42/41/10/7 needs two; at 90%, three. This is model mass, not an empirical coverage guarantee or a confidence interval.

Advanced effective counts remain available without becoming the primary API. Exponential Shannon entropy and inverse Simpson concentration both equal k for k equal probabilities and one for a point mass. For 42/41/10/7 they are about 3.15 and 2.78. Neither is the integer number of valid answers. Exact zero padding preserves these measurements; splitting labels changes what the distribution means.

## Verification and publication

Tests cover the prior numerical regressions plus exhaustive dispatch, callback narrowing, mixed return-type inference, promise identity, exception propagation, overlapping predicates, short-circuit composition, literal-key preservation and cautious unknown/indexed-input typing. Synthetic examples check the common shapes. They do not establish calibration or universal defaults.

The package is MIT, independent of the provider's HTTP client, dependency-free at runtime and unpublished. Before publication it needs compiled JavaScript/declarations, package-consumer checks, CI and a release policy. Python and domain evaluation come later. No private Jev inputs are public fixtures.

## Sources

- [TypeSafe confidence](https://docs.typesafe.ai/confidence): the provider exposes the full distribution behind confidence.
- [TypeSafe API](https://docs.typesafe.ai/api): wire response schemas.
- [TypeSafe Score](https://docs.typesafe.ai/primitives/score): ordered levels and weighted positions.
- [Jost, Entropy and diversity (2006)](https://doi.org/10.1111/j.2006.0030-1299.14714.x): effective-number interpretations.
- [SciPy entropy reference](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.entropy.html): Shannon formula.
