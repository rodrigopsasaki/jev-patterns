import { allOf, analyze, dominant, marginAtLeast, parse } from '../src/index.ts';

const ownership = analyze({ platform: 0.48, product: 0.44, infrastructure: 0.05, other: 0.03 });

// The application owns both the domain vocabulary and the actions.
const state = ownership.match({
  dominant: d => ({ kind: 'clear-owner', owner: d.leader.option }) as const,
  'runner-up': d => ({ kind: 'secondary-owner', primary: d.leader.option,
    secondary: d.runnerUp.option }) as const,
  contested: d => ({ kind: 'ownership-conflict', candidates: d.frontRunners }) as const,
  clustered: d => ({ kind: 'cross-functional', candidates: d.contenders.items }) as const,
  flat: () => ({ kind: 'no-clear-owner' }) as const,
  mixed: () => ({ kind: 'unclassified-ownership' }) as const,
});

if (state.kind === 'ownership-conflict') {
  // Inferred: readonly [Candidate<"platform" | "product" | "infrastructure" | "other">, Candidate<...>]
  console.log('Compare:', state.candidates.map(candidate => candidate.option));
}

// Predicates are ordinary functions; customization doesn't relabel the distribution.
const strongLead = allOf(dominant({ floor: 0.9 }), marginAtLeast(0.3));
console.log({ shape: ownership.shape, strongLead: ownership.is(strongLead) });

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
