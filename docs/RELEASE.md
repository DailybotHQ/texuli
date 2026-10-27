# Release and version policy

**Status:** policy for future, owner-authorized releases. This page documents
the intended process; it does not publish packages or grant release authority.

## Current npm status

All 15 packable packages are published to npm as `0.1.0-next.1` under the
`next` dist-tag (2026-10-25, publish workflow run
https://github.com/DailybotHQ/texuli/actions/runs/40238083612, from the
verified tarballs with signed provenance). Observed registry state on
2026-10-26: `npm view texuli dist-tags` prints
`{ latest: '0.1.0-next.0', next: '0.1.0-next.1' }` (the same for
`@texuli/core` and `@texuli/slides`), so `latest` still resolves to the
first upload, `0.1.0-next.0`, and a bare install gets that version; install
the previews with `@next`. By policy `latest` is reserved for the 1.0.0
stable release (see the dist-tag rules below). Workspace
manifests remain `private: true`; the previews are not approved for
general use, and every future version and wave requires a fresh, explicit
developer GO. Publishing never overwrites a published version.

## Independent package versions

Texuli uses independent SemVer versions per package, following the independent
package-version model recommended by ADR-002's monorepo strategy. A release in
one package does not require unrelated packages to share its version. Internal
dependency constraints and compatibility still follow the down-only package
graph.

Before a package reaches 1.0.0, its `0.x` minor is the API compatibility line:

- `0.x.y-next.N` is a pre-release. Increment `N` for another candidate on the
  same `0.x.y` line; do not replace or republish an existing version.
- Increment `y` for a backwards-compatible fix that does not add public API.
- Increment `x` for a backwards-compatible public feature or any breaking API
  change. A breaking change gets a new minor because `0.x` has no major-version
  slot to communicate incompatibility.
- Start each new `0.x.y` candidate line at `-next.0`. Once the API contract,
  support window, and stable release gates are accepted, a package may proceed
  to `1.0.0` under a separate developer GO. Packages make that transition
  independently.

For example, a fix candidate can progress from `0.2.1-next.0` to
`0.2.1-next.1`; a new feature or breaking change starts `0.3.0-next.0`.
Pre-release dependencies between Texuli packages use exact compatible
pre-release versions. Ordinary ranges do not select prerelease versions by
default.

## Dist-tags

- **`next`** points to the newest owner-approved preview. Use it for
  `0.x.y-next.N` versions, any other pre-release, and any supported `0.x`
  version. It moves only with a new version and a fresh GO.
- **`latest`** is npm's default install tag and is reserved for the first
  supported stable release. It is first used when an owner-approved `1.0.0`
  release has completed its compatibility, support, and release gates. No
  `0.x` release is ever tagged `latest`; where it resolves today is recorded
  under [Current npm status](#current-npm-status).
- Dailybot v4 and other production consumers must pin exact package versions
  in their manifests and lockfiles. They must not rely on a moving dist-tag;
  `next` is for deliberate preview integration only.

Promoting a version to a dist-tag does not change that version's bytes. Publish
a new immutable version for every fix or change; never overwrite an existing
version.

## Workspace dependencies and consumers

Task 172 made every published dependency an intentional semver range: the
published package manifests pin internal `@texuli/*` dependencies to exact
versions (prerelease compatibility between Texuli packages is exact, per
"Independent package versions" above), while the private development
manifests (`apps/website`, `packages/examples`, `packages/editor`) keep the
pnpm `workspace:` protocol. The release packer enforces that boundary
(`scripts/packages.ts` rewrites `workspace:` to the exact workspace version
and fails the pack when a published manifest would still carry
`workspace:*`, `link:`, `file:` or `0.0.0`).

This changes consumers from workspace resolution to registry resolution.
Applications such as Dailybot v4 and Protoyard must install published package
versions, record compatible exact versions in their lockfiles, and validate
the packed artifacts in their own consumer gates. A local workspace install
does not prove that a clean consumer can resolve the dependency graph. The
workspace remains the development source; the published semver ranges define
the package-to-package contract outside this repository.

## Compatibility map: npm, spec and native

| Surface | Version | Where it is pinned |
| --- | --- | --- |
| 15 npm packages | `0.1.0-next.1` (dist-tag `next`) | Each package manifest; published 2026-10-25 by the publish workflow (run 40238083612). |
| Blueprint spec | `0.2.0`, digest `d9eccaba1826e7d87648a4a33787d873245592dda843607a10b2c68a77f1806f` | `packages/spec/versions.json`; every generated file is stamped `// Spec 0.2.0, digest …`. |
| `@texuli/spec` (npm) | `0.1.0-next.1` | Ships the spec `0.2.0` generated sources stamped with the digest above. |
| Native modules (`texuli-spec`, `texuli-compose`) | source-consumed, no artifact | `native/` builds from `packages/spec/generated/kotlin`; planned Maven coordinates `com.texuli` (decision [ADR-005](DECISIONS.md)). Not published. |

- A normative spec change takes a new spec version and a fresh digest pin in
  `packages/spec/versions.json` (`tests/versioning.test.ts` enforces the pin);
  regeneration re-stamps the generated TypeScript and Kotlin.
- Consumers pin exact npm versions ("Dist-tags" above) and can assert the
  contract they built against via the digest stamp in `@texuli/spec`'s
  generated sources.
- The native modules are compatible with exactly the spec version whose
  generated Kotlin they consume — the conformance module tests against the
  same committed sources, so there is no separate native version to track
  until a Maven Central publication exists (owner GO; ADR-005).

## Publication waves

Tasks 174–178 establish this dependency order. Completing a task or passing a
gate does not publish anything; **each wave requires a separate, fresh owner
GO** for the exact packages, versions, tarball digests, and `next` or `latest`
tag. Any GO for Task 170's name reservation covers only that reservation.

| Task | Wave | Planned package order | Approval boundary |
| --- | --- | --- | --- |
| 174 | Foundations | `@texuli/core`, then `@texuli/tokens` | Fresh owner GO for the exact Task 174 package/version set after its release gates; core precedes tokens. |
| 175 | Controls | `@texuli/primitives` | Fresh owner GO after its core dependency and behavior, accessibility, size, pack, and consumer gates pass. |
| 176 | Styled package | `texuli` | Fresh owner GO after core, primitives, and tokens compatibility plus style and consumer gates pass. |
| 177 | Domain packages | `@texuli/charts`, `@texuli/data`, `@texuli/media`, `@texuli/chat`, `@texuli/blocks` | Fresh owner GO for the exact ready set after dependency order, package checks, size, pack, and consumer gates pass. |
| 178 | Catalog and integration tools | `@texuli/catalog`, `@texuli/tools`, `@texuli/astro`; `@texuli/player` and `@texuli/slides` only when ready | Fresh owner GO for each exact release set after implementation, dependency, pack, consumer, and relevant website/build gates pass. |

Each outward wave must also pass its task's `pnpm verify:packages` gate and
the applicable tests, type checks, layer checks, behavior, visual, size,
website, and clean-consumer checks from [TESTING_GUIDE](TESTING_GUIDE.md).
Record the exact version, source commit, tarball digest, tests, and chosen
dist-tag before requesting GO. A failure stops downstream waves; fix it in a
new version rather than reusing a published version.

## Honesty in documentation

The npm name reservation is a prerelease publication by the owner, not a
supported product release. Keep `private: true`, pre-release status, and the
absence of a stable `latest` release clear until the corresponding approved
stable release actually exists. A passing pack gate proves only that a tarball
was built and checked; it does not prove that it was published, supported, or
usable by consumers.
