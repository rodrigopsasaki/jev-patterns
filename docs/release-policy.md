# Release policy

`jev-patterns` is an experimental open-source project. v0.1.0 was GitHub-only; v0.2.0 was the first npm release, published by hand from a maintainer's machine using a long-lived npm token. Releases from here on are versioned and published through Changesets, and npm authentication uses Trusted Publishing (OIDC) instead of any token.

## Compatibility contract

Names, fields, nullability, inferred types, validation, threshold defaults, precedence and numerical tolerances are public behavior. Review them as API changes. Every release records relevant behavior changes in CHANGELOG.md with migration guidance where needed.

Before 1.0, breaking API changes require a minor-version increment; compatible fixes use a patch increment. Starting at 1.0, breaking changes require a major increment. Do not silently retune descriptive rules in a patch. Changes to shape interpretation or numerical policy also require a new profile identifier so stored results retain their provenance.

The package ships ESM JavaScript and TypeScript declarations. The current support floor is Node 24.14 and TypeScript 5.9.3. CommonJS-specific builds, older engines and browser bundlers are not claimed as supported without dedicated runtime checks. Bundler-mode type resolution is tested separately.

## Changesets

Every pull request that changes public behavior adds a changeset (`npm run changeset`) describing the change and its semver bump, in the same terms as the compatibility contract above — a breaking pre-1.0 change is `minor`, a compatible fix is `patch`. Changesets accumulate on `main` as individual files under `.changeset/`; nothing about the package version changes until they are released.

On every push to `main`, `.github/workflows/release.yml` runs `changesets/action`:

- If unreleased changesets exist and no release PR is open, it opens `chore: version packages`, which runs `npm run version-packages` (`changeset version`) to bump `package.json`, prepend the accumulated changesets to `CHANGELOG.md`, and delete the consumed changeset files.
- Merging that PR is the release trigger. The same workflow run then executes `npm run release`, which runs the full `check:full` verification gate (Biome, both typecheck configurations, coverage, the installed-package replay) and, only if that passes, `changeset publish`.

No one runs `npm publish`, edits the version, or writes CHANGELOG.md by hand. A maintainer's only manual step is reviewing and merging the version-packages PR.

## npm publication (Trusted Publishing)

Publishing authenticates via npm's Trusted Publishing (OIDC), not a stored credential:

1. The release job requests `id-token: write` permission and runs on Node 24 (npm ≥ 11.5.1, required for the OIDC mint at publish time).
2. At publish time, npm exchanges the job's short-lived GitHub Actions OIDC token for a scoped, one-time npm publish token — minted per run, never stored as a secret.
3. `package.json`'s `publishConfig` (`access: public`, `registry: https://registry.npmjs.org`) fixes the public registry and access level; `changeset publish` publishes exactly the artifact built by the preceding `check:full` run, with npm provenance attached automatically for a public repo publishing a public package.
4. There is no `NODE_AUTH_TOKEN` or `NPM_TOKEN` anywhere in this repository or its workflows. A long-lived token, if one still exists from the v0.2.0 manual release, should be revoked on npmjs.com — it is no longer needed and no workflow reads it.

Trusted Publishing requires a one-time setup on npmjs.com: the package owner registers a trusted publisher for `jev-patterns` naming this GitHub repository, the `.github/workflows/release.yml` workflow file, and (if used) the deploying environment. Until that trust relationship exists, the release job's publish step fails closed rather than falling back to a token.

Verify a completed release the same way regardless of how it published: check the registry version, dist-tag and provenance attestation, then install from the registry in a fresh consumer and exercise the public API. Never republish, retag, or replace an existing version — fix a publication defect in a new version.

## CI still gates every change

Ordinary PRs and `main` pushes continue to run through `.github/workflows/ci.yml` exactly as before; the release workflow is additive and only reacts to pushes on `main`. Require the final `CI` status in branch protection for both workflows to matter — a version-packages PR is reviewed and merged like any other change before it can trigger a publish.
