# jev-lens

Describe how probability is distributed across outcomes. Jev provides probabilities; this library exposes their concentration and spread; applications interpret those observations in context.

An independent, experimental TypeScript library with no runtime dependencies or network calls. MIT licensed. The working name and API are provisional; nothing is published to npm or GitHub.

## Describe the distribution

```ts
import { analyze } from 'jev-lens';

const distribution = analyze({ a: 0.64, b: 0.25, c: 0.07, d: 0.04 });

distribution.shape;              // "paired"
distribution.first;              // { option: "a", probability: 0.64 }
distribution.second;             // { option: "b", probability: 0.25 }
distribution.gap;                // 0.39
distribution.uniqueMaximum;      // The sole maximum; null when maxima are tied.
distribution.metrics.firstTwoProbability; // 0.89
```

Working vocabulary:

| Shape | Example (%) | Description |
| --- | --- | --- |
| dominant | 91 / 5 / 3 / 1 | Most probability on one outcome |
| paired | 64 / 25 / 7 / 4 | Two substantial, unequal shares |
| split | 51 / 45 / 3 / 1 | Two substantial, similar shares |
| clustered | 41 / 34 / 22 / 3 | Several outcomes hold most of the probability |
| flat | 28 / 26 / 24 / 22 | Similar probabilities across positive support |
| mixed | 60 / 10 / 10 / 10 / 10 | No named pattern matches the current profile |

`paired` and `split` describe concentration on two outcomes, while keeping the remaining probability visible. These terms describe the distribution, not correctness, permission or a selected outcome. `mixed` keeps the limits of the current vocabulary explicit.

## Match with typed observations

```ts
const description = distribution.match({
  dominant: d => `${d.uniqueMaximum.option} contains most of the probability.`,
  paired: d => `${d.pair[0].option} and ${d.pair[1].option} have substantial, unequal shares.`,
  split: d => `${d.pair[0].option} and ${d.pair[1].option} have substantial, similar shares.`,
  clustered: () => 'Several outcomes contain most of the probability.',
  flat: () => 'The positive probabilities are similar in size.',
  mixed: () => 'No named concentration pattern matches.',
});
```

Option names remain `"a" | "b" | "c" | "d"` throughout. Both paired and split callbacks expose a typed pair. Dominant guarantees a non-null uniqueMaximum; split can include tied maxima.

`match()` requires every shape, narrows each callback's argument, and preserves the union of callback return values, including promises. It invokes exactly one handler. Exceptions and rejected promises belong to the caller; no fallback action is invented. Callbacks receive the distribution view; provider metadata remains available on the enclosing parsed answer. Callers can return domain names through the same method.

## Predicates describe structure

```ts
import { allOf, dominant, gapAtLeast, split } from 'jev-lens';

const concentrated = allOf(dominant({ floor: 0.9 }), gapAtLeast(0.3));
distribution.is(concentrated);
split({ gap: 0.08 })(distribution);
```

Predicates are ordinary functions. Compose them with `allOf`, `anyOf` and `not`, or write one yourself. They can overlap: a flat distribution can also satisfy `clustered()`. Customizing a predicate does not change the assigned shape or narrow it to a different TypeScript variant. Application policy lives in the calling code.

## Jev integration

```ts
import { parse } from 'jev-lens';

const response = parse(await jevJudge(callContext));
const distribution = response.answers.ownership;
```

With a typed Jev response, known question IDs, answer kinds and option names survive parsing. Choice answers expose `match()`, `is()`, `shape` and the measurements directly. For unknown JSON or open answer dictionaries, lookups remain potentially missing and answer-kind checks remain necessary.

Noul retains yes and no; Score retains ordered-level data. Their categorical views are under `.distribution`. Shape labels alone do not describe ordinal distance between Score levels. The adapter validates runtime input and preserves the provider's original choice, confidence and raw snapshots. Static key preservation assumes the typed probability map describes its actual enumerable keys.

## Measurements and provisional thresholds

`sorted` holds descending probabilities. `first` is always available; ordering tied entries does not create a unique maximum. `maxima` retains ties, and `uniqueMaximum` is null for a tie. `second` is null only when there is one entry.

`prominent` groups outcomes above a configurable fraction of the maximum, with `items`, `count`, `probability` and `remainingProbability`. This is a descriptive subset, not a count of valid answers. Advanced statistics remain under `metrics`; applied defaults and numerical tolerances remain under `profile`.

Thresholds are provisional and isolated in `src/predicates.ts`. This revision changes the vocabulary without retuning classification. The next iteration can improve the names and their distinctions while keeping the data/predicate/match contract intact.

In the repository checkout, see [the design](docs/proposal.md), [public types](src/model.ts), [runnable example](examples/shapes.ts), [domain example](examples/ownership.ts) and [compile-time contracts](test/types.test.ts). These development references are excluded from the package archive.

## Development

Node 24.14 or newer is required. The package builds ESM JavaScript and TypeScript declarations; the API remains experimental.

```sh
npm ci --ignore-scripts
npm run check
npm run demo
npm run demo:distributions
```

The package is not on npm yet. To try the consumer examples above, run `npm pack` in this checkout, then install the resulting `jev-lens-0.0.0.tgz` by its path in another project. Its public import is `jev-lens`; checkout examples under `examples/` run directly from source.

`npm run check` enforces source type checks and coverage floors, then builds and installs the actual tarball into an isolated consumer. The public runtime suite runs again against compiled JavaScript, and declaration contracts run in four TypeScript consumer configurations. Tests use synthetic responses and seeded distributions; no Jev account or network calls are needed after development dependencies are installed.

The repository includes CI for Node 24.14/24/26 and Linux/macOS/Windows. Remote CI results will be available after publication to GitHub. See [test contracts](docs/testing.md), [contributing](CONTRIBUTING.md) and the [release policy](docs/release-policy.md). The package remains private while names and the first public release are reviewed. This project is not affiliated with TypeSafe AI.
