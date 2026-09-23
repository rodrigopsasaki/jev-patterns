# Release policy

The package is experimental and private. The local repository can build and test a distribution; no GitHub repository or npm package has been published from this task.

## Compatibility contract

Names, fields, nullability, inferred types, validation, threshold defaults, precedence and numerical tolerances are public behavior. Review them as API changes. Every release records relevant behavior changes in CHANGELOG.md with migration guidance where needed.

Before 1.0, breaking API changes require a minor-version increment; compatible fixes use a patch increment. Starting at 1.0, breaking changes require a major increment. Do not silently retune descriptive rules in a patch. Changes to shape interpretation or numerical policy also require a new profile identifier so stored results retain their provenance.

The package ships ESM JavaScript and TypeScript declarations. The current support floor is Node 24.14 and TypeScript 5.9.3. CommonJS-specific builds, older engines and browser bundlers are not claimed as supported without dedicated runtime checks. Bundler-mode type resolution is tested separately.

## First public release

1. Settle the package name and repository owner, verify availability and add the actual repository metadata and reporting links.
2. Review the vocabulary and semantics against representative synthetic distributions, documenting surprising boundaries and remaining ambiguities. Keep cutoffs explicitly provisional; an experimental release does not require pretending they are calibrated.
3. Run `npm run check:full` from a clean checkout and obtain passing results from the configured remote CI matrix. Require the final `CI` status and review before merging after the remote repository exists. A clean `npm run check` intentionally has no affected work and is not release evidence.
4. Review the exact tarball contents and declarations. Confirm license, package metadata, README installation examples, changelog and support policy.
5. Remove `private: true` only in the release change, choose a version, tag the reviewed commit and publish the verified artifact. Use an explicit maintainer release; the CI workflow does not publish packages.

Later releases repeat the verification and artifact review. A regression requires a reproducer and a documented fix. Never overwrite an existing release or claim verification that has only been configured, rather than run.
