import { analyze } from '../src/index.ts';

for (const weights of [[97, 1, 1, 1], [60, 25, 10, 5], [42, 41, 10, 7], [34, 33, 30, 3], [26, 25, 25, 24]]) {
  const probabilities = Object.fromEntries(weights.map((weight, index) => [String.fromCharCode(65 + index), weight / 100]));
  const result = analyze(probabilities);
  console.log(JSON.stringify({
    input: weights, shape: result.shape,
    prominent: result.prominent.items.map(item => item.option),
    prominentProbability: result.prominent.probability,
    effectiveOptions: result.metrics.effectiveOptions,
    summary: result.summary,
  }, null, 2));
}
