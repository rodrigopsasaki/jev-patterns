import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parse } from '../src/jev.ts';

// Synthetic wire fixtures only: no SDK, credentials, network, or captured responses.
const choice = (overrides = {}) => ({
  type: 'choice',
  choice: 'a',
  confidence: 0.137,
  probabilities: { a: 0.625, b: 0.375 },
  ...overrides,
});
const noul = (overrides = {}) => ({ type: 'noul', noul: 0.25, ...overrides });
const score = (overrides = {}) => ({
  type: 'score',
  score: 1.5,
  confidence: 0.271,
  legend: { 0: 'Low', 1: 'Middle', 2: 'High' },
  probabilities: { 0: 0.125, 1: 0.25, 2: 0.625 },
  ...overrides,
});
const response = (answers = { q: choice() }) => ({
  model: 'synthetic-contract-model',
  usage: { input_tokens: 13, output_tokens: 5 },
  answers,
});
const answerPrefix = (id) => `answers[${JSON.stringify(id)}]: `;
const fractionError = (field) => `${field} must be finite and in [0, 1]`;

function expectTypeError(operation, message, label = message) {
  assert.throws(
    operation,
    (error) => {
      assert.ok(error instanceof TypeError, `${label}: expected TypeError`);
      assert.equal(error.message, message, label);
      return true;
    },
    label,
  );
}

function expectAnswerError(answer, reason, id = 'q', options) {
  expectTypeError(() => parse(response({ [id]: answer }), options), answerPrefix(id) + reason);
}

function close(actual, expected, context) {
  assert.ok(
    Math.abs(actual - expected) <= 1e-12,
    `${context}: expected ${expected}, received ${actual}`,
  );
}

function freezeDeep(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function nullMap(entries) {
  const result = Object.fromEntries(entries);
  Object.setPrototypeOf(result, null);
  return result;
}

test('Jev contract: a mixed response retains envelope, IDs, provider fields, and answer kinds', () => {
  const input = response({ route: choice(), urgent: noul(), severity: score() });
  input.usage = { input_tokens: 0, output_tokens: Number.MAX_SAFE_INTEGER };
  const result = parse(input);
  assert.equal(result.model, input.model);
  assert.deepEqual(result.usage, input.usage);
  assert.deepEqual(Object.keys(result.answers), ['route', 'urgent', 'severity']);
  assert.equal(Object.getPrototypeOf(result.answers), null);
  assert.equal(result.answers.route.type, 'choice');
  assert.equal(result.answers.route.choice, 'a');
  assert.equal(result.answers.route.confidence, 0.137);
  assert.equal(result.answers.route.uniqueMaximum.option, 'a');
  assert.equal(typeof result.answers.route.match, 'function');
  assert.equal(typeof result.answers.route.is, 'function');
  assert.equal(result.answers.urgent.type, 'noul');
  assert.equal(result.answers.urgent.yes, 0.25);
  assert.equal(result.answers.urgent.no, 0.75);
  assert.equal(Object.hasOwn(result.answers.urgent, 'confidence'), false);
  assert.equal(result.answers.severity.type, 'score');
  assert.equal(result.answers.severity.score, 1.5);
  assert.equal(result.answers.severity.confidence, 0.271);
  assert.deepEqual(result.answers.severity.legend, input.answers.severity.legend);
  assert.equal(result.answers.severity.expectedLevel, 1.5);
  assert.equal(result.answers.severity.scoreDifference, 0);
  assert.deepEqual(result.raw, input);
});

test('Jev contract: Choice preserves point masses, zero entries, and confidence endpoints', () => {
  for (const confidence of [0, 1]) {
    for (const probabilities of [{ only: 1 }, { only: 1, unused: 0 }]) {
      const original = choice({ choice: 'only', probabilities, confidence });
      const result = parse(response({ q: original })).answers.q;
      assert.equal(result.choice, 'only');
      assert.equal(result.confidence, confidence);
      assert.deepEqual(result.first, { option: 'only', probability: 1 });
      assert.equal(result.sorted.length, Object.keys(probabilities).length);
      assert.equal(result.massSet.count, 1);
      assert.equal(result.raw.confidence, confidence);
      assert.deepEqual(result.raw.probabilities, probabilities);
    }
  }
});

test('Jev contract: a Choice answer is built without mutating a previously finished Distribution', () => {
  const result = parse(response({ q: choice() })).answers.q;
  // is()/match() must close over the returned ChoiceAnswer itself, not a plain
  // Distribution that later had `type`/`choice`/`confidence`/`raw` bolted onto it:
  // the handler's argument, by reference, is the exact object the caller holds.
  const received = result.match({
    dominant: (d) => d,
    paired: (d) => d,
    split: (d) => d,
    clustered: (d) => d,
    flat: (d) => d,
    mixed: (d) => d,
  });
  assert.equal(received, result);
  assert.equal(received.type, 'choice');
  assert.equal(received.choice, 'a');
  assert.equal(
    result.is((d) => d.choice === 'a'),
    true,
  );
});

test('Jev contract: either exact maximum can remain the provider Choice', () => {
  for (const selected of ['a', 'z']) {
    const result = parse(
      response({
        q: choice({
          choice: selected,
          probabilities: { z: 0.5, a: 0.5, zero: 0 },
        }),
      }),
    ).answers.q;
    assert.equal(result.choice, selected);
    assert.equal(result.raw.choice, selected);
    assert.equal(result.uniqueMaximum, null);
    assert.deepEqual(
      result.maxima.map((item) => item.option),
      ['a', 'z'],
    );
    assert.equal(result.first.option, 'a');
  }
});

test('Jev contract: Noul endpoints and tie retain yes/no direction without a confidence field', () => {
  for (const yes of [0, 0.25, 0.5, 0.75, 1]) {
    const result = parse(response({ q: noul({ noul: yes }) })).answers.q;
    assert.equal(result.yes, yes);
    assert.equal(result.no, 1 - yes);
    assert.equal(Object.hasOwn(result, 'confidence'), false);
    assert.deepEqual(
      Object.fromEntries(result.distribution.sorted.map((item) => [item.option, item.probability])),
      { yes, no: 1 - yes },
    );
    assert.equal(
      result.distribution.uniqueMaximum?.option ?? null,
      yes === 0.5 ? null : yes > 0.5 ? 'yes' : 'no',
    );
    assert.deepEqual(result.raw, { type: 'noul', noul: yes });
  }
});

for (let count = 2; count <= 10; count++) {
  test(`Jev contract: Score accepts ${count} ordered levels, both endpoints, and a fractional mean`, () => {
    const legend = Object.fromEntries(
      Array.from({ length: count }, (_, i) => [String(i), `Level ${i}`]),
    );
    for (const endpoint of [0, count - 1]) {
      const probabilities = Object.fromEntries(
        Array.from({ length: count }, (_, i) => [String(i), i === endpoint ? 1 : 0]),
      );
      const result = parse(
        response({
          q: score({
            score: endpoint,
            confidence: endpoint === 0 ? 0 : 1,
            legend,
            probabilities,
          }),
        }),
      ).answers.q;
      assert.equal(result.score, endpoint);
      assert.equal(result.expectedLevel, endpoint);
      assert.equal(result.scoreDifference, 0);
      assert.equal(result.distribution.uniqueMaximum.option, String(endpoint));
      assert.equal(result.distribution.sorted.length, count);
      assert.equal(result.confidence, endpoint === 0 ? 0 : 1);
      assert.deepEqual(result.legend, legend);
    }
    const probabilities = Object.fromEntries(
      Array.from({ length: count }, (_, i) => [
        String(i),
        i === 0 ? 0.25 : i === count - 1 ? 0.75 : 0,
      ]),
    );
    const expected = 0.75 * (count - 1);
    const result = parse(response({ q: score({ score: expected, legend, probabilities }) })).answers
      .q;
    assert.equal(result.expectedLevel, expected);
    assert.equal(result.scoreDifference, 0);
    assert.deepEqual(
      Object.keys(result.legend),
      Array.from({ length: count }, (_, i) => String(i)),
    );
  });
}

test('Jev contract: reported Score and confidence survive a visible expectation discrepancy', () => {
  const input = score({ score: 0.25, confidence: 0, probabilities: { 0: 0, 1: 0, 2: 1 } });
  const result = parse(response({ q: input })).answers.q;
  assert.equal(result.score, 0.25);
  assert.equal(result.confidence, 0);
  assert.equal(result.expectedLevel, 2);
  assert.equal(result.scoreDifference, -1.75);
  assert.deepEqual(result.raw, input);
});

test('Jev contract: probability drift is normalized only in the derived view', () => {
  const result = parse(
    response({
      choice: choice({ probabilities: { a: 0.7, b: 0.300000001 } }),
      score: score({
        score: 0.300000001,
        legend: { 0: 'Low', 1: 'High' },
        probabilities: { 0: 0.7, 1: 0.300000001 },
      }),
    }),
  );
  assert.equal(result.answers.choice.input.normalized, true);
  close(result.answers.choice.input.total, 1.000000001, 'input total');
  close(result.answers.choice.first.probability, 0.7 / 1.000000001, 'normalized choice');
  assert.equal(result.answers.choice.raw.probabilities.b, 0.300000001);
  assert.equal(result.answers.score.score, 0.300000001);
  close(result.answers.score.expectedLevel, 0.300000001 / 1.000000001, 'normalized expectation');
  assert.equal(result.answers.score.raw.probabilities['1'], 0.300000001);
});

test('Jev contract: options reach the analysis for all three answer kinds', () => {
  const options = { prominenceRatio: 0.75, targetMass: 0.95 };
  const result = parse(response({ choice: choice(), noul: noul(), score: score() }), options);
  for (const distribution of [
    result.answers.choice,
    result.answers.noul.distribution,
    result.answers.score.distribution,
  ]) {
    assert.equal(distribution.profile.prominenceRatio, 0.75);
    assert.equal(distribution.profile.targetMass, 0.95);
    assert.equal(distribution.massSet.targetMass, 0.95);
    assert.equal(distribution.prominent.count, 1);
    assert.ok(distribution.massSet.mass >= 0.95);
  }
  assert.deepEqual(options, { prominenceRatio: 0.75, targetMass: 0.95 });
});

test('Jev contract: frozen input and provider extension data are preserved without mutation', () => {
  const input = response({ choice: choice(), noul: noul(), score: score() });
  input.request_id = 'synthetic-request';
  input.usage.extension = { cached: 3 };
  for (const answer of Object.values(input.answers))
    answer.extension = { trace: ['synthetic', { n: 1 }] };
  const before = structuredClone(input);
  freezeDeep(input);
  const result = parse(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.raw, before);
  assert.notEqual(result.raw, input);
  assert.notEqual(result.raw.answers, input.answers);
  assert.notEqual(result.usage, input.usage);
  for (const id of Object.keys(input.answers)) {
    assert.deepEqual(result.answers[id].raw, before.answers[id]);
    assert.notEqual(result.answers[id].raw, input.answers[id]);
    assert.notEqual(result.answers[id].raw, result.raw.answers[id]);
    assert.notEqual(result.answers[id].raw.extension.trace, input.answers[id].extension.trace);
  }
  assert.notEqual(result.answers.score.legend, input.answers.score.legend);
});

test('Jev contract: later input and raw-copy changes do not alter other snapshots or derived values', () => {
  const input = response({ choice: choice(), score: score() });
  input.answers.choice.extension = { labels: ['original'] };
  const result = parse(input);
  const independent = parse(input);
  const before = structuredClone(input);
  input.model = 'changed';
  input.usage.input_tokens = 999;
  input.answers.choice.choice = 'b';
  input.answers.choice.confidence = 1;
  input.answers.choice.probabilities.a = 0;
  input.answers.choice.extension.labels.push('changed');
  input.answers.score.legend['0'] = 'Changed';
  input.answers.score.score = 0;
  assert.deepEqual(result.raw, before);
  assert.deepEqual(result.answers.choice.raw, before.answers.choice);
  assert.deepEqual(result.answers.score.raw, before.answers.score);
  assert.equal(result.model, before.model);
  assert.equal(result.usage.input_tokens, 13);
  assert.equal(result.answers.choice.choice, 'a');
  assert.equal(result.answers.choice.confidence, 0.137);
  assert.equal(result.answers.choice.first.probability, 0.625);
  assert.equal(result.answers.score.legend['0'], 'Low');
  assert.equal(result.answers.score.score, 1.5);
  result.raw.answers.choice.probabilities.a = 0.1;
  result.answers.choice.raw.extension.labels.push('local-only');
  assert.equal(result.answers.choice.raw.probabilities.a, 0.625);
  assert.deepEqual(result.raw.answers.choice.extension.labels, ['original']);
  assert.equal(result.answers.choice.first.probability, 0.625);
  assert.deepEqual(independent.raw, before);
  assert.deepEqual(independent.answers.choice.raw, before.answers.choice);
});

test('Jev contract: reserved and escaped question/option names remain ordinary own data', () => {
  const names = [
    '__proto__',
    'constructor',
    'prototype',
    'toString',
    'hasOwnProperty',
    'raw',
    'match',
    'shape',
    '',
    '01',
    '10',
    'quoted"\n]name',
    '\u0000',
    '🧪',
  ];
  const input = response(
    Object.fromEntries(
      names.map((name) => [
        name,
        choice({
          choice: name,
          probabilities: Object.fromEntries([
            [name, 0.75],
            ['alternative', 0.25],
          ]),
        }),
      ]),
    ),
  );
  const prototypeBefore = Object.getOwnPropertyDescriptors(Object.prototype);
  const result = parse(input);
  for (const name of names) {
    assert.equal(Object.hasOwn(result.answers, name), true, name);
    assert.equal(result.answers[name].choice, name);
    assert.equal(result.answers[name].uniqueMaximum.option, name);
    assert.equal(Object.hasOwn(result.answers[name].raw.probabilities, name), true, name);
    assert.equal(result.answers[name].raw.probabilities[name], 0.75);
    assert.equal(Object.hasOwn(result.raw.answers, name), true, name);
  }
  assert.equal(Object.getPrototypeOf(result.answers), null);
  assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), prototypeBefore);
  assert.deepEqual(result.raw, input);
});

test('Jev contract: null-prototype wire objects work at every envelope and answer map level', () => {
  const makeNull = (value) => nullMap(Object.entries(value));
  const input = makeNull(
    response(
      makeNull({
        constructor: makeNull(
          choice({
            choice: '__proto__',
            probabilities: nullMap([
              ['__proto__', 0.75],
              ['constructor', 0.25],
            ]),
          }),
        ),
        score: makeNull(
          score({
            legend: makeNull({ 0: 'Low', 1: 'High' }),
            probabilities: makeNull({ 0: 0.25, 1: 0.75 }),
            score: 0.75,
          }),
        ),
        noul: makeNull(noul()),
      }),
    ),
  );
  input.usage = makeNull(input.usage);
  const result = parse(input);
  assert.equal(result.answers.constructor.choice, '__proto__');
  assert.equal(result.answers.score.expectedLevel, 0.75);
  assert.equal(result.answers.noul.yes, 0.25);
  // biome-ignore lint/suspicious/noProto: Regression for an absent literal answer ID.
  assert.equal(result.answers.__proto__, undefined);
  assert.equal(result.answers.toString, undefined);
  assert.equal(Object.getPrototypeOf(result.answers), null);
  assert.deepEqual(result.raw, JSON.parse(JSON.stringify(input)));
});

test('Jev contract: the synchronous parser also works as a Promise fulfillment callback', async () => {
  const input = response({ q: choice() });
  const result = await Promise.resolve(input).then(parse);
  assert.equal(result.answers.q.choice, 'a');
  assert.deepEqual(result.raw, input);
});

test('Jev contract: non-object and non-decoded response envelopes give a precise error', () => {
  for (const value of [
    undefined,
    null,
    false,
    1,
    'json',
    [],
    () => {},
    new Date(0),
    new Map(),
    Promise.resolve(response()),
    Object.create({ model: 'inherited' }),
  ]) {
    expectTypeError(() => parse(value), 'response must be a decoded JSON object');
  }
});

test('Jev contract: model and envelope object fields reject missing and wrong-kind values', () => {
  for (const value of [undefined, null, 0, false, [], {}]) {
    expectTypeError(() => parse({ ...response(), model: value }), 'model must be a string');
  }
  for (const field of ['usage', 'answers']) {
    for (const value of [
      undefined,
      null,
      'object',
      0,
      [],
      new Date(0),
      Object.create({ q: choice() }),
    ]) {
      expectTypeError(
        () => parse({ ...response(), [field]: value }),
        `${field} must be a decoded JSON object`,
      );
    }
  }
  expectTypeError(() => parse(response({})), 'answers must be nonempty');
  expectTypeError(() => parse(response(Object.create(null))), 'answers must be nonempty');
});

test('Jev contract: both token counts require nonnegative safe integers', () => {
  for (const field of ['input_tokens', 'output_tokens']) {
    for (const value of [
      undefined,
      null,
      '1',
      true,
      NaN,
      Infinity,
      -Infinity,
      -1,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      const input = response();
      input.usage[field] = value;
      expectTypeError(() => parse(input), `usage.${field} must be a nonnegative safe integer`);
    }
  }
});

test('Jev contract: malformed answer objects and type tags identify their question', () => {
  for (const value of [
    undefined,
    null,
    0,
    false,
    'answer',
    [],
    new Date(0),
    Object.create({ type: 'noul', noul: 0.5 }),
  ]) {
    expectAnswerError(value, 'answer must be a decoded JSON object');
  }
  for (const type of [undefined, null, 1, 'other', 'Choice', 'Noul', 'Score']) {
    expectAnswerError({ type }, 'type must be choice, score or noul');
  }
});

test('Jev contract: errors while reading an answer retain question context for primitive thrown values', () => {
  for (const reason of ['synthetic accessor failure', 0, null]) {
    const answer = Object.defineProperty({}, 'type', {
      enumerable: true,
      get() {
        throw reason;
      },
    });
    expectAnswerError(answer, String(reason), 'accessor-answer');
  }
});

test('Jev contract: Noul and provider confidence reject each invalid fraction category', () => {
  const invalid = [undefined, null, '0.5', true, {}, [], NaN, Infinity, -Infinity, -0.001, 1.001];
  for (const value of invalid) {
    expectAnswerError(noul({ noul: value }), fractionError('noul'));
    expectAnswerError(choice({ confidence: value }), fractionError('confidence'));
    expectAnswerError(score({ confidence: value }), fractionError('confidence'));
  }
});

test('Jev contract: Choice requires a string that is one of the probability maxima', () => {
  for (const value of [undefined, null, 1, true, {}, []]) {
    expectAnswerError(choice({ choice: value }), 'choice must be a string');
  }
  for (const selected of ['missing', 'b', '']) {
    expectAnswerError(choice({ choice: selected }), 'choice must be a highest-probability option');
  }
  expectAnswerError(
    choice({ choice: 'b', probabilities: { a: 0.500001, b: 0.499999 } }),
    'choice must be a highest-probability option',
  );
});

test('Jev contract: Choice and Score reject missing, malformed, empty, and non-normalized probability maps', () => {
  for (const factory of [choice, score]) {
    for (const value of [undefined, null, 'map', false, 1, []]) {
      expectAnswerError(factory({ probabilities: value }), 'probabilities must be a nonempty map');
    }
    for (const value of [{}, Object.create(null)]) {
      expectAnswerError(factory({ probabilities: value }), 'probabilities must be nonempty');
    }
    for (const [probabilities, total] of [
      [{ a: 0, b: 0 }, 0],
      [{ a: 0.75 }, 0.75],
      [{ a: 1, b: 1 }, 2],
    ]) {
      expectAnswerError(
        factory({ probabilities }),
        `Probabilities must sum to 1; received ${total}`,
      );
    }
  }
});

test('Jev contract: invalid probability entries name the exact escaped option', () => {
  const key = 'bad"\n]option';
  for (const value of [
    undefined,
    null,
    '1',
    false,
    {},
    [],
    NaN,
    Infinity,
    -Infinity,
    -0.001,
    1.001,
  ]) {
    for (const factory of [choice, score]) {
      expectAnswerError(
        factory({ probabilities: { [key]: value } }),
        `Probability for ${JSON.stringify(key)} must be finite and in [0, 1]`,
      );
    }
  }
});

test('Jev contract: Score validates the legend object and 2–10 level bound', () => {
  for (const value of [undefined, null, 1, 'legend', [], new Date(0)]) {
    expectAnswerError(score({ legend: value }), 'legend must be a decoded JSON object');
  }
  for (const count of [0, 1, 11]) {
    const legend = Object.fromEntries(
      Array.from({ length: count }, (_, i) => [String(i), `Level ${i}`]),
    );
    expectAnswerError(score({ legend }), 'score must have 2–10 levels');
  }
});

test('Jev contract: Score legend keys must be consecutive canonical indices starting at zero', () => {
  for (const legend of [
    { 1: 'Low', 2: 'High' },
    { 0: 'Low', 2: 'High' },
    { '00': 'Low', 1: 'High' },
    { 0: 'Low', 1: 'Middle', extra: 'High' },
    Object.fromEntries([
      ['__proto__', 'Low'],
      ['1', 'High'],
    ]),
  ]) {
    expectAnswerError(score({ legend }), 'legend keys must be consecutive from 0');
  }
  for (const value of [undefined, null, 1, true, {}, []]) {
    expectAnswerError(score({ legend: { 0: 'Low', 1: value } }), 'legend[1] must be a string');
  }
});

test('Jev contract: Score probabilities must cover every legend level without extras, even zero extras', () => {
  for (const probabilities of [
    { 0: 0.5, 1: 0.5 },
    { 0: 0.5, 1: 0.25, 3: 0.25 },
    { 0: 0.5, 1: 0.25, 2: 0.25, 3: 0 },
  ]) {
    expectAnswerError(
      score({ probabilities }),
      'probabilities must contain every legend level and no extra keys',
    );
  }
});

test('Jev contract: Score requires a finite number inside its actual legend range', () => {
  for (const value of [
    undefined,
    null,
    '1',
    true,
    {},
    [],
    NaN,
    Infinity,
    -Infinity,
    -0.001,
    2.001,
  ]) {
    expectAnswerError(score({ score: value }), 'score must lie within the level range');
  }
  expectAnswerError(
    score({ score: 1.5, legend: { 0: 'Low', 1: 'High' }, probabilities: { 0: 0.5, 1: 0.5 } }),
    'score must lie within the level range',
  );
});

test('Jev contract: invalid analysis options keep answer context for every answer kind', () => {
  for (const factory of [choice, noul, score]) {
    for (const [field, value] of [
      ['prominenceRatio', 0],
      ['prominenceRatio', Infinity],
      ['targetMass', 0],
      ['targetMass', 1.001],
    ]) {
      expectAnswerError(factory(), `${field} must be in (0, 1]`, 'q', { [field]: value });
    }
  }
});

test('Jev contract: error context safely escapes arbitrary IDs and locates a later invalid answer', () => {
  for (const id of ['__proto__', 'constructor', '', 'quoted"\n]question', '\u0000', '🧪']) {
    expectAnswerError(noul({ noul: 2 }), fractionError('noul'), id);
  }
  const input = response({ first: choice(), second: noul({ noul: 2 }), third: score() });
  const before = structuredClone(input);
  freezeDeep(input);
  expectTypeError(() => parse(input), 'answers["second"]: noul must be finite and in [0, 1]');
  assert.deepEqual(input, before);
});

test('Jev contract: seeded valid mixed responses preserve all probabilities and provider metadata', () => {
  let seed = 0x4a4556;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let sample = 0; sample < 90; sample++) {
    const count = 2 + (sample % 9);
    const weights = Array.from({ length: count }, () => 1 + Math.floor(random() * 100));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const probabilities = Object.fromEntries(
      weights.map((weight, i) => [String(i), weight / total]),
    );
    const selected = String(weights.lastIndexOf(Math.max(...weights)));
    const expectedLevel = weights.reduce((sum, weight, i) => sum + weight * i, 0) / total;
    const confidence = random();
    const yes = random();
    const input = response({
      route: choice({ choice: selected, confidence, probabilities }),
      signal: noul({ noul: yes }),
      level: score({
        score: expectedLevel,
        confidence,
        probabilities,
        legend: Object.fromEntries(weights.map((_, i) => [String(i), `Level ${i}`])),
      }),
    });
    const result = parse(input);
    assert.equal(result.answers.route.choice, selected, `sample ${sample}`);
    assert.equal(result.answers.route.confidence, confidence, `sample ${sample}`);
    assert.equal(result.answers.signal.yes, yes, `sample ${sample}`);
    assert.equal(result.answers.signal.no, 1 - yes, `sample ${sample}`);
    assert.equal(result.answers.level.score, expectedLevel, `sample ${sample}`);
    assert.equal(result.answers.level.confidence, confidence, `sample ${sample}`);
    close(result.answers.level.expectedLevel, expectedLevel, `sample ${sample} expectation`);
    close(result.answers.level.scoreDifference, 0, `sample ${sample} discrepancy`);
    for (const distribution of [result.answers.route, result.answers.level.distribution]) {
      assert.equal(distribution.sorted.length, count);
      for (const item of distribution.sorted) {
        close(
          item.probability,
          probabilities[item.option],
          `sample ${sample} level ${item.option}`,
        );
      }
    }
    assert.deepEqual(result.raw, input, `sample ${sample} raw`);
    for (const id of Object.keys(input.answers)) {
      assert.deepEqual(result.answers[id].raw, input.answers[id], `sample ${sample} answer ${id}`);
    }
  }
});
