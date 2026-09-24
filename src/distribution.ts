import type {
  DistributionData,
  MassSet,
  OptionKeys,
  Options,
  Outcome,
  RankOptions,
} from './model.ts';
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
    // Summation-order float drift (e.g. 0.1 + 0.2 + 0.7) can leave `total` a few ULPs
    // off 1 without the caller's data actually being unnormalized; only report
    // normalization once the drift exceeds the declared tolerance. Rescaling below
    // still runs unconditionally: dividing by a total within noise of 1 is a no-op in
    // practice, and a single code path avoids a second, untested branch.
    input: { total, normalized: Math.abs(total - 1) > numericTolerances.normalizedAbsolute },
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

/**
 * The option vocabulary `rank()` can exclude against: a typed input's own option keys, or
 * (for untyped/`unknown` input, which has no closed vocabulary to check against) `string`.
 * A single generic signature — rather than a typed overload plus an `unknown` fallback —
 * so that excluding a literal outside a typed input's option keys is a compile error at
 * this call, not a silent, more-permissive match against a second overload.
 */
type RankOption<Input> = Input extends object ? OptionKeys<Input> : string;

/**
 * A typed probability map's values must be numbers, same as `analyze()`/`massSet()`;
 * `unknown`/untyped input (which has no closed vocabulary to check anyway) passes through.
 */
type RankInput<Input> = Input extends object
  ? Input & { readonly [Key in keyof Input]: number }
  : Input;

/**
 * Rank options by probability, excluding some labels (e.g. an "other" catch-all or a
 * none-sentinel) and optionally keeping only the top `limit`. Shares `analyze()`'s
 * validation and tie-breaking order. Probabilities are not renormalized after exclusion:
 * a returned entry keeps its original model probability, exclusion only filters which
 * entries appear. There is no separate "top-1 excluding X" helper; that is
 * `rank(p, { exclude, limit: 1 })[0]`.
 */
export function rank<
  const Input,
  const Excluded extends readonly RankOption<Input>[] = readonly [],
>(
  input: RankInput<Input>,
  options?: RankOptions<Excluded>,
): readonly Outcome<Exclude<RankOption<Input>, Excluded[number]>>[];
export function rank(input: unknown, options: RankOptions = {}): readonly Outcome[] {
  const { exclude, limit } = options;
  if (limit !== undefined) requireLimit(limit);
  const { sorted } = readProbabilities(input);
  if (exclude === undefined) return limit === undefined ? sorted : sorted.slice(0, limit);
  const excluded = new Set(exclude);
  const filtered = sorted.filter((item) => !excluded.has(item.option));
  return limit === undefined ? filtered : filtered.slice(0, limit);
}

function requireLimit(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError('limit must be a positive safe integer');
  }
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
