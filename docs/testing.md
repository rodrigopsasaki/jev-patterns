# Test contracts and affected checks

The suite fabricates decoded Jev responses; no account, API key or model invocation is needed. Runtime and tooling tests use Vitest. Biome supplies linting, import organization and formatting. Synthetic fixtures test parsing and mathematics; they do not establish real-world calibration or the usefulness of heuristic names.

## Daily commands

```sh
npm run check                           # staged, unstaged and untracked work against HEAD
npm run check -- --since origin/main     # branch changes plus local work, from the merge base
npm run check:plan -- --since origin/main # JSON explanation; runs no checks
npm run test:changed                     # Vitest's native changed mode, tests only
npm run test:watch                       # watch and rerun affected tests
npm run format                          # apply Biome's formatting and safe fixes
npm run check:full                       # complete integration/release verification
```

`check:affected` aliases the fast gate. Pass an existing Git reference to `--since`; a missing or shallow-history base fails visibly. The default HEAD scope is intentionally empty after a clean commit. Use a branch base when reviewing committed work, and always use `check:full` for release evidence.

## Selection policy

| Changed files | Checks |
| --- | --- |
| `src/**` | Biome on changed files, affected Vitest suites, both typecheck configurations, installed-package smoke |
| Runtime tests or test helpers | Biome and affected Vitest suites; types for typed helpers |
| Type-contract fixtures or examples | Biome and typechecking |
| README or license | Installed-package smoke |
| Other documentation | No runtime checks |
| Dependencies, build/tooling/CI configuration, package-harness changes, deleted dependencies or unknown paths | Full gate |

`scripts/change-plan.mjs` is the single selection policy. It resolves a real merge base and reads NUL-delimited Git paths, including index/worktree/untracked changes. It handles deleted and renamed dependencies conservatively and records a reason for each file. Selection itself has Git-fixture tests, including divergent branches and unusual filenames.

`scripts/check.mjs` gives the same file list to Biome and `vitest related --run`. This avoids differences in Git parsing: Biome's native `--changed` is for committed changes, and the installed Vitest Git reader uses newline-delimited paths. The raw `test:changed` command is a convenience; the combined gate is the supported CI path. No `--passWithNoTests` flag conceals an unexplained empty runtime selection.

Unit suites import implementation modules so a parser edit does not mark every mathematical test as affected through the public barrel. All tested names remain public exports, verified separately through types and package smoke. The public barrel and types-only model are explicit Vitest rerun triggers because their contracts span suites. Runtime configuration includes only `.test.mjs`; compile-only `.test.ts` files are handled by TypeScript.

## Contract map

| Contract | Evidence |
| --- | --- |
| Shapes and measurements | `test/distribution.test.mjs`, `test/match.test.mjs` |
| Seeded mathematical invariants | `test/properties.test.mjs`: conservation, ordering, invariance, effective counts and mass sets |
| Numeric boundaries | `test/boundaries.test.mjs`: below/at/above defaults and custom thresholds, tolerances and invalid options |
| Jev wire compatibility | `test/jev.test.mjs`, `test/jev-contract.test.mjs`: all answer kinds, generated inputs, malformed values, snapshots and unusual keys |
| Matching and composition | `test/match-contract.test.mjs`: values/promises/errors, dispatch and predicate order |
| Type ergonomics | `test/types.test.ts`, `test/type-contracts.test.ts`: exact inferred unions, narrowing, readonly access and expected compiler errors |
| Selection correctness | `test/tooling/*.test.mjs`: Git manifest, category policy and dry-run CLI contracts |
| Package correctness | `test/package/consumer.mjs`: native Node checks of the installed tarball |

## Full and package checks

`npm test` runs all Vitest suites without coverage. `test:coverage` adds V8 coverage over runtime source, with floors of 100% lines/statements/functions and 99% branches. Coverage is disabled in affected runs because global thresholds cannot measure a deliberately partial run. The types-only model has no runtime statements. No runtime coverage-ignore comments are used.

`typecheck` checks the complete program under both index-access settings. Each configuration has a separate incremental cache under `node_modules/.cache/tsc`; affected source files are not typechecked in isolation. Artifact builds explicitly disable incremental compilation, so removing `dist` cannot preserve stale build output.

`test:package:smoke` cleans and compiles the package, creates a tarball, installs it offline with lifecycle scripts disabled, checks the archive allowlist/public exports, parses all three Jev answer kinds in native Node, executes the shipped README examples and checks NodeNext declarations. It does not replay the full runtime suite.

`test:package` additionally replays every library runtime contract against installed JavaScript and checks declarations in all four NodeNext/Bundler and checked/unchecked-index combinations. The artifact harness intentionally uses native Node rather than a transforming runner. Shared suites use Node assertions and Vitest's `test` function, translated to `node:test` in the isolated consumer; unsupported Vitest imports fail. The replay requires nonzero executed tests and no failures, skips, cancellations or todo tests. Temporary consumers are removed after completion.

## CI

PRs use the event's immutable base SHA with full Git history. A small planning job needs no package installation. Ordinary changes run one Linux/Node 24 affected job; documentation-only changes need no test runner. Broad changes select the complete five-job Node/platform matrix. `main` pushes, release tags and manual runs always select full verification. Branch pushes do not duplicate PR checks. Superseded runs are cancelled.

The final always-run `CI` status verifies that the selected jobs succeeded, including the expected skipped jobs; require that status in branch protection after publication. Action commits and development dependencies are pinned. Hosted CI execution remains unverified until the repository is published.

## Limits

Tests do not enumerate every possible distribution. Seeded cases retain reproducible failure context; new defects should retain a minimized regression input. Full mutation testing and shrinking fuzzers remain future work. Passing coverage gates does not establish threshold calibration or replace review.

References: [Vitest related tests](https://vitest.dev/guide/cli.html#vitest-related), [Biome changed-file semantics](https://biomejs.dev/reference/cli/), and the installed tools' Git implementations.
