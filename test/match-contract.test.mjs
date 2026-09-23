import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allOf, analyze, anyOf, not } from '../src/index.ts';

const examples = {
  dominant: { a: 0.91, b: 0.05, c: 0.03, d: 0.01 },
  paired: { a: 0.64, b: 0.25, c: 0.07, d: 0.04 },
  split: { a: 0.51, b: 0.45, c: 0.03, d: 0.01 },
  clustered: { a: 0.41, b: 0.34, c: 0.22, d: 0.03 },
  flat: { a: 0.28, b: 0.26, c: 0.24, d: 0.22 },
  mixed: { a: 0.60, b: 0.10, c: 0.10, d: 0.10, e: 0.10 },
};
const shapes = Object.keys(examples);
const handlersFor = callback => Object.fromEntries(shapes.map(shape => [shape, callback]));

for (const [shape, probabilities] of Object.entries(examples)) {
  test(`${shape}: only its callback runs with the original distribution and preserves result identity`, () => {
    const distribution = analyze(probabilities);
    assert.equal(distribution.shape, shape);
    const calls = [];
    const outputs = Object.fromEntries(shapes.map(key => [key, { selected: key }]));
    const handlers = Object.fromEntries(shapes.map(key => [key, argument => {
      calls.push(key);
      assert.equal(argument, distribution);
      assert.equal(argument.shape, key);
      return outputs[key];
    }]));

    assert.equal(distribution.match(handlers), outputs[shape]);
    assert.deepEqual(calls, [shape]);
  });

  test(`${shape}: a rejected callback promise keeps its identity and original reason`, async () => {
    const distribution = analyze(probabilities);
    const failure = new Error(`application failure in ${shape}`);
    const rejected = Promise.reject(failure);
    let calls = 0;
    const handlers = handlersFor(() => assert.fail('An unselected callback ran'));
    handlers[shape] = () => {
      calls++;
      return rejected;
    };

    const result = distribution.match(handlers);
    assert.equal(result, rejected);
    await assert.rejects(result, reason => reason === failure);
    assert.equal(calls, 1);
  });
}

test('every handler is validated before any callback runs, including unselected handlers', () => {
  const distribution = analyze(examples.dominant);
  const invalidValues = [undefined, null, false, 0, 'callback', {}, [], Promise.resolve(1)];
  for (const shape of shapes) {
    for (const invalid of invalidValues) {
      let calls = 0;
      const handlers = handlersFor(() => { calls++; });
      handlers[shape] = invalid;
      assert.throws(() => distribution.match(handlers), {
        name: 'TypeError', message: `match() requires a handler for ${JSON.stringify(shape)}`,
      });
      assert.equal(calls, 0);
    }
  }
});

test('malformed handler containers fail without calling function-valued containers', () => {
  const distribution = analyze(examples.flat);
  let calls = 0;
  const callable = () => { calls++; };
  for (const handlers of [undefined, true, 42, 'handlers', Symbol('handlers'), [], new Map(), callable]) {
    assert.throws(() => distribution.match(handlers), TypeError);
  }
  assert.equal(calls, 0);
});

test('an own-handler dictionary with no prototype dispatches normally', () => {
  const distribution = analyze(examples.mixed);
  const handlers = Object.assign(Object.create(null), handlersFor(value => value));
  assert.equal(distribution.match(handlers), distribution);
});

test('a callable container with six own handlers invokes the selected handler, not the container', () => {
  const distribution = analyze(examples.paired);
  const handlers = Object.assign(
    () => assert.fail('The callable container must not run'),
    handlersFor(() => assert.fail('An unselected handler ran')),
  );
  const expected = { source: 'paired-handler' };
  let calls = 0;
  handlers.paired = value => {
    assert.equal(value, distribution);
    calls++;
    return expected;
  };
  assert.equal(distribution.match(handlers), expected);
  assert.equal(calls, 1);
});

test('nested predicate composition evaluates in order with the same distribution', () => {
  const distribution = analyze(examples.clustered);
  const calls = [];
  const predicate = (name, result) => value => {
    assert.equal(value, distribution);
    calls.push(name);
    return result;
  };
  const unexpected = () => assert.fail('A short-circuited predicate ran');

  assert.equal(distribution.is(allOf(
    predicate('first', true),
    anyOf(predicate('second', false), predicate('third', true), unexpected),
    not(predicate('fourth', false)),
    predicate('fifth', false),
    unexpected,
  )), false);
  assert.deepEqual(calls, ['first', 'second', 'third', 'fourth', 'fifth']);
});

test('is and predicate combinators propagate the original error and stop evaluation', () => {
  const distribution = analyze(examples.paired);
  for (const compose of [
    failure => failure,
    failure => allOf(() => true, failure, () => assert.fail('allOf continued')),
    failure => anyOf(() => false, failure, () => assert.fail('anyOf continued')),
    failure => not(failure),
  ]) {
    const error = new Error('predicate failure');
    let calls = 0;
    const predicate = compose(value => {
      assert.equal(value, distribution);
      calls++;
      throw error;
    });
    assert.throws(() => distribution.is(predicate), reason => reason === error);
    assert.equal(calls, 1);
  }
});

test('paired and split pair entries reference the first two sorted outcomes', () => {
  for (const probabilities of [examples.paired, examples.split, { z: 0.5, a: 0.5 }]) {
    const distribution = analyze(probabilities);
    assert.ok(distribution.shape === 'paired' || distribution.shape === 'split');
    assert.equal(distribution.pair.length, 2);
    assert.equal(distribution.pair[0], distribution.first);
    assert.equal(distribution.pair[0], distribution.sorted[0]);
    assert.equal(distribution.pair[1], distribution.second);
    assert.equal(distribution.pair[1], distribution.sorted[1]);
  }
  for (const shape of ['dominant', 'clustered', 'flat', 'mixed']) {
    assert.equal(Object.hasOwn(analyze(examples[shape]), 'pair'), false);
  }
});

test('maxima retain every tied maximum in deterministic order and share outcome references', () => {
  const tied = analyze({ z: 0.3, remainder: 0.1, m: 0.3, a: 0.3 });
  assert.equal(tied.uniqueMaximum, null);
  assert.deepEqual(tied.maxima.map(outcome => outcome.option), ['a', 'm', 'z']);
  for (const [index, maximum] of tied.maxima.entries()) {
    assert.equal(maximum, tied.sorted[index]);
    assert.equal(maximum.probability, tied.maximumProbability);
  }
  assert.equal(tied.first, tied.maxima[0]);

  for (const probabilities of [...Object.values(examples), { only: 1 }]) {
    const distribution = analyze(probabilities);
    assert.equal(distribution.maxima.length, 1);
    assert.equal(distribution.uniqueMaximum, distribution.first);
    assert.equal(distribution.maxima[0], distribution.first);
  }
});
