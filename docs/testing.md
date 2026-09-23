# Test contracts

The suite fabricates decoded Jev responses; no account, API key, network or model invocation is needed. Synthetic fixtures are sufficient to test parsing and mathematical behavior. They do not establish real-world calibration or the usefulness of heuristic names.

| Contract | Evidence |
| --- | --- |
| Shapes and measurements | `test/distribution.test.mjs`, `test/match.test.mjs`: examples, effective counts, mass boundaries and reported normalization |
| Mathematical invariants | `test/properties.test.mjs`: seeded distributions, mass conservation, ordering, invariance and effective-count bounds |
| Numeric boundaries | `test/boundaries.test.mjs`: default/custom predicates, ties, sum tolerance and invalid options |
| Jev wire compatibility | `test/jev.test.mjs`, `test/jev-contract.test.mjs`: all three answer kinds, synthetic generated responses, malformed inputs, raw snapshots and unusual keys |
| Matching and composition | `test/match-contract.test.mjs`: every callback, preserved values/promises/errors, validation before dispatch, and predicate evaluation order |
| Type ergonomics | `test/types.test.ts`, `test/type-contracts.test.ts`: exact inferred unions, known keys, narrowing, readonly values and expected compiler errors |
| Installable package | `test/package/consumer.mjs`: archive allowlist, offline install, public runtime tests and shipped README examples against compiled JS, and declarations under four consumer configurations |

## Commands

`npm test` runs public runtime tests. `npm run typecheck` checks source examples and positive/negative type contracts with both index-access settings. `npm run test:coverage` runs runtime tests with enforced source coverage floors of 100% lines, 100% functions and 99% branches. Node's V8 coverage is a control-flow measurement, not a behavioral specification; the branch allowance accommodates defensive checks unreachable from validated inputs.

`npm run test:package` cleans and builds `dist`, creates a tarball, installs it in a temporary isolated project without lifecycle scripts or network access, and reuses the public tests against `jev-lens`. It also checks emitted declarations using TypeScript 5.9.3 in NodeNext and Bundler modes, with `noUncheckedIndexedAccess` both enabled and disabled. Unexpected archive files fail the check. Temporary files are removed after completion.

`npm run check` runs all these gates. CI runs this command on Node 24.14.0, Node 24 and Node 26 on Linux, plus Node 24 on macOS and Windows. Action revisions and the development compiler are pinned; dependency update proposals are configured through Dependabot.

The initial full local verification on 2026-09-23 passed on macOS arm64 with Node 24.14.0 and 26.9.0. It ran 107 named runtime tests, including seeded families and validation tables, with 100% line/function coverage and 99.10% branch coverage. The two uncovered branches in `distribution.ts` are the defensive empty-first guard after nonempty validation, and the equal-key comparator case for an object whose keys are necessarily unique. No coverage-ignore directives are used. Remote platform results remain unverified until GitHub CI runs.

## Limits and maintenance

Tests do not enumerate every possible distribution. Each named shape has readable examples, each configurable boundary has local counterexamples, and generated distributions exercise broader invariants. Keep a minimized failing input whenever a generated test finds a defect.

The tests validate categorical probability geometry. They do not validate Jev calibration, infer which answer is actually correct, or establish ordinal distances for Score answers. Full mutation testing and fuzzing with shrinking are not yet configured; passing coverage gates does not substitute for those checks or independent review.
