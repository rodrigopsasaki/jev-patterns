import type { Predicate, ShapeThresholds } from './model.ts';
import { atLeast, requireProbability } from './numeric.ts';

/** Provisional descriptive defaults. Version the profile when changing them. */
export const defaultThresholds: ShapeThresholds = Object.freeze({
  dominant: Object.freeze({ floor: 0.8, gap: 0.2 }),
  paired: Object.freeze({ floor: 0.5, secondFloor: 0.2, gap: 0.15 }),
  split: Object.freeze({ gap: 0.1, combinedFloor: 0.75 }),
  clustered: Object.freeze({ minimumCount: 3, combinedFloor: 0.75, ratio: 0.5 }),
  flat: Object.freeze({ minimumRatio: 0.75, minimumCount: 3 }),
});

export function dominant(options: { readonly floor?: number; readonly gap?: number } = {}): Predicate {
  const { floor = defaultThresholds.dominant.floor, gap = defaultThresholds.dominant.gap } = options;
  requireProbability(floor, 'floor');
  requireProbability(gap, 'gap');
  return data => data.uniqueMaximum !== null && atLeast(data.maximumProbability, floor) && atLeast(data.gap, gap);
}

/** gap is a minimum separation; secondFloor is the second-largest probability's floor. */
export function paired(options: {
  readonly floor?: number; readonly secondFloor?: number; readonly gap?: number;
} = {}): Predicate {
  const { floor = defaultThresholds.paired.floor, secondFloor = defaultThresholds.paired.secondFloor,
    gap = defaultThresholds.paired.gap } = options;
  requireProbability(floor, 'floor');
  requireProbability(secondFloor, 'secondFloor');
  requireProbability(gap, 'gap');
  return data => data.uniqueMaximum !== null && data.second !== null
    && atLeast(data.maximumProbability, floor) && atLeast(data.secondProbability, secondFloor)
    && atLeast(data.gap, gap);
}

/** gap bounds the first-to-second difference; combinedFloor bounds their combined probability. */
export function split(options: { readonly gap?: number; readonly combinedFloor?: number } = {}): Predicate {
  const { gap = defaultThresholds.split.gap, combinedFloor = defaultThresholds.split.combinedFloor } = options;
  requireProbability(gap, 'gap');
  requireProbability(combinedFloor, 'combinedFloor');
  return data => data.second !== null && atLeast(gap, data.gap)
    && atLeast(data.metrics.firstTwoProbability, combinedFloor);
}

export function clustered(options: {
  readonly minimumCount?: number; readonly combinedFloor?: number; readonly ratio?: number;
} = {}): Predicate {
  const { minimumCount = defaultThresholds.clustered.minimumCount,
    combinedFloor = defaultThresholds.clustered.combinedFloor, ratio = defaultThresholds.clustered.ratio } = options;
  requireCount(minimumCount);
  requireProbability(combinedFloor, 'combinedFloor');
  requireProbability(ratio, 'ratio');
  if (ratio === 0) throw new TypeError('ratio must be greater than 0');
  return data => {
    const items = data.sorted.filter(item => item.probability > 0
      && atLeast(item.probability / data.maximumProbability, ratio));
    return items.length >= minimumCount && atLeast(items.reduce((total, item) => total + item.probability, 0), combinedFloor);
  };
}

export function flat(options: { readonly minimumRatio?: number; readonly minimumCount?: number } = {}): Predicate {
  const { minimumRatio = defaultThresholds.flat.minimumRatio, minimumCount = defaultThresholds.flat.minimumCount } = options;
  requireProbability(minimumRatio, 'minimumRatio');
  requireCount(minimumCount);
  return data => {
    const positive = data.sorted.filter(item => item.probability > 0);
    const smallest = positive[positive.length - 1];
    return positive.length >= minimumCount && smallest !== undefined
      && atLeast(smallest.probability / data.maximumProbability, minimumRatio);
  };
}

export function maximumProbabilityAtLeast(floor: number): Predicate {
  requireProbability(floor, 'floor');
  return data => atLeast(data.maximumProbability, floor);
}

export function gapAtLeast(gap: number): Predicate {
  requireProbability(gap, 'gap');
  return data => atLeast(data.gap, gap);
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
