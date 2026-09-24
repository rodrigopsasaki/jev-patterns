# V2 proposal: task verbs, reusable recipes, optional receipts

Status: design sketch, not an implemented API. V0 continues to parse and describe responses. “V2” here names a future product layer; it is unrelated to the existing `descriptive-v3` statistical profile.

The [TypeSafe task map](https://docs.typesafe.ai/concepts/use-case-map#example-task-categories) suggests a useful application vocabulary. Our proposal turns that vocabulary into reusable task recipes. These would wrap Jev calls, return task-specific values, and expose their interpretation when requested. They are not additional Jev wire primitives or new distribution observations.

## The API someone reaches for

Proposed syntax, with application inputs and an injected Jev caller:

```ts
const tasks = createTasks({ judge: jevJudge });
const labels = {
  billing: 'The ticket concerns a charge, invoice, or payment.',
  refund: 'The customer requests money back.',
};

const tags = await tasks.label(ticket, { labels });
// { present: ['billing', 'refund'], absent: [], uncertain: [] }

const { value, receipt } = await tasks.label(ticket, {
  labels,
  receipt: true,
});
```

`label` is a convenience built from per-proposition detection. For a fabricated response with yes probabilities .94 and .89, both labels could be present under the selected recipe's defaults. The actual defaults must be named, inspectable, versioned and evaluated; this illustration is not a calibrated recommendation.

The ordinary result is useful on its own. A receipt adds the questions, responses and policy observations behind that result. It does not alter the questions sent, trigger another Jev call, or change the interpretation. Separate invocations may still receive different provider responses; equivalence is a contract for the same recorded inputs and responses.

## Verbs have different contracts

The following return shapes are our design suggestions, not provider API promises.

| Verb | Recipe responsibility | Useful result |
| --- | --- | --- |
| `classify` | Ask for one category and apply a declared selection policy. | A category or an explicit unresolved result. |
| `detect` | Evaluate one proposition and preserve yes/no direction. | Present, absent or uncertain, with a yes probability. |
| `label` | Apply detection to named propositions that may overlap. | Present, absent and uncertain label sets. |
| `score` | Evaluate an explicit ordered rubric. | A rubric-aware result retaining level probabilities. |
| `route` | Map an interpreted classification to a destination. | A destination or an unresolved result; dispatch remains explicit. |
| `search` | Evaluate supplied candidates against a query. | Matches under a stated relevance policy. |
| `retrieve` | Select context from evaluated candidates under a budget. | Context items plus omissions or unresolved candidates. |
| `rank` | Order supplied items using a specified method. | An ordering with ties and method metadata. |
| `verify` | Evaluate specified checks against supplied evidence. | Per-check outcomes, including unresolved checks. |
| `features` | Preserve named semantic measurements for downstream models. | A typed feature map, without forcing boolean decisions. |
| `extract` | Recover declared fields with field-level provenance. | Values and their supporting source references. |

Start V2 with `classify`, `detect` and their `label` composition. This proposed `rank` verb is a full task recipe: it wraps its own Jev calls and needs an explicit method and tie/cycle policy, which is a different thing from v0.3's `rank()` function — a pure, synchronous helper that orders an already-supplied probability map, with no Jev call, method, or cycle policy of its own. The verb could be built on top of the primitive; the primitive does not anticipate the verb. Retrieval needs candidate identity and budget semantics. Open-ended field extraction may require a separate extractor before Jev evaluates candidate values. A distribution parser cannot recover arbitrary text fields that were never returned.

Distribution observations inform these recipes where useful. They are not the task result: a Noul's yes probability can still mean no even when its distribution looks concentrated, a Score has ordered levels, and pairwise rankings can disagree. No universal “highest score” reducer fits all verbs.

## A recipe is an inspectable default you can replace

The direct verbs should use the same public recipe constructors available to users. Someone who wants a different policy can configure a recipe; someone who needs a different method can implement the same small contract.

Proposed customization syntax:

```ts
const supportLabels = recipes.label({
  id: 'support-labels',
  version: '1',
  labels,
  policy: { presentAt: 0.9, absentAt: 0.1 },
});

const detailed = await tasks.run(supportLabels, ticket, { receipt: true });
```

The example thresholds are an application choice. The recipe records their resolved values, including comparison direction and boundary behavior. Changing configuration creates a new immutable definition; it does not mutate a shared built-in. Custom identities and effective configuration must remain visible rather than masquerading as an unchanged default recipe.

A normal verb call and `tasks.run()` share the same execution and interpretation path. There is no private, more capable implementation behind the convenience API.

## The seam to preserve: prepare, call, interpret

```text
recipe + input → resolved plan → injected Jev caller → parse + correlate → interpret
                                                                               ↓
                                                                      task value + evidence
```

A plan holds the resolved questions, interpretation context and policy parameters. The first runner can execute a finite list of calls. Stable call, question and candidate IDs bind responses to the plan even when batching or concurrency changes completion order. Adaptive workflows and a general graph scheduler are outside the initial scope.

A sketch of the recipe contract, with the specific plan and evidence schemas still open:

```ts
interface Recipe<Input, Plan, Calls, Value, Evidence> {
  readonly id: string;
  readonly version: string;
  prepare(input: Input): Plan;
  interpret(plan: Plan, calls: Calls): Interpretation<Value, Evidence>;
}

type Interpretation<Value, Evidence> = {
  readonly value: Value;
  readonly evidence: Evidence;
};

type WithReceipt<Value, Receipt> = {
  readonly value: Value;
  readonly receipt: Receipt;
};

type TaskOutput<Value, Receipt, Capture extends boolean = false> =
  Capture extends true ? WithReceipt<Value, Receipt> : Value;

type LabelResult<Label extends string> = {
  readonly present: readonly Label[];
  readonly absent: readonly Label[];
  readonly uncertain: readonly Label[];
};
```

This generic interface illustrates the boundary, not a demand for users to supply five type arguments. Built-in constructors infer label/category names and their associated plan, response and result types. A literal `receipt: true` returns a typed envelope; omission returns the value; a runtime boolean produces the appropriate union.

The interpreter stays pure. It uses the current distribution analysis and returns structured rule observations alongside the value. Receipt assembly and optional raw-payload retention happen outside it. If detailed tracing later becomes expensive, an optional collector can be added only with tests proving that collection does not affect values.

Offline interpretation uses the same recipe with supplied context and recorded responses:

```ts
const interpretation = supportLabels.interpret(savedPlan, savedCalls);
```

A response alone does not contain the original question or the policy used by the application. The response-only path must accept that context explicitly, or represent it as unknown; it must not invent the missing provenance.

`parse()` currently validates Jev wire structure. The future runner must additionally correlate responses with its plan: expected question IDs, answer kinds, option/level vocabularies and candidate identities. A well-formed answer to a different question is not a valid task result. Missing, failed or cancelled calls cannot become negative labels. Initially fail incomplete runs; any later partial-result mode needs its own explicit type.

## What a receipt means

A receipt is a serializable record of the input context, observed response and applied policy. It is not proof of correctness, a provider attestation, or a reconstruction of hidden model reasoning.

Keep these facts separate:

- Receipt schema version and recipe identity/version.
- Resolved question specifications and policy parameters, including the selection/ranking method.
- Input or source references and an explicit indication of what content was retained or omitted.
- Calls identified by ID, with returned model, usage, answer values and execution status where actually observed.
- Distribution observations and their own analysis profile/version, separate from the task recipe version.
- Structured rule outcomes linked to question/candidate IDs: for example, yes .94 met the configured .9 boundary, producing `present`.

A runner receipt records that the injected caller was invoked. An imported-response receipt records that responses were supplied. Neither upgrades caller-provided metadata into independently verified provider execution. Do not fill in latency, retries, request IDs or missing evidence that were not observed.

Project receipt data explicitly. Current distribution objects have methods, and current readonly declarations do not deep-freeze runtime objects. A receipt should snapshot data rather than retain mutable references or depend on `JSON.stringify()` silently dropping functions. Raw inputs and full payloads are a separate retention choice; a lightweight receipt can use references and state its replay limits.

Given the exact resolved plan, recorded responses, recipe implementation and versions, interpretation should be reproducible without a model call. Replaying a live Jev call is a different operation and need not reproduce its response. Custom function source is not serialized as a substitute for versioned recipe code.

## What v0 should keep open now

1. Keep `analyze()` and `parse()` deterministic and free of transport concerns. Future verbs can wrap them.
2. Preserve typed IDs, raw provider values, Noul direction, Score legends, ties and analysis profiles. Recipes need those facts before applying task policies.
3. Keep `DistributionData` usable independently of matching methods. A later receipt can project a data-only observation without serializing a live result object.
4. Keep structural predicate defaults separate from recipe policies and their versions. `descriptive-v3` is not the version of a label-selection or routing policy.
5. Keep receipts at the task/interpretation boundary. Analyzing probabilities does not imply a request was issued or a workflow action was taken.
6. Keep one-to-many responses possible in the future API. Do not model every task as one question, one response or one confidence scalar.

The current runtime already permits these boundaries. No new V2 exports, receipt fields, placeholder runners, or transport dependencies are required now. These are design constraints for the next layer; the v0 public contract and statistical profile remain unchanged.

## Evidence required before implementation ships

- The live wrapper and offline interpreter return the same value for identical plans and recorded responses.
- Receipt collection does not alter the value, planned requests, or caller count.
- Literal option names and receipt-option return types survive TypeScript inference, including negative type checks.
- Batched/reordered calls remain correctly associated; mismatched vocabularies and missing answers fail explicitly.
- A strong no remains absent, an unresolved detection stays uncertain, and overlapping labels can both be present.
- Built-in and configured recipes use the same interpreter; effective defaults and overrides appear in receipts.
- Receipt JSON round-trips preserve evidence; later mutation of inputs or parsed objects does not rewrite an existing receipt.

Use fabricated responses and an injected fake caller for these contracts. The first implementation should prove a small recipe end to end before expanding the verb catalog.
