import {
  analyze, dominant, massSet, parse, type Distribution, type JevAnswer, type JevResponse,
} from '../src/index.ts';

// Compile-time consumer contracts; runtime coverage lives beside this file.
export function publicTypes(input: unknown) {
  const distribution = analyze({ billing: 0.48, support: 0.44, sales: 0.05, other: 0.03 });
  const option: 'billing' | 'support' | 'sales' | 'other' = distribution.first.option;
  // @ts-expect-error Literal option names are preserved.
  const wrong: 'fraud' = distribution.first.option;
  // @ts-expect-error Mass-set outcome lists are readonly.
  distribution.massSet.options.pop();
  // @ts-expect-error Standalone mass-set summaries are readonly too.
  massSet({ a: 1 }, 1).count = 0;
  const numericKey: '0' | '1' = analyze({ 0: 0.6, 1: 0.4 }).first.option;

  const action = distribution.match({
    dominant: d => {
      const name: typeof option = d.uniqueMaximum.option;
      const shape: 'dominant' = d.shape;
      return { kind: 'route', option: name, shape } as const;
    },
    paired: d => ({ kind: 'inspect', option: d.pair[1].option }) as const,
    split: d => {
      const pair: readonly [{ readonly option: typeof option }, { readonly option: typeof option }] = d.pair;
      // @ts-expect-error Split includes exact ties.
      d.uniqueMaximum.option;
      return { kind: 'compare', pair } as const;
    },
    clustered: d => d.prominent.count,
    flat: () => null,
    mixed: async d => d.first.option,
  });
  const output: { readonly kind: 'route' | 'inspect' | 'compare' }
    | number | null | Promise<typeof option> = action;
  // @ts-expect-error match() preserves the union of handler return types.
  const impossible: boolean = action;
  const partial = {
    dominant: () => 'one', 'paired': () => 'two', split: () => 'close',
    clustered: () => 'group', flat: () => 'even',
  };
  // @ts-expect-error Exhaustive matching also requires mixed.
  distribution.match(partial);

  if (distribution.shape === 'dominant') {
    const uniqueMaximum: typeof option = distribution.uniqueMaximum.option;
    void uniqueMaximum;
  }
  if (distribution.is(dominant({ floor: 0.6 }))) {
    // @ts-expect-error Structural tests do not narrow the assigned shape.
    const shape: 'dominant' = distribution.shape;
    void shape;
  }

  const response = parse({
    model: 'synthetic', usage: { input_tokens: 1, output_tokens: 1 },
    answers: {
      route: { type: 'choice', choice: 'billing', confidence: 0.2,
        probabilities: { billing: 0.48, support: 0.44, sales: 0.05, other: 0.03 } },
      urgent: { type: 'noul', noul: 0.7 },
      severity: { type: 'score', score: 0.4, confidence: 0.3,
        probabilities: { 0: 0.6, 1: 0.4 }, legend: { 0: 'Low', 1: 'High' } },
    },
  });
  const choice: typeof option = response.answers.route.choice;
  const type: 'choice' = response.answers.route.type;
  const yes: number = response.answers.urgent.yes;
  const level: '0' | '1' = response.answers.severity.distribution.first.option;
  // @ts-expect-error Known question ids are closed.
  response.answers.missing;
  // @ts-expect-error Known answer kind is preserved.
  response.answers.urgent.choice;
  // @ts-expect-error Answer dictionary is readonly.
  response.answers.route = response.answers.route;

  const unknown = parse(input);
  // @ts-expect-error Unknown JSON requires a missing-id check.
  unknown.answers.route.type;
  const unknownOption: string = analyze(input).first.option;
  // @ts-expect-error Unknown input cannot acquire promised literal names.
  const fabricated: typeof option = analyze(input).first.option;
  void [wrong, numericKey, output, impossible, choice, type, yes, level, unknownOption, fabricated];
}

export function broadRecords(response: JevResponse<Record<string, JevAnswer>>) {
  const result = parse(response);
  // @ts-expect-error Open dictionaries remain potentially missing.
  result.answers.anything.type;
  const answer = result.answers.route;
  if (answer?.type === 'choice') {
    const distribution: Distribution = answer;
    return distribution.is(dominant());
  }
  return false;
}

export function uncommonRecords(
  numeric: JevResponse<Record<number, JevAnswer>>,
  patterned: JevResponse<Record<`q_${string}`, JevAnswer>>,
  alternatives: { red: number } | { blue: number },
) {
  // @ts-expect-error Numeric index signatures can be absent.
  parse(numeric).answers['999'].type;
  // @ts-expect-error Template index signatures can be absent.
  parse(patterned).answers.q_absent.type;
  const option: 'red' | 'blue' = analyze(alternatives).first.option;
  // @ts-expect-error Disjoint input keys produce their union, not never.
  const neverOption: never = analyze(alternatives).first.option;
  void [option, neverOption];
}

interface ProbabilityMap { red: number; blue: number }

export function erasedKeys(erased: {}, numeric: Record<number, number>, named: ProbabilityMap) {
  // @ts-expect-error Erased keys cannot promise the impossible never type.
  const neverOption: never = analyze(erased).first.option;
  const possibleName: string = analyze(numeric).first.option;
  // @ts-expect-error Broad numeric keys can stringify to NaN and Infinity as well.
  const narrowNumber: `${number}` = analyze(numeric).first.option;
  const names: 'red' | 'blue' = analyze(named).first.option;
  const subset: readonly { readonly option: 'red' | 'blue' }[] = massSet(named, 0.8).options;
  void [neverOption, possibleName, narrowNumber, names, subset];
}
