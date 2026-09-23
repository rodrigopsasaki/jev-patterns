import { measure } from './distribution.ts';
import type {
  Distribution, DistributionData, DistributionShape, MatchHandlers,
  OptionKeys, Options, Predicate, Profile, ShapeDetails,
} from './model.ts';
import { numericTolerances } from './numeric.ts';
import { clustered, split, defaultThresholds, dominant, flat, paired } from './predicates.ts';

const shapes: readonly DistributionShape[] = ['dominant', 'paired', 'split', 'clustered', 'flat', 'mixed'];
const isDominant = dominant();
const isFlat = flat();
const isSplit = split();
const isPaired = paired();
const isClustered = clustered();

/** Typed probability maps preserve their option names; unknown input is validated at runtime. */
export function analyze<const Input extends object>(
  input: Input & { readonly [Key in keyof Input]: number }, options?: Options,
): Distribution<OptionKeys<Input>>;
export function analyze(input: unknown, options?: Options): Distribution;
export function analyze(input: unknown, options: Options = {}): Distribution {
  const data = measure(input, options);
  const details = describe(data);
  const profile: Profile = {
    id: 'descriptive-v2', prominenceRatio: options.prominenceRatio ?? 0.5,
    targetMass: options.targetMass ?? 0.8, thresholds: defaultThresholds, numericTolerances,
  };
  const result: Distribution = {
    ...data, ...details, profile,
    summary: summary(data, details.shape),
    is(predicate: Predicate): boolean { return predicate(result); },
    match<const Handlers extends MatchHandlers>(handlers: Handlers): ReturnType<Handlers[DistributionShape]> {
      // dispatch returns exactly the selected handler's value. TypeScript loses that
      // return-type correlation when invoking a handler from the mapped dictionary.
      return dispatch(result, handlers) as ReturnType<Handlers[DistributionShape]>;
    },
  };
  return result;
}

function describe(data: DistributionData): ShapeDetails<string> {
  if (isDominant(data) && data.uniqueMaximum !== null) return { shape: 'dominant', uniqueMaximum: data.uniqueMaximum };
  if (isFlat(data)) return { shape: 'flat' };
  // A prominent third outcome takes precedence over a small gap between the first two.
  if (isClustered(data)) return { shape: 'clustered' };
  if (isSplit(data) && data.second !== null) {
    return { shape: 'split', second: data.second, pair: [data.first, data.second] };
  }
  if (isPaired(data) && data.uniqueMaximum !== null && data.second !== null) {
    return { shape: 'paired', uniqueMaximum: data.uniqueMaximum, second: data.second,
      pair: [data.first, data.second] };
  }
  return { shape: 'mixed' };
}

function dispatch<Option extends string>(
  distribution: Distribution<Option>, handlers: MatchHandlers<Option>,
): unknown {
  for (const shape of shapes) {
    if (handlers === null || (typeof handlers !== 'object' && typeof handlers !== 'function')
      || !Object.hasOwn(handlers, shape) || typeof handlers[shape] !== 'function') {
      throw new TypeError(`match() requires a handler for ${JSON.stringify(shape)}`);
    }
  }
  switch (distribution.shape) {
    case 'dominant': return handlers.dominant(distribution);
    case 'paired': return handlers.paired(distribution);
    case 'split': return handlers.split(distribution);
    case 'clustered': return handlers.clustered(distribution);
    case 'flat': return handlers.flat(distribution);
    case 'mixed': return handlers.mixed(distribution);
  }
}

function summary(data: DistributionData, shape: DistributionShape): string {
  const first = JSON.stringify(data.first.option);
  const second = JSON.stringify(data.second?.option);
  switch (shape) {
    case 'dominant': return `${percent(data.maximumProbability)} of model probability is concentrated on ${first}.`;
    case 'paired': return `${first} and ${second} account for ${percent(data.maximumProbability)} and ${percent(data.secondProbability)} of model probability: two substantial, unequal shares.`;
    case 'split': return `Model probability is split between ${first} (${percent(data.maximumProbability)}) and ${second} (${percent(data.secondProbability)}), with ${percent(1 - data.metrics.firstTwoProbability)} elsewhere.`;
    case 'clustered': return 'Several outcomes carry most of the probability under the descriptive profile.';
    case 'flat': return 'The positive probabilities are similar in size under the descriptive profile.';
    case 'mixed': return 'The distribution does not fit a named pattern under the descriptive profile.';
  }
}

function percent(value: number): string { return `${(value * 100).toFixed(1)}%`; }
