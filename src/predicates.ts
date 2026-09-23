import type { Predicate, ShapeThresholds } from './model.ts';
import { atLeast, requireProbability } from './numeric.ts';

/** Provisional descriptive defaults. Version the profile when changing them. */
export const defaultThresholds: ShapeThresholds = Object.freeze({
  dominant: Object.freeze({ floor: 0.8, margin: 0.2 }),
  runnerUp: Object.freeze({ floor: 0.5, alternativeFloor: 0.2, margin: 0.15 }),
  contested: Object.freeze({ margin: 0.1, combinedFloor: 0.75 }),
  clustered: Object.freeze({ minimumCount: 3, combinedFloor: 0.75, ratio: 0.5 }),
  flat: Object.freeze({ minimumRatio: 0.75, minimumCount: 3 }),
});

export function dominant(options: { readonly floor?: number; readonly margin?: number } = {}): Predicate {
  const floor = requireProbability(options.floor ?? defaultThresholds.dominant.floor, 'floor');
  const margin = requireProbability(options.margin ?? defaultThresholds.dominant.margin, 'margin');
  return data => data.leader !== null && atLeast(data.topProbability, floor) && atLeast(data.margin, margin);
}

/** margin is a minimum lead; alternativeFloor is the runner-up's minimum probability. */
export function runnerUp(options: {
  readonly floor?: number; readonly alternativeFloor?: number; readonly margin?: number;
} = {}): Predicate {
  const floor = requireProbability(options.floor ?? defaultThresholds.runnerUp.floor, 'floor');
  const alternative = requireProbability(options.alternativeFloor ?? defaultThresholds.runnerUp.alternativeFloor, 'alternativeFloor');
  const margin = requireProbability(options.margin ?? defaultThresholds.runnerUp.margin, 'margin');
  return data => data.leader !== null && data.runnerUp !== null
    && atLeast(data.topProbability, floor) && atLeast(data.runnerUpProbability, alternative)
    && atLeast(data.margin, margin);
}

/** margin is a maximum gap; combinedFloor excludes two small peaks in a long tail. */
export function contested(options: { readonly margin?: number; readonly combinedFloor?: number } = {}): Predicate {
  const margin = requireProbability(options.margin ?? defaultThresholds.contested.margin, 'margin');
  const combined = requireProbability(options.combinedFloor ?? defaultThresholds.contested.combinedFloor, 'combinedFloor');
  return data => data.runnerUp !== null && atLeast(margin, data.margin)
    && atLeast(data.metrics.topTwoProbability, combined);
}

export function clustered(options: {
  readonly minimumCount?: number; readonly combinedFloor?: number; readonly ratio?: number;
} = {}): Predicate {
  const count = requireCount(options.minimumCount ?? defaultThresholds.clustered.minimumCount);
  const combined = requireProbability(options.combinedFloor ?? defaultThresholds.clustered.combinedFloor, 'combinedFloor');
  const ratio = requireProbability(options.ratio ?? defaultThresholds.clustered.ratio, 'ratio');
  if (ratio === 0) throw new TypeError('ratio must be greater than 0');
  return data => {
    const items = data.ranked.filter(item => item.probability > 0
      && atLeast(item.probability / data.topProbability, ratio));
    return items.length >= count && atLeast(items.reduce((total, item) => total + item.probability, 0), combined);
  };
}

export function flat(options: { readonly minimumRatio?: number; readonly minimumCount?: number } = {}): Predicate {
  const ratio = requireProbability(options.minimumRatio ?? defaultThresholds.flat.minimumRatio, 'minimumRatio');
  const count = requireCount(options.minimumCount ?? defaultThresholds.flat.minimumCount);
  return data => {
    const positive = data.ranked.filter(item => item.probability > 0);
    const smallest = positive[positive.length - 1];
    return positive.length >= count && smallest !== undefined
      && atLeast(smallest.probability / data.topProbability, ratio);
  };
}

export function topProbabilityAtLeast(floor: number): Predicate {
  requireProbability(floor, 'floor');
  return data => atLeast(data.topProbability, floor);
}

export function marginAtLeast(margin: number): Predicate {
  requireProbability(margin, 'margin');
  return data => atLeast(data.margin, margin);
}

export function allOf(...predicates: readonly Predicate[]): Predicate {
  return data => predicates.every(predicate => predicate(data));
}

export function anyOf(...predicates: readonly Predicate[]): Predicate {
  return data => predicates.some(predicate => predicate(data));
}

export function not(predicate: Predicate): Predicate {
  return data => !predicate(data);
}

function requireCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 2) throw new TypeError('minimumCount must be an integer >= 2');
  return value;
}
