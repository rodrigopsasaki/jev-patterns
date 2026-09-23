# A vocabulary for probability distributions

Status: experimental proposal, 2026-09-23.

## What the library promises

Jev already returns probability distributions for Choice and Score. Its confidence is a compression of that distribution. A second opaque confidence score would add little. The useful abstraction exposes the shape, the alternatives worth inspecting under an explicit rule, and enough evidence to explain both.

Keep four questions distinct:

1. Which option has the largest probability?
2. How competitive are the alternatives?
3. How broadly is probability distributed?
4. What should this application do next?

The first three are descriptive. The fourth belongs to a policy with domain data and error costs. A clear winner can still be wrong, and every offered option can be wrong. A response alone cannot establish calibration, correctness, significance, independence or the cause of uncertainty.

## Human vocabulary

| Distribution (%) | Suggested description | Contenders with a half-of-leader rule |
| --- | --- | --- |
| 97, 1, 1, 1 | Clear winner | 1 |
| 60, 25, 10, 5 | Leader with a runner-up | 1 |
| 42, 41, 10, 7 | Close race | 2 |
| 34, 33, 30, 3 | Several contenders | 3 |
| 26, 25, 25, 24 | Flat | 4 |
| 40, 20, 15, 15, 10 | Mixed | 2 |

The runner-up label describes the second option's material probability; the contender rule asks a separate, narrower question. Callers can change the contender ratio. Every description returns the profile and thresholds used. These names are product vocabulary, not statistical hypothesis tests.

Initial shape rules, in order: clear winner (top >= .8 and gap >= .2); flat (at least three positive options with minimum/maximum >= .8); close race (top-two mass >= .75 and runner-up/top >= .8); leader with runner-up (top >= .5, runner-up >= .2, gap >= .15); several contenders (at least three half-of-leader contenders jointly carry >= .75); otherwise mixed. Exact ties remain explicit, never silently broken into a unique winner.

## Three answers to “how many?”

**Contender count** is the number with p >= r times the leader, excluding zero probability. Default r = .5 is a visible heuristic. It gives one for 97/1/1/1 and two for 42/41/10/7. It does not promise coverage; report retained and excluded mass beside it.

**Mass set** is the smallest ranked prefix reaching a requested model mass, expanded to include all options tied at the boundary. At 80%, 42/41/10/7 needs two options; at 90%, it needs three. This is model probability mass, not a confidence interval or a guaranteed prediction set. It can include more than the mathematically smallest set because arbitrary tie-breaking is undesirable. A target below 1 uses a 1e-12 mass tolerance to avoid accidental extra options from decimal roundoff; target 1 always keeps every strictly positive entry. The result reports the actual retained mass.

**Effective options** expresses concentration in units of equally weighted alternatives. Exponential Shannon entropy, exp(-sum(p log p)), is sensitive to the tail. Inverse Simpson concentration, 1/sum(p²), emphasizes larger entries. Both equal k for k equally weighted options and 1 for a point mass. Neither is an integer count of valid answers. For 42/41/10/7 these are about 3.15 and 2.78; rounding them to two would erase useful information.

Return both rather than choosing one and pretending it answers every question. Appending zero-probability options should leave these statistics and the contender shortlist unchanged. Splitting or duplicating labels changes the distribution's meaning; the library cannot repair the question taxonomy.

The profile exposes input-sum, tie, threshold and mass-boundary tolerances. Ties use 1e-12 absolute probability tolerance; threshold comparisons use 1e-12 relative tolerance, including for very small custom contender ratios. This is numerical bookkeeping, not statistical indistinguishability. Shape's several-contenders rule uses the profile's fixed .5 ratio; changing the user shortlist ratio does not rename the distribution. `runnerUp` means the second ranked entry, which may have probability zero.

## API and validation

`analyze(probabilities, options?)` is a pure provider-neutral core. Accept normalized probabilities only; reject invalid values, empty maps and zero totals. Permit tiny floating point drift and explicitly report any normalization. An explicit `fromWeights` conversion is a future convenience; never guess whether 97 means .97 or an invalid probability.

`parse(response, options?)` accepts Jev's decoded response object, validates the documented wire shape, preserves model, usage and raw data, and returns discriminated answer types. Use `parse(await call())`, or `call().then(parse)`. A synchronous parser should not silently accept a pending Promise.

Choice preserves the provider's `choice` and `confidence` and adds a distribution analysis. Verify that the reported choice is among the maxima. Noul exposes P(yes) and P(no) without inventing a provider confidence. Score preserves its ordered levels and reported score; an expectation alone can hide probability split between distant levels. The initial adapter exposes the full distribution, leaving richer ordinal interpretation for a later version.

Do not infer missing probability entries from a confidence score. Retain raw input beside derived fields so interpretations can be reproduced. Keep profile versions and all applied options in the result. Name the output `shape`, not `verdict` or `validity`.

The prototype accepts ordinary decoded JSON objects from the calling JavaScript realm, plus null-prototype maps. Foreign-realm objects (for example from an iframe or Node vm context) must first be decoded in the calling realm. Returned raw values are independent snapshots of input; they are not deeply frozen at runtime. Treat every result as immutable. `scoreDifference` is the provider's reported score minus the expectation recomputed from its probabilities; a discrepancy is exposed, not silently corrected or certified as consistent.

## Open-source scope

Start with one small TypeScript package, no runtime dependencies, deterministic results and synthetic fixtures. Ship declarations and a conventional JavaScript build before npm publication. Keep the statistics independent of Jev's HTTP client and model lifecycle. MIT license; add Python after the vocabulary is stable.

The next layer can be an explicit policy helper: accept, inspect shortlist, gather evidence or abstain. Policies should be tuned on held-out labeled examples by model version and task. Proper scoring rules such as Brier score and log loss, reliability curves, and risk versus coverage belong in an evaluation module, not a magic transformation of one response. Conformal prediction requires a calibration dataset and its assumptions; it cannot be promised by a parser alone.

## Verification

Check point masses, uniform distributions, ties, zero padding, key order, floating point drift, malformed responses, arbitrary user keys and the examples above. Verify mass-set coverage and monotonicity as target mass increases. Treat threshold-boundary behavior as part of the versioned profile. Use synthetic data in the public repo; do not copy private Jev inputs or session transcripts.

## Sources

- [TypeSafe confidence](https://docs.typesafe.ai/confidence): confidence is derived from the distribution; alternatives can be computed from the supplied probabilities.
- [TypeSafe API](https://docs.typesafe.ai/api): response and answer schemas.
- [TypeSafe Score](https://docs.typesafe.ai/primitives/score): levels are ordered; score is a weighted position.
- [Jost, Entropy and diversity (2006)](https://doi.org/10.1111/j.2006.0030-1299.14714.x): effective-number interpretation of entropy and concentration.
- [SciPy entropy reference](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.entropy.html): Shannon entropy formula.
