import type {
  DistributionData,
  MassSet,
  OptionKeys,
  Options,
  Outcome,
  RankOptions,
} from './model.ts';
import { atLeast, bounded, numericTolerances } from './numeric.ts';
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
 * `rank()`'s result option type. Subtracting `Excluded[number]` from the option union is
 * only sound when every excluded member is known at the type level, which needs two things:
 * a statically known length (a tuple, not a plain array — `string[]`'s length is `number`,
 * not a literal) and statically known members (every element a literal, not widened to
 * plain `string` — `[CONST, someStringVariable]` is still a fixed-length tuple, but its
 * second slot's type is the whole `string` vocabulary, not one value from it). Failing
 * either check, narrowing would either collapse an open `string` vocabulary to `never`
 * (nothing could ever be excluded away entirely) or claim members of a closed union are
 * impossible when only some of that union's values are actually excluded at runtime. In
 * both failure cases the option type stays the full `RankOption<Input>`. `const Excluded`
 * at the call site still infers a literal tuple of literal members for an inline
 * `exclude: ['other']`, so that narrowing is unaffected.
 */
type RankedOption<
  Input,
  Excluded extends readonly RankOption<Input>[],
> = number extends Excluded['length']
  ? RankOption<Input>
  : string extends Excluded[number]
    ? RankOption<Input>
    : Exclude<RankOption<Input>, Excluded[number]>;

/**
 * Order any map of probability-like scores in [0, 1], optionally excluding some labels
 * (e.g. an "other" catch-all or a none-sentinel) and keeping only the top `limit`.
 * Ranking is invariant to scale, so unlike `analyze()`/`massSet()`, `rank()` does not
 * require the map to be nonempty or sum to 1: it accepts unnormalized judge estimates
 * (e.g. a model only asked for "roughly sums to 1") as well as full distributions, and
 * an empty map ranks to `[]`. Values come back exactly as given — never rescaled — and
 * tie-breaking (probability desc, then option key asc) matches `analyze()`/`massSet()`.
 * Probabilities are not renormalized after exclusion: a returned entry keeps its
 * original probability, exclusion only filters which entries appear. There is no
 * separate "top-1 excluding X" helper; that is `rank(p, { exclude, limit: 1 })[0]`.
 */
export function rank<
  const Input,
  const Excluded extends readonly RankOption<Input>[] = readonly [],
>(
  input: RankInput<Input>,
  options?: RankOptions<Excluded>,
): readonly Outcome<RankedOption<Input, Excluded>>[];
export function rank(input: unknown, options: RankOptions = {}): readonly Outcome[] {
  const { exclude, limit } = options;
  if (limit !== undefined) requireLimit(limit);
  const sorted = parseOutcomes(input);
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

/**
 * The validation and deterministic ordering every probability-map entry point shares:
 * a plain object, per-value finite-in-[0,1] checks, sorted probability desc then option
 * key asc. Ranking needs nothing more than this. `readProbabilities()` layers the
 * nonempty/sum/rescale requirements that `analyze()`/`massSet()` additionally need on
 * top of it.
 */
function parseOutcomes(input: unknown): { option: string; probability: number }[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InputIssue(
      ['probabilities'],
      'invalid-type',
      'probabilities must be a map of option to probability',
    );
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
  return sorted;
}

function readProbabilities(input: unknown) {
  // These outcome objects are owned by this function, never borrowed from input.
  const sorted = parseOutcomes(input);
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
function tied(a: number, b: number): boolean {
  return Math.abs(a - b) <= numericTolerances.tieAbsolute;
}
function compareKeys(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}
