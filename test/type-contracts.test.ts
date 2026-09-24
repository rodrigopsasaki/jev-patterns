import {
  analyze,
  type ChoiceAnswer,
  type Distribution,
  type JevAnswer,
  type JevResponse,
  type NoulAnswer,
  type ParsedAnswer,
  parse,
  type ScoreAnswer,
} from '../src/index.ts';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;

// These functions are typechecked, never executed. Exact type comparisons catch
// accidental unknown/any widening that assignment-only checks would miss.
export function exactDistributionContract() {
  const distribution = analyze({ north: 0.64, south: 0.36 });
  type Name = 'north' | 'south';
  const exact: Assert<Equal<typeof distribution, Distribution<Name>>> = true;
  void exact;

  // @ts-expect-error Sorted outcomes cannot be reordered through the public API.
  distribution.sorted.sort();
  // @ts-expect-error Individual outcomes are readonly.
  distribution.first.probability = 1;
  // @ts-expect-error Nested metrics are readonly too.
  distribution.metrics.effectiveOptions.shannon = 1;
  // @ts-expect-error Profile metadata cannot be replaced.
  distribution.profile.numericTolerances.tieAbsolute = 0;
  // @ts-expect-error The complete maximum set is readonly.
  distribution.maxima.push(distribution.first);
}

function parseTyped<const Answers extends Readonly<Record<string, JevAnswer>>>(
  input: JevResponse<Answers>,
) {
  return parse(input);
}

export function genericParseContracts() {
  const response = parseTyped({
    model: 'typed-model',
    usage: { input_tokens: 1, output_tokens: 1 },
    answers: {
      7: {
        type: 'choice',
        choice: 'north',
        confidence: 0.8,
        probabilities: { north: 0.64, south: 0.36 },
      },
      urgent: { type: 'noul', noul: 0.2 },
      severity: {
        type: 'score',
        score: 0.4,
        confidence: 0.8,
        probabilities: { 0: 0.6, 1: 0.4 },
        legend: { 0: 'Low', 1: 'High' },
      },
    },
  });
  const keys: Assert<Equal<keyof typeof response.answers, '7' | 'urgent' | 'severity'>> = true;
  const choice: Assert<Equal<(typeof response.answers)['7'], ChoiceAnswer<'north' | 'south'>>> =
    true;
  const noul: Assert<Equal<typeof response.answers.urgent, NoulAnswer>> = true;
  const score: Assert<Equal<typeof response.answers.severity, ScoreAnswer<'0' | '1'>>> = true;
  // @ts-expect-error Generic parsing preserves readonly answer metadata.
  response.answers['7'].confidence = 0;
  // @ts-expect-error Score legend keys retain the probability level literals.
  response.answers.severity.legend['2'];
  void [keys, choice, noul, score];
}

export function explicitMissingAnswerContracts(
  unknownInput: unknown,
  broad: JevResponse<Record<string, JevAnswer>>,
  numeric: JevResponse<Record<number, JevAnswer>>,
  patterned: JevResponse<Record<`q_${string}`, JevAnswer>>,
) {
  const unknown = parse(unknownInput);
  const open = parseTyped(broad);
  const numbered = parseTyped(numeric);
  const prefixed = parseTyped(patterned);
  // Type-level indexing ensures undefined is explicit in declarations, independent
  // of whether a consumer enables noUncheckedIndexedAccess.
  const unknownAnswer: Assert<Equal<(typeof unknown.answers)[string], ParsedAnswer | undefined>> =
    true;
  const openAnswer: Assert<Equal<(typeof open.answers)[string], ParsedAnswer | undefined>> = true;
  const numericAnswer: Assert<Equal<(typeof numbered.answers)['999'], ParsedAnswer | undefined>> =
    true;
  const patternedAnswer: Assert<
    Equal<(typeof prefixed.answers)['q_missing'], ParsedAnswer | undefined>
  > = true;
  void [unknownAnswer, openAnswer, numericAnswer, patternedAnswer];
}

export function unionAnswerContracts(
  input: JevResponse<{
    item:
      | { type: 'choice'; choice: string; confidence: number; probabilities: { red: number } }
      | { type: 'choice'; choice: string; confidence: number; probabilities: { blue: number } }
      | { type: 'noul'; noul: number };
  }>,
) {
  const response = parseTyped(input);
  const preserved: Assert<
    Equal<typeof response.answers.item, ChoiceAnswer<'red'> | ChoiceAnswer<'blue'> | NoulAnswer>
  > = true;
  if (response.answers.item.type === 'choice') {
    const option: 'red' | 'blue' = response.answers.item.first.option;
    // @ts-expect-error A choice answer has no noul-only yes field.
    response.answers.item.yes;
    void option;
  } else {
    const directions: 'yes' | 'no' = response.answers.item.distribution.first.option;
    void directions;
  }
  void preserved;
}
