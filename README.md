# jev-lens

An experimental, independent TypeScript library for reading Jev probability distributions.

Turn “A won with 42%” into “A and B are close contenders, with 17% of the probability elsewhere.” Keep the original answer and the numbers behind the description.

Working name; no package or hosted repository has been published. The core is provider-neutral; the first adapter targets Jev.

## Proposed use

```ts
import { parse } from 'jev-lens';

const response = parse(await jevJudge(callContext));
const answer = response.answers.route;

if (answer?.type === 'choice') {
  console.log(answer.distribution.shape);
  console.log(answer.distribution.contenders);
  console.log(answer.distribution.summary);
}
```

The first implementation is a prototype, with descriptive defaults that need evaluation against real uses. A contender is an option the configured rule keeps in consideration; it is not a verified or valid answer.

See [the proposal](docs/proposal.md) for the statistical model, API boundaries and roadmap.

## Development

Node 24.14 or newer supports the erasable TypeScript used here. Run `npm test` and `npm run demo`. `npm run typecheck` requires the development dependencies. The runtime has no dependencies, network calls or model inference.

MIT licensed. This project is not affiliated with TypeSafe AI.
