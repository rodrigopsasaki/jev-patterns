import { measure } from './distribution.ts';
import type {
  Decision, DistributionData, DistributionShape, MatchHandlers,
  OptionKeys, Options, Predicate, Profile, ShapeDetails,
} from './model.ts';
import { numericTolerances } from './numeric.ts';
import { clustered, contested, defaultThresholds, dominant, flat, runnerUp } from './predicates.ts';

const shapes: readonly DistributionShape[] = ['dominant', 'runner-up', 'contested', 'clustered', 'flat', 'mixed'];
const isDominant = dominant();
const isFlat = flat();
const isContested = contested();
const hasRunnerUp = runnerUp();
const isClustered = clustered();

/** Typed probability maps preserve their option names; unknown input is validated at runtime. */
export function analyze<const Input extends object>(
  input: Input & { readonly [Key in keyof Input]: number }, options?: Options,
): Decision<OptionKeys<Input>>;
export function analyze(input: unknown, options?: Options): Decision;
export function analyze(input: unknown, options: Options = {}): Decision {
  const data = measure(input, options);
  const details = describe(data);
  const profile: Profile = {
    id: 'descriptive-v1', contenderRatio: options.contenderRatio ?? 0.5,
    targetMass: options.targetMass ?? 0.8, thresholds: defaultThresholds, numericTolerances,
  };
  const result: Decision = {
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
  if (isDominant(data) && data.leader !== null) return { shape: 'dominant', leader: data.leader };
  if (isFlat(data)) return { shape: 'flat' };
  // A meaningful third contender takes precedence over a narrow top-two gap.
  if (isClustered(data)) return { shape: 'clustered' };
  if (isContested(data) && data.runnerUp !== null) {
    return { shape: 'contested', runnerUp: data.runnerUp, frontRunners: [data.top, data.runnerUp] };
  }
  if (hasRunnerUp(data) && data.leader !== null && data.runnerUp !== null) {
    return { shape: 'runner-up', leader: data.leader, runnerUp: data.runnerUp };
  }
  return { shape: 'mixed' };
}

function dispatch<Option extends string>(
  decision: Decision<Option>, handlers: MatchHandlers<Option>,
): unknown {
  for (const shape of shapes) {
    if (handlers === null || typeof handlers !== 'object'
      || !Object.hasOwn(handlers, shape) || typeof handlers[shape] !== 'function') {
      throw new TypeError(`match() requires a handler for ${JSON.stringify(shape)}`);
    }
  }
  switch (decision.shape) {
    case 'dominant': return handlers.dominant(decision);
    case 'runner-up': return handlers['runner-up'](decision);
    case 'contested': return handlers.contested(decision);
    case 'clustered': return handlers.clustered(decision);
    case 'flat': return handlers.flat(decision);
    case 'mixed': return handlers.mixed(decision);
  }
}

function summary(data: DistributionData, shape: DistributionShape): string {
  const top = JSON.stringify(data.top.option);
  const second = JSON.stringify(data.runnerUp?.option);
  switch (shape) {
    case 'dominant': return `${top} dominates with ${percent(data.topProbability)} of model probability.`;
    case 'runner-up': return `${top} leads; ${second} remains a meaningful alternative at ${percent(data.runnerUpProbability)}.`;
    case 'contested': return `${top} and ${second} are close contenders, together accounting for ${percent(data.metrics.topTwoProbability)} of model probability.`;
    case 'clustered': return 'Several options form a plausible group under the descriptive profile.';
    case 'flat': return 'Probability is spread evenly enough that no option stands clearly apart.';
    case 'mixed': return 'The distribution does not fit a named pattern under the descriptive profile.';
  }
}

function percent(value: number): string { return `${(value * 100).toFixed(1)}%`; }
