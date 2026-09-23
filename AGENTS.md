# Working on jev-lens

This library describes probability distributions. Keep the distinction between an observation, a descriptive heuristic and an application action visible in the API.

## Required evidence

- Every behavior change needs a regression or contract test. New numeric rules need cases below, at and above their boundaries. New validation needs valid and invalid fixtures.
- Use synthetic Jev responses. Tests must run without credentials, live services, network calls or unseeded randomness. Generated tests must identify the seed and failing input.
- Test invariants independently of the implementation: conservation, ordering, ties, permutation invariance, zero padding and return-value identity. Do not derive the expected answer by calling the code under test.
- Public TypeScript changes require positive and negative consumer checks. Preserve literal keys, exhaustiveness, readonly types and missing-answer checks.
- During iteration run `npm run check` (changed worktree) or `npm run check -- --since origin/main` (branch plus worktree). Inspect scope with `npm run check:plan`. The planner selects Biome, affected Vitest tests, relevant type checks and installed-package smoke checks.
- Run `npm run check:full` for release verification, broad changes and the final integration of a tooling migration. It includes full coverage and the complete installed-package replay. Do not run the full suite after every small edit unless a failure or unresolved concern warrants it.
- Keep affected selection conservative and tested. Missing Git references fail; deleted dependencies and configuration changes promote to full checks. Never turn an unexplained empty runtime selection into success.
- Do not reduce a coverage gate or remove a failing assertion to pass a change. Explain unreachable paths and repair the design or the test when appropriate.

## Compatibility

- Shape names, thresholds, classification precedence and numerical tolerances are observable behavior. Record changes and their profile-version impact in the changelog and proposal.
- Keep runtime dependencies at zero. A development dependency needs a concrete purpose that the existing tools cannot reasonably meet.
- Preserve input and provider provenance. Do not mutate caller data, invent confidence or choose application actions.
- Keep generated builds, temporary consumers, credentials and orchestration state out of Git. The package uses an explicit file allowlist.
- Treat high coverage as evidence of exercised code, never a proof of correctness or calibrated thresholds.

See CONTRIBUTING.md and docs/release-policy.md for the contribution and release requirements.
