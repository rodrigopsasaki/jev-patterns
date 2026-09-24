export type DistributionShape = 'dominant' | 'paired' | 'split' | 'clustered' | 'flat' | 'mixed';

export type OptionKeys<Input> = Input extends unknown
  ? [keyof Input] extends [never]
    ? string
    : number extends keyof Input
      ? string
      : `${Extract<keyof Input, string | number>}`
  : never;

export interface Outcome<Option extends string = string> {
  readonly option: Option;
  readonly probability: number;
}

export interface Options {
  readonly prominenceRatio?: number;
  readonly targetMass?: number;
}

export interface ProbabilityGroup<Option extends string = string> {
  readonly items: readonly Outcome<Option>[];
  readonly count: number;
  readonly probability: number;
  readonly remainingProbability: number;
}

export interface MassSet<Option extends string = string> {
  readonly options: readonly Outcome<Option>[];
  readonly count: number;
  readonly mass: number;
  readonly targetMass: number;
  readonly excludedMass: number;
}

/** Observations only. A predicate never receives authority to accept or reject. */
export interface DistributionData<Option extends string = string> {
  readonly sorted: readonly Outcome<Option>[];
  /** First in descending probability order; consult maxima for ties. */
  readonly first: Outcome<Option>;
  /** The unique highest-probability option, or null for a tie. */
  readonly uniqueMaximum: Outcome<Option> | null;
  readonly maxima: readonly Outcome<Option>[];
  readonly second: Outcome<Option> | null;
  readonly maximumProbability: number;
  readonly secondProbability: number;
  readonly gap: number;
  readonly prominent: ProbabilityGroup<Option>;
  readonly massSet: MassSet<Option>;
  readonly metrics: {
    readonly firstTwoProbability: number;
    readonly entropyNats: number;
    readonly effectiveOptions: { readonly shannon: number; readonly simpson: number };
  };
  readonly input: { readonly total: number; readonly normalized: boolean };
}

export type Predicate = (distribution: DistributionData) => boolean;

export interface ShapeThresholds {
  readonly dominant: { readonly floor: number; readonly gap: number };
  readonly paired: { readonly floor: number; readonly secondFloor: number; readonly gap: number };
  readonly split: { readonly gap: number; readonly combinedFloor: number };
  readonly clustered: {
    readonly minimumCount: number;
    readonly combinedFloor: number;
    readonly ratio: number;
  };
  readonly flat: { readonly minimumRatio: number; readonly minimumCount: number };
}

export interface Profile {
  readonly id: 'descriptive-v2';
  readonly prominenceRatio: number;
  readonly targetMass: number;
  readonly thresholds: ShapeThresholds;
  readonly numericTolerances: {
    readonly inputSumAbsolute: number;
    readonly tieAbsolute: number;
    readonly thresholdRelative: number;
    readonly massBoundaryAbsolute: number;
    readonly normalizedAbsolute: number;
  };
}

export type ShapeDetails<Option extends string> =
  | { readonly shape: 'dominant'; readonly uniqueMaximum: Outcome<Option> }
  | {
      readonly shape: 'paired';
      readonly uniqueMaximum: Outcome<Option>;
      readonly second: Outcome<Option>;
      readonly pair: readonly [Outcome<Option>, Outcome<Option>];
    }
  | {
      readonly shape: 'split';
      readonly second: Outcome<Option>;
      readonly pair: readonly [Outcome<Option>, Outcome<Option>];
    }
  | { readonly shape: 'clustered' }
  | { readonly shape: 'flat' }
  | { readonly shape: 'mixed' };

/** A handler's declared return type per shape; defaulted to `unknown` when unconstrained. */
export type ShapeResults = { readonly [Shape in DistributionShape]: unknown };

/**
 * Ranging over `keyof R` (rather than the fixed `DistributionShape` union) makes this a
 * homomorphic mapped type in `R`, so TypeScript's reverse mapped-type inference recovers `R`
 * from the actual handler object passed to `match()` — the return-type correlation `match()`
 * needs, without a cast (see `Distribution.match`).
 */
export type MatchHandlers<Option extends string = string, R extends ShapeResults = ShapeResults> = {
  readonly [Shape in keyof R]: (
    distribution: DistributionFor<Shape & DistributionShape, Option>,
  ) => R[Shape];
};

export type DistributionFor<
  Shape extends DistributionShape,
  Option extends string = string,
> = Extract<Distribution<Option>, { readonly shape: Shape }>;

export type Distribution<Option extends string = string> = DistributionData<Option> &
  ShapeDetails<Option> & {
    readonly profile: Profile;
    readonly summary: string;
    /** Structural tests can overlap and do not change the assigned shape. */
    is(predicate: Predicate): boolean;
    /** Calls exactly one application-supplied handler; preserves its return value. */
    match<const R extends ShapeResults>(handlers: MatchHandlers<Option, R>): R[DistributionShape];
  };
