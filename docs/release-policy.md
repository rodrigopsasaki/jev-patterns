# Release policy

`jev-patterns` is an experimental open-source project. v0.1.0 was GitHub-only; v0.2.0 was the first npm release, published by hand from a maintainer's machine using a long-lived npm token. Releases from here on are versioned and published through Changesets, and npm authentication uses Trusted Publishing (OIDC) instead of any token.

## Compatibility contract

Names, fields, nullability, inferred types, validation, threshold defaults, precedence and numerical tolerances are public behavior. Review them as API changes. Every release records relevant behavior changes in CHANGELOG.md with migration guidance where needed.

Before 1.0, breaking API changes require a minor-version increment; compatible fixes use a patch increment. Starting at 1.0, breaking changes require a major increment. Do not silently retune descriptive rules in a patch. Changes to observation semantics or numerical policy require a new profile identifier so stored results retain their provenance. Structural predicate defaults (`dominant`'s floor, `clustered`'s ratio, and so on) are the predicates' own parameters, not part of the profile, and may change independently; see the v0.3 removal of the named-shape classification layer in [the proposal](docs/proposal.md).

The package ships ESM JavaScript and TypeScript declarations. The current support floor is Node 24.14 and TypeScript 5.9.3. CommonJS-specific builds, older engines and browser bundlers are not claimed as supported without dedicated runtime checks. Bundler-mode type resolution is tested separately.

The TypeScript floor is CI-verified, not merely asserted: `typescript-floor` is a devDependency alias (`npm:typescript@5.9.3`) installed alongside the current `typescript` devDependency, and `test/package/consumer.mjs`'s declaration checks (run by `test:package`, part of `check:full`) type-check the packed declarations under *both* compilers, across NodeNext/Bundler module resolution and both `noUncheckedIndexedAccess` settings — four combinations per compiler, eight total. A floor bump or a declaration change the floor compiler rejects fails this gate directly, rather than only being caught by a maintainer reading the claim against the shipped `.d.ts` files by hand.

## Changesets

Every pull request that changes public behavior adds a changeset (`npm run changeset`) describing the change and its semver bump, in the same terms as the compatibility contract above — a breaking pre-1.0 change is `minor`, a compatible fix is `patch`. Changesets accumulate on `main` as individual files under `.changeset/`; nothing about the package version changes until they are released.

On every push to `main` (and on manual dispatch), `.github/workflows/release.yml` runs `changesets/action`:

- If unreleased changesets exist and no release PR is open, it opens `chore: version packages`, which runs `npm run version-packages` (`changeset version`) to bump `package.json`, prepend the accumulated changesets to `CHANGELOG.md`, and delete the consumed changeset files.
- Merging that PR is the release trigger. The same workflow run then executes `npm run release`, which runs the full `check:full` verification gate (Biome, both typecheck configurations, coverage, the installed-package replay) and, only if that passes, `node scripts/stage-release.mjs`.

`scripts/stage-release.mjs` decides whether to stage, and stages rather than publishes (see "npm publication" below). It stages only when the exact `package.json` version is not already on the registry, **and** either the run is a manual `workflow_dispatch` or the current commit changed `package.json`'s `version` relative to its parent commit. An ordinary push to `main` that neither dispatched nor bumped the version prints one line explaining why it skipped and exits `0` — the workflow stays green without restaging anything. The version-bump comparison is Git-based (`git show HEAD^:package.json` vs. the working tree), never a match on an npm error string.

No one runs `npm publish`, edits the version, or writes CHANGELOG.md by hand. A maintainer's manual steps are reviewing and merging the version-packages PR, and then approving the resulting staged package (below).

## npm publication (Trusted Publishing, staged)

`jev-patterns`'s npm Trusted Publisher is configured **stage-only**: the OIDC token this workflow mints can run `npm stage publish`, not `npm publish`. A plain publish attempt from CI is rejected with `E403 OIDC permission denied for this action` by design — that failure mode is expected, not a misconfiguration.

1. The release job requests `id-token: write` permission and pins an exact npm version `>= 11.15.0` (npm's staged-publishing floor) after `actions/setup-node`, since Node 24's bundled npm predates it. See the "Pin npm for staged publishing" step in `release.yml` for how that version was chosen and why it isn't a range.
2. At stage time, npm exchanges the job's short-lived GitHub Actions OIDC token for a scoped, one-time npm token — minted per run, never stored as a secret.
3. `npm stage publish --access public --provenance` packs the current `check:full`-verified artifact and places that exact version into the registry in a **staged, not publicly installable** state. Staging never prompts for 2FA. `package.json`'s `publishConfig` (`access: public`, `registry: https://registry.npmjs.org`) still fixes the public registry and access level.
4. A maintainer completes the release with 2FA, either `npm stage approve <stage-id>` from a local npm session or the **Staged Packages** tab on the package's npmjs.com page. `npm stage list` shows pending stage IDs. Only that approval step makes the version installable; OIDC tokens can never approve or reject a stage.
5. There is no `NODE_AUTH_TOKEN` or `NPM_TOKEN` anywhere in this repository or its workflows. A long-lived token, if one still exists from the v0.2.0 manual release, should be revoked on npmjs.com — it is no longer needed and no workflow reads it.

Trusted Publishing requires a one-time setup on npmjs.com: the package owner registers a trusted publisher for `jev-patterns` naming this GitHub repository and the `.github/workflows/release.yml` workflow file, with its stage-publish permission enabled and its publish permission disabled. Until that trust relationship exists, the release job's stage step fails closed rather than falling back to a token.

**Retrying a stage.** A version that is already staged cannot be staged again (staged and published versions share one semver index), so `stage-release.mjs` never restages a version once it's on the registry in either state. To retry after a failed or skipped run for the same version: re-run the `Version & Publish` job on the commit that carries that `package.json` version (its Git-diff check will see the same bump again), or dispatch the workflow manually (`workflow_dispatch` always attempts a stage, subject only to the "not already published" check).

**GitHub tags and releases are no longer created automatically.** `changesets/action` creates a GitHub release/tag by scanning the publish step's output for `New tag: ...` lines, which is what `changeset publish` used to print. `stage-release.mjs` never prints that — a GitHub release before a maintainer has actually approved the stage would announce a version that isn't installable yet. Tag and release creation, if wanted, is a manual step after approving the stage.

Verify a completed release the same way regardless of how it published: check the registry version, dist-tag and provenance attestation, then install from the registry in a fresh consumer and exercise the public API. Never republish, retag, or replace an existing version — fix a publication defect in a new version.

## Version-packages PRs don't trigger required CI (workaround)

`changesets/action` opens/updates the `chore: version packages` PR using the default `GITHUB_TOKEN`. GitHub does not run workflows (including the required `CI` check) for PRs created by `GITHUB_TOKEN`-authenticated pushes, so that PR shows no `CI` run and branch protection blocks merging it. The current workaround is manual: close the PR and immediately reopen it, which does trigger `CI` as a normal PR event. This is a known GitHub Actions limitation with `GITHUB_TOKEN`-opened PRs, not something to route around by weakening branch protection or switching to a different token.

## CI still gates every change

Ordinary PRs and `main` pushes continue to run through `.github/workflows/ci.yml` exactly as before; the release workflow is additive and only reacts to pushes on `main`. Require the final `CI` status in branch protection for both workflows to matter — a version-packages PR is reviewed and merged like any other change before it can trigger a publish.
