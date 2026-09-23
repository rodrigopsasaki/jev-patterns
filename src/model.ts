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

export type MatchHandlers<Option extends string = string> = {
  readonly [Shape in DistributionShape]: (distribution: DistributionFor<Shape, Option>) => unknown;
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
    match<const Handlers extends MatchHandlers<Option>>(
      handlers: Handlers,
    ): ReturnType<Handlers[DistributionShape]>;
  };
