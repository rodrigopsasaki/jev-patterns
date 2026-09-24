import assert from 'node:assert/strict';
import { test } from 'vitest';
import { rank } from '../src/distribution.ts';

const probabilities = { a: 0.42, b: 0.41, c: 0.1, d: 0.07 };

test('rank orders options descending by probability, matching sorted/analyze order', () => {
  const ranked = rank(probabilities);
  assert.deepEqual(
    ranked.map((item) => item.option),
    ['a', 'b', 'c', 'd'],
  );
  assert.deepEqual(
    ranked.map((item) => item.probability),
    [0.42, 0.41, 0.1, 0.07],
  );
});

test('rank breaks ties the same way analyze/massSet do: probability desc, then key asc', () => {
  const tied = rank({ z: 0.3, m: 0.3, a: 0.3, remainder: 0.05, rest: 0.05 });
  assert.deepEqual(
    tied.map((item) => item.option),
    ['a', 'm', 'z', 'remainder', 'rest'],
  );
});

test('rank is invariant to the input object key order', () => {
  const forward = rank(probabilities);
  const reversed = rank(Object.fromEntries(Object.entries(probabilities).reverse()));
  assert.deepEqual(reversed, forward);
});

test('excluding a label filters it out without renormalizing the remaining probabilities', () => {
  const withOther = rank({ billing: 0.51, refund: 0.45, other: 0.04 });
  const excluded = rank({ billing: 0.51, refund: 0.45, other: 0.04 }, { exclude: ['other'] });
  assert.deepEqual(
    excluded,
    withOther.filter((item) => item.option !== 'other'),
  );
  // The remaining entries keep their original model probability mass; it is not
  // rescaled to sum to 1 again after "other" is removed.
  assert.equal(excluded[0].probability, 0.51);
  assert.equal(excluded[1].probability, 0.45);
});

test('excluding every option returns an empty ranking', () => {
  assert.deepEqual(rank(probabilities, { exclude: ['a', 'b', 'c', 'd'] }), []);
});

test('excluding an untyped label absent from the data is silently ignored', () => {
  assert.deepEqual(rank(probabilities, { exclude: ['not-present'] }), rank(probabilities));
});

test('limit keeps only the top N entries; limit at, below, and above the available count', () => {
  assert.deepEqual(
    rank(probabilities, { limit: 2 }).map((item) => item.option),
    ['a', 'b'],
  );
  assert.deepEqual(
    rank(probabilities, { limit: 4 }).map((item) => item.option),
    ['a', 'b', 'c', 'd'],
  );
  assert.deepEqual(
    rank(probabilities, { limit: 100 }).map((item) => item.option),
    ['a', 'b', 'c', 'd'],
  );
  assert.deepEqual(
    rank(probabilities, { limit: 1 }).map((item) => item.option),
    ['a'],
  );
});

test('exclude and limit compose: top-1 excluding a catch-all label is rank(p, { exclude, limit: 1 })[0]', () => {
  const [top] = rank(
    { billing: 0.51, refund: 0.45, other: 0.04 },
    { exclude: ['other'], limit: 1 },
  );
  assert.deepEqual(top, { option: 'billing', probability: 0.51 });
});

test('limit rejects non-positive-safe-integer values the same way other validated inputs do', () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => rank(probabilities, { limit: value }), TypeError);
  }
});

test('rank rejects malformed probability input exactly as analyze does', () => {
  for (const value of [{}, { a: 0 }, { a: 97, b: 3 }, { a: -0.1, b: 1.1 }, { a: NaN }, [], null]) {
    assert.throws(() => rank(value), TypeError);
  }
});
