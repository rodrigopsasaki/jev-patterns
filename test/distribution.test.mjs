import assert from 'node:assert/strict';
import { test } from 'vitest';
import { analyze } from '../src/analysis.ts';
import { massSet } from '../src/distribution.ts';

const probabilities = (weights) =>
  Object.fromEntries(weights.map((weight, i) => [String.fromCharCode(65 + i), weight / 100]));

for (const [weights, count] of [
  [[97, 1, 1, 1], 1],
  [[60, 25, 10, 5], 1],
  [[42, 41, 10, 7], 2],
  [[34, 33, 30, 3], 3],
  [[26, 25, 25, 24], 4],
  [[40, 20, 15, 15, 10], 2],
]) {
  test(`${weights.join('/')} has ${count} prominent outcome(s)`, () => {
    const result = analyze(probabilities(weights));
    assert.equal(result.prominent.count, count);
  });
}

test('point mass has one effective option and no entropy', () => {
  const result = analyze({ a: 1, b: 0 });
  assert.equal(result.metrics.entropyNats, 0);
  assert.deepEqual(result.metrics.effectiveOptions, { shannon: 1, simpson: 1 });
  assert.equal(result.massSet.count, 1);
});

test('uniform distributions have k effective options with no unique maximum', () => {
  for (const k of [2, 3, 4, 10, 100]) {
    const result = analyze(
      Object.fromEntries(Array.from({ length: k }, (_, i) => [String(i), 1 / k])),
    );
    assert.ok(Math.abs(result.metrics.effectiveOptions.shannon - k) < 1e-10);
    assert.ok(Math.abs(result.metrics.effectiveOptions.simpson - k) < 1e-10);
    assert.equal(result.uniqueMaximum, null);
    assert.equal(result.maxima.length, k);
    assert.equal(result.massSet.count, k);
  }
});

test('effective options are not a rounded prominent-outcome count', () => {
  const result = analyze(probabilities([42, 41, 10, 7]));
  assert.equal(result.prominent.count, 2);
  assert.equal(result.prominent.probability, 0.83);
  assert.ok(Math.abs(result.metrics.effectiveOptions.shannon - 3.1465675096437438) < 1e-12);
  assert.ok(Math.abs(result.metrics.effectiveOptions.simpson - 2.7824151363383423) < 1e-12);
  assert.equal(massSet(probabilities([42, 41, 10, 7]), 0.9).count, 3);
});

test('ties at the mass boundary are all included', () => {
  const result = massSet({ a: 0.5, b: 0.25, c: 0.25 }, 0.7);
  assert.equal(result.count, 3);
  assert.equal(result.mass, 1);
});

test('full mass keeps tiny positive tails and ordinary boundaries tolerate roundoff', () => {
  const full = massSet({ a: 1 - Number.EPSILON, b: Number.EPSILON / 2, c: Number.EPSILON / 2 }, 1);
  assert.deepEqual(
    full.options.map((item) => item.option),
    ['a', 'b', 'c'],
  );
  const boundary = massSet({ a: 0.58, b: 0.22, c: 0.15, d: 0.05 }, 0.8);
  assert.equal(boundary.count, 2);
  assert.ok(Math.abs(boundary.mass - 0.8) < 1e-12);
});

test('default prominent-outcome count applies the same ratio comparison near its boundary', () => {
  const result = analyze({ a: 0.4, b: 0.2 - 6e-13, c: 0.2 - 6e-13, d: 0.15, e: 0.05 + 12e-13 });
  assert.equal(result.prominent.count, 1);
});

test('relative comparison tolerance cannot swallow a tiny custom prominence ratio', () => {
  const result = analyze({ a: 1 - 1e-15, b: 1e-15 }, { prominenceRatio: 1e-12 });
  assert.equal(result.prominent.count, 1);
});

test('zero padding and insertion order preserve descriptors', () => {
  const a = analyze({ a: 0.42, b: 0.41, c: 0.1, d: 0.07 });
  const b = analyze({ d: 0.07, c: 0.1, b: 0.41, a: 0.42, z: 0 });
  for (const key of ['prominent', 'metrics', 'massSet', 'maxima', 'input']) {
    assert.deepEqual(a[key], b[key]);
  }
});

test('custom shortlist does not silently redefine mass-set or prominence defaults', () => {
  const result = analyze(probabilities([60, 25, 10, 5]), { prominenceRatio: 0.4, targetMass: 0.9 });
  assert.equal(result.prominent.count, 2);
  assert.equal(result.massSet.count, 3);
  assert.equal(result.profile.prominenceRatio, 0.4);
});

test('summation-order float noise is not reported as normalization', () => {
  // 0.1 + 0.2 + 0.7 sums to 0.9999999999999999 in IEEE 754 double precision: the
  // caller's data was already normalized, and the drift is round-off, not signal.
  const result = analyze({ a: 0.1, b: 0.2, c: 0.7 });
  assert.notEqual(result.input.total, 1);
  assert.equal(result.input.normalized, false);
});

test('the normalized flag is reported strictly beyond its declared tolerance, on both sides', () => {
  const tolerance = analyze({ a: 1 }).profile.numericTolerances.normalizedAbsolute;
  for (const scale of [0.5, 1, 2]) {
    const input = { a: 0.6, b: 0.4 + scale * tolerance };
    const total = input.a + input.b;
    const result = analyze(input);
    assert.equal(result.input.total, total, `scale=${scale}`);
    assert.equal(result.input.normalized, Math.abs(total - 1) > tolerance, `scale=${scale}`);
    // Rescaling always runs, regardless of whether the drift is reported: probabilities
    // are consistently normalized to the observed total either way.
    assert.equal(result.sorted[0].probability, input.a / total, `scale=${scale}`);
  }
});

test('small floating point drift is reported; malformed mass is rejected', () => {
  assert.equal(analyze({ a: 0.7, b: 0.300000001 }).input.normalized, true);
  for (const value of [
    {},
    { a: 0 },
    { a: 97, b: 3 },
    { a: -0.1, b: 1.1 },
    { a: NaN },
    { a: Infinity },
    { a: '1' },
    { a: 0.99 },
    [],
    null,
  ]) {
    assert.throws(() => analyze(value), TypeError);
  }
  for (const value of [0, -1, NaN, Infinity, 1.1]) {
    assert.throws(() => analyze({ a: 1 }, { prominenceRatio: value }), TypeError);
    assert.throws(() => massSet({ a: 1 }, value), TypeError);
  }
});

test('mass selection reaches the target and grows monotonically', () => {
  let seed = 9123;
  function random() {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return (seed + 1) / 4294967297;
  }
  for (let sample = 0; sample < 100; sample++) {
    const weights = Array.from({ length: 2 + (sample % 30) }, random);
    const total = weights.reduce((a, b) => a + b, 0);
    const input = Object.fromEntries(weights.map((v, i) => [String(i), v / total]));
    let previous = 0;
    for (const target of [0.1, 0.5, 0.8, 0.9, 0.99, 1]) {
      const selected = massSet(input, target);
      assert.ok(selected.mass + 1e-12 >= target);
      assert.ok(selected.count >= previous);
      previous = selected.count;
    }
    const metrics = analyze(input).metrics.effectiveOptions;
    assert.ok(metrics.simpson >= 1 - 1e-12);
    assert.ok(metrics.shannon + 1e-12 >= metrics.simpson);
    assert.ok(metrics.shannon <= weights.length + 1e-12);
  }
});
