# Individual answers

`inspectAnswer(answer, options?)` is a synchronous entry point available since v0.2.0 for an individual decoded Choice, Noul, or Score answer. It accepts unknown input and preserves the types of known answers, including adapter shapes with nullable fields. It makes no network calls and requires no fabricated response envelope.

## Outcomes

- `available`: `answer` contains the observations. Choice exposes its distribution directly. Noul and Score expose `.distribution`. All retain independent `.raw` snapshots.
- `missing`: input was exactly `undefined`. An absent Map entry can flow straight into inspection. `null` is invalid, not missing.
- `unavailable`: a recognized Choice or Score supplied `null`, `undefined`, or no `probabilities` field. Its `.raw` snapshot preserves the provider's answer and extension fields. No distribution is invented. Choice must still supply a string choice. Score must still supply a finite nonnegative score; a supplied non-null legend is validated, including the score's upper bound. An absent legend cannot establish an upper bound and is preserved as absence.
- `invalid`: the first expected data failure appears in the nonempty `issues` array. Paths are relative to the answer, with an empty path for the answer itself. An option containing punctuation remains one path segment. Codes are `invalid-type`, `out-of-range`, `invalid-total`, and `inconsistent-answer`. The array leaves room for future multiple issues; callers should not rely on validation order or message wording.

Noul has one required finite probability in `[0, 1]`; a missing `noul` field is malformed data. Independent Noul answers remain separate propositions. Never normalize their affirmative probabilities into a categorical distribution.

## Confidence and validation

Inspected Choice and Score confidence is `number | null`. A null, omitted, or undefined confidence becomes `null` in the derived view, with the original distinction preserved in `.raw`. A supplied confidence must be finite and within `[0, 1]`. Concentration, gap, and entropy never substitute for provider confidence.

When a distribution is supplied, the same numeric validation as `analyze()` and `parse()` applies: finite probabilities within `[0, 1]`, a nonempty map, and total one within the existing tolerance. An empty or incorrectly summed map is invalid, not unavailable. Tiny accepted drift is normalized only in the derived view. Choice must name a maximum under the existing tie tolerance. A Score with a distribution requires a complete, consecutive 2–10 level legend and a score inside its level range. A fractional score and a discrepancy from the computed expectation remain visible.

`parse()` retains its strict wire contract: required numeric confidence, required distributions, a model, usage, and an answer record. No existing strict input becomes accepted merely because inspection permits adapter absence. The three entry points share answer readers and statistical calculations; the `descriptive-v2` profile does not change.

Invalid analysis options throw even when an answer is missing or unavailable. Unexpected exceptions also propagate; inspection is intended for decoded data, not executable object graphs. A snapshot that cannot be structured-cloned returns an `invalid-type` issue. Objects with throwing getters or proxies are outside the decoded-data contract. Results are readonly in TypeScript rather than deeply frozen at runtime.

## Composition and integration

Use ordinary Map, array, or object operations to retain question IDs. The [batch example](../examples/answer-batch.ts) preserves every item, including missing and invalid entries. Inspection never discards failed items, assumes independence between questions, associates answers with a request, or supplies an application decision.

Typed input retains its answer kind and literal option or level names, including nullable map unions. Unknown input returns the full inspected-answer union and requires narrowing. Shape matching preserves callback return values and promises exactly as `analyze()` does. A matched handler receives the distribution; provider metadata remains available on the enclosing answer.

A vendor-neutral judge can keep its own response outcomes, provenance, and policy gates. After narrowing a successful response, inspect its individual answers and attach observations beside its existing decision records. A refusal remains a refusal owned by that port; it is not an empty distribution or an invented negative answer. Scores and shapes alone cannot establish whether a question was well posed, whether the answer was correct, or whether a policy should act.
