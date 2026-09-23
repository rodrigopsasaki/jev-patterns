# Review orchestration

The approved `initial-review` Interlock graph contains two independent report-only nodes: statistics and API. Product code is integrated by the parent session after reviewing their findings. Report gates verify structure; they do not certify the scientific correctness of the report.

The initial launch could not reach an agent. Its brief commit hit a sandbox restriction on Git signing. The current desktop task also runs outside a Herdr-managed pane and has no active Herdr server. The two reviews therefore used native Codex subagents as an explicit fallback. Their reports are not Interlock-cleared outcomes. The approval and failed attempt remain in the local ledger, excluded from the public repo.

The 2026-09-23 test-hardening pass also used native sessions: separate Jev wire-contract, numerical-property/boundary, and TypeScript/matching tasks. The parent integrated two validation/dispatch fixes, added packaging and CI checks, and ran the complete gate on Node 24.14.0 and 26.9.0. A further independent package review caught source-only imports in the shipped README; installed-example tests now cover that regression. These are locally verified test results, not new Interlock receipts or remote CI results. The original approved graph was not changed or reused as approval for the later work.

The later Biome/Vitest migration used the same native fallback for runtime-test migration, Git selection/CLI contracts and independent CI review. The parent integrated formatting, affected/full runners, installed-package smoke and conditional CI. Review identified quoted Git paths, clean-build cache isolation, CRLF README parsing and the need to run full verification when the package harness changes. The selected local checks are recorded in terminal output; no Interlock or hosted-CI receipts are claimed.

## Normal Interlock setup

Use the installed Interlock CLI from a properly configured Herdr session. Copy `.interlock/local.example.yaml` to `.interlock/local.yaml`, choose an authenticated runtime, and use the graph approval and run commands. Local runtime configuration stays outside Git.

```sh
interlock schema validate .interlock/graphs/initial-review.yaml
interlock brief validate initial-review statistics
interlock brief validate initial-review api
interlock run initial-review statistics
interlock run initial-review api
```

The failed statistics attempt may retain a lease until it expires. Inspect the graph with `interlock graph show initial-review`; use normal sweep/recovery commands when appropriate. Do not delete the ledger or fabricate a completed session to hide a launch failure.

## Kimi

The installed Interlock Herdr adapter already includes `kimi` among its supported runtime kinds. No new provider adapter is indicated by that code. The `kimi` executable was not on PATH in the parent shell when checked; no Kimi session has been verified.

Install and authenticate Kimi using the [official current Kimi Code instructions](https://www.kimi.com/code/docs/en/). Current documentation describes launching `kimi` and completing `/login`. A Kimi Code subscription login and a Moonshot API key are different access paths; use the one attached to your account. Never put credentials in the repository or a review brief.

After confirming `kimi --version` and a normal authenticated terminal interaction, copy `.interlock/local.kimi.example.yaml` to the ignored `.interlock/local.yaml`. Run a small review first and verify that Herdr recognizes startup, work and completion. Recognizing a runtime name does not establish that the installed CLI version's lifecycle is compatible.
