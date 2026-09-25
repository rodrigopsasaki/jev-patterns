import { atLeast } from './numeric.ts';
import { InputIssue, object } from './validation.ts';

export interface ThresholdObservation {
  readonly score: number;
  readonly correct: boolean;
}

export interface WilsonInterval {
  readonly lower: number;
  readonly upper: number;
}

export interface EmptyThresholdPoint {
  readonly kind: 'empty';
  readonly threshold: number;
  readonly covered: 0;
  readonly coverage: 0;
  readonly correct: 0;
}

export interface CoveredThresholdPoint {
  readonly kind: 'covered';
  readonly threshold: number;
  readonly covered: number;
  readonly coverage: number;
  readonly correct: number;
  readonly precision: number;
  readonly interval: WilsonInterval;
}

export type ThresholdPoint = EmptyThresholdPoint | CoveredThresholdPoint;

export interface MeasureThresholdsOptions {
  readonly thresholds?: readonly number[];
}

export interface ThresholdMeasurement {
  readonly n: number;
  readonly correct: number;
  readonly auroc: number | null;
  readonly thresholds: readonly ThresholdPoint[];
}

/** Measure labeled score floors; selecting a floor remains application policy. */
export function measureThresholds(
  observations: readonly ThresholdObservation[],
  options?: MeasureThresholdsOptions,
): ThresholdMeasurement;
export function measureThresholds(
  observations: unknown,
  options: unknown = {},
): ThresholdMeasurement {
  const checkedObservations = readObservations(observations);
  const thresholds = readThresholds(options, checkedObservations);
  const correct = checkedObservations.filter((observation) => observation.correct).length;
  return {
    n: checkedObservations.length,
    correct,
    auroc: calculateAuroc(checkedObservations),
    thresholds:
      checkedObservations.length === 0
        ? []
        : thresholds.map((threshold) => measurePoint(checkedObservations, threshold)),
  };
}

function readObservations(input: unknown): ThresholdObservation[] {
  if (!Array.isArray(input)) {
    throw new InputIssue(['observations'], 'invalid-type', 'observations must be an array');
  }
  const values: readonly unknown[] = input;
  return values.map((value, index) => {
    const observation = object(value, `observations[${index}]`, ['observations', index]);
    const score = observation.score;
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) {
      throw new InputIssue(
        ['observations', index, 'score'],
        typeof score === 'number' ? 'out-of-range' : 'invalid-type',
        'score must be finite and in [0, 1]',
      );
    }
    const correct = observation.correct;
    if (typeof correct !== 'boolean') {
      throw new InputIssue(
        ['observations', index, 'correct'],
        'invalid-type',
        'correct must be a boolean',
      );
    }
    return { score, correct };
  });
}

function readThresholds(input: unknown, observations: readonly ThresholdObservation[]): number[] {
  const options = object(input, 'options');
  const supplied = options.thresholds;
  if (supplied === undefined) {
    return distinctSorted(observations.map((observation) => observation.score));
  }
  if (!Array.isArray(supplied)) {
    throw new InputIssue(['options', 'thresholds'], 'invalid-type', 'thresholds must be an array');
  }
  const thresholds: number[] = [];
  const values: readonly unknown[] = supplied;
  for (const [index, value] of values.entries()) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new InputIssue(
        ['options', 'thresholds', index],
        typeof value === 'number' ? 'out-of-range' : 'invalid-type',
        'threshold must be finite and in [0, 1]',
      );
    }
    thresholds.push(value);
  }
  return distinctSorted(thresholds);
}

function distinctSorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function measurePoint(
  observations: readonly ThresholdObservation[],
  threshold: number,
): ThresholdPoint {
  const covered = observations.filter((observation) => atLeast(observation.score, threshold));
  const correct = covered.filter((observation) => observation.correct).length;
  if (covered.length === 0) {
    return { kind: 'empty', threshold, covered: 0, coverage: 0, correct: 0 };
  }
  const coverage = covered.length / observations.length;
  const precision = correct / covered.length;
  return {
    kind: 'covered',
    threshold,
    covered: covered.length,
    coverage,
    correct,
    precision,
    interval: wilsonInterval(correct, covered.length),
  };
}

function calculateAuroc(observations: readonly ThresholdObservation[]): number | null {
  const correct = observations.filter((observation) => observation.correct);
  const incorrect = observations.filter((observation) => !observation.correct);
  if (correct.length === 0 || incorrect.length === 0) return null;
  let wins = 0;
  for (const right of correct) {
    for (const wrong of incorrect) {
      if (right.score > wrong.score) wins += 1;
      else if (right.score === wrong.score) wins += 0.5;
    }
  }
  return wins / (correct.length * incorrect.length);
}

function wilsonInterval(correct: number, covered: number): WilsonInterval {
  const z = 1.96;
  const zSquared = z ** 2;
  const denominator = 1 + zSquared / covered;
  const centre = (correct / covered + zSquared / (2 * covered)) / denominator;
  const margin =
    (z *
      Math.sqrt(
        ((correct / covered) * (1 - correct / covered) + zSquared / (4 * covered)) / covered,
      )) /
    denominator;
  return { lower: centre - margin, upper: centre + margin };
}
