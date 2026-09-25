---
interlock: brief@v1
graph: measure-thresholds
node: measure-thresholds
role: worker
gates:
  - id: tests
    kind: command
    run: npm test
  - id: whitespace
    kind: command
    run: git diff --check
  - id: check-full
    kind: command
    run: npm run check:full
  - id: floors-reproduced
    kind: command
    run: node /Users/rodrigosasaki/dev/private/jev-local-bench/shape-eval/src/reproduce-floors.ts ./src/index.ts
    expect_output: 'floors reproduced: 3/3'
  - id: debrief-valid
    kind: command
    run: interlock debrief validate {graph} {node}
scope:
  - AGENTS.md
  - README.md
  - CONTRIBUTING.md
  - docs/proposal.md
  - docs/testing.md
  - package.json
  - src/index.ts
  - src/model.ts
  - src/numeric.ts
  - src/distribution.ts
  - src/validation.ts
  - test/type-contracts.test.ts
  - test/rank.test.mjs
  - test/boundaries.test.mjs
  - .changeset/config.json
substrate:
  address: none
---

Implement the acceptance of node `measure-thresholds` in `.interlock/graphs/measure-thresholds.yaml`
exactly as written. The API names and semantics there are a contract: a private gate you cannot
see the inside of (`floors-reproduced`) imports `measureThresholds` from `./src/index.ts` and checks
it against an independent reference computation on recorded judge data. It prints
`floors reproduced: 3/3` only when your coverage, correct counts, precision, Wilson interval and
AUROC match that reference exactly. You may run the gate command yourself as often as you like.

Start by reading AGENTS.md, then src/distribution.ts (`rank`, `parseOutcomes`, `readProbabilities`)
and src/numeric.ts (`atLeast`, `numericTolerances`) so the new module reuses the existing tolerant
comparison and InputIssue validation style rather than inventing its own. Match the repository's
voice, comment density and test style (see test/rank.test.mjs and test/type-contracts.test.ts).

Constraints: strict TypeScript with no `as`, no `any`, no non-null operators, and no `@ts-ignore`
(`@ts-expect-error` only inside negative type tests). Zero runtime dependencies. 100% coverage is
the floor. Do not change any existing export's behavior. Do not push, merge, tag or publish; do not
touch main; the human merges. Do not use live judge calls or copy any file from outside this
repository into it.

Deliverables: commits on this node's branch (Conventional Commits, subjects state why), `notes.yaml`
beside this brief committed as you go (typed choices and surprises), and `debrief.yaml` beside this
brief as your final commit. When the debrief is committed, stop and wait.
