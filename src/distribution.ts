import type { DistributionData, MassSet, OptionKeys, Options, Outcome } from './model.ts';
import { atLeast, numericTolerances } from './numeric.ts';
import { InputIssue } from './validation.ts';

/** Describe a normalized probability map with transparent, versioned heuristics. */
export function measure(input: unknown, options: Options = {}): DistributionData {
  const { prominenceRatio = 0.5, targetMass = 0.8 } = options;
  validateOptions(options);
  const { sorted, total, first } = readProbabilities(input);
  const second = sorted[1];
  const maxima = sorted.filter((item) => tied(item.probability, first.probability));
  const prominent = selectProminent(sorted, first.probability, prominenceRatio);
  const prominentProbability = bounded(sum(prominent.map((item) => item.probability)));
  const entropyNats = sum(
    sorted.map((item) =>
      item.probability === 0 ? 0 : -item.probability * Math.log(item.probability),
    ),
  );
  const concentration = sum(sorted.map((item) => item.probability ** 2));
  const gap = first.probability - (second?.probability ?? 0);
  return {
    sorted,
    first,
    uniqueMaximum: maxima.length === 1 ? first : null,
    maxima,
    second: second ?? null,
    maximumProbability: first.probability,
    secondProbability: second?.probability ?? 0,
    gap,
    prominent: {
      items: prominent,
      count: prominent.length,
      probability: prominentProbability,
      remainingProbability: bounded(1 - prominentProbability),
    },
    massSet: selectMassSet(sorted, targetMass),
    metrics: {
      firstTwoProbability: bounded(first.probability + (second?.probability ?? 0)),
      entropyNats,
      effectiveOptions: { shannon: Math.exp(entropyNats), simpson: 1 / concentration },
    },
    input: { total, normalized: total !== 1 },
  };
}

/** Ranked prefix reaching targetMass, expanded to retain ties at the boundary. */
export function massSet<const Input extends object>(
  input: Input & { readonly [Key in keyof Input]: number },
  targetMass: number,
): MassSet<OptionKeys<Input>>;
export function massSet(input: unknown, targetMass: number): MassSet;
export function massSet(input: unknown, targetMass: number): MassSet {
  requireFraction(targetMass, 'targetMass');
  return selectMassSet(readProbabilities(input).sorted, targetMass);
}

function selectMassSet(sorted: readonly Outcome[], targetMass: number): MassSet {
  const options: Outcome[] = [];
  let boundary: number | undefined;
  let total = 0;
  for (const item of sorted) {
    if (item.probability === 0) break;
    if (boundary !== undefined && !tied(item.probability, boundary)) break;
    options.push(item);
    total += item.probability;
    // A full-mass request always retains every positive entry, even sub-ULP tails.
    if (
      targetMass < 1 &&
      boundary === undefined &&
      total + numericTolerances.massBoundaryAbsolute >= targetMass
    ) {
      boundary = item.probability;
    }
  }
  return {
    options,
    count: options.length,
    mass: bounded(total),
    targetMass,
    excludedMass: bounded(1 - total),
  };
}

function selectProminent(sorted: readonly Outcome[], first: number, ratio: number): Outcome[] {
  return sorted.filter((item) => item.probability > 0 && atLeast(item.probability / first, ratio));
}

function readProbabilities(input: unknown) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InputIssue(['probabilities'], 'invalid-type', 'probabilities must be a nonempty map');
  }
  const entries = Object.entries(input);
  const sorted = entries.map(([option, probability]) => {
    if (
      typeof probability !== 'number' ||
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 1
    ) {
      throw new InputIssue(
        ['probabilities', option],
        typeof probability === 'number' ? 'out-of-range' : 'invalid-type',
        `Probability for ${JSON.stringify(option)} must be finite and in [0, 1]`,
      );
    }
    return { option, probability };
  });
  // Fix the accumulation order as well as the display order for reproducibility.
  sorted.sort((a, b) => b.probability - a.probability || compareKeys(a.option, b.option));
  const first = sorted[0];
  if (!first)
    throw new InputIssue(['probabilities'], 'invalid-total', 'probabilities must be nonempty');
  const total = sum(sorted.map((item) => item.probability));
  if (total <= 0 || Math.abs(total - 1) > numericTolerances.inputSumAbsolute) {
    throw new InputIssue(
      ['probabilities'],
      'invalid-total',
      `Probabilities must sum to 1; received ${total}`,
    );
  }
  // These outcome objects are owned by this function, never borrowed from input.
  for (const item of sorted) item.probability /= total;
  return { sorted, total, first };
}

export function validateOptions(options: Options): void {
  const { prominenceRatio = 0.5, targetMass = 0.8 } = options;
  requireFraction(prominenceRatio, 'prominenceRatio');
  requireFraction(targetMass, 'targetMass');
}

function requireFraction(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new TypeError(`${name} must be in (0, 1]`);
  }
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
function bounded(value: number): number {
  return Math.min(1, Math.max(0, value));
}
function tied(a: number, b: number): boolean {
  return Math.abs(a - b) <= numericTolerances.tieAbsolute;
}
function compareKeys(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}
