const SUM_TOLERANCE = 1e-8;
const TIE_TOLERANCE = 1e-12;

export type Shape = 'clear-winner' | 'leader-with-runner-up' | 'close-race'
  | 'several-contenders' | 'flat' | 'mixed';

export interface Candidate {
  readonly option: string;
  readonly probability: number;
}

export interface Options {
  /** Keep options with at least this fraction of the leading probability. */
  readonly contenderRatio?: number;
  /** Model mass requested for the tie-inclusive ranked set, not a coverage guarantee. */
  readonly targetMass?: number;
}

export interface Analysis {
  readonly profile: {
    readonly id: 'descriptive-v0';
    readonly contenderRatio: number;
    readonly targetMass: number;
    readonly shapeThresholds: typeof SHAPE_THRESHOLDS;
  };
  readonly shape: Shape;
  readonly summary: string;
  readonly ranked: readonly Candidate[];
  /** Null if the highest probability is tied (within numeric tolerance). */
  readonly winner: Candidate | null;
  readonly leaders: readonly Candidate[];
  readonly runnerUp: Candidate | null;
  readonly contenders: readonly Candidate[];
  readonly contenderCount: number;
  readonly contenderMass: number;
  readonly excludedMass: number;
  readonly massSet: ReturnType<typeof massSet>;
  readonly metrics: {
    readonly topProbability: number;
    readonly margin: number;
    readonly topTwoMass: number;
    readonly entropyNats: number;
    readonly effectiveOptions: { readonly shannon: number; readonly simpson: number };
  };
  readonly input: { readonly total: number; readonly normalized: boolean };
}

const SHAPE_THRESHOLDS = Object.freeze({
  clearTop: 0.8, clearMargin: 0.2, flatRatio: 0.8,
  closeTopTwoMass: 0.75, closeRatio: 0.8,
  leaderTop: 0.5, runnerUp: 0.2, leaderMargin: 0.15,
  severalRatio: 0.5, severalMass: 0.75,
});

/** Describe a normalized probability map with transparent, versioned heuristics. */
export function analyze(input: unknown, options: Options = {}): Analysis {
  const contenderRatio = options.contenderRatio ?? 0.5;
  const targetMass = options.targetMass ?? 0.8;
  requireFraction(contenderRatio, 'contenderRatio');
  requireFraction(targetMass, 'targetMass');
  const { ranked, total } = readProbabilities(input);
  const first = ranked[0];
  if (!first) throw new TypeError('At least one option is required');
  const second = ranked[1];
  const leaders = ranked.filter(item => tied(item.probability, first.probability));
  const contenders = ranked.filter(item => item.probability > 0
    && item.probability + TIE_TOLERANCE >= contenderRatio * first.probability);
  const contenderMass = bounded(sum(contenders.map(item => item.probability)));
  const entropyNats = sum(ranked.map(item => item.probability === 0
    ? 0 : -item.probability * Math.log(item.probability)));
  const concentration = sum(ranked.map(item => item.probability ** 2));
  const margin = first.probability - (second?.probability ?? 0);
  const shape = classify(ranked);
  return {
    profile: { id: 'descriptive-v0', contenderRatio, targetMass, shapeThresholds: SHAPE_THRESHOLDS },
    shape,
    summary: `${humanShape(shape)}. ${contenders.length} contender${contenders.length === 1 ? '' : 's'} under the ${contenderRatio} relative rule, carrying ${(100 * contenderMass).toFixed(1)}% of model probability; ${(100 * (1 - contenderMass)).toFixed(1)}% elsewhere.`,
    ranked, winner: leaders.length === 1 ? first : null, leaders,
    runnerUp: second ?? null, contenders, contenderCount: contenders.length,
    contenderMass, excludedMass: bounded(1 - contenderMass),
    massSet: selectMassSet(ranked, targetMass),
    metrics: {
      topProbability: first.probability, margin,
      topTwoMass: bounded(first.probability + (second?.probability ?? 0)),
      entropyNats,
      effectiveOptions: { shannon: Math.exp(entropyNats), simpson: 1 / concentration },
    },
    input: { total, normalized: total !== 1 },
  };
}

/** Ranked prefix reaching targetMass, expanded to retain ties at the boundary. */
export function massSet(input: unknown, targetMass: number) {
  requireFraction(targetMass, 'targetMass');
  return selectMassSet(readProbabilities(input).ranked, targetMass);
}

function selectMassSet(ranked: readonly Candidate[], targetMass: number) {
  const options: Candidate[] = [];
  let boundary: number | undefined;
  let total = 0;
  for (const item of ranked) {
    if (item.probability === 0) break;
    if (boundary !== undefined && !tied(item.probability, boundary)) break;
    options.push(item);
    total += item.probability;
    if (boundary === undefined && (total >= targetMass || 1 - total <= Number.EPSILON)) {
      boundary = item.probability;
    }
  }
  return { options, count: options.length, mass: bounded(total), targetMass,
    excludedMass: bounded(1 - total) };
}

function classify(ranked: readonly Candidate[]): Shape {
  const top = ranked[0]?.probability ?? 0;
  const second = ranked[1]?.probability ?? 0;
  const positive = ranked.filter(item => item.probability > 0);
  const smallest = positive[positive.length - 1]?.probability ?? 0;
  const t = SHAPE_THRESHOLDS;
  if (atLeast(top, t.clearTop) && atLeast(top - second, t.clearMargin)) return 'clear-winner';
  if (positive.length >= 3 && atLeast(smallest / top, t.flatRatio)) return 'flat';
  if (atLeast(top + second, t.closeTopTwoMass) && atLeast(second / top, t.closeRatio)) return 'close-race';
  if (atLeast(top, t.leaderTop) && atLeast(second, t.runnerUp)
    && atLeast(top - second, t.leaderMargin)) return 'leader-with-runner-up';
  const several = positive.filter(item => atLeast(item.probability / top, t.severalRatio));
  if (several.length >= 3 && atLeast(sum(several.map(item => item.probability)), t.severalMass)) {
    return 'several-contenders';
  }
  return 'mixed';
}

function humanShape(shape: Shape): string {
  switch (shape) {
    case 'clear-winner': return 'Clear winner';
    case 'leader-with-runner-up': return 'Leader with a runner-up';
    case 'close-race': return 'Close race';
    case 'several-contenders': return 'Several contenders';
    case 'flat': return 'Flat distribution';
    case 'mixed': return 'Mixed distribution';
  }
}

function readProbabilities(input: unknown) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('probabilities must be a nonempty map');
  }
  const entries = Object.entries(input);
  if (entries.length === 0) throw new TypeError('probabilities must be nonempty');
  const ranked = entries.map(([option, probability]) => {
    if (typeof probability !== 'number' || !Number.isFinite(probability)
      || probability < 0 || probability > 1) {
      throw new TypeError(`Probability for ${JSON.stringify(option)} must be finite and in [0, 1]`);
    }
    return { option, probability };
  });
  // Fix the accumulation order as well as the display order for reproducibility.
  ranked.sort((a, b) => b.probability - a.probability || compareKeys(a.option, b.option));
  const total = sum(ranked.map(item => item.probability));
  if (total <= 0 || Math.abs(total - 1) > SUM_TOLERANCE) {
    throw new TypeError(`Probabilities must sum to 1; received ${total}`);
  }
  return { ranked: ranked.map(item => ({ ...item, probability: item.probability / total })), total };
}

function requireFraction(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new TypeError(`${name} must be in (0, 1]`);
  }
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
function bounded(value: number): number { return Math.min(1, Math.max(0, value)); }
function tied(a: number, b: number): boolean { return Math.abs(a - b) <= TIE_TOLERANCE; }
function atLeast(a: number, b: number): boolean { return a + TIE_TOLERANCE >= b; }
function compareKeys(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
