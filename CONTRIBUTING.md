# Contributing

This is an experimental API. Start proposed vocabulary or threshold changes with distributions that expose the behavior you want to improve. Document which claims are mathematical properties and which are application choices.

Use Node 24.14 or newer. Install development dependencies with `npm install`, then run:

```sh
npm test
npm run typecheck
npm run demo
```

Tests must use synthetic data or explicitly public fixtures. Do not commit prompts, credentials, private Jev responses or runtime logs. Keep the runtime dependency-free and network-free. Preserve original provider output, report transformations and avoid implying that concentration establishes correctness.

Before publishing, select the final name, compile JavaScript and type declarations, verify the package archive, add CI, evaluate the descriptive thresholds on representative tasks, and set a release policy. `private: true` is intentional until those steps are complete.
