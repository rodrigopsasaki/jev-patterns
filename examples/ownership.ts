import { allOf, analyze, dominant, gapAtLeast, parse } from '../src/index.ts';

const ownership = analyze({ platform: 0.48, product: 0.44, infrastructure: 0.05, other: 0.03 });

// The application owns both the domain vocabulary and the decision. It reads the
// observations it needs directly, rather than branching on a library-assigned shape.
const state =
  ownership.maximumProbability >= 0.9
    ? ({ kind: 'clear-owner', owner: ownership.first.option } as const)
    : ({ kind: 'ownership-conflict', outcomes: ownership.prominent.items } as const);

if (state.kind === 'ownership-conflict') {
  // Inferred: readonly Outcome<"platform" | "product" | "infrastructure" | "other">[]
  console.log(
    'Compare:',
    state.outcomes.map((outcome) => outcome.option),
  );
}

// Predicates are ordinary functions; customization doesn't relabel the distribution.
const concentrated = allOf(dominant({ floor: 0.9 }), gapAtLeast(0.3));
console.log({ concentrated: ownership.is(concentrated) });

// Same API through the Jev adapter. A typed response retains ids and answer kinds.
const response = parse({
  model: 'synthetic',
  usage: { input_tokens: 0, output_tokens: 0 },
  answers: {
    ownership: {
      type: 'choice',
      choice: 'platform',
      confidence: 0.2,
      probabilities: { platform: 0.48, product: 0.44, infrastructure: 0.05, other: 0.03 },
    },
    urgent: { type: 'noul', noul: 0.7 },
  },
});

console.log(response.answers.ownership.maximumProbability);
console.log(response.answers.urgent.yes);
