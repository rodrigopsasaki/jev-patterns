# Changelog

## Unreleased

- Report `input.normalized` only once a distribution's total differs from 1 beyond a new, declared `normalizedAbsolute` tolerance (1e-12), surfaced under `profile.numericTolerances`. Summation-order float noise (e.g. `analyze({ a: 0.1, b: 0.2, c: 0.7 })`) no longer reports normalization; deliberate drift within the existing 1e-8 input-sum tolerance still does. Rescaling remains unconditional. `descriptive-v2` shape thresholds and precedence are unchanged.

## 0.2.0 — 2026-09-23

- Publish the first npm package, including the answer-inspection API, compiled ESM, declarations, and README assets. Install with `npm install jev-patterns`. The earlier v0.1.0 release remains GitHub-only.

- Add `inspectAnswer()` for individual Choice, Noul, and Score answers, including adapters with nullable confidence and distributions. Preserve literal option types, raw snapshots, predicates, and exhaustive shape matching.
- Distinguish available, missing, unavailable, and invalid answers. Return structured issue paths and codes for expected data failures while allowing invalid options and executable-input errors to throw.
- Share answer validation with strict `parse()` without weakening its wire contract. Distribution thresholds, tolerances, and the `descriptive-v2` profile are unchanged.
- Add synthetic adapter and batch contracts, nullable-input type checks, and an installed-package README example.

## 0.1.0 — 2026-09-23

- Prepare the first experimental GitHub release as `jev-patterns`. The working name `jev-lens` was already registered on npm. Add public repository metadata, CI links and a compiled release tarball; npm publication remains separate.
- Isolate Git fixtures with an actual empty global config file; Git for Windows rejects Node's null-device path when used as a config filename.

- Document a future task-recipe layer with ergonomic verbs, replaceable policies, optional receipts and a shared live/offline interpreter. Keep the v0 runtime API and descriptive profile unchanged.
- Add a visual v0 README with local badges, six distribution diagrams and executable application examples. Clarify categorical selection versus separate per-label Noul probabilities; no statistical rules or public APIs change.
- Include README SVGs in the package and validate image references, example execution and example types against the installed archive. Asset edits select package smoke checks.
- Add pinned Biome and Vitest, shared Git-aware affected checks, a readable dry-run plan, incremental typecheck caches, and conditional PR/full CI paths. Package smoke runs separately from full replay.
- Narrow unit imports so parser edits select parser suites. Consolidate nonempty validation and use a branch-free key comparator; retain all numerical cutoffs and result identity contracts.
- Describe Jev Choice, Noul and Score responses with preserved provider values and raw snapshots.
- Expose distribution data, structural predicates, exhaustive typed matching and the provisional `descriptive-v2` vocabulary.
- Build an ESM package with TypeScript declarations and verify its actual installed archive.
- Add boundary, generated-invariant, parser and type-contract suites; enforce coverage floors and configure a cross-platform CI matrix.
- Reject explicit `null` numeric options instead of silently using defaults. Omitted or `undefined` options still use defaults. Distribution thresholds are unchanged.
- Accept callable handler containers with all required own callbacks, matching the structural TypeScript contract.
