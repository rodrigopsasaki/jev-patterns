import { measure } from './distribution.ts';
import type {
  Distribution,
  DistributionData,
  OptionKeys,
  Options,
  Predicate,
  Profile,
} from './model.ts';
import { numericTolerances } from './numeric.ts';

/** Typed probability maps preserve their option names; unknown input is validated at runtime. */
export function analyze<const Input extends object>(
  input: Input & { readonly [Key in keyof Input]: number },
  options?: Options,
): Distribution<OptionKeys<Input>>;
export function analyze(input: unknown, options?: Options): Distribution;
export function analyze(input: unknown, options: Options = {}): Distribution {
  return construct(measure(input, options), options, {});
}

/**
 * Build a Distribution merged with caller-supplied fields (e.g. a Choice answer's `choice`,
 * `confidence` and `raw`) in the same construction step as `analyze()`. This lets `is()`
 * close over the one, already-complete object, so a caller never has to extend a
 * Distribution that analyze() already handed back as finished.
 */
export function analyzeExtended<Extra extends object>(
  input: unknown,
  options: Options,
  extra: Extra,
): Distribution & Extra {
  return construct(measure(input, options), options, extra);
}

function construct<Extra extends object>(
  data: DistributionData,
  options: Options,
  extra: Extra,
): Distribution & Extra {
  const profile: Profile = {
    id: 'descriptive-v3',
    prominenceRatio: options.prominenceRatio ?? 0.5,
    targetMass: options.targetMass ?? 0.8,
    numericTolerances,
  };
  const result: Distribution & Extra = {
    ...data,
    ...extra,
    profile,
    is(predicate: Predicate): boolean {
      return predicate(result);
    },
  };
  return result;
}
