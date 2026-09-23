import type { JevAnswer, JevResponse, ParsedAnswer, ParsedAnswerFor } from './answers.ts';
import { readAnswer } from './answers.ts';
import type { Options } from './model.ts';
import { object, text } from './validation.ts';

export type {
  ChoiceAnswer,
  JevAnswer,
  JevChoiceAnswer,
  JevNoulAnswer,
  JevResponse,
  JevScoreAnswer,
  NoulAnswer,
  ParsedAnswer,
  ScoreAnswer,
} from './answers.ts';

type ParsedAnswers<Answers extends Readonly<Record<string, JevAnswer>>> = {
  readonly [Key in keyof Answers as Key extends string | number ? `${Key}` : never]: Record<
    never,
    never
  > extends Pick<Answers, Key>
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
  input: JevResponse<Answers>,
  options?: Options,
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
  const parsedAnswers: Record<string, ParsedAnswer> = Object.fromEntries(
    Object.entries(answers).map(([id, answer]) => {
      try {
        return [id, readAnswer(answer, options, false)];
      } catch (error) {
        throw new TypeError(
          `answers[${JSON.stringify(id)}]: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
  );
  Object.setPrototypeOf(parsedAnswers, null);
  return {
    model,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    answers: parsedAnswers,
    raw: structuredClone(response),
  };
}

function tokenCount(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a nonnegative safe integer`);
  }
  return value;
}
