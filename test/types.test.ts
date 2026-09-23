import {
  analyze, dominant, massSet, parse, type Decision, type JevAnswer, type JevResponse,
} from '../src/index.ts';

// Compile-time consumer contracts; runtime coverage lives beside this file.
export function publicTypes(input: unknown) {
  const decision = analyze({ billing: 0.48, support: 0.44, sales: 0.05, other: 0.03 });
  const option: 'billing' | 'support' | 'sales' | 'other' = decision.top.option;
  // @ts-expect-error Literal option names are preserved.
  const wrong: 'fraud' = decision.top.option;
  // @ts-expect-error Mass-set candidate lists are readonly.
  decision.massSet.options.pop();
  // @ts-expect-error Standalone mass-set summaries are readonly too.
  massSet({ a: 1 }, 1).count = 0;
  const numericKey: '0' | '1' = analyze({ 0: 0.6, 1: 0.4 }).top.option;

  const action = decision.match({
    dominant: d => {
      const name: typeof option = d.leader.option;
      const shape: 'dominant' = d.shape;
      return { kind: 'route', option: name, shape } as const;
    },
    'runner-up': d => ({ kind: 'inspect', option: d.runnerUp.option }) as const,
    contested: d => {
      const pair: readonly [{ readonly option: typeof option }, { readonly option: typeof option }] = d.frontRunners;
      // @ts-expect-error Contested includes exact ties.
      d.leader.option;
      return { kind: 'compare', pair } as const;
    },
    clustered: d => d.contenders.count,
    flat: () => null,
    mixed: async d => d.top.option,
  });
  const output: { readonly kind: 'route' | 'inspect' | 'compare' }
    | number | null | Promise<typeof option> = action;
  // @ts-expect-error match() preserves the union of handler return types.
  const impossible: boolean = action;
  const partial = {
    dominant: () => 'one', 'runner-up': () => 'two', contested: () => 'close',
    clustered: () => 'group', flat: () => 'even',
  };
  // @ts-expect-error Exhaustive matching also requires mixed.
  decision.match(partial);

  if (decision.shape === 'dominant') {
    const leader: typeof option = decision.leader.option;
    void leader;
  }
  if (decision.is(dominant({ floor: 0.6 }))) {
    // @ts-expect-error Structural tests do not narrow the assigned shape.
    const shape: 'dominant' = decision.shape;
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
  const level: '0' | '1' = response.answers.severity.distribution.top.option;
  // @ts-expect-error Known question ids are closed.
  response.answers.missing;
  // @ts-expect-error Known answer kind is preserved.
  response.answers.urgent.choice;
  // @ts-expect-error Answer dictionary is readonly.
  response.answers.route = response.answers.route;

  const unknown = parse(input);
  // @ts-expect-error Unknown JSON requires a missing-id check.
  unknown.answers.route.type;
  const unknownOption: string = analyze(input).top.option;
  // @ts-expect-error Unknown input cannot acquire promised literal names.
  const fabricated: typeof option = analyze(input).top.option;
  void [wrong, numericKey, output, impossible, choice, type, yes, level, unknownOption, fabricated];
}

export function broadRecords(response: JevResponse<Record<string, JevAnswer>>) {
  const result = parse(response);
  // @ts-expect-error Open dictionaries remain potentially missing.
  result.answers.anything.type;
  const answer = result.answers.route;
  if (answer?.type === 'choice') {
    const decision: Decision = answer;
    return decision.is(dominant());
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
  const option: 'red' | 'blue' = analyze(alternatives).top.option;
  // @ts-expect-error Disjoint input keys produce their union, not never.
  const neverOption: never = analyze(alternatives).top.option;
  void [option, neverOption];
}

interface ProbabilityMap { red: number; blue: number }

export function erasedKeys(erased: {}, numeric: Record<number, number>, named: ProbabilityMap) {
  // @ts-expect-error Erased keys cannot promise the impossible never type.
  const neverOption: never = analyze(erased).top.option;
  const possibleName: string = analyze(numeric).top.option;
  // @ts-expect-error Broad numeric keys can stringify to NaN and Infinity as well.
  const narrowNumber: `${number}` = analyze(numeric).top.option;
  const names: 'red' | 'blue' = analyze(named).top.option;
  const subset: readonly { readonly option: 'red' | 'blue' }[] = massSet(named, 0.8).options;
  void [neverOption, possibleName, narrowNumber, names, subset];
}
