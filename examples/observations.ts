import { allOf, analyze, dominant, gapAtLeast, rank } from '../src/index.ts';

const distribution = analyze({ a: 0.64, b: 0.25, c: 0.07, d: 0.04 });

// Observations describe the distribution's geometry. They never choose an outcome.
console.log({
  first: distribution.first,
  second: distribution.second,
  gap: distribution.gap,
  prominent: distribution.prominent.items,
});

// Structural predicates are opt-in, named policy checks with no demonstrated predictive
// value on their own (see the README); validate against your own labeled data first.
console.log({
  concentrated: distribution.is(allOf(dominant({ floor: 0.9 }), gapAtLeast(0.3))),
});

// Option names remain "a" | "b" | "c" | "d" throughout, including through rank().
console.log(rank({ a: 0.64, b: 0.25, c: 0.07, d: 0.04 }, { exclude: ['d'], limit: 2 }));
