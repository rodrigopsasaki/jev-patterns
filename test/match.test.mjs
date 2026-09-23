import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allOf, analyze, anyOf, clustered, contested, dominant, flat, marginAtLeast,
  not, parse, runnerUp, topProbabilityAtLeast,
} from '../src/index.ts';

const fromPercent = values => analyze(Object.fromEntries(values.map((p, i) => [String(i), p / 100])));
const handlers = operation => ({
  dominant: operation, 'runner-up': operation, contested: operation,
  clustered: operation, flat: operation, mixed: operation,
});

test('the five illustrative shapes and the explicit remainder are reachable', () => {
  for (const [values, shape] of [
    [[91, 5, 3, 1], 'dominant'], [[64, 25, 7, 4], 'runner-up'],
    [[51, 45, 3, 1], 'contested'], [[41, 34, 22, 3], 'clustered'],
    [[28, 26, 24, 22], 'flat'], [[60, 10, 10, 10, 10], 'mixed'],
  ]) {
    const result = fromPercent(values);
    assert.equal(result.shape, shape);
    assert.equal(result.match(handlers(d => d.shape)), shape);
  }
});

test('same top probability retains the difference between a serious rival and a spread tail', () => {
  const rival = fromPercent([60, 40]);
  const tail = fromPercent([60, 10, 10, 10, 10]);
  assert.ok(Math.abs(rival.topProbability - tail.topProbability) < 1e-12);
  assert.equal(rival.shape, 'runner-up');
  assert.equal(tail.shape, 'mixed');
  assert.equal(rival.runnerUpProbability, 0.4);
  assert.ok(Math.abs(tail.runnerUpProbability - 0.1) < 1e-12);
  assert.notEqual(rival.metrics.entropyNats, tail.metrics.entropyNats);
});

test('match invokes exactly one callback, preserves its value and passes the decision', () => {
  const result = fromPercent([48, 44, 5, 3]);
  const expected = { next: 'request-context' };
  let count = 0;
  const onUnexpected = () => { throw new Error('Wrong handler'); };
  const actual = result.match({ ...handlers(onUnexpected), contested: d => {
    count++;
    assert.equal(d, result);
    assert.equal(d.frontRunners[1], d.runnerUp);
    return expected;
  } });
  assert.equal(actual, expected);
  assert.equal(count, 1);
});

test('match preserves promises and exceptions without inventing fallback actions', async () => {
  const result = fromPercent([91, 5, 3, 1]);
  const promise = Promise.resolve('app-chose-this');
  assert.equal(result.match(handlers(() => promise)), promise);
  assert.equal(await result.match(handlers(() => promise)), 'app-chose-this');
  const failure = new Error('application error');
  assert.throws(() => result.match(handlers(() => { throw failure; })), error => error === failure);
});

test('JavaScript callers also receive a clear error for incomplete or inherited handlers', () => {
  const result = fromPercent([91, 5, 3, 1]);
  assert.throws(() => result.match({ dominant: () => 1 }), /requires a handler/);
  assert.throws(() => result.match(Object.create(handlers(() => 1))), /requires a handler/);
  assert.throws(() => result.match(null), /requires a handler/);
});

test('predicates are independent of shape precedence and can overlap', () => {
  const result = fromPercent([25, 25, 25, 25]);
  assert.equal(result.shape, 'flat');
  assert.equal(result.is(flat()), true);
  assert.equal(result.is(clustered()), true);
  const custom = fromPercent([64, 25, 7, 4]);
  assert.equal(custom.shape, 'runner-up');
  assert.equal(custom.is(dominant({ floor: 0.6 })), true);
  assert.equal(custom.shape, 'runner-up');
});

test('structural predicates compose and short-circuit', () => {
  const result = fromPercent([48, 44, 5, 3]);
  assert.equal(result.is(allOf(contested(), not(dominant()))), true);
  assert.equal(result.is(anyOf(dominant(), contested())), true);
  assert.equal(result.is(topProbabilityAtLeast(0.5)), false);
  assert.equal(result.is(marginAtLeast(0.1)), false);
  const never = () => { throw new Error('Must short circuit'); };
  assert.equal(result.is(allOf(() => false, never)), false);
  assert.equal(result.is(anyOf(() => true, never)), true);
  assert.equal(result.is(allOf()), true);
  assert.equal(result.is(anyOf()), false);
});

test('ties and point masses retain honest structural facts', () => {
  const tied = fromPercent([50, 50]);
  assert.equal(tied.shape, 'contested');
  assert.equal(tied.leader, null);
  assert.equal(tied.is(dominant({ floor: 0, margin: 0 })), false);
  tied.match({ ...handlers(() => {}), contested: d => assert.equal(d.frontRunners.length, 2) });
  const point = analyze({ only: 1 });
  assert.equal(point.shape, 'dominant');
  assert.equal(point.runnerUp, null);
  assert.equal(point.is(contested({ margin: 1, combinedFloor: 0 })), false);
});

test('threshold options reject malformed values at predicate construction', () => {
  for (const value of [NaN, Infinity, -0.1, 1.1]) {
    assert.throws(() => dominant({ floor: value }), TypeError);
    assert.throws(() => contested({ margin: value }), TypeError);
    assert.throws(() => runnerUp({ alternativeFloor: value }), TypeError);
    assert.throws(() => flat({ minimumRatio: value }), TypeError);
    assert.throws(() => clustered({ combinedFloor: value }), TypeError);
  }
  assert.throws(() => clustered({ minimumCount: 1.5 }), TypeError);
  assert.throws(() => clustered({ ratio: 0 }), TypeError);
});

test('domain naming is an ordinary match result; choice parsing exposes the same interface', () => {
  const response = parse({ model: 'synthetic', usage: { input_tokens: 0, output_tokens: 0 },
    answers: { ownership: { type: 'choice', choice: 'platform', confidence: 0.2,
      probabilities: { platform: 0.41, product: 0.34, infra: 0.22, other: 0.03 } } } });
  assert.equal(response.answers.ownership.match({
    dominant: () => 'clear-owner', 'runner-up': () => 'secondary-owner',
    contested: () => 'ownership-conflict', clustered: () => 'cross-functional',
    flat: () => 'no-clear-owner', mixed: () => 'unclassified-ownership',
  }), 'cross-functional');
  assert.equal(response.answers.ownership.choice, 'platform');
  assert.equal(response.answers.ownership.is(clustered()), true);
  assert.equal(response.answers.ownership.match(handlers(d => d)), response.answers.ownership);
});
