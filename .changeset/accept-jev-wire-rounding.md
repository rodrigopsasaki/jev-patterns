---
"jev-patterns": patch
---

Accept real Jev wire responses whose probabilities sum a cent or two off 1. Jev rounds each option's probability to two decimal places before serializing it, so a genuine answer — a 3-option `{0.05, 0.93, 0.01}` choice, or a ~200-option choice with the same shape — commonly sums to 0.99, not exactly 1. Every entry point (`analyze`, `massSet`, `rank`, `parse`, `inspectAnswer`) previously rejected any such answer, throwing on ordinary Jev output rather than only on genuinely malformed input.

`profile.numericTolerances.inputSumAbsolute` is now `0.02` (previously `1e-8`, a float-noise-sized figure unrelated to wire rounding): twice the largest drift measured across 1,752 real probability maps collected from Jev calls, chosen as a fixed constant rather than one that scales with option count, since the measured drift does not grow with option count either. A grossly wrong sum — 0.9, 1.1, or an unconverted percentage split like 51/45/4 — still throws.

`input.normalized` and rescaling are unchanged: a distribution whose drift exceeds the much tighter `normalizedAbsolute` (`1e-12`) float-noise boundary is still reported and rescaled as before, just no longer rejected outright when the drift is wire-rounding-sized.
