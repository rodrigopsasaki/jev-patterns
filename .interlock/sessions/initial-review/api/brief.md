---
interlock: brief@v1
graph: initial-review
node: api
role: reviewer
gates: []
scope: []
substrate:
  address: none
---

Review README.md, docs/proposal.md, src/index.ts, src/jev.ts, src/distribution.ts and the tests.
Write docs/reviews/api.md with sections Findings, Counterexamples and Recommendations.
Check unknown-input validation, documented Jev response handling, prototype safety, raw provenance,
TypeScript ergonomics, determinism and npm publication readiness. Give concrete failing inputs.
This is intentionally an unpublished prototype. Do not change product code, publish, access private
inputs or use live inference. Commit your report and supply the required Interlock debrief with
precise file references. The gate checks report structure, not the quality of your conclusions.
