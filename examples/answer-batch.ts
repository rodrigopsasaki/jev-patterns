import { type InspectableAnswer, inspectAnswer } from '../src/index.ts';

// Synthetic adapter output. IDs and batch membership belong to the application.
const answers: ReadonlyMap<string, InspectableAnswer | undefined> = new Map([
  [
    'standing_ref',
    {
      type: 'choice',
      choice: 'S1',
      confidence: null,
      probabilities: { S1: 0.51, S2: 0.45, none: 0.04 },
    },
  ],
  ['billing', { type: 'noul', noul: 0.94 }],
  ['refund', { type: 'noul', noul: 0.89 }],
  ['without_distribution', { type: 'choice', choice: 'S1', probabilities: null }],
  ['invalid_total', { type: 'choice', choice: 'S1', probabilities: { S1: 0.4 } }],
  ['not_answered', undefined],
]);

export const inspections = new Map([...answers].map(([id, answer]) => [id, inspectAnswer(answer)]));

for (const [id, inspection] of inspections) {
  switch (inspection.kind) {
    case 'available': {
      const answer = inspection.answer;
      const distribution = answer.type === 'choice' ? answer : answer.distribution;
      console.log(id, distribution.shape, distribution.summary);
      break;
    }
    case 'missing':
      console.log(id, 'No answer supplied');
      break;
    case 'unavailable':
      console.log(id, inspection.reason);
      break;
    case 'invalid':
      console.log(id, inspection.issues);
      break;
  }
}
