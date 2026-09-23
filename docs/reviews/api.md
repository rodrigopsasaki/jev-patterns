# Public API and Jev adapter review

Review date: 2026-09-23. Provenance: native Codex subagent review, used as a fallback after the Interlock runner was unavailable. This is not an Interlock session or an Interlock receipt.

Findings describe the initial implementation inspected. Any subsequent parent-agent changes and resolution notes should be assessed separately.

Scope: `README.md`, `docs/proposal.md`, `src/*.ts`, both `test/*.test.mjs` files, the example, `package.json`, and `tsconfig.json`. The review used synthetic inputs only. Product source and tests were not edited; nothing was committed or published.

## Findings

1. **P2 — An absent answer ID can resolve to an inherited object instead of absence.** `src/jev.ts:31` constructs `answers` with `Object.fromEntries`, which gives the result `Object.prototype`. For a response containing only `q`, `result.answers.constructor` is a function, and `result.answers.__proto__` is `Object.prototype`. Code that reads a dynamic ID and uses an ordinary missing-answer guard can therefore attempt to use a non-answer as an answer. `Record<string, ParsedAnswer>` also omits missing-key information unless the consumer enables `noUncheckedIndexedAccess`. This is a dictionary lookup defect, not evidence of prototype pollution: reserved IDs that actually occur in decoded JSON are retained as safe own data properties. Use a null-prototype dictionary or an own-property-aware accessor, and expose absence in the lookup type.

2. **P3 — The nominally readonly analysis exposes a mutable mass-set result.** `src/distribution.ts:37` uses `ReturnType<typeof massSet>`, and the inferred return at lines 98–112 has mutable `options`, `count`, `mass`, `targetMass`, and `excludedMass`. A caller can clear `analysis.massSet.options` or overwrite its count without a TypeScript error, leaving the result internally contradictory. Other analysis collections are explicitly readonly. Add an exported `MassSet` interface with readonly members and a readonly candidate array, and use it consistently for the standalone function and the analysis field. Runtime freezing is a separate policy decision; readonly declarations alone do not promise runtime immutability.

3. **P3 — Cross-realm decoded JSON is rejected.** `src/jev.ts:84` requires the current realm's exact `Object.prototype`. A valid response produced by `JSON.parse` in a Node `vm` context fails with `response must be a decoded JSON object`. Ordinary HTTP JSON decoded in the calling realm works. This is a narrow interoperability limitation, not a failure of the usual Jev request flow; either document the same-realm requirement or deliberately support foreign plain objects. A change should retain protection against unsupported object instances.

The basic documented wire contract is correct: Choice validates its reported selection against the maxima; Noul keeps its direction and does not fabricate confidence; Score requires consecutive level keys and matching probabilities; usage counts and probabilities receive numeric checks. The current [TypeSafe API reference](https://docs.typesafe.ai/api) and [Score documentation](https://docs.typesafe.ai/primitives/score) support the adapter's expected fields and level indexing. No ordinary decoded-JSON Jev compatibility failure was found in this review.

Existing reserved keys (`__proto__`, `constructor`, `prototype`, `hasOwnProperty`, and `toString`) survived synthetic round trips without modifying object prototypes. Distribution ordering uses a locale-independent comparison and a fixed summation order; reversing input insertion order produced deeply equal complete `analyze` results. Retaining input order inside raw provenance is appropriate and should not be confused with nondeterministic analysis.

Raw data is cloned, so later changes to the original input do not affect the result. However, the exposed raw records remain mutable, and the response-level and answer-level copies can diverge after caller mutation. This is an API/documentation choice rather than a failed input-isolation guarantee. Describe raw as an independent snapshot, or add deep readonly typing/freezing if immutable provenance is intended.

**Intentional prototype limits, not new defects:** the package is explicitly private, version `0.0.0`, and exports TypeScript source. The proposal already requires JavaScript output and declarations before publication. No runtime dependencies, Python API, calibrated decision policy, or richer ordinal interpretation are promised. A score/expectation mismatch is preserved with `scoreDifference`; treating that diagnostic as an error would require an explicit contract and tolerance rather than an assumption by this review.

## Counterexamples

These snippets were run on Node v26.9.0 from the repository root. They use only synthetic data.

```js
import { analyze, parse } from './src/index.ts';
import { runInNewContext } from 'node:vm';

const response = {
  model: 'synthetic-model',
  usage: { input_tokens: 1, output_tokens: 1 },
  answers: { q: { type: 'noul', noul: 0.4 } },
};

// Finding 1: missing key is not undefined.
const parsed = parse(response);
Object.hasOwn(parsed.answers, 'constructor'); // false
typeof parsed.answers.constructor;            // 'function'
parsed.answers['constructor']?.distribution.shape;
// TypeError: Cannot read properties of undefined (reading 'shape')

// Finding 2: result becomes inconsistent through its mutable collection.
const result = analyze({ a: 0.6, b: 0.4 });
result.massSet.options.length = 0;
result.massSet;
// { options: [], count: 2, mass: 1, targetMass: 0.8, excludedMass: 0 }

// Finding 3: this is still decoded JSON, but from another realm.
const foreign = runInNewContext(
  `JSON.parse(${JSON.stringify(JSON.stringify(response))})`
);
parse(foreign);
// TypeError: response must be a decoded JSON object
```

A separate synthetic Score with `score: 0`, `legend: {0: 'low', 1: 'high'}`, and `probabilities: {0: 0, 1: 1}` was accepted and returned `expectedLevel: 1` and `scoreDifference: -1`. The discrepancy is visible; acceptance should be documented so consumers do not assume that parsing certifies semantic consistency of every provider field.

Verification: `npm test` passed all 20 tests. Additional probes covered the five reserved keys above, missing-key behavior, mass-set mutation, raw-copy independence, cross-realm input, score discrepancy reporting, and full analysis equality under reversed insertion order. `npm run typecheck` passed after the parent installed development dependencies; the initial missing-compiler setup state was not a product defect. `node scripts/check-review.mjs api` passed. The mutable return-type observation follows directly from the initial public TypeScript declarations and inference; no consumer compilation fixture was added in this report-only review.

## Recommendations

1. Fix missing-ID lookup behavior before downstream consumers use untrusted or variable question IDs. Cover absent and present reserved keys, ordinary absent IDs, and the intended absence-aware TypeScript API. Preserve actual `__proto__` values as own data.
2. Define and export a readonly `MassSet` result type. Consider readonly dictionary types for `answers`, `legend`, and raw snapshots to clarify the mutation contract. Do not imply that TypeScript readonly provides runtime tamper protection.
3. Decide whether foreign-realm plain objects are supported. Keep this lower priority than ordinary dictionary semantics; documentation is sufficient if the scope is intentionally same-realm decoded HTTP JSON.
4. Before npm publication, add the already-planned conventional JavaScript build and declarations, a restrictive package file list, and a packed-package consumer smoke test. That test should install the tarball in a clean temporary consumer and import the package name, since repository-relative imports do not validate an installed package's exports or TypeScript-under-`node_modules` behavior. Remove `private` only in a separately authorized publication step.
5. Document raw snapshot mutability and the meaning of `scoreDifference`, expose or document numeric tolerances alongside the versioned profile, and add small API-focused tests for any accepted changes. Keep statistical tuning and calibration claims separate from parser correctness.
