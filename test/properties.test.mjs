import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, massSet } from '../src/index.ts';

// Synthetic fixtures only. The seed and complete input are attached to failures.
const SEED = 0x5eeda11;
function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function probabilities(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  return Object.fromEntries(weights.map((value, index) => [`option-${index}`, value / total]));
}

function* cases() {
  // Anchor every shape; randomized families exercise different support and tail geometry.
  for (const [index, weights] of [
    [91, 5, 3, 1], [64, 25, 7, 4], [51, 45, 3, 1],
    [41, 34, 22, 3], [28, 26, 24, 22], [60, 10, 10, 10, 10],
  ].entries()) yield { label: `shape-anchor-${index}`, input: probabilities(weights) };
  const random = randomSource(SEED);
  for (let index = 0; index < 120; index++) {
    const size = 1 + Math.floor(random() * 48);
    const family = index % 5;
    const weights = Array.from({ length: size }, (_, i) => {
      if (family === 0) return 1;
      if (family === 1) return i === 0 ? 1 : 0;
      if (family === 2) return i === 0 ? 1 : Math.floor(random() * 9);
      if (family === 3) return Math.exp(-20 * random());
      return i === 0 ? 30 : 1 + Math.floor(random() * 5);
    });
    yield { label: `seed=${SEED}, family=${family}, case=${index}`, input: probabilities(weights) };
  }
}

function checkCases(check) {
  for (const { label, input } of cases()) {
    try { check(input); }
    catch (error) {
      error.message = `${label}, input=${JSON.stringify(input)}\n${error.message}`;
      throw error;
    }
  }
}

// Independent compensated accumulation reduces the oracle's own order sensitivity.
function sum(values) {
  let total = 0;
  let correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value)
      ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
}

function close(actual, expected, message, tolerance = 2e-11) {
  assert.ok(Number.isFinite(actual), `${message}: nonfinite ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} versus ${expected}, tolerance=${tolerance}`);
}

const names = items => items.map(item => item.option).sort();
const plain = result => JSON.parse(JSON.stringify(result));
function numericView(result) {
  return {
    shape: result.shape, profile: result.profile, metrics: result.metrics,
    maximumProbability: result.maximumProbability, secondProbability: result.secondProbability,
    gap: result.gap, input: result.input,
    prominent: { ...result.prominent, items: undefined },
    massSet: { ...result.massSet, options: undefined },
  };
}

test('distribution observations are invariant under insertion order and option renaming', () => {
  const random = randomSource(SEED ^ 0x12345678);
  checkCases(input => {
    const options = { prominenceRatio: .65, targetMass: .91 };
    const original = analyze(input, options);
    const entries = Object.entries(input);
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    assert.deepEqual(plain(analyze(Object.fromEntries(entries), options)), plain(original));

    const renamedKeys = entries.map((_, index) => `renamed-${entries.length - index}`);
    const reverseNames = new Map(renamedKeys.map((key, index) => [key, entries[index][0]]));
    const renamed = analyze(Object.fromEntries(entries.map(([, p], index) => [renamedKeys[index], p])), options);
    assert.deepEqual(numericView(renamed), numericView(original));
    const probabilitiesByName = items => Object.fromEntries([...items].sort((a, b) =>
      a.option < b.option ? -1 : a.option > b.option ? 1 : 0).map(item => [item.option, item.probability]));
    assert.deepEqual(probabilitiesByName(renamed.sorted.map(item => ({
      ...item, option: reverseNames.get(item.option),
    }))), probabilitiesByName(original.sorted));
    for (const items of ['maxima', 'sorted']) {
      assert.deepEqual(names(renamed[items].map(item => ({ ...item, option: reverseNames.get(item.option) }))),
        names(original[items]));
    }
    for (const [left, right] of [
      [renamed.prominent.items, original.prominent.items],
      [renamed.massSet.options, original.massSet.options],
    ]) assert.deepEqual(left.map(item => reverseNames.get(item.option)).sort(), names(right));
    if (original.uniqueMaximum) {
      assert.equal(reverseNames.get(renamed.uniqueMaximum.option), original.uniqueMaximum.option);
    } else assert.equal(renamed.uniqueMaximum, null);
    // A renamed exact tie may change which tied identity is displayed first.
  });
});

test('exact zero padding preserves positive-support observations and probability groups', () => {
  checkCases(input => {
    const options = { prominenceRatio: .3, targetMass: .97 };
    const original = analyze(input, options);
    const padded = analyze({ 'zero-before': 0, ...input, 'zero-after': 0 }, options);
    assert.deepEqual(numericView(padded), numericView(original));
    assert.deepEqual(padded.maxima, original.maxima);
    assert.deepEqual(padded.prominent, original.prominent);
    assert.deepEqual(padded.massSet, original.massSet);
    assert.deepEqual(padded.sorted.filter(item => item.probability > 0),
      original.sorted.filter(item => item.probability > 0));
  });
});

test('metrics satisfy probability, entropy and effective-number bounds with conserved group mass', () => {
  checkCases(input => {
    const result = analyze(input, { prominenceRatio: .4, targetMass: .87 });
    const positive = result.sorted.filter(item => item.probability > 0);
    const support = positive.length;
    const slack = 2e-11;
    const bounded = [result.maximumProbability, result.secondProbability, result.gap,
      result.metrics.firstTwoProbability, result.prominent.probability,
      result.prominent.remainingProbability, result.massSet.mass, result.massSet.excludedMass];
    for (const value of bounded) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    for (let index = 0; index < result.sorted.length; index++) {
      const item = result.sorted[index];
      assert.ok(Number.isFinite(item.probability) && item.probability >= 0 && item.probability <= 1);
      close(item.probability, input[item.option] / sum(Object.values(input)), 'normalized probability');
      if (index) assert.ok(result.sorted[index - 1].probability >= item.probability);
    }
    close(sum(result.sorted.map(item => item.probability)), 1, 'distribution mass');
    assert.equal(result.first, result.sorted[0]);
    assert.equal(result.second, result.sorted[1] ?? null);
    const tied = result.sorted.filter(item => result.maximumProbability - item.probability
      <= result.profile.numericTolerances.tieAbsolute);
    assert.deepEqual(result.maxima, tied);
    assert.equal(result.uniqueMaximum, tied.length === 1 ? result.first : null);
    close(result.gap, result.maximumProbability - result.secondProbability, 'gap');
    close(result.metrics.firstTwoProbability,
      sum(result.sorted.slice(0, 2).map(item => item.probability)), 'first-two mass');
    const { entropyNats, effectiveOptions: { shannon, simpson } } = result.metrics;
    assert.ok(Number.isFinite(entropyNats) && entropyNats >= -slack && entropyNats <= Math.log(support) + slack);
    assert.ok(Number.isFinite(simpson) && Number.isFinite(shannon));
    assert.ok(simpson >= 1 - slack && simpson <= shannon + slack && shannon <= support + slack);

    const prominentNames = new Set(result.prominent.items.map(item => item.option));
    for (const item of result.sorted) {
      const ratio = item.probability / result.maximumProbability;
      if (prominentNames.has(item.option)) {
        assert.ok(item.probability > 0);
        assert.ok(ratio >= .4 * (1 - result.profile.numericTolerances.thresholdRelative) - Number.EPSILON);
      } else assert.ok(item.probability === 0 || ratio < .4, 'an outcome at the cutoff must be prominent');
    }

    for (const group of [
      { items: result.prominent.items, count: result.prominent.count,
        retained: result.prominent.probability, remaining: result.prominent.remainingProbability },
      { items: result.massSet.options, count: result.massSet.count,
        retained: result.massSet.mass, remaining: result.massSet.excludedMass },
    ]) {
      const selected = new Set(group.items.map(item => item.option));
      assert.equal(group.count, selected.size);
      assert.equal(group.count, group.items.length);
      assert.ok(group.items.every(item => item.probability > 0));
      close(group.retained, sum(group.items.map(item => item.probability)), 'retained mass');
      close(group.remaining,
        sum(result.sorted.filter(item => !selected.has(item.option)).map(item => item.probability)),
        'remaining mass');
      close(group.retained + group.remaining, 1, 'group conservation');
    }
  });
});

test('uniformly splitting every outcome scales effective counts and adds log multiplicity to entropy', () => {
  checkCases(input => {
    const original = analyze(input);
    for (const multiplicity of [2, 3]) {
      const split = Object.fromEntries(Object.entries(input).flatMap(([key, probability]) =>
        Array.from({ length: multiplicity }, (_, index) => [`${key}/part-${index}`, probability / multiplicity])));
      const result = analyze(split);
      close(result.metrics.entropyNats, original.metrics.entropyNats + Math.log(multiplicity), 'split entropy');
      for (const kind of ['shannon', 'simpson']) {
        close(result.metrics.effectiveOptions[kind], original.metrics.effectiveOptions[kind] * multiplicity,
          `split ${kind}`, 2e-9);
      }
    }
  });
});

test('mass sets are nested prefixes, meet tolerated coverage and retain every exact boundary tie', () => {
  checkCases(input => {
    const result = analyze(input);
    let previous = new Set();
    for (const target of [Number.MIN_VALUE, .01, .2, .5, .8, .95, .999, 1]) {
      const selected = massSet(input, target);
      const selectedNames = new Set(selected.options.map(item => item.option));
      assert.ok([...previous].every(name => selectedNames.has(name)), `nested set at ${target}`);
      assert.deepEqual(selected.options, result.sorted.slice(0, selected.count));
      assert.ok(selected.options.every(item => item.probability > 0));
      assert.ok(selected.mass + result.profile.numericTolerances.massBoundaryAbsolute + 2e-14 >= target);
      assert.equal(selected.targetMass, target);
      const boundary = selected.options.at(-1).probability;
      for (const item of result.sorted.filter(item => item.probability === boundary)) {
        assert.ok(selectedNames.has(item.option), `boundary tie at ${target}`);
      }
      if (target === 1) assert.deepEqual(names(selected.options), names(result.sorted.filter(item => item.probability > 0)));
      previous = selectedNames;
    }
  });
});

test('distinct-probability mass sets are minimal within the declared numerical tolerance', () => {
  const random = randomSource(SEED ^ 0x2468ace);
  for (let sample = 0; sample < 50; sample++) {
    const weights = new Set();
    const size = 2 + sample % 30;
    while (weights.size < size) weights.add(1 + Math.floor(random() * 100000));
    const input = probabilities([...weights]);
    const result = analyze(input);
    const context = `seed=${SEED ^ 0x2468ace}, sample=${sample}, input=${JSON.stringify(input)}`;
    const prefixMass = result.sorted.reduce((values, item) => [...values, (values.at(-1) ?? 0) + item.probability], []);
    const targets = [.1, .5, .8, .99, ...prefixMass.slice(0, -1).flatMap(mass => [mass - 1e-7, mass, mass + 1e-7])]
      .filter(target => target > 0 && target < 1);
    for (const target of targets) {
      const selected = massSet(input, target);
      const previousMass = sum(selected.options.slice(0, -1).map(item => item.probability));
      assert.ok(previousMass + result.profile.numericTolerances.massBoundaryAbsolute < target,
        `nonminimal prefix for target=${target}; ${context}`);
      assert.ok(selected.mass + result.profile.numericTolerances.massBoundaryAbsolute + 2e-14 >= target,
        `coverage for target=${target}; ${context}`);
    }
  }
});

test('every assigned shape satisfies its structural guarantees and declared precedence', () => {
  const observed = new Set();
  checkCases(input => {
    const result = analyze(input);
    const p = result.sorted.map(item => item.probability);
    const positive = p.filter(value => value > 0);
    const slack = 1e-10; // Generated fixtures are away from non-exact threshold boundaries.
    const high = (a, b) => a >= b - slack;
    const significant = positive.filter(value => high(value / p[0], .5));
    const rules = {
      dominant: result.uniqueMaximum !== null && high(p[0], .8) && high(result.gap, .2),
      flat: positive.length >= 3 && high(positive.at(-1) / p[0], .75),
      clustered: significant.length >= 3 && high(sum(significant), .75),
      split: p.length >= 2 && result.gap <= .1 + slack && high(sum(p.slice(0, 2)), .75),
      paired: result.uniqueMaximum !== null && p.length >= 2
        && high(p[0], .5) && high(p[1], .2) && high(result.gap, .15),
    };
    // This oracle uses the published inequalities, not the exported predicates.
    const expected = Object.keys(rules).find(shape => rules[shape]) ?? 'mixed';
    assert.equal(result.shape, expected);
    if (result.shape === 'dominant' || result.shape === 'paired') {
      assert.ok(result.uniqueMaximum);
      assert.equal(result.maxima.length, 1);
      assert.equal(result.uniqueMaximum, result.first);
    }
    if (result.shape === 'paired' || result.shape === 'split') {
      assert.deepEqual(result.pair, result.sorted.slice(0, 2));
      assert.equal(result.pair[0], result.first);
      assert.equal(result.pair[1], result.second);
    }
    const custom = analyze(input, { prominenceRatio: .99, targetMass: .31 });
    assert.equal(custom.shape, result.shape);
    assert.deepEqual(custom.metrics, result.metrics);
    observed.add(result.shape);
  });
  assert.deepEqual([...observed].sort(), ['clustered', 'dominant', 'flat', 'mixed', 'paired', 'split']);
});

test('analysis and mass selection leave frozen inputs and options unchanged', () => {
  checkCases(input => {
    const before = structuredClone(input);
    const options = Object.freeze({ prominenceRatio: .7, targetMass: .85 });
    Object.freeze(input);
    const result = analyze(input, options);
    assert.deepEqual(massSet(input, options.targetMass), result.massSet);
    assert.deepEqual(input, before);
    assert.deepEqual(options, { prominenceRatio: .7, targetMass: .85 });
  });
});
