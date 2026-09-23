# Release policy

`jev-patterns` is an experimental open-source project. v0.2.0 is the first npm release and includes the individual-answer API. The earlier v0.1.0 release remains GitHub-only. Each release has a compiled package tarball on GitHub, with the same package distributed through npm.

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

## npm publication

1. Use an explicitly authorized maintainer release. Authenticate to the public npm registry and confirm the publishing identity and package ownership. For the first publication, verify the package name remains available.
2. Complete the same release checks and exact-commit hosted CI required above. Inspect the packed files, declarations, public metadata, and install instructions. Never publish an unreviewed working directory.
3. Publish that exact verified tarball with public access and the intended dist-tag. The package's `publishConfig` fixes the public registry and access level. Do not rebuild a different artifact during publication.
4. Verify registry version, dist-tag, ownership, and tarball integrity, then install from the registry in a fresh consumer and exercise the public API.
5. Attach the same tarball and checksum to the matching GitHub release. Never replace an existing version, tag, or artifact. Fix publication defects in a new version.

CI currently validates releases but does not publish them automatically. Phyxius-style trusted publishing can be configured separately once the package exists; it requires an npm trust relationship for this repository and its publishing workflow. Do not reuse credentials or trust settings from another package.
