# Contributing

This is an experimental API. Start proposed vocabulary or threshold changes with distributions that expose the behavior you want to improve. Document which claims are mathematical properties and which are application choices.

Use Node 24.14 or newer and the committed lockfile:

```sh
npm ci --ignore-scripts
npm run check
npm run demo
```

Tests must use synthetic data or explicitly public fixtures. Do not commit prompts, credentials, private Jev responses or runtime logs. Keep the runtime dependency-free and network-free. Preserve original provider output, report transformations and avoid implying that concentration establishes correctness.

`npm run check` is the contribution gate. It checks types, runtime contracts and coverage, builds JavaScript and declarations, installs the real tarball into an isolated project, and repeats the public runtime and type tests there. Consumers are checked with NodeNext and Bundler resolution, with and without unchecked-index protection. The runtime coverage floor is 100% lines, 100% functions and 99% branches; defensive unreachable branches explain the remaining allowance.

For every change, explain the observable behavior and provide its evidence:

- Bugs: the smallest synthetic input that reproduces the failure, retained as a regression test.
- Numeric behavior: below/at/above boundaries and independent mathematical invariants.
- Parsing: valid and malformed wire fixtures, field-specific errors, and provider-value preservation.
- API changes: inferred return types, callback narrowing, readonly access and intentional compile errors.
- Packaging: the installed artifact must work without repository source or runtime dependencies.

Seed generated cases and include the failing input in assertion context. Test iteration counts are not separate behavioral guarantees. Coverage cannot establish that a threshold is useful for a real task; keep mathematical claims and provisional product semantics separate.

CI is configured for the minimum Node version, maintained Node 24/26 lines, and Linux/macOS/Windows. A local pass does not establish that the remote matrix passed. See [testing](docs/testing.md) for the contract map and [release policy](docs/release-policy.md) for publication requirements. `private: true` remains intentional while the API is experimental.
