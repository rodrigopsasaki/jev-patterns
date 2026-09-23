export type DistributionShape =
  | 'dominant'
  | 'runner-up'
  | 'contested'
  | 'clustered'
  | 'flat'
  | 'mixed';

export type OptionKeys<Input> = Input extends unknown
  ? [keyof Input] extends [never] ? string
    : number extends keyof Input ? string
    : `${Extract<keyof Input, string | number>}`
  : never;

export interface Candidate<Option extends string = string> {
  readonly option: Option;
  readonly probability: number;
}

export interface Options {
  readonly contenderRatio?: number;
  readonly targetMass?: number;
}

export interface Contenders<Option extends string = string> {
  readonly items: readonly Candidate<Option>[];
  readonly count: number;
  readonly probability: number;
  readonly remainingProbability: number;
}

export interface MassSet<Option extends string = string> {
  readonly options: readonly Candidate<Option>[];
  readonly count: number;
  readonly mass: number;
  readonly targetMass: number;
  readonly excludedMass: number;
}

/** Observations only. A predicate never receives authority to accept or reject. */
export interface DistributionData<Option extends string = string> {
  readonly ranked: readonly Candidate<Option>[];
  /** First in deterministic rank order; consult leaders for ties. */
  readonly top: Candidate<Option>;
  /** The unique highest-probability option, or null for a tie. */
  readonly leader: Candidate<Option> | null;
  readonly leaders: readonly Candidate<Option>[];
  readonly runnerUp: Candidate<Option> | null;
  readonly topProbability: number;
  readonly runnerUpProbability: number;
  readonly margin: number;
  readonly contenders: Contenders<Option>;
  readonly massSet: MassSet<Option>;
  readonly metrics: {
    readonly topTwoProbability: number;
    readonly entropyNats: number;
    readonly effectiveOptions: { readonly shannon: number; readonly simpson: number };
  };
  readonly input: { readonly total: number; readonly normalized: boolean };
}

export type Predicate = (distribution: DistributionData) => boolean;

export interface ShapeThresholds {
  readonly dominant: { readonly floor: number; readonly margin: number };
  readonly runnerUp: { readonly floor: number; readonly alternativeFloor: number; readonly margin: number };
  readonly contested: { readonly margin: number; readonly combinedFloor: number };
  readonly clustered: { readonly minimumCount: number; readonly combinedFloor: number; readonly ratio: number };
  readonly flat: { readonly minimumRatio: number; readonly minimumCount: number };
}

export interface Profile {
  readonly id: 'descriptive-v1';
  readonly contenderRatio: number;
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
  | { readonly shape: 'dominant'; readonly leader: Candidate<Option> }
  | { readonly shape: 'runner-up'; readonly leader: Candidate<Option>; readonly runnerUp: Candidate<Option> }
  | { readonly shape: 'contested'; readonly runnerUp: Candidate<Option>;
      readonly frontRunners: readonly [Candidate<Option>, Candidate<Option>] }
  | { readonly shape: 'clustered' }
  | { readonly shape: 'flat' }
  | { readonly shape: 'mixed' };

export type MatchHandlers<Option extends string = string> = {
  readonly [Shape in DistributionShape]: (decision: DecisionFor<Shape, Option>) => unknown;
};

export type DecisionFor<Shape extends DistributionShape, Option extends string = string> =
  Extract<Decision<Option>, { readonly shape: Shape }>;

export type Decision<Option extends string = string> = DistributionData<Option>
  & ShapeDetails<Option>
  & {
    readonly profile: Profile;
    readonly summary: string;
    /** Structural tests can overlap and do not change the assigned shape. */
    is(predicate: Predicate): boolean;
    /** Calls exactly one application-supplied handler; preserves its return value. */
    match<const Handlers extends MatchHandlers<Option>>(
      handlers: Handlers,
    ): ReturnType<Handlers[DistributionShape]>;
  };
