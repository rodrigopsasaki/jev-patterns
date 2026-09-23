import {
  analyze, parse,
  type ChoiceAnswer, type DistributionFor, type JevAnswer, type JevResponse,
  type MatchHandlers, type NoulAnswer, type Outcome, type ParsedAnswer, type ScoreAnswer,
} from '../src/index.ts';

type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;
type Assert<Value extends true> = Value;

// These functions are typechecked, never executed. Exact type comparisons catch
// accidental unknown/any widening that assignment-only checks would miss.
export function exactMatchContracts() {
  const distribution = analyze({ north: 0.64, south: 0.36 });
  type Name = 'north' | 'south';
  const result = distribution.match({
    dominant: value => {
      const narrowed: Assert<Equal<typeof value, DistributionFor<'dominant', Name>>> = true;
      void narrowed;
      return { kind: 'dominant', option: value.uniqueMaximum.option } as const;
    },
    paired: value => {
      const narrowed: Assert<Equal<typeof value, DistributionFor<'paired', Name>>> = true;
      // @ts-expect-error The pair is a readonly tuple.
      value.pair[0] = value.second;
      void narrowed;
      return Promise.resolve({ kind: 'paired', pair: value.pair } as const);
    },
    split: value => {
      const narrowed: Assert<Equal<typeof value, DistributionFor<'split', Name>>> = true;
      // @ts-expect-error A pair always has exactly two entries.
      value.pair[2];
      void narrowed;
      return 7 as const;
    },
    clustered: value => {
      const narrowed: Assert<Equal<typeof value, DistributionFor<'clustered', Name>>> = true;
      // @ts-expect-error Clustered distributions do not promise a pair.
      value.pair;
      void narrowed;
      return undefined;
    },
    flat: value => {
      const narrowed: Assert<Equal<typeof value, DistributionFor<'flat', Name>>> = true;
      void narrowed;
      return null;
    },
    mixed: value => {
      const narrowed: Assert<Equal<typeof value, DistributionFor<'mixed', Name>>> = true;
      void narrowed;
      return false as const;
    },
  });
  type Expected = { readonly kind: 'dominant'; readonly option: Name }
    | Promise<{ readonly kind: 'paired'; readonly pair: readonly [Outcome<Name>, Outcome<Name>] }>
    | 7 | undefined | null | false;
  const exact: Assert<Equal<typeof result, Expected>> = true;
  // @ts-expect-error match does not automatically await asynchronous handlers.
  const implicitlyAwaited: Awaited<Expected> = result;
  // @ts-expect-error A mixed result is not automatically wrapped in a Promise.
  const implicitlyWrapped: Promise<Awaited<Expected>> = result;
  void [exact, implicitlyAwaited, implicitlyWrapped];

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

export function invalidHandlerContracts(
  missingPaired: Omit<MatchHandlers<'north' | 'south'>, 'paired'>,
  wrongShape: Omit<MatchHandlers<'north' | 'south'>, 'paired'> & {
    paired: (value: DistributionFor<'split', 'north' | 'south'>) => void;
  },
  notCallable: Omit<MatchHandlers<'north' | 'south'>, 'flat'> & { flat: number },
) {
  const distribution = analyze({ north: 0.64, south: 0.36 });
  // @ts-expect-error Every variant must have its own callback, even if unlikely for this input.
  distribution.match(missingPaired);
  // @ts-expect-error A handler cannot require the wrong discriminated shape.
  distribution.match(wrongShape);
  // @ts-expect-error Handler values must be callable.
  distribution.match(notCallable);
}

export function callableContainerContract() {
  const distribution = analyze({ north: 0.64, south: 0.36 });
  const handlers = Object.assign(() => 'container-return' as const, {
    dominant: value => value.uniqueMaximum.option,
    paired: value => value.pair[1].option,
    split: () => null,
    clustered: () => null,
    flat: () => null,
    mixed: () => null,
  } satisfies MatchHandlers<'north' | 'south'>);
  const result = distribution.match(handlers);
  // The container's own return type is unrelated to its handler return values.
  const exact: Assert<Equal<typeof result, 'north' | 'south' | null>> = true;
  void exact;
}

function parseTyped<const Answers extends Readonly<Record<string, JevAnswer>>>(input: JevResponse<Answers>) {
  return parse(input);
}

export function genericParseContracts() {
  const response = parseTyped({
    model: 'typed-model', usage: { input_tokens: 1, output_tokens: 1 },
    answers: {
      7: { type: 'choice', choice: 'north', confidence: 0.8,
        probabilities: { north: 0.64, south: 0.36 } },
      urgent: { type: 'noul', noul: 0.2 },
      severity: { type: 'score', score: 0.4, confidence: 0.8,
        probabilities: { 0: 0.6, 1: 0.4 }, legend: { 0: 'Low', 1: 'High' } },
    },
  });
  const keys: Assert<Equal<keyof typeof response.answers, '7' | 'urgent' | 'severity'>> = true;
  const choice: Assert<Equal<typeof response.answers['7'], ChoiceAnswer<'north' | 'south'>>> = true;
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
  const unknownAnswer: Assert<Equal<typeof unknown.answers[string], ParsedAnswer | undefined>> = true;
  const openAnswer: Assert<Equal<typeof open.answers[string], ParsedAnswer | undefined>> = true;
  const numericAnswer: Assert<Equal<typeof numbered.answers['999'], ParsedAnswer | undefined>> = true;
  const patternedAnswer: Assert<Equal<typeof prefixed.answers['q_missing'], ParsedAnswer | undefined>> = true;
  void [unknownAnswer, openAnswer, numericAnswer, patternedAnswer];
}

export function unionAnswerContracts(input: JevResponse<{
  item: { type: 'choice'; choice: string; confidence: number; probabilities: { red: number } }
    | { type: 'choice'; choice: string; confidence: number; probabilities: { blue: number } }
    | { type: 'noul'; noul: number };
}>) {
  const response = parseTyped(input);
  const preserved: Assert<Equal<typeof response.answers.item,
    ChoiceAnswer<'red'> | ChoiceAnswer<'blue'> | NoulAnswer>> = true;
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
