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
    run: node
      /Users/rodrigosasaki/dev/private/jev-local-bench/shape-eval/src/reproduce-floors.ts
      ./src/index.ts
    expect_output: "floors reproduced: 3\\/3"
  - id: debrief-valid
    kind: command
    run: interlock debrief validate {graph} {node}
scope:
  - .changeset/README.md
  - .changeset/config.json
  - .editorconfig
  - .gitattributes
  - .github/dependabot.yml
  - .github/pull_request_template.md
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - .gitignore
  - .interlock/config.yaml
  - .interlock/graphs/initial-review.yaml
  - .interlock/graphs/measure-thresholds.yaml
  - .interlock/local.example.yaml
  - .interlock/local.kimi.example.yaml
  - .interlock/sessions/initial-review/api/brief.md
  - .interlock/sessions/initial-review/statistics/brief.md
  - .interlock/sessions/measure-thresholds/measure-thresholds/brief.md
  - AGENTS.md
  - CHANGELOG.md
  - CONTRIBUTING.md
  - LICENSE
  - README.md
  - assets/badges/dependencies.svg
  - assets/badges/license.svg
  - assets/badges/node.svg
  - assets/badges/status.svg
  - assets/badges/typescript.svg
  - biome.json
  - docs/answer-inspection.md
  - docs/orchestration.md
  - docs/proposal.md
  - docs/release-policy.md
  - docs/reviews/api.md
  - docs/reviews/decision-api.md
  - docs/reviews/resolutions.md
  - docs/reviews/statistics.md
  - docs/task-recipes.md
  - docs/testing.md
  - examples/answer-batch.ts
  - examples/distributions.mjs
  - examples/observations.ts
  - examples/ownership.ts
  - package-lock.json
  - package.json
  - scripts/change-plan.mjs
  - scripts/check-review.mjs
  - scripts/check.mjs
  - scripts/clean.mjs
  - scripts/stage-release.mjs
  - scripts/test-package.mjs
  - src/analysis.ts
  - src/answers.ts
  - src/distribution.ts
  - src/index.ts
  - src/inspection.ts
  - src/jev.ts
  - src/model.ts
  - src/numeric.ts
  - src/predicates.ts
  - src/validation.ts
  - test/boundaries.test.mjs
  - test/distribution.test.mjs
  - test/inspection-types.test.ts
  - test/inspection.test.mjs
  - test/jev-contract.test.mjs
  - test/jev.test.mjs
  - test/package/consumer.mjs
  - test/predicates.test.mjs
  - test/properties.test.mjs
  - test/rank.test.mjs
  - test/tooling/change-plan.test.mjs
  - test/tooling/check-cli.test.mjs
  - test/tooling/stage-release.test.mjs
  - test/type-contracts.test.ts
  - test/types.test.ts
  - tsconfig.build.json
  - tsconfig.consumer.json
  - tsconfig.json
  - vitest.config.mjs
substrate:
  address: none
graph_base_sha: 6079acb8d4d645834f75643624fdfe004b2655b4
session: 0271f9ad-f942-48b8-b43a-e06d2918b1c2
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

<!-- interlock: debrief-authoring-guidance@v1:start -->
## Debrief authoring

`found_at`, `rests_on`, and `hunks` say what supports a claim. Optional `applies_to` says
where you judge a rooted lesson useful; it never supplies support or ratifies a claim.

Review notes for discoveries worth handing on. For an explicit `found_at` path and line or
range, write one separate exact quotation from that range at the authored head. A bare ranged
path does not establish the discovery:

```yaml
discoveries:
  - id: exact-range
    what: The evidence records a durable exact excerpt.
    found_at: 'evidence.ts:2-3 "durable exact excerpt"'
    mattered_because: A later session can re-read the cited source.
```

No discovery, no justified applicability, an unrooted claim, and declining a received hypothesis
are all valid. Do not invent claims, infer applicability, rewrite citations, or promote notes
automatically.

Prefer a justified narrow path:

```yaml
applies_to: { kind: path, path: packages/substrate/src/evidence.ts }
```

Use repository scope only with an explicit cross-cutting reason:

```yaml
applies_to: { kind: repository }
```

Omit `applies_to` when no target is warranted. Keep the real decision and its why, and say what
a future session can act on. It changes neither authority nor gates, and does not establish better
judgment. Treat received context as a hypothesis: check, reject, or leave it unused.

Before filing, optionally inspect an authored candidate read-only with `interlock debrief preview --file <candidate>`.
<!-- interlock: debrief-authoring-guidance@v1:end -->
