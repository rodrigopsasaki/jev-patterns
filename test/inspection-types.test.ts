import {
  dominant,
  type InspectableAnswer,
  type InspectedAnswer,
  type InspectedAnswerFor,
  type InspectedChoice,
  type InspectedScore,
  type Inspection,
  inspectAnswer,
  type NoulAnswer,
  parse,
} from '../src/index.ts';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

export function literalInspection() {
  const result = inspectAnswer({
    type: 'choice',
    choice: 'S1',
    confidence: null,
    probabilities: { S1: 0.51, S2: 0.45, none: 0.04 },
  });
  const exact: Assert<Equal<typeof result, Inspection<InspectedChoice<'S1' | 'S2' | 'none'>>>> =
    true;
  // @ts-expect-error Outcomes must be narrowed before reading an answer.
  result.answer.first;
  if (result.kind === 'available') {
    const value = result.answer;
    const confidence: Assert<Equal<typeof value.confidence, number | null>> = true;
    // @ts-expect-error Nullable confidence cannot clear a numeric gate without narrowing.
    const certain: number = value.confidence;
    // @ts-expect-error Outcomes are readonly, including their elements.
    value.first.probability = 1;
    // @ts-expect-error Raw snapshots are readonly at the top level.
    value.raw.confidence = 1;
    const concentrated: Assert<Equal<ReturnType<typeof value.is>, boolean>> = true;
    const structural: boolean = value.is(dominant());
    if (value.maximumProbability >= 0.5 && value.second !== null) {
      const names: readonly ['S1' | 'S2' | 'none', 'S1' | 'S2' | 'none'] = [
        value.first.option,
        value.second.option,
      ];
      void names;
    }
    // @ts-expect-error Observations are readonly.
    // biome-ignore lint/correctness/noSelfAssign: the assignment itself is the point of the check.
    value.first = value.first;
    void [confidence, certain, concentrated, structural];
  }
  void exact;
}

export function scoreAndNoulInspection() {
  const score = inspectAnswer({
    type: 'score',
    score: 0.6,
    probabilities: { 0: 0.4, 1: 0.6 },
    legend: { 0: 'Low', 1: 'High' },
  });
  const scoreType: Assert<Equal<typeof score, Inspection<InspectedScore<'0' | '1'>>>> = true;
  const noul = inspectAnswer({ type: 'noul', noul: 0.8 });
  const noulType: Assert<Equal<typeof noul, Inspection<NoulAnswer>>> = true;
  if (noul.kind === 'available') {
    const direction: 'yes' | 'no' = noul.answer.distribution.first.option;
    // @ts-expect-error Noul has no separate confidence.
    noul.answer.confidence;
    void direction;
  }
  if (score.kind === 'available') {
    // @ts-expect-error Nonexistent level names are rejected.
    score.answer.legend['2'];
    const level: '0' | '1' = score.answer.distribution.first.option;
    void level;
  }
  void [scoreType, noulType];
}

// Mirrors a vendor-neutral port; no dependency on that port or its application.
type AdapterChoice = {
  readonly type: 'choice';
  readonly choice: string;
  readonly probabilities: Readonly<Record<string, number>> | null;
  readonly confidence: number | null;
};
type AdapterScore = {
  readonly type: 'score';
  readonly score: number;
  readonly probabilities: Readonly<Record<number, number>> | null;
  readonly confidence: number | null;
  readonly legend: Readonly<Record<number, string>> | null;
  readonly topLevel: number | null;
};

export function adapterContracts(
  choice: AdapterChoice | undefined,
  score: AdapterScore | undefined,
) {
  const choiceResult = inspectAnswer(choice);
  const scoreResult = inspectAnswer(score);
  const choiceType: Assert<Equal<typeof choiceResult, Inspection<InspectedChoice>>> = true;
  const scoreType: Assert<Equal<typeof scoreResult, Inspection<InspectedScore>>> = true;
  const map: ReadonlyMap<string, AdapterChoice> = new Map();
  const inspections = new Map([...map].map(([id, answer]) => [id, inspectAnswer(answer)]));
  const one = inspections.get('missing');
  const mapped: Assert<Equal<typeof one, Inspection<InspectedChoice> | undefined>> = true;
  void [choiceType, scoreType, mapped];
}

function inspectTyped<const Input extends InspectableAnswer | undefined>(input: Input) {
  return inspectAnswer(input);
}

export function unionAndUnknownContracts(
  input:
    | { type: 'choice'; choice: string; probabilities: { a: number } | null }
    | { type: 'choice'; choice: string; probabilities: { b: number } }
    | { type: 'noul'; noul: number }
    | undefined,
  unknown: unknown,
) {
  const result = inspectTyped(input);
  const union: Assert<
    Equal<typeof result, Inspection<InspectedChoice<'a'> | InspectedChoice<'b'> | NoulAnswer>>
  > = true;
  const fromUnknown = inspectAnswer(unknown);
  const broad: Assert<Equal<typeof fromUnknown, Inspection<InspectedAnswer>>> = true;
  if (fromUnknown.kind === 'available' && fromUnknown.answer.type === 'choice') {
    const option: string = fromUnknown.answer.first.option;
    // @ts-expect-error Unknown input cannot create a closed vocabulary.
    const literal: 'a' = option;
    void literal;
  }
  const nullable = inspectAnswer({ type: 'choice', choice: 'a', probabilities: null });
  const absent = inspectAnswer({ type: 'choice', choice: 'a' });
  const missing = inspectAnswer(undefined);
  const nullableType: Assert<Equal<typeof nullable, Inspection<InspectedChoice>>> = true;
  const absentType: Assert<Equal<typeof absent, Inspection<InspectedChoice>>> = true;
  const missingType: Assert<Equal<typeof missing, Inspection<never>>> = true;
  const generic: InspectedAnswerFor<typeof input> | undefined = undefined;
  void [union, broad, nullableType, absentType, missingType, generic];
}

export function exhaustiveInspection(result: Inspection) {
  switch (result.kind) {
    case 'available':
      return result.answer;
    case 'missing':
      return null;
    case 'unavailable': {
      const reason: 'distribution-not-provided' = result.reason;
      // @ts-expect-error No analysis is fabricated for an unavailable answer.
      result.answer;
      void reason;
      return result.raw;
    }
    case 'invalid': {
      const path: readonly (string | number)[] = result.issues[0].path;
      // @ts-expect-error Issues are readonly.
      result.issues.push(result.issues[0]);
      // @ts-expect-error Issue paths cannot be rewritten.
      result.issues[0].path.push('a');
      return path;
    }
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export function strictParseStillHasNumericConfidence() {
  const result = parse({
    model: 'synthetic',
    usage: { input_tokens: 0, output_tokens: 0 },
    answers: { q: { type: 'choice', choice: 'a', probabilities: { a: 1 }, confidence: 0.3 } },
  });
  const confidence: Assert<Equal<typeof result.answers.q.confidence, number>> = true;
  void confidence;
}

export async function promiseComposition() {
  const result = await Promise.resolve({
    type: 'choice' as const,
    choice: 'a',
    probabilities: { a: 0.9, b: 0.1 },
  }).then(inspectAnswer);
  const exact: Assert<Equal<typeof result, Inspection<InspectedChoice<'a' | 'b'>>>> = true;
  void exact;
}
