export const numericTolerances = Object.freeze({
  // The absolute tolerance on the input probability sum. Jev (and every other observed
  // judge) rounds each wire probability to two decimal places before serializing it, so a
  // real response's total commonly lands a cent or two off 1 (e.g. a 3-option
  // {0.05, 0.93, 0.01} answer, or a ~200-option answer, both summing to 0.99). Measured
  // across 1,752 real probability maps recorded from Jev calls (35 in jev-local-bench, 809
  // in mycelium's jev-citation/jev-shadow call logs, 833 in the discipline-seam-ab evidence,
  // 6 in packages/analyze's jev-wire fixtures), the observed drift tops out at 0.01 and does
  // not grow with option count: option counts from 2 to over 200 all show the same ~0.01
  // ceiling, because only a handful of options ever carry enough probability for their
  // individual rounding error to matter. This tolerance is twice that observed ceiling, not
  // a per-option bound multiplied by option count (an n * 0.005 bound would accept almost
  // anything at 200 options and was rejected for that reason); it still rejects a grossly
  // wrong sum such as 0.9, 1.1, or an unconverted percentage split like 51/45/4.
  inputSumAbsolute: 0.02,
  tieAbsolute: 1e-12,
  thresholdRelative: 1e-12,
  massBoundaryAbsolute: 1e-12,
  normalizedAbsolute: 1e-12,
});

export function atLeast(actual: number, threshold: number): boolean {
  return (
    actual >= threshold ||
    threshold - actual <=
      numericTolerances.thresholdRelative * Math.max(Math.abs(actual), Math.abs(threshold))
  );
}

/**
 * Two scores are the same score exactly when `atLeast` can't tell them apart in either
 * direction — the same relative tolerance coverage's threshold comparison already uses.
 * No second tolerance: this is derived from `atLeast`, never a fresh constant.
 */
export function sameScore(a: number, b: number): boolean {
  return atLeast(a, b) && atLeast(b, a);
}

export function requireProbability(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`${name} must be finite and in [0, 1]`);
  }
  return value;
}

/** Clamp a value that the math should already keep in [0, 1] but float rounding can nudge past. */
export function bounded(value: number): number {
  return Math.min(1, Math.max(0, value));
}
