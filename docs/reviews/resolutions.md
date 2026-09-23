# Review resolutions

The two reports describe the initial prototype (commit `246802c`) and retain their original counterexamples. The parent integrated these changes after review. Neither report is an Interlock-cleared outcome; provenance is recorded in each report and in [orchestration](../orchestration.md).

| Finding | Resolution |
| --- | --- |
| Statistics F1: full-mass tail omission and decimal boundaries | Target 1 includes all positive entries; smaller targets use a declared absolute mass tolerance. Focused regressions cover both. |
| Statistics F2: inconsistent contender comparisons | Public shortlists and the fixed shape rule share one relative comparison. A separate regression checks tiny custom ratios. |
| Statistics F3: implicit numeric policy | The returned profile and proposal now identify absolute sum/tie/mass tolerances and relative threshold tolerance. |
| API P2: missing-key prototype lookup | Answer maps have a null prototype, and public lookup types include undefined. Present reserved keys remain safe own values. |
| API P3: mutable inferred mass-set types | Exported MassSet has readonly fields and entries. Compile-time regression tests verify the contract. |
| API P3: cross-realm objects | Documented as outside the initial decoded-input contract. Same-realm HTTP JSON remains the primary path. |
| Raw mutation and score discrepancy semantics | Documentation distinguishes independent snapshots from deep runtime immutability and explains scoreDifference. |

Validation after remediation: 24 runtime tests, public TypeScript contract checks, and both report-structure checks pass. Tests include seeded synthetic checks of mass monotonicity and effective-count bounds. No live Jev accuracy or calibration benchmark has been run.

Deferred: higher-order numerical hardening for very large generic maps, ordinal Score interpretation, evaluation of shape vocabulary on real tasks, conventional compiled npm packaging, CI, naming and publication. The source-only package remains private and experimental. A few successful fixtures do not establish universal thresholds.
