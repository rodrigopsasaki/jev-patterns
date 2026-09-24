import assert from 'node:assert/strict';
import { test } from 'vitest';
import { analyze } from '../src/analysis.ts';
import {
  allOf,
  anyOf,
  clustered,
  dominant,
  flat,
  gapAtLeast,
  maximumProbabilityAtLeast,
  not,
  paired,
  split,
} from '../src/predicates.ts';

const fromPercent = (values) =>
  analyze(Object.fromEntries(values.map((p, i) => [String(i), p / 100])));

test('structural predicates can overlap; none of them assigns a single label', () => {
  const uniform = fromPercent([25, 25, 25, 25]);
  assert.equal(uniform.is(flat()), true);
  assert.equal(uniform.is(clustered()), true);
  const skewed = fromPercent([64, 25, 7, 4]);
  assert.equal(skewed.is(dominant({ floor: 0.6 })), true);
  assert.equal(skewed.is(paired()), true);
});

test('structural predicates compose and short-circuit', () => {
  const result = fromPercent([48, 44, 5, 3]);
  assert.equal(result.is(allOf(split(), not(dominant()))), true);
  assert.equal(result.is(anyOf(dominant(), split())), true);
  assert.equal(result.is(maximumProbabilityAtLeast(0.5)), false);
  assert.equal(result.is(gapAtLeast(0.1)), false);
  const never = () => {
    throw new Error('Must short circuit');
  };
  assert.equal(result.is(allOf(() => false, never)), false);
  assert.equal(result.is(anyOf(() => true, never)), true);
  assert.equal(result.is(allOf()), true);
  assert.equal(result.is(anyOf()), false);
});

test('ties and point masses retain honest structural facts', () => {
  const tied = fromPercent([50, 50]);
  assert.equal(tied.uniqueMaximum, null);
  assert.equal(tied.is(dominant({ floor: 0, gap: 0 })), false);
  assert.equal(tied.is(split({ gap: 1, combinedFloor: 0 })), true);
  const point = analyze({ only: 1 });
  assert.equal(point.second, null);
  assert.equal(point.is(split({ gap: 1, combinedFloor: 0 })), false);
});

test('threshold options reject malformed values at predicate construction', () => {
  for (const value of [NaN, Infinity, -0.1, 1.1]) {
    assert.throws(() => dominant({ floor: value }), TypeError);
    assert.throws(() => split({ gap: value }), TypeError);
    assert.throws(() => paired({ secondFloor: value }), TypeError);
    assert.throws(() => flat({ minimumRatio: value }), TypeError);
    assert.throws(() => clustered({ combinedFloor: value }), TypeError);
  }
  assert.throws(() => clustered({ minimumCount: 1.5 }), TypeError);
  assert.throws(() => clustered({ ratio: 0 }), TypeError);
});

test('nested predicate composition evaluates in order with the same distribution', () => {
  const distribution = fromPercent([41, 34, 22, 3]);
  const calls = [];
  const predicate = (name, result) => (value) => {
    assert.equal(value, distribution);
    calls.push(name);
    return result;
  };
  const unexpected = () => assert.fail('A short-circuited predicate ran');

  assert.equal(
    distribution.is(
      allOf(
        predicate('first', true),
        anyOf(predicate('second', false), predicate('third', true), unexpected),
        not(predicate('fourth', false)),
        predicate('fifth', false),
        unexpected,
      ),
    ),
    false,
  );
  assert.deepEqual(calls, ['first', 'second', 'third', 'fourth', 'fifth']);
});

test('is and predicate combinators propagate the original error and stop evaluation', () => {
  const distribution = fromPercent([64, 25, 7, 4]);
  for (const compose of [
    (failure) => failure,
    (failure) =>
      allOf(
        () => true,
        failure,
        () => assert.fail('allOf continued'),
      ),
    (failure) =>
      anyOf(
        () => false,
        failure,
        () => assert.fail('anyOf continued'),
      ),
    (failure) => not(failure),
  ]) {
    const error = new Error('predicate failure');
    let calls = 0;
    const predicate = compose((value) => {
      assert.equal(value, distribution);
      calls++;
      throw error;
    });
    assert.throws(
      () => distribution.is(predicate),
      (reason) => reason === error,
    );
    assert.equal(calls, 1);
  }
});
