import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const name = process.argv[2];
assert(['statistics', 'api'].includes(name));
const text = readFileSync(`docs/reviews/${name}.md`, 'utf8');
for (const heading of ['Findings', 'Counterexamples', 'Recommendations']) {
  assert(text.includes(`## ${heading}`), `Missing ${heading}`);
}
assert(text.length > 600, 'Report must contain substantive findings');
console.log('Review structure checked');
