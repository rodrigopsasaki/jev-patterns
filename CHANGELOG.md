# Changelog

Changesets now generates this file's entries from `.changeset/`; see the pending release notes there until the next version is cut.

## 0.3.1

### Patch Changes

- 442ae66: Accept real Jev wire responses whose probabilities sum a cent or two off 1. Jev rounds each option's probability to two decimal places before serializing it, so a genuine answer — a 3-option `{0.05, 0.93, 0.01}` choice, or a ~200-option choice with the same shape — commonly sums to 0.99, not exactly 1. Every entry point (`analyze`, `massSet`, `rank`, `parse`, `inspectAnswer`) previously rejected any such answer, throwing on ordinary Jev output rather than only on genuinely malformed input.
  
  `profile.numericTolerances.inputSumAbsolute` is now `0.02` (previously `1e-8`, a float-noise-sized figure unrelated to wire rounding): twice the largest drift measured across 1,752 real probability maps collected from Jev calls, chosen as a fixed constant rather than one that scales with option count, since the measured drift does not grow with option count either. A grossly wrong sum — 0.9, 1.1, or an unconverted percentage split like 51/45/4 — still throws.
  
  `input.normalized` and rescaling are unchanged: a distribution whose drift exceeds the much tighter `normalizedAbsolute` (`1e-12`) float-noise boundary is still reported and rescaled as before, just no longer rejected outright when the drift is wire-rounding-sized.

## 0.3.0

### Minor Changes

- 80ad7eb: Remove the six named distribution shapes (`dominant`, `paired`, `split`, `clustered`, `flat`, `mixed`), `.shape`, `match()`, `MatchHandlers`, `ShapeDetails`, `ShapeResults`, and `DistributionFor`. A v0.3 evaluation on 356 labeled judge answers found the named shapes add no information about a top answer's correctness beyond `maximumProbability` alone (`dominant` at its default floor is exactly `maximumProbability >= 0.8`; `clustered` at its defaults is exactly `prominent.count >= 3 && prominent.probability >= 0.75`; `flat` never occurred in the corpus; `paired`'s apparent value is fully reproduced by a shape-agnostic `maximumProbability` band). With the classification carrying no demonstrated value, the whole discriminant is removed rather than deprecated.
  
  **Migration:**
  
  - Replace any `.shape` read or `match()` dispatch with the observations you actually need (`maximumProbability`, `gap`, `prominent`, `massSet`, `metrics`) and your own application logic, or with `.is(predicate)` using one of the structural predicate factories below.
  - `dominant`, `paired`, `split`, `clustered`, `flat` are unchanged as predicate factories usable through `.is(predicate)` — their default parameters and boolean behavior are exactly as before. Their documentation now says plainly that they have no demonstrated predictive value on their own; validate against your own labeled data before gating a real decision on one.
  - `Distribution<Option>` is now `DistributionData<Option>` plus `profile` and `is(predicate)` — no `.shape`, `.summary`, or `.match()`.
  - The profile id is now `descriptive-v3`. `profile.thresholds` is removed: predicate default thresholds now live only next to each predicate factory in `src/predicates.ts`, since there is no classification decision left for them to version.
  
  Add `rank(probabilities, options?)`: a new primitive that orders a probability map by probability, optionally excluding labels (e.g. an "other" catch-all or a none-sentinel) and limiting to the top N. It shares `analyze()`/`massSet()`'s validation and deterministic tie order, and does not renormalize after exclusion — excluded entries' neighbors keep their original model probability. With a typed probability map, excluding a literal outside its option keys is a compile error; untyped input has no closed vocabulary to check an excluded label against, so an absent label is silently ignored. There is no separate "top-1 excluding X" helper: that is `rank(p, { exclude, limit: 1 })[0]`.
  
  This changeset also carries forward the not-yet-released fixes from the prior `## Unreleased` section (folded in here rather than split into a separate patch changeset, since they describe the same not-yet-published release and one of them — the `match()` return-type cast removal — is now moot given `match()` itself is removed above):
  
  - `input.normalized` is now reported only once a distribution's total differs from 1 beyond a declared `normalizedAbsolute` tolerance (`1e-12`), surfaced under `profile.numericTolerances`. Summation-order float noise (e.g. `analyze({ a: 0.1, b: 0.2, c: 0.7 })`) no longer reports normalization; deliberate drift within the existing `1e-8` input-sum tolerance still does. Rescaling remains unconditional.
  - Choice answers (`readAnswer`/`parse`) are built without mutating an already-returned `Distribution`: `is()` on a Choice answer closes over the one object constructed with its `type`/`choice`/`confidence`/`raw` fields already in place, rather than a plain `Distribution` that later had those fields assigned onto it.

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
