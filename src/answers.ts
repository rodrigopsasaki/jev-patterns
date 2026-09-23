import { analyze } from './analysis.ts';
import type { Distribution, OptionKeys, Options } from './model.ts';
import { InputIssue, object, probability, text } from './validation.ts';

export interface JevChoiceAnswer {
  readonly type: 'choice';
  readonly choice: string;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
}

export interface JevNoulAnswer {
  readonly type: 'noul';
  readonly noul: number;
}

export interface JevScoreAnswer {
  readonly type: 'score';
  readonly score: number;
  readonly confidence: number;
  readonly legend: Readonly<Record<string, string>>;
  readonly probabilities: Readonly<Record<string, number>>;
}

export type JevAnswer = JevChoiceAnswer | JevNoulAnswer | JevScoreAnswer;

export interface JevResponse<Answers extends Readonly<Record<string, JevAnswer>>> {
  readonly model: string;
  readonly usage: { readonly input_tokens: number; readonly output_tokens: number };
  readonly answers: Answers;
}

export type ChoiceAnswer<
  Option extends string = string,
  Confidence extends number | null = number,
> = Distribution<Option> & {
  readonly type: 'choice';
  /** The provider's original choice, including its tie-breaking choice. */
  readonly choice: Option;
  readonly confidence: Confidence;
  readonly raw: Readonly<Record<string, unknown>>;
};

export interface NoulAnswer {
  readonly type: 'noul';
  readonly yes: number;
  readonly no: number;
  readonly distribution: Distribution<'yes' | 'no'>;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface ScoreAnswer<
  Level extends string = string,
  Confidence extends number | null = number,
> {
  readonly type: 'score';
  readonly score: number;
  readonly confidence: Confidence;
  readonly legend: Readonly<Record<Level, string>>;
  readonly expectedLevel: number;
  readonly scoreDifference: number;
  readonly distribution: Distribution<Level>;
  readonly raw: Readonly<Record<string, unknown>>;
}

export type ParsedAnswer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

export type ParsedAnswerFor<Answer extends JevAnswer> = Answer extends JevChoiceAnswer
  ? ChoiceAnswer<OptionKeys<Answer['probabilities']>>
  : Answer extends JevNoulAnswer
    ? NoulAnswer
    : Answer extends JevScoreAnswer
      ? ScoreAnswer<OptionKeys<Answer['probabilities']>>
      : never;

export type InspectedChoice<Option extends string = string> = ChoiceAnswer<Option, number | null>;
export type InspectedScore<Level extends string = string> = ScoreAnswer<Level, number | null>;
export type InspectedAnswer = InspectedChoice | NoulAnswer | InspectedScore;

export interface UnavailableAnswer {
  readonly kind: 'unavailable';
  readonly reason: 'distribution-not-provided';
  readonly raw: Readonly<Record<string, unknown>>;
}

// One reader for strict wire parsing and nullable adapter answers. The overloads
// preserve strict confidence types; only the inspection mode permits absence.
export function readAnswer(input: unknown, options: Options, inspect: false): ParsedAnswer;
export function readAnswer(
  input: unknown,
  options: Options,
  inspect: true,
): InspectedAnswer | UnavailableAnswer;
export function readAnswer(
  input: unknown,
  options: Options,
  inspect: boolean,
): InspectedAnswer | UnavailableAnswer {
  const answer = object(input, 'answer', []);
  const raw = structuredClone(answer);
  if (answer.type === 'noul') {
    const yes = probability(answer.noul, 'noul');
    return {
      type: 'noul',
      yes,
      no: 1 - yes,
      distribution: analyze({ yes, no: 1 - yes }, options),
      raw,
    };
  }
  if (answer.type !== 'choice' && answer.type !== 'score') {
    throw new InputIssue(['type'], 'invalid-type', 'type must be choice, score or noul');
  }
  const confidence =
    inspect && answer.confidence == null ? null : probability(answer.confidence, 'confidence');
  if (inspect && answer.probabilities == null) {
    // Even without a distribution, malformed provider fields are still errors.
    // Score adapters may omit both distribution and legend; never invent levels.
    if (answer.type === 'choice') text(answer.choice, 'choice');
    else {
      const legend = answer.legend == null ? null : readLegend(answer.legend);
      readScore(answer.score, legend === null ? Infinity : Object.keys(legend).length - 1);
    }
    return { kind: 'unavailable', reason: 'distribution-not-provided', raw };
  }
  const distribution = analyze(answer.probabilities, options);
  if (answer.type === 'choice') {
    const choice = text(answer.choice, 'choice');
    if (!distribution.maxima.some((item) => item.option === choice)) {
      throw new InputIssue(
        ['choice'],
        'inconsistent-answer',
        'choice must be a highest-probability option',
      );
    }
    return Object.assign(distribution, { type: 'choice' as const, choice, confidence, raw });
  }
  const legend = readLegend(answer.legend);
  const levelCount = Object.keys(legend).length;
  if (
    distribution.sorted.length !== levelCount ||
    distribution.sorted.some((item) => !Object.hasOwn(legend, item.option))
  ) {
    throw new InputIssue(
      ['probabilities'],
      'inconsistent-answer',
      'probabilities must contain every legend level and no extra keys',
    );
  }
  const score = readScore(answer.score, levelCount - 1);
  const expectedLevel = distribution.sorted.reduce(
    (total, item) => total + Number(item.option) * item.probability,
    0,
  );
  return {
    type: 'score',
    score,
    confidence,
    legend,
    distribution,
    expectedLevel,
    scoreDifference: score - expectedLevel,
    raw,
  };
}

function readLegend(input: unknown): Record<string, string> {
  const legendInput = object(input, 'legend');
  const levelCount = Object.keys(legendInput).length;
  if (levelCount < 2 || levelCount > 10) {
    throw new InputIssue(['legend'], 'out-of-range', 'score must have 2–10 levels');
  }
  return Object.fromEntries(
    Array.from({ length: levelCount }, (_, index) => {
      const key = String(index);
      if (!Object.hasOwn(legendInput, key)) {
        throw new InputIssue(
          ['legend'],
          'inconsistent-answer',
          'legend keys must be consecutive from 0',
        );
      }
      return [key, text(legendInput[key], `legend[${key}]`, ['legend', key])];
    }),
  );
}

function readScore(value: unknown, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    throw new InputIssue(
      ['score'],
      typeof value === 'number' ? 'out-of-range' : 'invalid-type',
      'score must lie within the level range',
    );
  }
  return value;
}
