import type {
  InspectedAnswer,
  InspectedChoice,
  InspectedScore,
  JevChoiceAnswer,
  JevNoulAnswer,
  JevScoreAnswer,
  NoulAnswer,
  UnavailableAnswer,
} from './answers.ts';
import { readAnswer } from './answers.ts';
import { validateOptions } from './distribution.ts';
import type { OptionKeys, Options } from './model.ts';
import { InputIssue, type InspectionIssue } from './validation.ts';

/** Adapter inputs may omit provider confidence and probability maps. */
export type InspectableChoice = Omit<JevChoiceAnswer, 'confidence' | 'probabilities'> & {
  readonly confidence?: number | null | undefined;
  readonly probabilities?: Readonly<Record<string, number>> | null | undefined;
};
export type InspectableScore = Omit<JevScoreAnswer, 'confidence' | 'probabilities' | 'legend'> & {
  readonly confidence?: number | null | undefined;
  readonly probabilities?: Readonly<Record<string, number>> | null | undefined;
  readonly legend?: Readonly<Record<string, string>> | null | undefined;
};
export type InspectableAnswer = InspectableChoice | JevNoulAnswer | InspectableScore;

type AnswerOptions<Input> = Input extends { readonly probabilities?: infer Probabilities }
  ? [NonNullable<Probabilities>] extends [never]
    ? string
    : OptionKeys<NonNullable<Probabilities>>
  : string;

export type InspectedAnswerFor<Input> = unknown extends Input
  ? InspectedAnswer
  : Input extends InspectableChoice
    ? InspectedChoice<AnswerOptions<Input>>
    : Input extends JevNoulAnswer
      ? NoulAnswer
      : Input extends InspectableScore
        ? InspectedScore<AnswerOptions<Input>>
        : Input extends undefined
          ? never
          : InspectedAnswer;

export type Inspection<Answer = InspectedAnswer> =
  | { readonly kind: 'available'; readonly answer: Answer }
  | { readonly kind: 'missing' }
  | UnavailableAnswer
  | { readonly kind: 'invalid'; readonly issues: readonly [InspectionIssue, ...InspectionIssue[]] };

/**
 * Inspect one decoded answer without manufacturing a response envelope.
 * Expected data failures are values. Invalid options and exceptions from
 * executable inputs (e.g. throwing getters) remain caller errors.
 */
export function inspectAnswer<const Input>(
  input: Input,
  options?: Options,
): Inspection<InspectedAnswerFor<Input>>;
export function inspectAnswer(input: unknown, options: Options = {}): Inspection {
  validateOptions(options);
  if (input === undefined) return { kind: 'missing' };
  try {
    const answer = readAnswer(input, options, true);
    return 'kind' in answer ? answer : { kind: 'available', answer };
  } catch (error) {
    if (error instanceof InputIssue) return { kind: 'invalid', issues: [error.issue] };
    if (error instanceof DOMException && error.name === 'DataCloneError') {
      return {
        kind: 'invalid',
        issues: [{ path: [], code: 'invalid-type', message: 'answer must contain cloneable data' }],
      };
    }
    throw error;
  }
}
