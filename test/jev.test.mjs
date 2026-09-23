import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/index.ts';

const response = answers => ({ model: 'synthetic-model', answers, usage: { input_tokens: 10, output_tokens: 2 } });
const choice = () => ({ type: 'choice', choice: 'a', probabilities: { a: 0.42, b: 0.41, c: 0.1, d: 0.07 }, confidence: 0.123 });

test('choice keeps provider confidence and provenance distinct from analysis', () => {
  const input = response({ route: choice() });
  const result = parse(input);
  assert.equal(result.answers.route.distribution.shape, 'close-race');
  assert.equal(result.answers.route.confidence, 0.123);
  assert.deepEqual(result.raw, input);
  input.answers.route.confidence = 1;
  assert.equal(result.answers.route.raw.confidence, 0.123);
  assert.equal(result.raw.answers.route.confidence, 0.123);
});

test('noul preserves direction without inventing confidence', () => {
  const result = parse(response({ urgent: { type: 'noul', noul: 0.03 } })).answers.urgent;
  assert.equal(result.yes, 0.03);
  assert.equal(result.no, 0.97);
  assert.equal(result.distribution.winner.option, 'no');
  assert.equal(Object.hasOwn(result, 'confidence'), false);
});

test('score exposes a distant split that its mean hides', () => {
  const result = parse(response({ severity: {
    type: 'score', score: 1, confidence: 0.2,
    probabilities: { 0: 0.5, 1: 0, 2: 0.5 },
    legend: { 0: 'Low', 1: 'Medium', 2: 'High' },
  } })).answers.severity;
  assert.equal(result.expectedLevel, 1);
  assert.equal(result.distribution.winner, null);
  assert.deepEqual(result.distribution.contenders.map(item => item.option), ['0', '2']);
});

test('arbitrary option and question keys cannot modify prototypes', () => {
  const answer = JSON.parse('{"type":"choice","choice":"__proto__","probabilities":{"__proto__":0.9,"constructor":0.1},"confidence":0.5}');
  const input = response(Object.fromEntries([['__proto__', answer]]));
  const result = parse(input);
  assert.equal(Object.hasOwn(result.answers, '__proto__'), true);
  assert.equal(result.answers.__proto__.distribution.winner.option, '__proto__');
  assert.equal(Object.getPrototypeOf(result.answers), Object.prototype);
});

test('bad responses are rejected with the question id in the error', () => {
  for (const answer of [
    { ...choice(), choice: 'b' }, { ...choice(), confidence: -0.1 },
    { ...choice(), probabilities: { a: 0.9 } }, { type: 'noul', noul: 1.1 },
    { type: 'other' },
    { type: 'score', score: 0.5, confidence: 0.3, legend: { 0: 'L', 1: 'H' }, probabilities: { 0: 1 } },
    { type: 'score', score: 0.5, confidence: 0.3, legend: { 1: 'L', 2: 'H' }, probabilities: { 1: 0.5, 2: 0.5 } },
  ]) {
    assert.throws(() => parse(response({ q: answer })), /answers\["q"\]/);
  }
  assert.throws(() => parse(Promise.resolve(response({ q: choice() }))), /decoded JSON/);
  assert.throws(() => parse({ ...response({ q: choice() }), usage: { input_tokens: -1, output_tokens: 1 } }), /usage.input_tokens/);
});

test('a provider may select either option in an exact tie', () => {
  const result = parse(response({ route: { ...choice(), choice: 'b', probabilities: { a: 0.5, b: 0.5 } } }));
  assert.equal(result.answers.route.choice, 'b');
  assert.equal(result.answers.route.distribution.winner, null);
});
