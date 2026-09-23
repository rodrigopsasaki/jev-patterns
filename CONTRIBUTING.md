# Contributing

This is an experimental API. Start proposed vocabulary or threshold changes with distributions that expose the behavior you want to improve. Document which claims are mathematical properties and which are application choices.

Use Node 24.14 or newer and the committed lockfile:

```sh
npm ci --ignore-scripts
npm run check
npm run demo
```

Tests must use synthetic data or explicitly public fixtures. Do not commit prompts, credentials, private Jev responses or runtime logs. Keep the runtime dependency-free and network-free. Preserve original provider output, report transformations and avoid implying that concentration establishes correctness.

`npm run check` is the fast iteration gate: it includes staged, unstaged and untracked changes against HEAD. For a pull request, use `npm run check -- --since origin/main`; the base is resolved to the merge base, not guessed. `npm run check:plan` prints the files, selected checks and reasons without running them. `npm run format` applies Biome fixes. Biome's recommended lint rules, import organization and formatting are enforced, including warnings.

The planner selects affected Vitest tests, complete incremental type checks when relevant, and installed-package smoke checks for source or shipped-content changes. Runtime test edits select their dependent suites; documentation under `docs/` needs no runtime run. Dependencies, build/CI configuration, deleted dependencies and unknown paths request full verification. The same planner is used locally and in CI.

`npm run check:full` is the complete integration/release gate. It runs Biome, both typecheck configurations, Vitest coverage, and the full installed-package replay. Consumers are checked with NodeNext and Bundler resolution, with and without unchecked-index protection. Coverage floors are 100% lines/statements/functions and 99% branches, unchanged or strengthened from the native runner. Ordinary affected runs do not compute incomplete global coverage.

For every change, explain the observable behavior and provide its evidence:

- Bugs: the smallest synthetic input that reproduces the failure, retained as a regression test.
- Numeric behavior: below/at/above boundaries and independent mathematical invariants.
- Parsing: valid and malformed wire fixtures, field-specific errors, and provider-value preservation.
- API changes: inferred return types, callback narrowing, readonly access and intentional compile errors.
- Packaging: the installed artifact must work without repository source or runtime dependencies.

Seed generated cases and include the failing input in assertion context. Test iteration counts are not separate behavioral guarantees. Coverage cannot establish that a threshold is useful for a real task; keep mathematical claims and provisional product semantics separate.

Ordinary PRs run selected checks on one Linux/Node 24 runner. Full verification runs on `main`, release tags, manual dispatch and high-impact PRs, using the minimum Node version, Node 24/26 and Linux/macOS/Windows. Duplicate branch-push runs are disabled. Require the final `CI` status in branch protection after the remote exists. A local pass does not establish that the remote matrix passed. See [testing](docs/testing.md) and [release policy](docs/release-policy.md). `private: true` remains intentional while the API is experimental.
