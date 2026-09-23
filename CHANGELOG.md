# Changelog

## Unreleased

- Describe Jev Choice, Noul and Score responses with preserved provider values and raw snapshots.
- Expose distribution data, structural predicates, exhaustive typed matching and the provisional `descriptive-v2` vocabulary.
- Build an ESM package with TypeScript declarations and verify its actual installed archive.
- Add boundary, generated-invariant, parser and type-contract suites; enforce coverage floors and configure a cross-platform CI matrix.
- Reject explicit `null` numeric options instead of silently using defaults. Omitted or `undefined` options still use defaults. Distribution thresholds are unchanged.
- Accept callable handler containers with all required own callbacks, matching the structural TypeScript contract.
