# Pattern matching over uncertainty

Status: experimental descriptive-v2 contract, 2026-09-23. This supersedes the first prototype vocabulary. Historical review reports retain their original source snapshots.

## Authority boundary

Jev supplies probabilities over allowed answers. The library measures and describes their geometry. Application code assigns domain names and actions. The library does not determine whether a choice is correct, safe or acceptable. A concentrated distribution can still be wrong, and all offered options can be wrong.

Prioritize the data model, composable predicates and exhaustive `match()` before threshold tuning. The seam must survive changes in heuristic cutoffs. Do not add acceptAtFloor, isSafe or shouldProceed: maximumProbabilityAtLeast and application callbacks expose the intended separation.

This boundary applies to the descriptive core. A future opt-in task recipe may supply an explicit, versioned application policy and return a task result with an optional receipt. See [V2 task verbs and recipes](task-recipes.md): its proposed wrapper and offline paths share one pure interpreter. It requires no new runtime API in v0.

## Question semantics

A Choice distributes model probability across alternatives for one requested selection. A split can motivate inspecting or retrieving several alternatives, but does not establish that both are correct, that the model is calibrated, or why it is divided. Real-world concepts can overlap even when the question requests one primary label.

For several labels that may apply simultaneously, ask a separate Noul question for each label. Those yes probabilities need not sum to one; normalizing them together changes their meaning. Separate questions do not establish statistical independence. Preserve each proposition and its yes/no distribution. In particular, a Noul near zero has a dominant **no**, so a label suggestion policy must inspect `.yes`, not just the shape or maximum probability.

The v0 README demonstrates clarification, retrieval and label suggestions as caller-defined policies. It does not add a combined multi-label shape or claim that effective counts estimate the number of true answers. This clarification leaves the API and `descriptive-v2` thresholds unchanged. See the provider's [Choice](https://docs.typesafe.ai/primitives/choice) and [Noul](https://docs.typesafe.ai/primitives/noul) contracts.

## Vocabulary

The current labels describe concentration. `dominant` means one outcome holds most of the probability; `paired` means two substantial unequal shares; `split` means two substantial similar shares; `clustered` means several outcomes hold most of the probability; `flat` means similar probabilities across positive support. These are working names, not a claim that the taxonomy is final.

`Distribution`, `Outcome`, `first`, `second`, `maxima`, `uniqueMaximum`, `gap` and `prominent` name observations. No outcome is selected by this vocabulary. `paired` and `split` can have nonzero probability outside their two-element group. Group size and balance are separate aspects of the distribution even when summarized by one label.

This terminology revision changes the names and adds the explicit pair to the paired view. It leaves the numerical classification rules unchanged. The profile is versioned as descriptive-v2 so stored interpretations remain attributable.

## Three layers

1. `DistributionData<Option>` contains observations: sorted outcomes, largest/second-largest probability, gap, ties, shortlist and spread metrics. `Outcome<Option>` preserves the application's literal option names.
2. `Distribution<Option>` adds a descriptive shape, profile, summary, `is(predicate)` and `match(handlers)`. The shape is a discriminant: dominant has a non-null uniqueMaximum; paired and split each provide an explicit pair. Split can include tied maxima.
3. Handlers return domain facts or perform application actions. `match()` invokes exactly one caller-supplied handler, preserving its return value, promise or exception. There is no action default inside the library.

`first` means the first entry in descending probability order, with deterministic ordering of ties. `uniqueMaximum` means a unique highest-probability option. Neither means correctness. `second` is the second sorted entry and may have probability zero.

Choice answers expose `Distribution` directly. Noul and Score keep their native semantics and put the categorical view under `distribution`. Their distribution match callbacks still describe geometry, not ordinal units or a yes/no action policy.

## Shape vocabulary and provisional profile

| Shape | Illustrative distribution (%) | Structural reading |
| --- | --- | --- |
| dominant | 91, 5, 3, 1 | One answer holds most probability |
| paired | 64, 25, 7, 4 | Two substantial, unequal shares |
| split | 51, 45, 3, 1 | Two substantial, similar shares |
| clustered | 41, 34, 22, 3 | Several outcomes hold most of the probability |
| flat | 28, 26, 24, 22 | Little separation across positive support |
| mixed | 60, 10, 10, 10, 10 | None of the named patterns fits |

Current defaults live in one module, `src/predicates.ts`, and are returned under `profile.thresholds`. Dominant: maximum >= .8 and gap >= .2 with a unique maximum. Paired: maximum >= .5, second >= .2 and gap >= .15. Split: gap <= .1 and combined first-two probability >= .75. Clustered: at least three options at half the maximum probability collectively hold >= .75. Flat: at least three positive options, smallest/maximum >= .75.

Classification precedence is dominant, flat, clustered, split, paired, mixed. A prominent third outcome takes precedence over a small gap between the two largest probabilities. These cutoffs and precedence are an inspectable product policy; they are not significance tests or validated application thresholds. We have not optimized them against a benchmark.

`mixed` is an explicit escape hatch. Forcing every distribution into a named pattern would conceal a classifier limitation. Consumers must handle it in exhaustive matching.

## Predicates and matching

The shape factories return ordinary `(data: DistributionData) => boolean` functions. Structural checks do not inspect the assigned label, so multiple checks can pass. For example, a uniform four-way distribution is both flat and clustered, but the descriptive profile calls it flat. A lower custom dominant floor may pass on a paired-shaped distribution. `.is()` therefore returns boolean; it does not claim a different shape via a TypeScript type guard.

`dominant({ floor, gap })` and `paired({ floor, secondFloor, gap })` use minimum gaps. `split({ gap, combinedFloor })` uses a maximum gap. Options are validated at predicate construction. `maximumProbabilityAtLeast` and `gapAtLeast` express simpler structural policies. `allOf`, `anyOf` and `not` compose with short-circuit semantics. Empty allOf is true and empty anyOf is false.

`match()` is exhaustive in TypeScript and checks own function handlers at runtime for JavaScript callers. Each callback receives its shape-specific Distribution type. Different callback return types form an inferred union; promises are preserved rather than implicitly awaited. Match can also return domain names, so a separate shape.as mapping API is unnecessary at this stage.

Defer the fluent `.when(...).otherwise(...)` builder, acceptance helpers, additional scalar measures, calibrated action policies, and elaborate domain-mapping objects. They are not required to validate this seam.

## Literal names and runtime validation

`analyze()` and `massSet()` infer option names from typed probability maps, including named interfaces and unions. Erased keys and broad numeric indices conservatively widen to strings. Numeric literal keys become their string representation, matching JavaScript enumeration.

`parse()` has a typed Jev-response overload and an unknown-input overload. Known question IDs and answer kinds are preserved. String, numeric and template-pattern index signatures include undefined on lookup even when a consumer does not enable noUncheckedIndexedAccess. Unknown input cannot fabricate a closed vocabulary. Runtime validation still occurs on both overloads.

Typed key preservation assumes that the typed map enumerates its actual keys. TypeScript's structural typing permits extra runtime keys after widening; no function can reconstruct an erased type from such an object. Use unknown input when the static object contract is untrusted.

Probabilities must be normalized, finite and within [0,1]. Percentages are converted explicitly in examples, never guessed. Accepted sum drift is 1e-8 and any normalization is reported. Ties use absolute 1e-12 probability tolerance, comparisons use relative 1e-12 tolerance, and non-full mass boundaries use absolute 1e-12 tolerance. These are numeric tolerances, not statistical indistinguishability.

The parser accepts same-realm decoded JSON objects and null-prototype maps. Foreign-realm objects must first be decoded locally. Results are readonly in TypeScript, not deeply frozen at runtime; treat them as immutable. Raw snapshots are independent copies. Score discrepancy is preserved in scoreDifference rather than silently corrected.

## How many prominent outcomes?

The returned shortlist uses `p >= prominenceRatio * maximumProbability`, default .5, excluding zeros. It reports retained and remaining probability. This gives one prominent outcome for 97/1/1/1 and two for 42/41/10/7, with 83% retained in the latter. Altering the shortlist ratio does not alter the fixed descriptive shape profile.

`massSet(probabilities, target)` returns a sorted prefix reaching a requested model mass within the declared numerical tolerance, including boundary ties. Target 1 retains every strictly positive entry. At 80%, 42/41/10/7 needs two; at 90%, three. This is model mass, not an empirical coverage guarantee or a confidence interval.

Advanced effective counts remain available without becoming the primary API. Exponential Shannon entropy and inverse Simpson concentration both equal k for k equal probabilities and one for a point mass. For 42/41/10/7 they are about 3.15 and 2.78. Neither is the integer number of valid answers. Exact zero padding preserves these measurements; splitting labels changes what the distribution means.

## Verification and publication

Individual answers are now a public composition boundary through `inspectAnswer()` (v0.2.0). Applications can inspect answers from adapters and batches without recreating the wire envelope. Missing, unavailable, and malformed inputs remain distinct; nullable confidence never becomes distribution strength. Strict `parse()` and all `descriptive-v2` rules remain unchanged. See [the inspection contract](answer-inspection.md).

Tests cover the prior numerical regressions plus exhaustive dispatch, callback narrowing, mixed return-type inference, promise identity, exception propagation, overlapping predicates, short-circuit composition, literal-key preservation and cautious unknown/indexed-input typing. Synthetic examples check the common shapes. They do not establish calibration or universal defaults.

The package is MIT, independent of the provider's HTTP client and dependency-free at runtime. The first experimental GitHub release was `jev-patterns` v0.1.0; v0.2.0 is the first npm release. JavaScript/declaration builds, installed-package tests, a CI matrix and a release policy are implemented. The public name replaces the working name `jev-lens`, which was already registered on npm. See testing.md and release-policy.md for the contribution and release gates. Python and domain evaluation come later. No private Jev inputs are public fixtures.

## Sources

- [TypeSafe confidence](https://docs.typesafe.ai/confidence): the provider exposes the full distribution behind confidence.
- [TypeSafe API](https://docs.typesafe.ai/api): wire response schemas.
- [TypeSafe Score](https://docs.typesafe.ai/primitives/score): ordered levels and weighted positions.
- [Jost, Entropy and diversity (2006)](https://doi.org/10.1111/j.2006.0030-1299.14714.x): effective-number interpretations.
- [SciPy entropy reference](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.entropy.html): Shannon formula.
