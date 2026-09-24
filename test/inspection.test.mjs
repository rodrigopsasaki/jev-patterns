import assert from 'node:assert/strict';
import { test } from 'vitest';
import { analyze, dominant, inspectAnswer, parse } from '../src/index.ts';

// Adapter-shaped fixtures are entirely synthetic, including IDs and provenance.
const choice = (overrides = {}) => ({
  type: 'choice',
  choice: 'S1',
  confidence: 0.24,
  probabilities: { S1: 0.51, S2: 0.45, none: 0.04 },
  ...overrides,
});
const score = (overrides = {}) => ({
  type: 'score',
  score: 0.25,
  confidence: 0.13,
  probabilities: { 0: 0.2, 1: 0.8 },
  legend: { 0: 'Low', 1: 'High' },
  ...overrides,
});
const envelope = (answer) => ({
  model: 'synthetic',
  usage: { input_tokens: 0, output_tokens: 0 },
  answers: { q: answer },
});
const data = ({ is: _is, ...rest }) => rest;

function invalid(input, path, code) {
  const result = inspectAnswer(input);
  assert.equal(result.kind, 'invalid');
  assert.equal(result.issues.length, 1);
  assert.deepEqual(result.issues[0].path, path);
  assert.equal(result.issues[0].code, code);
  assert.ok(result.issues[0].message.length > 0);
  assert.equal(Object.hasOwn(result, 'answer'), false);
  return result.issues[0];
}

test('inspection: a Choice is usable without an envelope or invented provenance', () => {
  const input = choice();
  const result = inspectAnswer(input);
  assert.equal(result.kind, 'available');
  assert.equal(result.answer.type, 'choice');
  assert.equal(result.answer.maximumProbability, 0.51);
  assert.deepEqual(
    [result.answer.first, result.answer.second],
    [
      { option: 'S1', probability: 0.51 },
      { option: 'S2', probability: 0.45 },
    ],
  );
  assert.equal(result.answer.confidence, 0.24);
  assert.equal(result.answer.choice, 'S1');
  assert.equal(result.answer.prominent.count, 2);
  assert.equal(result.answer.massSet.count, 2);
  assert.equal(result.answer.is(dominant()), false);
  assert.deepEqual(result.answer.raw, input);
  for (const field of ['model', 'usage', 'accepted', 'provenance']) {
    assert.equal(Object.hasOwn(result.answer, field), false);
  }
});

test('inspection: a Choice whose wire-rounded probabilities sum to 0.99 is available, not invalid', () => {
  // Reproduces the two-decimal wire-rounding pattern of a real Jev response: each value is
  // a valid rounded probability, but the sum lands a cent off 1. Synthetic fixture.
  const input = choice({
    choice: 'adjacent',
    probabilities: { exact: 0.05, adjacent: 0.93, combination: 0.01 },
  });
  const result = inspectAnswer(input);
  assert.equal(result.kind, 'available');
  assert.equal(result.answer.choice, 'adjacent');
  assert.ok(Math.abs(result.answer.input.total - 0.99) < 1e-9);
  assert.equal(result.answer.input.normalized, true);
});

test('inspection: is() closes over the returned answer and preserves the predicate result', () => {
  const result = inspectAnswer(choice());
  assert.equal(result.kind, 'available');
  let received;
  const matched = result.answer.is((d) => {
    received = d;
    return d.maximumProbability >= 0.5;
  });
  assert.equal(matched, true);
  assert.equal(received, result.answer);
});

test('inspection: Promise pipelines preserve missing, available, and invalid outcomes', async () => {
  const results = await Promise.all(
    [choice(), undefined, null].map((answer) => Promise.resolve(answer).then(inspectAnswer)),
  );
  assert.deepEqual(
    results.map((result) => result.kind),
    ['available', 'missing', 'invalid'],
  );
  assert.equal(results[0].answer.choice, 'S1');
});

test('inspection: null, omitted, or undefined confidence never substitutes distribution strength', () => {
  for (const factory of [choice, score]) {
    for (const confidence of [null, undefined, 0, 1]) {
      const result = inspectAnswer(factory({ confidence }));
      assert.equal(result.kind, 'available');
      assert.equal(result.answer.confidence, confidence ?? null);
      assert.equal(result.answer.raw.confidence, confidence);
    }
    const input = factory();
    delete input.confidence;
    const result = inspectAnswer(input);
    assert.equal(result.kind, 'available');
    assert.equal(result.answer.confidence, null);
    assert.equal(Object.hasOwn(result.answer.raw, 'confidence'), false);
  }
});

test('inspection: Noul preserves affirmative direction, negatives, and ties', () => {
  for (const yes of [0, 0.08, 0.5, 0.94, 1]) {
    const result = inspectAnswer({ type: 'noul', noul: yes });
    assert.equal(result.kind, 'available');
    assert.equal(result.answer.yes, yes);
    assert.equal(result.answer.no, 1 - yes);
    assert.equal(Object.hasOwn(result.answer, 'confidence'), false);
    assert.equal(
      result.answer.distribution.uniqueMaximum?.option ?? null,
      yes === 0.5 ? null : yes > 0.5 ? 'yes' : 'no',
    );
  }
});

test('inspection: fractional Score retains a discrepancy and the full level distribution', () => {
  const result = inspectAnswer(score({ confidence: null, topLevel: 1 }));
  assert.equal(result.kind, 'available');
  assert.equal(result.answer.score, 0.25);
  assert.equal(result.answer.expectedLevel, 0.8);
  assert.equal(result.answer.scoreDifference, -0.55);
  assert.equal(result.answer.confidence, null);
  assert.equal(result.answer.distribution.uniqueMaximum.option, '1');
  assert.equal(result.answer.raw.topLevel, 1);
});

test('inspection: only undefined means missing; a malformed answer is never absence', () => {
  assert.deepEqual(inspectAnswer(undefined), { kind: 'missing' });
  for (const input of [
    null,
    false,
    0,
    '',
    [],
    new Date(0),
    new Map(),
    Promise.resolve(choice()),
    Object.create({ type: 'noul', noul: 0.5 }),
  ]) {
    invalid(input, [], 'invalid-type');
  }
  for (const type of [undefined, null, 1, 'Choice', 'other']) {
    invalid({ type }, ['type'], 'invalid-type');
  }
});

test('inspection: absent probability maps have their own outcome and a detached raw snapshot', () => {
  for (const factory of [choice, score]) {
    for (const probabilities of [undefined, null]) {
      const input = factory({
        probabilities,
        confidence: null,
        extension: { source: 'synthetic' },
      });
      const result = inspectAnswer(input);
      assert.equal(result.kind, 'unavailable');
      assert.equal(result.reason, 'distribution-not-provided');
      assert.deepEqual(result.raw, input);
      input.extension.source = 'changed';
      assert.equal(result.raw.extension.source, 'synthetic');
    }
    const input = factory();
    delete input.probabilities;
    assert.equal(inspectAnswer(input).kind, 'unavailable');
  }
  for (const legend of [undefined, null]) {
    assert.equal(inspectAnswer(score({ probabilities: null, legend })).kind, 'unavailable');
  }
});

test('inspection: malformed metadata is not hidden by a missing distribution', () => {
  invalid(choice({ probabilities: null, choice: 1 }), ['choice'], 'invalid-type');
  invalid(choice({ probabilities: null, confidence: 5 }), ['confidence'], 'out-of-range');
  invalid(score({ probabilities: null, legend: 'bad' }), ['legend'], 'invalid-type');
  invalid(score({ probabilities: null, score: 2 }), ['score'], 'out-of-range');
  for (const value of [-1, NaN, Infinity]) {
    invalid(score({ probabilities: null, legend: null, score: value }), ['score'], 'out-of-range');
  }
  invalid(score({ probabilities: null, legend: null, score: '1' }), ['score'], 'invalid-type');
});

test('inspection: invalid confidence and Noul fields have precise issues', () => {
  for (const value of ['0.5', true, {}, []]) {
    invalid(choice({ confidence: value }), ['confidence'], 'invalid-type');
    invalid({ type: 'noul', noul: value }, ['noul'], 'invalid-type');
  }
  for (const value of [NaN, Infinity, -Infinity, -0.001, 1.001]) {
    invalid(score({ confidence: value }), ['confidence'], 'out-of-range');
    invalid({ type: 'noul', noul: value }, ['noul'], 'out-of-range');
  }
  for (const value of [null, undefined]) {
    invalid({ type: 'noul', noul: value }, ['noul'], 'invalid-type');
  }
});

test('inspection: malformed maps, totals, and entries are distinct', () => {
  for (const probabilities of ['map', 1, false, []]) {
    invalid(choice({ probabilities }), ['probabilities'], 'invalid-type');
  }
  for (const probabilities of [{}, { a: 0 }, { a: 0.6, b: 0.3 }, { a: 1, b: 1 }]) {
    invalid(choice({ probabilities }), ['probabilities'], 'invalid-total');
  }
  for (const name of ['__proto__', 'constructor', '', 'quoted"\n]name', '🧪']) {
    const probabilities = Object.fromEntries([[name, '0.5']]);
    invalid(choice({ probabilities }), ['probabilities', name], 'invalid-type');
    for (const value of [-0.001, 1.001, Infinity, NaN]) {
      invalid(
        choice({ probabilities: { [name]: value } }),
        ['probabilities', name],
        'out-of-range',
      );
    }
  }
});

test('inspection: Choice mismatches are reported rather than silently selecting another option', () => {
  for (const selected of ['S2', 'missing']) {
    const issue = invalid(choice({ choice: selected }), ['choice'], 'inconsistent-answer');
    assert.equal(issue.message, 'choice must be a highest-probability option');
  }
  invalid(choice({ choice: null }), ['choice'], 'invalid-type');
  for (const selected of ['S1', 'S2']) {
    const result = inspectAnswer(choice({ choice: selected, probabilities: { S1: 0.5, S2: 0.5 } }));
    assert.equal(result.kind, 'available');
    assert.equal(result.answer.choice, selected);
    assert.equal(result.answer.uniqueMaximum, null);
    assert.equal(result.answer.maxima.length, 2);
  }
});

test('inspection: Score issues locate malformed levels, mismatches, and invalid scores', () => {
  invalid(score({ legend: null }), ['legend'], 'invalid-type');
  invalid(score({ legend: {} }), ['legend'], 'out-of-range');
  invalid(score({ legend: { 1: 'Low', 2: 'High' } }), ['legend'], 'inconsistent-answer');
  invalid(score({ legend: { 0: 'Low', 1: 3 } }), ['legend', '1'], 'invalid-type');
  for (const probabilities of [{ 0: 1 }, { 0: 0.2, 2: 0.8 }]) {
    invalid(score({ probabilities }), ['probabilities'], 'inconsistent-answer');
  }
  invalid(score({ score: '1' }), ['score'], 'invalid-type');
  for (const value of [-0.001, 1.001, Infinity, NaN]) {
    invalid(score({ score: value }), ['score'], 'out-of-range');
  }
});

test('inspection: configuration failures still throw for every data outcome', () => {
  for (const input of [undefined, null, choice(), choice({ probabilities: null })]) {
    for (const options of [
      { targetMass: 0 },
      { prominenceRatio: null },
      { targetMass: Infinity },
    ]) {
      assert.throws(() => inspectAnswer(input, options), TypeError);
    }
  }
});

test('inspection: noncloneable data returns an issue; executable input failures propagate', () => {
  invalid(choice({ extension: () => {} }), [], 'invalid-type');
  for (const failure of [
    new Error('accessor failed'),
    new DOMException('accessor failed', 'Other'),
    'primitive failure',
    null,
  ]) {
    const input = Object.defineProperty({}, 'type', {
      enumerable: true,
      get() {
        throw failure;
      },
    });
    assert.throws(
      () => inspectAnswer(input),
      (error) => error === failure,
    );
  }
});

test('inspection: options, normalization, and the descriptive profile match strict parsing', () => {
  const options = { targetMass: 0.95, prominenceRatio: 0.75 };
  for (const input of [
    choice({ probabilities: { S1: 0.51, S2: 0.45, none: 0.040000001 } }),
    { type: 'noul', noul: 0.7 },
    score(),
  ]) {
    const inspected = inspectAnswer(input, options);
    assert.equal(inspected.kind, 'available');
    const parsed = parse(envelope(input), options).answers.q;
    const inspectedDistribution =
      inspected.answer.type === 'choice' ? inspected.answer : inspected.answer.distribution;
    const parsedDistribution = parsed.type === 'choice' ? parsed : parsed.distribution;
    assert.deepEqual(data(inspectedDistribution), data(parsedDistribution));
    assert.equal(inspectedDistribution.profile.targetMass, 0.95);
    assert.equal(inspectedDistribution.profile.prominenceRatio, 0.75);
    assert.equal(inspectedDistribution.profile.id, 'descriptive-v3');
    if (input.type !== 'choice') {
      assert.deepEqual(
        { ...inspected.answer, distribution: null },
        { ...parsed, distribution: null },
      );
    }
  }
});

test('inspection: exposing nullable inspection does not weaken strict wire parsing', () => {
  for (const factory of [choice, score]) {
    for (const field of ['confidence', 'probabilities']) {
      for (const value of [undefined, null]) {
        const input = factory({ [field]: value });
        assert.notEqual(inspectAnswer(input).kind, 'invalid');
        assert.throws(() => parse(envelope(input)), TypeError);
      }
    }
  }
});

test('inspection: frozen inputs and nested extension data stay detached from derived values', () => {
  const input = score({ extension: { tags: ['original'] } });
  const before = structuredClone(input);
  Object.freeze(input.probabilities);
  Object.freeze(input.legend);
  Object.freeze(input);
  const result = inspectAnswer(input);
  assert.equal(result.kind, 'available');
  result.answer.raw.extension.tags.push('copy');
  result.answer.raw.legend['0'] = 'copy';
  assert.deepEqual(input, before);
  assert.equal(result.answer.legend['0'], 'Low');
  assert.equal(result.answer.expectedLevel, 0.8);
});

test('inspection: null-prototype answer objects and reserved option keys remain data', () => {
  const input = choice({
    choice: '__proto__',
    probabilities: Object.fromEntries([
      ['__proto__', 0.9],
      ['constructor', 0.1],
    ]),
  });
  Object.setPrototypeOf(input, null);
  const result = inspectAnswer(input);
  assert.equal(result.kind, 'available');
  assert.equal(result.answer.uniqueMaximum.option, '__proto__');
  assert.equal(Object.hasOwn(result.answer.raw.probabilities, '__proto__'), true);
});

test('inspection: mixed batches retain IDs and never normalize unrelated Noul questions together', () => {
  const answers = new Map([
    ['standing_ref', choice()],
    ['billing', { type: 'noul', noul: 0.94 }],
    ['refund', { type: 'noul', noul: 0.89 }],
    ['unavailable', choice({ probabilities: null })],
    ['broken', choice({ probabilities: { S1: 9 } })],
    ['missing', undefined],
  ]);
  const inspections = new Map([...answers].map(([id, answer]) => [id, inspectAnswer(answer)]));
  assert.deepEqual([...inspections.keys()], [...answers.keys()]);
  assert.deepEqual(
    [...inspections.values()].map((r) => r.kind),
    ['available', 'available', 'available', 'unavailable', 'invalid', 'missing'],
  );
  assert.equal(inspections.get('billing').answer.yes, 0.94);
  assert.equal(inspections.get('refund').answer.yes, 0.89);
});

test('inspection: seeded valid maps agree with analyze and remain permutation invariant', () => {
  let seed = 0x1a5eec7;
  for (let sample = 0; sample < 80; sample++) {
    const weights = Array.from({ length: 2 + (sample % 8) }, (_, index) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return [`option-${index}`, 1 + (seed % 1000)];
    });
    const total = weights.reduce((sum, [, n]) => sum + n, 0);
    const entries = weights.map(([id, n]) => [id, n / total]);
    const selected = weights.reduce((a, b) => (a[1] >= b[1] ? a : b))[0];
    const input = choice({ choice: selected, probabilities: Object.fromEntries(entries) });
    const reversed = choice({ ...input, probabilities: Object.fromEntries(entries.toReversed()) });
    const first = inspectAnswer(input);
    const second = inspectAnswer(reversed);
    assert.equal(first.kind, 'available', `seed=0x1a5eec7 sample=${sample}`);
    assert.equal(second.kind, 'available');
    assert.deepEqual(data(first.answer), data(second.answer));
    const {
      type: _type,
      choice: _choice,
      confidence: _confidence,
      raw: _raw,
      ...observations
    } = data(first.answer);
    assert.deepEqual(observations, data(analyze(input.probabilities)));
  }
});
