import { analyze } from './analysis.ts';
import type { Distribution, OptionKeys, Options } from './model.ts';

export interface JevChoiceAnswer {
  readonly type: 'choice';
  readonly choice: string;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
}

export interface JevNoulAnswer { readonly type: 'noul'; readonly noul: number }

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

export type ChoiceAnswer<Option extends string = string> = Distribution<Option> & {
  readonly type: 'choice';
  /** The provider's original choice, including its tie-breaking choice. */
  readonly choice: Option;
  readonly confidence: number;
  readonly raw: Readonly<Record<string, unknown>>;
};

export interface NoulAnswer {
  readonly type: 'noul';
  readonly yes: number;
  readonly no: number;
  readonly distribution: Distribution<'yes' | 'no'>;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface ScoreAnswer<Level extends string = string> {
  readonly type: 'score';
  readonly score: number;
  readonly confidence: number;
  readonly legend: Readonly<Record<Level, string>>;
  readonly expectedLevel: number;
  readonly scoreDifference: number;
  readonly distribution: Distribution<Level>;
  readonly raw: Readonly<Record<string, unknown>>;
}

export type ParsedAnswer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

type ParsedAnswerFor<Answer extends JevAnswer> =
  Answer extends JevChoiceAnswer ? ChoiceAnswer<OptionKeys<Answer['probabilities']>>
  : Answer extends JevNoulAnswer ? NoulAnswer
  : Answer extends JevScoreAnswer ? ScoreAnswer<OptionKeys<Answer['probabilities']>>
  : never;

type ParsedAnswers<Answers extends Readonly<Record<string, JevAnswer>>> = {
  readonly [Key in keyof Answers as Key extends string | number ? `${Key}` : never]:
    {} extends Pick<Answers, Key>
      ? ParsedAnswerFor<Answers[Key]> | undefined
      : ParsedAnswerFor<Answers[Key]>;
};

export interface ParsedResponse<Answers = Readonly<Record<string, ParsedAnswer | undefined>>> {
  readonly model: string;
  readonly usage: { readonly input_tokens: number; readonly output_tokens: number };
  readonly answers: Answers;
  readonly raw: Readonly<Record<string, unknown>>;
}

/** Parse decoded Jev JSON. Await the SDK or HTTP call before calling this function. */
export function parse<const Answers extends Readonly<Record<string, JevAnswer>>>(
  input: JevResponse<Answers>, options?: Options,
): ParsedResponse<ParsedAnswers<Answers>>;
export function parse(input: unknown, options?: Options): ParsedResponse;
export function parse(input: unknown, options: Options = {}): ParsedResponse {
  const response = object(input, 'response');
  const model = text(response.model, 'model');
  const usage = object(response.usage, 'usage');
  const inputTokens = tokenCount(usage.input_tokens, 'usage.input_tokens');
  const outputTokens = tokenCount(usage.output_tokens, 'usage.output_tokens');
  const answers = object(response.answers, 'answers');
  if (Object.keys(answers).length === 0) throw new TypeError('answers must be nonempty');
  const parsedAnswers: Record<string, ParsedAnswer> = Object.fromEntries(Object.entries(answers).map(([id, answer]) => {
    try { return [id, parseAnswer(answer, options)]; }
    catch (error) {
      throw new TypeError(`answers[${JSON.stringify(id)}]: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));
  Object.setPrototypeOf(parsedAnswers, null);
  return {
    model, usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    answers: parsedAnswers,
    raw: structuredClone(response),
  };
}

function parseAnswer(input: unknown, options: Options): ParsedAnswer {
  const answer = object(input, 'answer');
  const raw = structuredClone(answer);
  if (answer.type === 'noul') {
    const yes = probability(answer.noul, 'noul');
    return { type: 'noul', yes, no: 1 - yes,
      distribution: analyze({ yes, no: 1 - yes }, options), raw };
  }
  if (answer.type !== 'choice' && answer.type !== 'score') {
    throw new TypeError('type must be choice, score or noul');
  }
  const confidence = probability(answer.confidence, 'confidence');
  const distribution = analyze(answer.probabilities, options);
  if (answer.type === 'choice') {
    const choice = text(answer.choice, 'choice');
    if (!distribution.maxima.some(item => item.option === choice)) {
      throw new TypeError('choice must be a highest-probability option');
    }
    const provider = { type: 'choice' as const, choice, confidence, raw };
    return Object.assign(distribution, provider);
  }
  const legendInput = object(answer.legend, 'legend');
  const levelCount = Object.keys(legendInput).length;
  if (levelCount < 2 || levelCount > 10) throw new TypeError('score must have 2–10 levels');
  const legend = Object.fromEntries(Array.from({ length: levelCount }, (_, index) => {
    const key = String(index);
    if (!Object.hasOwn(legendInput, key)) throw new TypeError('legend keys must be consecutive from 0');
    return [key, text(legendInput[key], `legend[${key}]`)];
  }));
  if (distribution.sorted.length !== levelCount
    || distribution.sorted.some(item => !Object.hasOwn(legend, item.option))) {
    throw new TypeError('probabilities must contain every legend level and no extra keys');
  }
  const score = answer.score;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > levelCount - 1) {
    throw new TypeError('score must lie within the level range');
  }
  const expectedLevel = distribution.sorted.reduce((total, item) => total + Number(item.option) * item.probability, 0);
  return { type: 'score', score, confidence, legend, distribution,
    expectedLevel, scoreDifference: score - expectedLevel, raw };
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError(`${name} must be a decoded JSON object`);
  }
  return Object.fromEntries(Object.entries(value));
}
function text(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  return value;
}
function probability(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`${name} must be finite and in [0, 1]`);
  }
  return value;
}
function tokenCount(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a nonnegative safe integer`);
  }
  return value;
}
