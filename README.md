# jev-lens

Pattern matching over uncertainty. Jev provides a distribution; this library describes its shape; your application decides what that means.

An independent, experimental TypeScript library with no runtime dependencies or network calls. MIT licensed. The working name and API are provisional; nothing is published to npm or GitHub.

## Start with the application code

```ts
import { analyze } from './src/index.ts';

const ownership = analyze({
  platform: 0.48,
  product: 0.44,
  infrastructure: 0.05,
  other: 0.03,
});

const state = ownership.match({
  dominant: d => ({ kind: 'clear-owner', owner: d.leader.option }) as const,
  'runner-up': d => ({ kind: 'secondary-owner', owner: d.runnerUp.option }) as const,
  contested: d => ({ kind: 'ownership-conflict', candidates: d.frontRunners }) as const,
  clustered: d => ({ kind: 'cross-functional', candidates: d.contenders.items }) as const,
  flat: () => ({ kind: 'no-clear-owner' }) as const,
  mixed: () => ({ kind: 'unclassified-ownership' }) as const,
});

if (state.kind === 'ownership-conflict') {
  state.candidates; // A typed pair retaining the four option names.
}
```

`match()` requires every shape, narrows each callback's argument, and preserves the union of callback return values, including promises. It invokes exactly one handler. Exceptions and rejected promises belong to the caller; no fallback action is invented. Callbacks receive the distribution view; provider metadata remains available on the enclosing parsed answer.

`mixed` keeps distributions that don't meet a named pattern explicit. For example, 60/40 has a meaningful runner-up, while 60/10/10/10/10 has uncertainty dispersed among smaller alternatives. The current vocabulary leaves the latter mixed and retains its full measurements.

## Predicates describe structure

```ts
import { allOf, contested, dominant, marginAtLeast } from './src/index.ts';

const strongLead = allOf(dominant({ floor: 0.9 }), marginAtLeast(0.3));
ownership.is(strongLead);
contested({ margin: 0.08 })(ownership);
```

Predicates are ordinary functions. Compose them with `allOf`, `anyOf` and `not`, or write one yourself. They can overlap: a flat distribution can also satisfy `clustered()`. Customizing a predicate does not change the assigned shape or narrow it to a different TypeScript variant. These checks do not mean accept, reject, safe or correct.

## Jev integration

```ts
import { parse } from './src/index.ts';

const response = parse(await jevJudge(callContext));
const ownership = response.answers.ownership;
```

With a typed Jev response, known question IDs, answer kinds and option names survive parsing. Choice answers expose the decision methods directly: `ownership.match(...)`, `ownership.is(...)`, `ownership.shape`. A dominant branch guarantees a non-null `leader`; a contested branch provides a two-element `frontRunners` tuple, but may have no unique leader.

For `unknown` JSON or open answer dictionaries, lookups remain potentially missing and answer-kind checks remain necessary. Noul retains `yes` and `no`; Score retains ordered-level data. Their categorical views are available under `.distribution`. Generic shape labels alone do not describe ordinal distance between Score levels.

The adapter validates runtime input and keeps provider `choice`, `confidence` and raw snapshots separate from the derived geometry. Known option names presume that the typed probability map describes its actual enumerable keys; TypeScript cannot certify extra hidden keys in a structurally widened object.

## Data and thresholds

The common fields are `top`, `leader`, `runnerUp`, `topProbability`, `runnerUpProbability`, `margin` and `contenders`. `top` is always available in deterministic rank order; `leader` is null when the top is tied. `contenders` groups `items`, `count`, `probability` and `remainingProbability`. The shortlist is a configurable relative-to-leader rule, not proof of validity or guaranteed real-world coverage.

Advanced statistics remain under `metrics`. The applied defaults and numerical tolerances remain under `profile`. Default shape thresholds are deliberately provisional; they are isolated in `src/predicates.ts`. The first priority is a stable contract between observations, named shapes and application callbacks.

See [the design](docs/proposal.md), [the public types](src/model.ts), [the runnable example](examples/ownership.ts), and [the compile-time contracts](test/types.test.ts).

## Development

Node 24.14 or newer is required for this source-only prototype.

```sh
npm ci
npm test
npm run typecheck
npm run demo
npm run demo:distributions
```

The package remains private until compiled JavaScript/declarations, package-consumer checks, CI and release preparation are complete. See [contributing](CONTRIBUTING.md). This project is not affiliated with TypeSafe AI.
