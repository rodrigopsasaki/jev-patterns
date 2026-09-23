export const numericTolerances = Object.freeze({
  inputSumAbsolute: 1e-8,
  tieAbsolute: 1e-12,
  thresholdRelative: 1e-12,
  massBoundaryAbsolute: 1e-12,
});

export function atLeast(actual: number, threshold: number): boolean {
  return actual >= threshold || threshold - actual <= numericTolerances.thresholdRelative
    * Math.max(Math.abs(actual), Math.abs(threshold));
}

export function requireProbability(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`${name} must be finite and in [0, 1]`);
  }
  return value;
}
