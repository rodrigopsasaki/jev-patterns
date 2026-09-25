import assert from 'node:assert/strict';
import { test } from 'vitest';
import { measureThresholds } from '../src/index.ts';

const labeled = [
  { score: 0.9, correct: true },
  { score: 0.8, correct: false },
  { score: 0.6, correct: true },
  { score: 0.4, correct: false },
];

test('measures hand-computed coverage, precision and Wilson intervals at sorted thresholds', () => {
  assert.deepEqual(measureThresholds(labeled), {
    n: 4,
    correct: 2,
    auroc: 0.75,
    thresholds: [
      {
        kind: 'covered',
        threshold: 0.4,
        covered: 4,
        coverage: 1,
        correct: 2,
        precision: 0.5,
        interval: { lower: 0.15003570882017148, upper: 0.8499642911798285 },
      },
      {
        kind: 'covered',
        threshold: 0.6,
        covered: 3,
        coverage: 0.75,
        correct: 2,
        precision: 2 / 3,
        interval: { lower: 0.2076549551264879, upper: 0.9385096847238394 },
      },
      {
        kind: 'covered',
        threshold: 0.8,
        covered: 2,
        coverage: 0.5,
        correct: 1,
        precision: 0.5,
        interval: { lower: 0.09452865480086614, upper: 0.9054713451991339 },
      },
      {
        kind: 'covered',
        threshold: 0.9,
        covered: 1,
        coverage: 0.25,
        correct: 1,
        precision: 1,
        interval: { lower: 0.20654329147389294, upper: 1 },
      },
    ],
  });
});

test('explicit thresholds are deduplicated and sorted, including below, at and above boundaries', () => {
  const result = measureThresholds(labeled, { thresholds: [1, 0.8, 0.6, 0.8, 0] });
  assert.deepEqual(
    result.thresholds.map((point) => point.threshold),
    [0, 0.6, 0.8, 1],
  );
  assert.deepEqual(result.thresholds[1], {
    kind: 'covered',
    threshold: 0.6,
    covered: 3,
    coverage: 0.75,
    correct: 2,
    precision: 2 / 3,
    interval: { lower: 0.2076549551264879, upper: 0.9385096847238394 },
  });
  assert.deepEqual(result.thresholds[2], {
    kind: 'covered',
    threshold: 0.8,
    covered: 2,
    coverage: 0.5,
    correct: 1,
    precision: 0.5,
    interval: { lower: 0.09452865480086614, upper: 0.9054713451991339 },
  });
  assert.deepEqual(result.thresholds[3], {
    kind: 'empty',
    threshold: 1,
    covered: 0,
    coverage: 0,
    correct: 0,
  });
});

test('uses the existing tolerant atLeast comparison at a score boundary', () => {
  const result = measureThresholds([{ score: 0.8, correct: true }], {
    thresholds: [0.8, 0.8000000000001, 0.81],
  });
  assert.deepEqual(
    result.thresholds.map((point) => [point.threshold, point.covered]),
    [
      [0.8, 1],
      [0.8000000000001, 1],
      [0.81, 0],
    ],
  );
});

test('computes AUROC as the probability a correct score outscores an incorrect score', () => {
  assert.equal(
    measureThresholds([
      { score: 0.9, correct: true },
      { score: 0.7, correct: true },
      { score: 0.8, correct: false },
      { score: 0.2, correct: false },
    ]).auroc,
    0.75,
  );
  assert.equal(
    measureThresholds([
      { score: 0.8, correct: true },
      { score: 0.4, correct: true },
      { score: 0.8, correct: false },
      { score: 0.2, correct: false },
    ]).auroc,
    0.625,
  );
});

test('is invariant to observation permutation and preserves the caller input', () => {
  const input = labeled.map((observation) => ({ ...observation }));
  const reversed = [...input].reverse();
  const expected = measureThresholds(input, { thresholds: [0.4, 0.6, 0.8, 0.9] });
  assert.deepEqual(measureThresholds(reversed, { thresholds: [0.9, 0.8, 0.6, 0.4] }), expected);
  assert.deepEqual(input, labeled);
});

test('returns null AUROC when every observation has the same label', () => {
  assert.equal(measureThresholds([{ score: 0.4, correct: true }]).auroc, null);
  assert.equal(measureThresholds([{ score: 0.4, correct: false }]).auroc, null);
});

test('accepts an empty observation array and produces no points even with explicit thresholds', () => {
  assert.deepEqual(measureThresholds([], { thresholds: [0, 0.5, 1] }), {
    n: 0,
    correct: 0,
    auroc: null,
    thresholds: [],
  });
});

test('represents zero coverage without precision or an interval', () => {
  const [point] = measureThresholds([{ score: 0.2, correct: false }], {
    thresholds: [0.9],
  }).thresholds;
  assert.deepEqual(point, { kind: 'empty', threshold: 0.9, covered: 0, coverage: 0, correct: 0 });
  assert.equal('precision' in point, false);
  assert.equal('interval' in point, false);
});

test('rejects invalid observations and thresholds with InputIssue-style TypeErrors', () => {
  const invalidInputs = [
    [null, ['observations']],
    [[{ score: 'high', correct: true }], ['observations', 0, 'score']],
    [[{ score: 1.1, correct: true }], ['observations', 0, 'score']],
    [[{ score: 0.5, correct: 'yes' }], ['observations', 0, 'correct']],
  ];
  for (const [input, path] of invalidInputs) {
    assert.throws(
      () => measureThresholds(input),
      (error) =>
        error instanceof TypeError &&
        'issue' in error &&
        error.issue.path.join('.') === path.join('.'),
    );
  }
  assert.throws(() => measureThresholds('not-an-array'), TypeError);
  assert.throws(() => measureThresholds([], { thresholds: [NaN] }), TypeError);
  assert.throws(() => measureThresholds([], { thresholds: [-0.1] }), TypeError);
  assert.throws(() => measureThresholds([], { thresholds: ['0.5'] }), TypeError);
  assert.throws(() => measureThresholds([], { thresholds: null }), TypeError);
  assert.throws(() => measureThresholds([], null), TypeError);
});
