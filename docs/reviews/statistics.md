# Statistical semantics review

Date: 2026-09-23. Provenance: **native Codex subagent review**, used as a fallback after the Interlock runner was unavailable. This report is not an Interlock session or an Interlock-generated result.

Scope: the **pre-remediation implementation** of `docs/proposal.md`, `src/distribution.ts`, `src/jev.ts`, and the existing synthetic tests. Line references and findings below refer to that reviewed implementation; subsequent resolution notes belong to the coordinating agent. Report only: this reviewer changed no product code or tests, performed no publication, and used no private data or external services. Validation used Node v26.9.0; `npm test` passed all 20 original tests. Examples A–D were run against the original source; example E was verified separately after concurrent numerical remediation began and does not depend on the changed comparisons.

## Findings

### F1 — P2: mass-set threshold arithmetic has inconsistent endpoint behavior

Location: `src/distribution.ts:98–112`, especially line 107.

The loop compares ordinary targets using a strict floating-point `total >= targetMass`, but permits an absolute `Number.EPSILON` shortfall only near 1. This creates two observable boundary surprises:

- With `{ a: .58, b: .22, c: .15, d: .05 }` and target `.8`, it returns three options and mass `.95`; `.58 + .22` evaluates to `.7999999999999999`. The intuitive decimal 80% prefix has two options. This is a numerical-contract issue: if strict comparison of the represented binary inputs is intended, three is internally defensible, but that choice should be explicit. It is not an exact-real-arithmetic proof of incorrectness.
- With `{ a: 1 - Number.EPSILON / 2, b: Number.EPSILON / 2 }` and target `1`, it returns only `a`, with mass `.9999999999999999` and positive excluded mass. This directly contradicts the unqualified promise that the selected prefix reaches the requested mass. The omitted probability is real and explicitly supplied, even though numerically tiny.

The existing coverage assertion permits a `1e-12` shortfall, so it cannot detect the full-mass defect. Resolve the mass-comparison contract before promising a smallest prefix. A target of exactly 1 should include every positive option; that rule needs no fuzzy boundary decision.

### F2 — P3: nominally identical contender rules use different tolerance units

Location: `src/distribution.ts:66–67` versus `src/distribution.ts:126–127`.

The exposed contenders compare `p + 1e-12 >= ratio * top`; shape classification compares `p / top + 1e-12 >= .5`. These are different rules near a boundary, even when the user leaves the default ratio at `.5`. Example B below returns three contenders with approximately 80% mass, yet shape `mixed`, contrary to the proposal's rule that three half-of-leader contenders carrying at least 75% produce `several-contenders` when earlier rules do not apply.

The same absolute addition also dominates sufficiently small valid user ratios. With probabilities approximately `1` and `1e-15`, a ratio of `1e-12` includes both candidates; the second candidate is roughly 1,000 times below the requested relative cutoff. This is a small-mass edge case, but the contender count is the central user-visible output, and the declared option range allows it.

Use one explicitly defined comparison for exposed contenders and the shape profile's fixed `.5` contenders. A floating-point tolerance should scale with the compared quantity if the full `(0, 1]` ratio range remains supported. Keep exact zero exclusion.

### F3 — Documentation gap: numerical tolerances are part of the profile but are not returned

Location: `src/distribution.ts:1–2`, `src/distribution.ts:75`, and `docs/proposal.md` API/verification sections.

`profile` exposes the semantic shape thresholds, contender ratio, and target mass, but omits the `1e-8` accepted sum drift, `1e-12` tie/comparison tolerance, and special mass endpoint rule. These affect accepted inputs, whether a winner exists, shortlists, and shape labels. The `winner` type comment mentions numeric tolerance, while the proposal otherwise emphasizes exact ties and returned thresholds. This is a transparency/documentation issue, not an incorrect entropy formula. The version identifier can pin behavior if maintained rigorously; returning or documenting the numerical policy would make the current promise easier to audit.

### Confirmed behavior and non-defects

- Shannon entropy and inverse Simpson concentration use the correct formulas for the normalized categorical distribution. The effective-number interpretation, distinction from integer contenders, and warnings against calibration/validity claims are appropriate. Point masses, small uniform distributions, and the worked 42/41/10/7 example behave as described.
- Shape precedence and the six examples match the proposal. The fixed `.5` shape rule being independent of a caller's custom shortlist ratio is intentional and tested.
- Exact ties produce multiple explicit leaders and no unique winner. Boundary ties expand the mass set. Key sorting makes accumulation and presentation deterministic under input insertion-order changes. Approximate ties are anchored to the maximum or boundary probability; they are not transitive clustering. That is a reasonable policy if documented.
- Appending exact zeros preserves entropy, effective counts, contenders, leaders, shape, and mass selection. A zero may appear as `runnerUp` when it creates a second ranked entry for a point mass; this field is the second ranked option, not a second positive option. No stronger invariant is currently promised.
- The flat classifier is intentionally sensitive to *any positive* tail. A uniform three-way distribution is `flat`; adding probability `1e-15` as a fourth option and rescaling the other three changes it to `several-contenders`. This follows the stated positive-support minimum/maximum rule. A dominant-mass definition of flatness would be a product-design change, not a fix to the current rule.
- Score preserves the provider's score and legend, computes the mean of numeric level positions, and keeps the full categorical distribution. Adjacent and distant equal splits can have the same shape, entropy, effective counts, and expected level; the retained level identities expose the difference. Richer ordinal summaries are explicitly deferred in the proposal, so their absence is not a defect. Do not describe expected level as a measurement in the legend's real-world units. A nonzero `scoreDifference` is a diagnostic, not a calibrated error estimate.
- This review checked internal consistency with the local proposed Score contract; it did not independently revalidate the provider's current wire schema.

## Counterexamples

Run this from the repository root. Assertions describe the **observed pre-remediation behavior**; successful fixes should make the corresponding assertions fail. In a rerun after the coordinating agent began remediation, A1 already returned two options and failed the old-behavior assertion as expected. The script does not modify files.

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { analyze, massSet, parse } from './src/index.ts';

// A1: ordinary decimal mass boundary overshoots the intuitive 80% prefix.
const decimal = massSet({ a: .58, b: .22, c: .15, d: .05 }, .8);
assert.equal(decimal.count, 3);
assert.equal(decimal.mass, .95);
console.log('A1', decimal.count, decimal.mass); // 3, 0.95

// A2: target 1 excludes an explicitly positive tail.
const all = massSet({
  a: 1 - Number.EPSILON / 2,
  b: Number.EPSILON / 2,
}, 1);
assert.equal(all.count, 1);
assert.ok(all.mass < all.targetMass);
assert.ok(all.excludedMass > 0);
console.log('A2', all.count, all.mass, all.excludedMass);

// B: the public default shortlist and shape's half-of-leader rule disagree.
const near = analyze({
  a: .4, b: .2 - 6e-13, c: .2 - 6e-13,
  d: .15, e: .05 + 12e-13,
});
assert.equal(near.contenderCount, 3);
assert.ok(near.contenderMass >= .75);
assert.equal(near.shape, 'mixed');
console.log('B', near.contenderCount, near.contenderMass, near.shape);

// C: the absolute tolerance swallows a small relative cutoff.
const tiny = analyze({ a: 1 - 1e-15, b: 1e-15 }, {
  contenderRatio: 1e-12,
});
assert.equal(tiny.contenderCount, 2);
const actualRatio = tiny.ranked[1].probability / tiny.ranked[0].probability;
assert.ok(actualRatio < tiny.profile.contenderRatio / 999);
console.log('C', tiny.contenderCount, actualRatio);

// D: shape sensitivity is intentional under the written flatness rule.
const uniform = analyze({ a: 1/3, b: 1/3, c: 1/3 });
const tail = analyze({
  a: (1 - 1e-15)/3, b: (1 - 1e-15)/3,
  c: (1 - 1e-15)/3, d: 1e-15,
});
assert.equal(uniform.shape, 'flat');
assert.equal(tail.shape, 'several-contenders');
console.log('D', uniform.shape, tail.shape);

// E: generic concentration and a mean do not encode ordinal spread.
function score(probabilities) {
  return parse({
    model: 'synthetic', usage: { input_tokens: 0, output_tokens: 0 },
    answers: { q: {
      type: 'score', score: 1.5, confidence: .5,
      legend: { 0: 'Lowest', 1: 'Lower', 2: 'Higher', 3: 'Highest' },
      probabilities,
    } },
  }).answers.q;
}
const adjacent = score({ 0: 0, 1: .5, 2: .5, 3: 0 });
const distant = score({ 0: .5, 1: 0, 2: 0, 3: .5 });
assert.equal(adjacent.expectedLevel, distant.expectedLevel);
assert.equal(adjacent.distribution.shape, distant.distribution.shape);
assert.deepEqual(adjacent.distribution.metrics, distant.distribution.metrics);
assert.notDeepEqual(adjacent.distribution.contenders, distant.distribution.contenders);
console.log('E', adjacent.expectedLevel, distant.expectedLevel);
JS
```

## Recommendations

1. **Before describing mass sets as reaching every requested target:** special-case target 1 to retain all positive entries, define tolerated mass error for other targets, and add focused decimal-boundary and tiny-positive-tail regression cases. Avoid using a blanket tolerance that discards a real tail at target 1.
2. **Unify the half-of-leader comparison:** share one scale-aware rule between contender selection and shape classification; add the default-rule disagreement and very small custom-ratio examples above. Decide whether the full current ratio range is intended before narrowing it.
3. **Document the numerical profile:** include normalization tolerance, tie policy, comparison units, and mass error policy in returned metadata or a version-pinned specification. Clarify that `runnerUp` means the second ranked entry and that a provider choice within tie tolerance is accepted as a leader.
4. **Optional numerical hardening:** compensated summation would reduce accumulation error in large provider-neutral maps. A synthetic uniform map of 100,000 entries currently yields Shannon effective options `100000.00000337404` and Simpson `99999.99999974281`; the Shannon result is slightly above the mathematical support bound. The relative error is tiny, and this is not a practical blocker for the adapter's 2–10 Score levels. Prefer error-aware assertions over exact equality for general effective counts.
5. **Optional future product work:** evaluate whether flatness should be defined over all positive support or a declared retained-mass subset. For Score, consider an ordered view, dispersion in level-position units, or separated-mode indicators only when ordinal semantics are explicitly specified. Do not turn these into correctness, significance, calibration, or guaranteed-coverage claims.

The core statistical separation is sound. The requested changes concern precise numerical contracts and consistency at boundaries; the optional vocabulary and ordinal extensions should remain separate design decisions.
