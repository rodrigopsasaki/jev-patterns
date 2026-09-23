---
interlock: brief@v1
graph: initial-review
node: statistics
role: reviewer
gates: []
scope: []
substrate:
  address: none
---

Review README.md, docs/proposal.md, src/distribution.ts, src/jev.ts and the synthetic tests.
Write docs/reviews/statistics.md with sections Findings, Counterexamples and Recommendations.
Look for misleading statistical interpretation, brittle thresholds, count-versus-mass confusion,
numeric failures, tie handling and ordinal score problems. Give executable counterexamples where
possible. Distinguish defects from optional API preferences. Do not change product code, publish,
access private inputs or use live inference. Commit your report and supply the required Interlock
debrief with precise file references. The gate checks report structure, not scientific truth.
