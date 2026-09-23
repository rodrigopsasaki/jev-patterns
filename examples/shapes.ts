import { allOf, analyze, dominant, gapAtLeast } from '../src/index.ts';

const distribution = analyze({ a: 0.64, b: 0.25, c: 0.07, d: 0.04 });

// Handlers describe probability placement. None chooses an outcome.
const description = distribution.match({
  dominant: (d) => `${d.uniqueMaximum.option} contains most of the probability.`,
  paired: (d) => `${d.pair[0].option} and ${d.pair[1].option} have substantial, unequal shares.`,
  split: (d) => `${d.pair[0].option} and ${d.pair[1].option} have substantial, similar shares.`,
  clustered: () => 'Several outcomes contain most of the probability.',
  flat: () => 'The positive probabilities are similar in size.',
  mixed: () => 'No named concentration pattern matches.',
});

// Option names remain "a" | "b" | "c" | "d" throughout the result and callbacks.
console.log({
  shape: distribution.shape,
  description,
  first: distribution.first,
  second: distribution.second,
  gap: distribution.gap,
  concentrated: distribution.is(allOf(dominant({ floor: 0.9 }), gapAtLeast(0.3))),
});
