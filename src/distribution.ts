import type { Candidate, DistributionData, MassSet, OptionKeys, Options } from './model.ts';
import { atLeast, numericTolerances } from './numeric.ts';

/** Describe a normalized probability map with transparent, versioned heuristics. */
export function measure(input: unknown, options: Options = {}): DistributionData {
  const contenderRatio = options.contenderRatio ?? 0.5;
  const targetMass = options.targetMass ?? 0.8;
  requireFraction(contenderRatio, 'contenderRatio');
  requireFraction(targetMass, 'targetMass');
  const { ranked, total } = readProbabilities(input);
  const first = ranked[0];
  if (!first) throw new TypeError('At least one option is required');
  const second = ranked[1];
  const leaders = ranked.filter(item => tied(item.probability, first.probability));
  const contenders = selectContenders(ranked, first.probability, contenderRatio);
  const contenderMass = bounded(sum(contenders.map(item => item.probability)));
  const entropyNats = sum(ranked.map(item => item.probability === 0
    ? 0 : -item.probability * Math.log(item.probability)));
  const concentration = sum(ranked.map(item => item.probability ** 2));
  const margin = first.probability - (second?.probability ?? 0);
  return {
    ranked, top: first, leader: leaders.length === 1 ? first : null, leaders,
    runnerUp: second ?? null,
    topProbability: first.probability, runnerUpProbability: second?.probability ?? 0, margin,
    contenders: { items: contenders, count: contenders.length, probability: contenderMass,
      remainingProbability: bounded(1 - contenderMass) },
    massSet: selectMassSet(ranked, targetMass),
    metrics: {
      topTwoProbability: bounded(first.probability + (second?.probability ?? 0)),
      entropyNats,
      effectiveOptions: { shannon: Math.exp(entropyNats), simpson: 1 / concentration },
    },
    input: { total, normalized: total !== 1 },
  };
}

/** Ranked prefix reaching targetMass, expanded to retain ties at the boundary. */
export function massSet<const Input extends object>(
  input: Input & { readonly [Key in keyof Input]: number }, targetMass: number,
): MassSet<OptionKeys<Input>>;
export function massSet(input: unknown, targetMass: number): MassSet;
export function massSet(input: unknown, targetMass: number): MassSet {
  requireFraction(targetMass, 'targetMass');
  return selectMassSet(readProbabilities(input).ranked, targetMass);
}

function selectMassSet(ranked: readonly Candidate[], targetMass: number): MassSet {
  const options: Candidate[] = [];
  let boundary: number | undefined;
  let total = 0;
  for (const item of ranked) {
    if (item.probability === 0) break;
    if (boundary !== undefined && !tied(item.probability, boundary)) break;
    options.push(item);
    total += item.probability;
    // A full-mass request always retains every positive entry, even sub-ULP tails.
    if (targetMass < 1 && boundary === undefined && total + numericTolerances.massBoundaryAbsolute >= targetMass) {
      boundary = item.probability;
    }
  }
  return { options, count: options.length, mass: bounded(total), targetMass,
    excludedMass: bounded(1 - total) };
}

function selectContenders(ranked: readonly Candidate[], top: number, ratio: number): Candidate[] {
  return ranked.filter(item => item.probability > 0 && atLeast(item.probability / top, ratio));
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
  if (total <= 0 || Math.abs(total - 1) > numericTolerances.inputSumAbsolute) {
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
function tied(a: number, b: number): boolean { return Math.abs(a - b) <= numericTolerances.tieAbsolute; }
function compareKeys(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
