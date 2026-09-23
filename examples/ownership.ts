import { allOf, analyze, dominant, gapAtLeast, parse } from '../src/index.ts';

const ownership = analyze({ platform: 0.48, product: 0.44, infrastructure: 0.05, other: 0.03 });

// The application owns both the domain vocabulary and the actions.
const state = ownership.match({
  dominant: d => ({ kind: 'clear-owner', owner: d.uniqueMaximum.option }) as const,
  'paired': d => ({ kind: 'secondary-owner', primary: d.uniqueMaximum.option,
    secondary: d.second.option }) as const,
  split: d => ({ kind: 'ownership-conflict', outcomes: d.pair }) as const,
  clustered: d => ({ kind: 'cross-functional', outcomes: d.prominent.items }) as const,
  flat: () => ({ kind: 'no-clear-owner' }) as const,
  mixed: () => ({ kind: 'unclassified-ownership' }) as const,
});

if (state.kind === 'ownership-conflict') {
  // Inferred: readonly [Outcome<"platform" | "product" | "infrastructure" | "other">, Outcome<...>]
  console.log('Compare:', state.outcomes.map(outcome => outcome.option));
}

// Predicates are ordinary functions; customization doesn't relabel the distribution.
const concentrated = allOf(dominant({ floor: 0.9 }), gapAtLeast(0.3));
console.log({ shape: ownership.shape, concentrated: ownership.is(concentrated) });

// Same API through the Jev adapter. A typed response retains ids and answer kinds.
const response = parse({
  model: 'synthetic', usage: { input_tokens: 0, output_tokens: 0 },
  answers: {
    ownership: { type: 'choice', choice: 'platform', confidence: 0.2,
      probabilities: { platform: 0.48, product: 0.44, infrastructure: 0.05, other: 0.03 } },
    urgent: { type: 'noul', noul: 0.7 },
  },
});

console.log(response.answers.ownership.summary);
console.log(response.answers.urgent.yes);
