# Release policy

`jev-patterns` is an experimental open-source project. The v0.1.0 GitHub prerelease distributes a compiled package tarball. It is not published to npm; `private: true` prevents accidental registry publication. The npm name was unregistered when checked on 2026-09-23, which does not reserve it.

## Compatibility contract

Names, fields, nullability, inferred types, validation, threshold defaults, precedence and numerical tolerances are public behavior. Review them as API changes. Every release records relevant behavior changes in CHANGELOG.md with migration guidance where needed.

Before 1.0, breaking API changes require a minor-version increment; compatible fixes use a patch increment. Starting at 1.0, breaking changes require a major increment. Do not silently retune descriptive rules in a patch. Changes to shape interpretation or numerical policy also require a new profile identifier so stored results retain their provenance.

The package ships ESM JavaScript and TypeScript declarations. The current support floor is Node 24.14 and TypeScript 5.9.3. CommonJS-specific builds, older engines and browser bundlers are not claimed as supported without dedicated runtime checks. Bundler-mode type resolution is tested separately.

## GitHub releases

1. Update version, lockfile, changelog and package documentation. Review statistical/API changes against representative fixtures, keeping provisional cutoffs explicit.
2. Run `npm run check:full` from the reviewed checkout. Obtain passing results from the hosted Node/platform matrix for the exact release commit. A clean `npm run check` intentionally has no affected work and is not release evidence.
3. Review the tarball contents and declarations. The package must include its README assets and work without repository source. Build the release artifact from the tested commit; include a SHA-256 checksum with the download.
4. Create an annotated version tag and publish the artifact as a GitHub prerelease while the API remains experimental. Include the commit, validation and scope in the release notes.
5. Require the final `CI` status for changes to `main`, and use pull requests after the initial repository bootstrap. Review changes before merging. The workflow does not publish packages automatically.

Never replace an existing release artifact or tag to conceal a defect. Fix regressions in a new version with a reproducer and a documented correction.

## First npm release

Recheck package-name availability and confirm ownership immediately before publication. Confirm the public repository metadata, reporting links, install instructions and exact package contents. Remove `private: true` only in the deliberate npm release change and use an explicitly authorized maintainer publication of the verified artifact. GitHub publication alone neither reserves the npm name nor authorizes an npm publish.
