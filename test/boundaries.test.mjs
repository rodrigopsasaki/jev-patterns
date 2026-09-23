import assert from 'node:assert/strict';
import { test } from 'vitest';
import { analyze } from '../src/analysis.ts';
import { massSet } from '../src/distribution.ts';
import {
  clustered,
  dominant,
  flat,
  gapAtLeast,
  maximumProbabilityAtLeast,
  paired,
  split,
} from '../src/predicates.ts';

const fromWeights = (weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  return analyze(
    Object.fromEntries(weights.map((weight, index) => [`option-${index}`, weight / total])),
  );
};
const STEP = 1e-7; // Separates semantic boundaries from the separately tested 1e-12 tolerance.

test('minimum and maximum predicate thresholds are inclusive, with both adjacent sides exercised', () => {
  const boundaries = [
    { name: 'dominant default floor', at: 0.8, factory: () => dominant(), data: (p) => [p, 1 - p] },
    {
      name: 'dominant custom floor',
      at: 0.7,
      factory: () => dominant({ floor: 0.7 }),
      data: (p) => [p, 1 - p],
    },
    {
      name: 'dominant default gap',
      at: 0.2,
      factory: () => dominant({ floor: 0 }),
      data: (g) => [(1 + g) / 2, (1 - g) / 2],
    },
    {
      name: 'dominant custom gap',
      at: 0.3,
      factory: () => dominant({ floor: 0, gap: 0.3 }),
      data: (g) => [(1 + g) / 2, (1 - g) / 2],
    },
    {
      name: 'paired default floor',
      at: 0.5,
      factory: () => paired(),
      data: (p) => [p, 0.3, 1 - p - 0.3],
    },
    {
      name: 'paired custom floor',
      at: 0.55,
      factory: () => paired({ floor: 0.55 }),
      data: (p) => [p, 0.3, 1 - p - 0.3],
    },
    {
      name: 'paired default second floor',
      at: 0.2,
      factory: () => paired(),
      data: (p) => [0.6, p, (0.4 - p) / 2, (0.4 - p) / 2],
    },
    {
      name: 'paired custom second floor',
      at: 0.25,
      factory: () => paired({ secondFloor: 0.25 }),
      data: (p) => [0.6, p, (0.4 - p) / 2, (0.4 - p) / 2],
    },
    {
      name: 'paired default gap',
      at: 0.15,
      factory: () => paired(),
      data: (g) => [0.55, 0.55 - g, g - 0.1],
    },
    {
      name: 'paired custom gap',
      at: 0.2,
      factory: () => paired({ gap: 0.2 }),
      data: (g) => [0.55, 0.55 - g, g - 0.1],
    },
    {
      name: 'split default maximum gap',
      at: 0.1,
      maximum: true,
      factory: () => split(),
      data: (g) => [(0.9 + g) / 2, (0.9 - g) / 2, 0.1],
    },
    {
      name: 'split custom maximum gap',
      at: 0.2,
      maximum: true,
      factory: () => split({ gap: 0.2 }),
      data: (g) => [(0.9 + g) / 2, (0.9 - g) / 2, 0.1],
    },
    {
      name: 'split default combined floor',
      at: 0.75,
      factory: () => split(),
      data: (m) => [(m + 0.04) / 2, (m - 0.04) / 2, (1 - m) / 3, (1 - m) / 3, (1 - m) / 3],
    },
    {
      name: 'split custom combined floor',
      at: 0.85,
      factory: () => split({ combinedFloor: 0.85 }),
      data: (m) => [(m + 0.04) / 2, (m - 0.04) / 2, (1 - m) / 3, (1 - m) / 3, (1 - m) / 3],
    },
    {
      name: 'clustered default ratio',
      at: 0.5,
      factory: () => clustered(),
      data: (r) => [1, 0.85, r, 0.05],
    },
    {
      name: 'clustered custom ratio',
      at: 0.65,
      factory: () => clustered({ ratio: 0.65 }),
      data: (r) => [1, 0.85, r, 0.05],
    },
    {
      name: 'clustered default combined floor',
      at: 0.75,
      factory: () => clustered(),
      data: (m) => [0.4 * m, 0.33 * m, 0.27 * m, ...Array(4).fill((1 - m) / 4)],
    },
    {
      name: 'clustered custom combined floor',
      at: 0.65,
      factory: () => clustered({ combinedFloor: 0.65 }),
      data: (m) => [0.4 * m, 0.33 * m, 0.27 * m, ...Array(4).fill((1 - m) / 4)],
    },
    {
      name: 'flat default minimum ratio',
      at: 0.75,
      factory: () => flat(),
      data: (r) => [1, 0.9, r],
    },
    {
      name: 'flat custom minimum ratio',
      at: 0.85,
      factory: () => flat({ minimumRatio: 0.85 }),
      data: (r) => [1, 0.9, r],
    },
    {
      name: 'maximum probability helper',
      at: 0.65,
      factory: () => maximumProbabilityAtLeast(0.65),
      data: (p) => [p, (1 - p) / 2, (1 - p) / 2],
    },
    {
      name: 'minimum gap helper',
      at: 0.2,
      factory: () => gapAtLeast(0.2),
      data: (g) => [(1 + g) / 2, (1 - g) / 2],
    },
  ];
  for (const boundary of boundaries) {
    for (const offset of [-STEP, 0, STEP]) {
      const result = fromWeights(boundary.data(boundary.at + offset));
      const expected = boundary.maximum ? offset <= 0 : offset >= 0;
      assert.equal(result.is(boundary.factory()), expected, `${boundary.name}, offset=${offset}`);
    }
  }
});

test('default and custom minimum counts count positive support and include the exact minimum', () => {
  for (const [name, factory] of [
    ['clustered', clustered],
    ['flat', flat],
  ]) {
    for (const minimum of [2, 3, 5]) {
      for (const count of [minimum - 1, minimum, minimum + 1]) {
        const data = fromWeights([...Array(count).fill(1), 0, 0]);
        assert.equal(
          data.is(factory({ minimumCount: minimum })),
          count >= minimum,
          `${name}, minimum=${minimum}, positive count=${count}`,
        );
        if (minimum === 3)
          assert.equal(data.is(factory()), count >= minimum, `${name} default count`);
      }
    }
  }
});

test('prominence and requested mass honor custom values on both sides of a boundary', () => {
  const input = { a: 0.5, b: 0.3, c: 0.2, zero: 0 };
  for (const offset of [-STEP, 0, STEP]) {
    const ratio = 0.6 + offset;
    const target = 0.8 + offset;
    const result = analyze(input, { prominenceRatio: ratio, targetMass: target });
    assert.deepEqual(
      result.prominent.items.map((item) => item.option),
      offset <= 0 ? ['a', 'b'] : ['a'],
    );
    assert.deepEqual(
      result.massSet.options.map((item) => item.option),
      offset <= 0 ? ['a', 'b'] : ['a', 'b', 'c'],
    );
    assert.deepEqual(result.massSet, massSet(input, target));
    assert.equal(result.profile.prominenceRatio, ratio);
    assert.equal(result.profile.targetMass, target);
    assert.equal(result.shape, analyze(input).shape);
  }
});

test('relative threshold tolerance scales with the threshold, including tiny custom ratios', () => {
  const tolerance = analyze({ a: 1 }).profile.numericTolerances.thresholdRelative;
  for (const threshold of [0.6, 1e-8, 1e-200]) {
    const values = [
      threshold * (1 - 2 * tolerance),
      threshold * (1 - tolerance / 2),
      threshold,
      threshold * (1 + tolerance / 2),
      threshold * (1 + 2 * tolerance),
    ];
    for (const [index, ratio] of values.entries()) {
      const result = fromWeights([1, ratio]);
      const input = Object.fromEntries(
        result.sorted.map((item) => [item.option, item.probability]),
      );
      const prominent = analyze(input, { prominenceRatio: threshold });
      assert.equal(
        prominent.prominent.count,
        index === 0 ? 1 : 2,
        `relative threshold=${threshold}, actual ratio=${ratio}`,
      );
      assert.equal(
        result.is(clustered({ minimumCount: 2, combinedFloor: 0, ratio: threshold })),
        index !== 0,
      );
    }
  }
  const result = analyze({ a: 0.6, b: 0.4 });
  assert.equal(result.is(maximumProbabilityAtLeast(0.6 * (1 + tolerance / 2))), true);
  assert.equal(result.is(maximumProbabilityAtLeast(0.6 * (1 + 2 * tolerance))), false);
  assert.equal(result.is(split({ gap: result.gap * (1 - tolerance / 2) })), true);
  assert.equal(result.is(split({ gap: result.gap * (1 - 2 * tolerance) })), false);
});

test('absolute tie tolerance determines maxima and expands mass boundaries without chaining ties', () => {
  const tolerance = analyze({ a: 1 }).profile.numericTolerances.tieAbsolute;
  for (const nominalGap of [0, tolerance / 2, tolerance, 2 * tolerance]) {
    const input = { a: 0.5 + nominalGap / 2, b: 0.5 - nominalGap / 2 };
    const result = analyze(input);
    // A nominal decimal tolerance need not be exactly representable as a gap near .5.
    const actualGap = input.a - input.b;
    const isTie = actualGap <= tolerance;
    assert.equal(
      result.maxima.length,
      isTie ? 2 : 1,
      `nominal gap=${nominalGap}, represented gap=${actualGap}`,
    );
    assert.equal(result.uniqueMaximum === null, isTie);
    assert.equal(massSet(input, 0.4).count, isTie ? 2 : 1);
  }
  const nearChain = analyze({ a: 1 / 3 + 0.75 * tolerance, b: 1 / 3, c: 1 / 3 - 0.75 * tolerance });
  assert.deepEqual(
    nearChain.maxima.map((item) => item.option),
    ['a', 'b'],
  );
  assert.deepEqual(
    massSet(
      Object.fromEntries(nearChain.sorted.map((item) => [item.option, item.probability])),
      0.2,
    ).options.map((item) => item.option),
    ['a', 'b'],
  );
});

test('mass tolerance is inclusive for partial requests and never removes positive support at target one', () => {
  const tolerance = analyze({ a: 1 }).profile.numericTolerances.massBoundaryAbsolute;
  const input = { a: 0.625, b: 0.25, c: 0.125 };
  for (const scale of [0.5, 1, 2]) {
    const selected = massSet(input, input.a + tolerance * scale);
    assert.equal(selected.count, scale <= 1 ? 1 : 2, `mass tolerance scale=${scale}`);
  }
  for (const tail of [Number.EPSILON / 2, Number.MIN_VALUE]) {
    const selected = massSet({ a: 1 - tail, b: tail, zero: 0 }, 1);
    assert.deepEqual(
      selected.options.map((item) => item.option),
      ['a', 'b'],
    );
  }
});

test('accepted sum drift is normalized and its represented boundary is enforced on both sides of one', () => {
  const tolerance = analyze({ a: 1 }).profile.numericTolerances.inputSumAbsolute;
  for (const sign of [-1, 1]) {
    for (const scale of [0.5, 1, 2]) {
      const input = { a: 0.6, b: 0.4 + sign * scale * tolerance };
      const total = input.a + input.b;
      const label = `sign=${sign}, scale=${scale}, represented total=${total}`;
      if (Math.abs(total - 1) > tolerance) {
        assert.throws(() => analyze(input), TypeError, label);
        assert.throws(() => massSet(input, 0.8), TypeError, label);
      } else {
        const result = analyze(input);
        assert.equal(result.input.total, total, label);
        assert.equal(result.input.normalized, true, label);
        assert.equal(result.sorted[0].probability, input.a / total, label);
        assert.equal(result.sorted[1].probability, input.b / total, label);
      }
    }
  }
  assert.deepEqual(analyze({ a: 0.75, b: 0.25 }).input, { total: 1, normalized: false });
});

test('numeric parameter validation rejects malformed values across every factory and analysis option', () => {
  const probabilityOptions = [
    ['dominant.floor', (value) => dominant({ floor: value })],
    ['dominant.gap', (value) => dominant({ gap: value })],
    ['paired.floor', (value) => paired({ floor: value })],
    ['paired.secondFloor', (value) => paired({ secondFloor: value })],
    ['paired.gap', (value) => paired({ gap: value })],
    ['split.gap', (value) => split({ gap: value })],
    ['split.combinedFloor', (value) => split({ combinedFloor: value })],
    ['clustered.combinedFloor', (value) => clustered({ combinedFloor: value })],
    ['clustered.ratio', (value) => clustered({ ratio: value })],
    ['flat.minimumRatio', (value) => flat({ minimumRatio: value })],
    ['maximumProbabilityAtLeast', maximumProbabilityAtLeast],
    ['gapAtLeast', gapAtLeast],
    ['prominenceRatio', (value) => analyze({ a: 1 }, { prominenceRatio: value })],
    ['targetMass', (value) => analyze({ a: 1 }, { targetMass: value })],
    ['massSet.targetMass', (value) => massSet({ a: 1 }, value)],
  ];
  for (const [name, factory] of probabilityOptions) {
    for (const value of [
      null,
      NaN,
      Infinity,
      -Infinity,
      -0.01,
      1.01,
      '0.5',
      true,
      false,
      {},
      [],
      1n,
    ]) {
      assert.throws(() => factory(value), TypeError, `${name}, invalid ${String(value)}`);
    }
  }
  for (const factory of [clustered, flat]) {
    for (const value of [
      null,
      -1,
      0,
      1,
      1.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      '3',
      true,
      {},
      [],
      3n,
    ]) {
      assert.throws(
        () => factory({ minimumCount: value }),
        TypeError,
        `minimumCount=${String(value)}`,
      );
    }
  }
  for (const value of [0, -0]) {
    assert.throws(() => analyze({ a: 1 }, { prominenceRatio: value }), TypeError);
    assert.throws(() => analyze({ a: 1 }, { targetMass: value }), TypeError);
    assert.throws(() => massSet({ a: 1 }, value), TypeError);
    assert.throws(() => clustered({ ratio: value }), TypeError);
  }
});

test('valid endpoint parameters and explicit undefined defaults remain usable', () => {
  const point = analyze({ a: 1 });
  const tie = analyze({ a: 0.5, b: 0.5 });
  assert.equal(point.is(maximumProbabilityAtLeast(0)), true);
  assert.equal(point.is(maximumProbabilityAtLeast(1)), true);
  assert.equal(point.is(gapAtLeast(1)), true);
  assert.equal(tie.is(gapAtLeast(0)), true);
  assert.equal(tie.is(split({ gap: 0, combinedFloor: 1 })), true);
  assert.equal(tie.is(dominant({ floor: 0, gap: 0 })), false);
  assert.equal(tie.is(paired({ floor: 0, secondFloor: 0, gap: 0 })), false);
  assert.equal(tie.is(flat({ minimumCount: 2, minimumRatio: 1 })), true);
  assert.equal(tie.is(clustered({ minimumCount: 2, ratio: 1, combinedFloor: 1 })), true);
  assert.equal(tie.is(flat({ minimumCount: 2, minimumRatio: 0 })), true);
  assert.deepEqual(
    analyze(
      { a: 0.6, b: 0.4 },
      { prominenceRatio: 1, targetMass: Number.MIN_VALUE },
    ).prominent.items.map((item) => item.option),
    ['a'],
  );
  const input = { a: 0.6, b: 0.3, c: 0.1 };
  const defaults = analyze(input);
  const explicit = analyze(input, { prominenceRatio: undefined, targetMass: undefined });
  assert.deepEqual(explicit.profile, defaults.profile);
  assert.deepEqual(explicit.prominent, defaults.prominent);
  assert.deepEqual(explicit.massSet, defaults.massSet);
  for (const [factory, keys] of [
    [dominant, ['floor', 'gap']],
    [paired, ['floor', 'secondFloor', 'gap']],
    [split, ['gap', 'combinedFloor']],
    [clustered, ['minimumCount', 'combinedFloor', 'ratio']],
    [flat, ['minimumRatio', 'minimumCount']],
  ])
    assert.equal(
      defaults.is(factory(Object.fromEntries(keys.map((key) => [key, undefined])))),
      defaults.is(factory()),
    );
});
