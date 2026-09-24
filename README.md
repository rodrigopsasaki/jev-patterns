# jev-patterns

[![Status: v0.2.0 experimental](assets/badges/status.svg)](https://github.com/rodrigopsasaki/jev-patterns/releases/tag/v0.2.0)
[![CI](https://github.com/rodrigopsasaki/jev-patterns/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/rodrigopsasaki/jev-patterns/actions/workflows/ci.yml)
[![License: MIT](assets/badges/license.svg)](LICENSE)
![Node: 24.14 or newer](assets/badges/node.svg)
![TypeScript: typed API](assets/badges/typescript.svg)
![Runtime dependencies: zero](assets/badges/dependencies.svg)

**Describe a probability distribution honestly. Decide what to do about it in your own code.**

Turn Jev responses into typed observations and application code you can read: concentration, alternatives, and a ranked list, with option names preserved as a TypeScript literal union throughout.

Independent TypeScript library. ESM. No runtime dependencies or network calls. This revision (v0.3.0, unreleased) removes the six named distribution shapes and adds `rank()`; see [why](#why-v03-removed-the-named-shapes) below. The API and thresholds remain provisional.

## Start with the whole distribution

A customer cannot sign in. Your model was asked which **one** explanation best fits the message:

<!-- example:quickstart -->
```ts
import { analyze } from 'jev-patterns';

const distribution = analyze({
  password_reset: 0.51,
  account_locked: 0.45,
  outage: 0.03,
  other: 0.01,
});

distribution.first.option;                // 'password_reset'
distribution.maximumProbability;          // 0.51
distribution.gap;                         // approximately 0.06
distribution.metrics.firstTwoProbability; // 0.96
distribution.prominent.count;             // 2 prominent alternatives
```

The first option is available, but so is the fact that almost as much probability sits on the second. Option names remain a TypeScript literal union throughout the result.

## Start with one answer

An SDK, adapter, batch, or saved record may give you an individual answer. `inspectAnswer()` describes it without requiring a model name, usage counts, or a response envelope.

<!-- example:inspection -->
```ts
import { inspectAnswer } from 'jev-patterns';

const inspected = inspectAnswer({
  type: 'choice',
  choice: 'S1',
  confidence: null,
  probabilities: { S1: 0.51, S2: 0.45, none: 0.04 },
});

if (inspected.kind === 'available') {
  inspected.answer.maximumProbability; // 0.51
  inspected.answer.prominent;   // S1 and S2, with their probabilities
  inspected.answer.confidence;  // null: provider confidence was unavailable
  inspected.answer.first.option; // typed as 'S1' | 'S2' | 'none'
}
```

| Result kind | Meaning |
| --- | --- |
| `available` | `.answer` contains the typed observations and a `.raw` snapshot. |
| `missing` | The supplied answer was `undefined`. |
| `unavailable` | A Choice or Score omitted its distribution or supplied `null`; `.raw` preserves the supplied answer. |
| `invalid` | The supplied data cannot be interpreted; `.issues` provides structured paths, codes, and messages. |

Missing confidence becomes `null` in the inspected view. It never borrows a number from the distribution. Noul keeps `.yes`, `.no`, and `.distribution`; Score keeps `.score`, `.confidence`, `.legend`, and `.distribution`. Choice exposes the distribution directly, including `.is()`.

`parse(response)` remains strict about Jev's full wire response. `analyze(probabilities)` remains the direct probability-map API. All three share the same descriptive rules. Expected input problems become inspection outcomes; invalid options and exceptions from executable inputs such as throwing getters still throw. See the [individual-answer contract](docs/answer-inspection.md) and [batch example](examples/answer-batch.ts).

## Why v0.3 removed the named shapes

Earlier versions classified a distribution into one of six named shapes (`dominant`, `paired`, `split`, `clustered`, `flat`, `mixed`) and dispatched on that label with `match()`. A board evaluated that vocabulary against 356 labeled judge answers (Jev plus two local judges) and found it added no information about a top answer's correctness beyond `maximumProbability` alone:

- `dominant` at its default floor (`0.8`) is *exactly* the predicate `maximumProbability >= 0.8` — bin purity 1.0, not a discovered pattern.
- `paired`'s apparent "the runner-up is worth checking" signal is fully reproduced by a shape-agnostic `maximumProbability` band: for `0.5 <= maximumProbability < 0.8`, the top answer alone is correct 66% of the time, versus 93% for the top two (n=61) — the same lift `paired` claims to add.
- `clustered`, at its defaults, is itself the predicate `prominent.count >= 3 && prominent.probability >= 0.75` — again a restatement of scalars already on the distribution, not new signal.
- `flat` never occurred in the 356-answer corpus.
- `maximumProbability`, `gap`, and entropy predicted correctness about equally well (AUROC ≈ .79–.80) — and only for a *validated* judge model. One of the two local judges was at chance, so that number is not universal.

With five of six shapes carrying no demonstrated value and the sixth (`mixed`) an explicit non-classification, there was nothing left for the discriminant to classify, so v0.3 removes `.shape`, `match()`, and the whole classification layer, rather than deprecating it. `Distribution` is now its observations (below) plus `.is(predicate)`. The predicate factories (`dominant`, `paired`, `split`, `clustered`, `flat`) survive as opt-in structural tests with unchanged defaults — see [Structural predicates](#express-a-structural-policy-with-no-assumed-predictive-value) below — because a caller who validates one against their own labeled data may still find it useful; the library just no longer claims that value for them.

## Observations, not a verdict

`analyze()` and `parse()` return the same observations regardless of shape: `first`/`second`/`maxima` (rank and ties), `gap`, `maximumProbability`, `prominent` (a configurable shortlist), `massSet` (a mass-target shortlist), and `metrics` (entropy and effective-option counts). None of them selects an outcome or claims correctness; they describe the geometry Jev returned, and your application code reads the ones it needs.

## The question changes the interpretation

**“Which one?” and “Which ones?” need different inputs.**

| What you ask | What the scores describe | A useful application response |
| --- | --- | --- |
| “Which explanation best fits this login failure?” | Alternatives competing for one selection | Ask for a detail that distinguishes the main alternatives. |
| “Which article is the best starting point?” | Alternatives competing for one starting point | Fetch several plausible starting points before composing a response. |
| “Does this ticket mention billing? Does it request a refund?” | A separate yes/no proposition for each label | Suggest several labels, each from its own yes probability. |

In a Choice response, `billing: 0.51, refund: 0.45, other: 0.04` does **not** establish that both billing and refund apply. It describes the model's allocation across options for the question it received. The concepts can overlap in the real world; the question still requests one selection.

For multiple applicable labels, ask one Noul question per label. `billing: 0.94` and `refund: 0.89` can both be high. Do not normalize those scores into one distribution: each describes a different proposition. Separate questions do not imply statistical independence.

This follows Jev's documented [Choice](https://docs.typesafe.ai/primitives/choice) and [Noul](https://docs.typesafe.ai/primitives/noul) semantics. The library cannot recover a missing question or turn concentration into evidence of correctness. A dominant distribution can still favor the wrong answer, and the right answer might not be among the supplied options.

## Things you can build

### Ask a useful follow-up

In a support UI, read the observations your application actually needs and decide the view yourself. Here, a single clear leader gets a direct suggestion; two close contenders get a clarifying question; anything more spread out asks for more detail.

<!-- example:support -->
```ts
import { analyze } from 'jev-patterns';

const issue = analyze({
  password_reset: 0.51,
  account_locked: 0.45,
  outage: 0.03,
  other: 0.01,
});

const view =
  issue.maximumProbability >= 0.8
    ? ({ kind: 'suggest', option: issue.first.option } as const)
    : issue.prominent.count === 2
      ? ({ kind: 'clarify', options: issue.prominent.items.map((x) => x.option) } as const)
      : ({ kind: 'ask-for-details' } as const);

// { kind: 'clarify', options: ['password_reset', 'account_locked'] }
// A UI can now ask: “Do you need to reset your password, or is your account locked?”
```

The thresholds (`0.8`, a prominent count of `2`) are this application's own policy, stated in its own code — not a name the library assigned to the distribution. Change them freely; nothing here reclassifies anything.

### Fetch a shortlist before answering

Ask which **one** help article is the best starting point. If probability is spread across several, retrieve a shortlist rather than build the answer around the first article alone.

<!-- example:retrieval -->
```ts
import { massSet } from 'jev-patterns';

const shortlist = massSet({
  reset_2fa: 0.41,
  lost_phone: 0.34,
  backup_codes: 0.22,
  other: 0.03,
}, 0.8);

const pagesToFetch = shortlist.options.map((item) => item.option);
// ['reset_2fa', 'lost_phone', 'backup_codes']

shortlist.mass;         // approximately 0.97
shortlist.excludedMass; // approximately 0.03
```

This returns a ranked prefix reaching the requested model probability mass within numeric tolerance, including ties at its boundary. Here two articles cover only 75%, so the third is included. The 80% target is this application's retrieval policy; it is not a measured recall guarantee or proof that those articles contain the answer.

### Suggest every applicable label

Ask “Does this ticket mention billing?”, “Does it request a refund?”, and “Does it mention a login problem?” as separate Noul questions. Here is a fabricated decoded response:

<!-- example:labels -->
```ts
import { parse } from 'jev-patterns';

const response = parse({
  model: 'synthetic',
  usage: { input_tokens: 0, output_tokens: 0 },
  answers: {
    billing: { type: 'noul', noul: 0.94 },
    refund: { type: 'noul', noul: 0.89 },
    login: { type: 'noul', noul: 0.08 },
  },
});

// Illustrative application policy, to evaluate on your own labeled examples.
const suggestAt = 0.8;
const suggestedLabels = Object.entries(response.answers)
  .filter(([, answer]) => answer.yes >= suggestAt)
  .map(([label]) => label);
// ['billing', 'refund']

response.answers.billing.distribution.maximumProbability; // 0.94, toward yes
response.answers.login.distribution.maximumProbability;   // 0.92, toward no
```

Both the strong yes and the strong no are concentrated. **Use `.yes` to suggest a label; a high `maximumProbability` alone does not tell you the direction.** Each Noul retains `.yes`, `.no`, and its own binary `.distribution`. There is no combined observation for this collection of labels in v0.

### Rank options, excluding a catch-all label

The first real consumer of this library never branched on a distribution's shape at all — it only ever compared a scalar to a floor, and separately hand-rolled "rank the options, excluding a catch-all or none-sentinel, then take the top one" twice. `rank()` is that one primitive:

<!-- example:ranking -->
```ts
import { rank } from 'jev-patterns';

const probabilities = { password_reset: 0.51, account_locked: 0.45, other: 0.04 };
const topCause = rank(probabilities, { exclude: ['other'], limit: 1 })[0];
```

`rank()` shares `analyze()`'s validation and deterministic tie order. It does not renormalize after exclusion: the remaining entries keep their original model probability, exclusion just filters which entries appear. There is no separate "top-1 excluding X" helper; that is `rank(p, { exclude, limit: 1 })[0]`. With a typed probability map, excluding a literal option name outside its keys is a compile error, not a silent no-op; an untyped map has no closed vocabulary to check an excluded label against, so an absent label is silently ignored.

### Express a structural policy with no assumed predictive value

The predicate factories below (`dominant`, `paired`, `split`, `clustered`, `flat`) are structural tests over a distribution's shape. **They have no demonstrated predictive value for answer correctness on their own** — see [why](#why-v03-removed-the-named-shapes) above. If you want to gate a real decision on one, validate it against your own labeled data first.

<!-- example:predicates -->
```ts
import { allOf, analyze, dominant, gapAtLeast } from 'jev-patterns';

const route = analyze({ billing: 0.91, refunds: 0.05, login: 0.03, other: 0.01 });
const routingPolicy = allOf(dominant({ floor: 0.9 }), gapAtLeast(0.3));
const meetsRoutingPolicy = route.is(routingPolicy); // true
```

Predicates are ordinary functions. Compose them with `allOf`, `anyOf`, and `not`, or supply your own. They can overlap, and applying one never relabels the distribution — there is no label to change. These cutoffs are an example policy to evaluate against the costs of incorrect routing before trusting it.

## Connect a Jev response

Replace a synthetic response with your decoded API result: `const response = parse(await jevJudge(callContext))`. `jevJudge` stands for your application's Jev client call; it is not exported by this package.

| Answer kind | What `parse()` exposes |
| --- | --- |
| Choice | Observations and `.is()` directly on the answer, alongside the original `.choice`, `.confidence`, and `.raw`. |
| Noul | `.yes`, `.no`, and the yes/no view under `.distribution`. |
| Score | Level legend, provider score/confidence, `.expectedLevel`, and the categorical view under `.distribution`. |

With typed input, known question IDs, answer kinds, and option names survive parsing. With unknown JSON or an open dictionary, check for a missing answer and narrow its kind before use. Invalid input throws a `TypeError`. Input is preserved, including raw snapshots and provider metadata.

Score levels are ordered. A categorical view by itself cannot distinguish probability on adjacent levels from probability on distant levels; retain the legend and inspect the levels for that use case.

## What v0.3 includes

| API | Purpose |
| --- | --- |
| `analyze(probabilities, options?)` | Describe one normalized probability map. Values must be in `[0, 1]` and sum to 1 within the reported tolerance. |
| `parse(response, options?)` | Validate decoded Jev JSON and add typed distribution views. |
| `.is(predicate)` | Test structure using a supplied function. |
| `massSet(probabilities, targetMass)` | Keep a ranked prefix reaching a requested mass within numeric tolerance, retaining boundary ties. |
| `rank(probabilities, options?)` | Order options by probability; optionally `exclude` labels and `limit` to the top N, without renormalizing. |

`sorted`, `first`, `second`, `maxima`, `uniqueMaximum`, and `gap` expose rank and ties. Sorting tied entries never creates a unique maximum. `prominent` groups positive-probability outcomes at least a configurable fraction of the maximum, within numeric tolerance; `massSet` groups by accumulated mass; `rank` returns the same deterministic order as a plain list, optionally filtered and truncated.

`metrics.effectiveOptions` provides Shannon and Simpson effective counts: how spread out this one distribution is, expressed on the scale of equally weighted alternatives. It does **not** estimate how many answers are true or how many labels apply. `prominent.count` is also a descriptive count, not a validity count.

The applied numerical tolerances are recorded under `.profile` (`descriptive-v3`). The structural predicates' own default thresholds (`dominant`'s floor, and so on) live next to each predicate factory in `src/predicates.ts`, not on `.profile`: with no classification decision left to version, they are the predicates' own opt-in parameters. Multi-label aggregation, calibration, and ordinal distance analysis remain outside the current API.

Explore the [public types](src/model.ts), [design](docs/proposal.md), and [examples](examples/observations.ts) in the repository. Development files are excluded from the package archive.

## Looking ahead: task verbs

The next layer could expose verbs such as `classify`, `detect`, `label`, `retrieve`, and `verify`, and a fuller `rank` verb that wraps its own Jev calls with a tie/cycle policy (a different, larger thing from v0.3's `rank()` primitive above). Each would wrap Jev calls with an inspectable, versioned task recipe: useful defaults you can adopt, configure, or recreate. An optional receipt would accompany the task result with the questions, observed responses and policy rules that produced it.

This is a V2 design direction, not an available v0 API. The key boundary is a pure interpreter shared by wrapped calls and saved responses; distribution observations remain available underneath the task policy. See the [task recipe proposal](docs/task-recipes.md) in the repository for example signatures, receipt semantics and the seams v0 keeps open.

## Install

Node 24.14+ and TypeScript 5.9.3+ are the current support floor. Install the compiled package from [npm](https://www.npmjs.com/package/jev-patterns):

```sh
npm install jev-patterns
```

The earlier v0.1.0 release predated the npm package and was GitHub-only; npm is the distribution channel from v0.2.0 on.

To work from source:

```sh
git clone https://github.com/rodrigopsasaki/jev-patterns.git
cd jev-patterns
```

Then:

```sh
npm ci --ignore-scripts
npm run demo
npm pack
```

In a separate project, install the resulting `jev-patterns-0.2.0.tgz` by its local path. The public import is `jev-patterns`. The tarball includes compiled ESM JavaScript, declarations, this README, and its visual assets.

## Development and checks

```sh
npm run check                     # changed worktree: Biome + affected checks
npm run check -- --since main     # branch changes from the merge base
npm run check:plan                # inspect selection without running checks
npm run test:watch                # affected tests while editing
npm run check:full                # complete coverage and installed-package checks
```

Tests fabricate Jev responses and exercise mathematical invariants, numeric boundaries, malformed inputs, typed consumers, and package contracts. All TypeScript examples in this README execute and typecheck against the installed tarball.

Ordinary PRs select affected checks. Broad changes, `main` pushes, release tags, and manual runs select the full Node/platform matrix. See the [live CI runs](https://github.com/rodrigopsasaki/jev-patterns/actions/workflows/ci.yml). See [testing](docs/testing.md), [contributing](CONTRIBUTING.md), [changes](CHANGELOG.md), and the [release policy](docs/release-policy.md).

MIT licensed. Independent project, not affiliated with TypeSafe AI.
