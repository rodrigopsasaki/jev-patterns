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

export interface RankOptions<Excluded extends readonly string[] = readonly string[]> {
  readonly exclude?: Excluded;
  readonly limit?: number;
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

export interface Profile {
  readonly id: 'descriptive-v3';
  readonly prominenceRatio: number;
  readonly targetMass: number;
  readonly numericTolerances: {
    readonly inputSumAbsolute: number;
    readonly tieAbsolute: number;
    readonly thresholdRelative: number;
    readonly massBoundaryAbsolute: number;
    readonly normalizedAbsolute: number;
  };
}

export type Distribution<Option extends string = string> = DistributionData<Option> & {
  readonly profile: Profile;
  /** Structural tests over the distribution's shape; see the predicate factories' own docs. */
  is(predicate: Predicate): boolean;
};
