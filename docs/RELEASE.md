# Release and version policy

**Status:** policy for future, owner-authorized releases. This page documents
the intended process; it does not publish packages or grant release authority.

## Current npm status

`0.3.0` is the current release of all 16 packable packages (owner decision
2026-10-27): the 15 packages of the `0.2.0` release plus `@texuli/date`,
which is published for the first time in `0.3.0`. The publish workflow
publishes it from `main` after the merge, from the verified tarballs with
signed provenance, and moves both the `latest` and `next` dist-tags to it,
so a bare `npm install texuli` or `pnpm add texuli` gets it.

`0.3.0` is a breaking `0.x` minor:

- `@texuli/primitives` re-exports `CalendarDate` from `@texuli/date`
  instead of `@internationalized/date`, which is no longer a dependency.
- `CalendarIdentifier` is narrowed to `'gregory'`: only the Gregorian
  calendar is supported.
- The calendar entry fell from about 13.05 to 5.15 KiB gzip and the date
  picker from about 28.60 to 20.26 KiB.

`0.3.0` is still pre-1.0, not a stable release: see "0.x versioning" below.
Workspace manifests remain `private: true`, and every future version and
wave requires a fresh, explicit developer GO. Publishing never overwrites a
published version.

### Not yet on npm

- `@texuli/drag` (the drag engine, layer L0) and `@texuli/workflows` (the
  workflow editor and viewer, layer L4) are **in development**: private
  `0.0.0` workspace packages, never published.
- `@texuli/editor` and `@texuli/examples` stay private (`NEVER_PACKED` in
  `scripts/packages.ts`).
- The repository is ahead of npm: the `0.3.0` tarballs on npm predate
  PLAN_007, so the changes under "Unreleased" below are not in any published
  version.

### Unreleased (in the repository after `0.3.0`)

These reach npm only with the next owner-approved release (a new `0.x`
minor, because some are breaking):

- **Breaking, `@texuli/data`:** the board and tree view no longer export
  `DRAG_THRESHOLD_PX` or `indexFromPointer`. Every drag surface (board, tree
  view, calendar, timeline, grid column moves) now runs on `@texuli/drag`
  with localized `DragMessages`; use `@texuli/drag/gesture` for the
  threshold and `@texuli/drag/collision` (`midpointIndex`) for the index.
- **`@texuli/primitives`:** a new `@texuli/primitives/sortable` binding
  (`Sortable.Root`, `List`, `Item`, `Handle`) on `@texuli/drag`.
- **Blueprint spec 0.3.0** (ADR-008): envelope `spec`, `state` and `flow`;
  node `bind` and `on`; `$state` and `$data` bindings; the closed actions
  (`setState`, `toggleState`, `moveItem`, `flowGo`, `emit`, `submit`);
  `reorder` (drag as data) and `workflowGraph` (`schemas/workflow.schema.json`);
  migrations from 0.2.0 (`@texuli/spec/migrate`); the state surface and list
  item text rules (`@texuli/spec/surface`); and catalog coverage of 158 ids.
  A 0.2.0 blueprint migrates purely and still validates.
- **`@texuli/player`:** paints every agent-emittable id from JSON (data views,
  chat display, sortable lists with a shared drag scope, workflow graphs)
  and runs the closed actions.
- **Unchanged, for the record:** the chat composer stays host chrome. The
  catalog has no `chat-composer` entry, and the player refuses the id at
  every tier; hosts mount a composer in their own chrome. The
  `CalendarIdentifier` narrowing to `'gregory'` already shipped in `0.3.0`
  (above).

### History

- `0.2.0` (2026-10-27): the first non-prerelease `0.x` line, for the 15
  packages that were packable then. `@texuli/primitives@0.2.0` is immutable
  and still depends on `@internationalized/date`; `0.3.0` replaces it with
  `@texuli/date`.
- `0.1.0-next.0` through `0.1.0-next.3` (previews): `0.1.0-next.0` was the
  name reservation, `0.1.0-next.1` went out on 2026-10-25 (run
  https://github.com/DailybotHQ/texuli/actions/runs/40238083612), and
  `0.1.0-next.2` (the PLAN_006 package fixes) and `0.1.0-next.3` (consumer
  READMEs and two CLI fixes) on 2026-10-27.

### 0.x versioning

Until 1.0.0, a breaking change bumps the minor (`0.3.0` to `0.4.0`) and a
fix bumps the patch (`0.3.0` to `0.3.1`). Consumers pin the exact version or
use `~0.3.0` or `^0.3.0`; for a `0.x` version both ranges accept only
`0.3.x`, so a new minor never arrives unasked. 1.0.0 will be the first stable
release.

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

For example, a fix candidate can progress from `0.3.1-next.0` to
`0.3.1-next.1`; a new feature or breaking change starts `0.4.0-next.0`.
Pre-release dependencies between Texuli packages use exact compatible
pre-release versions. Ordinary ranges do not select prerelease versions by
default.

## Dist-tags

- **`next`** points to the newest owner-approved version, including any
  future `0.x.y-next.N` or other pre-release. The publish workflow always
  publishes with `--tag next`, so it moves only with a new version and a
  fresh GO. It names `0.3.0` once the publish workflow runs after the merge
  (`0.2.0` before that).
- **`latest`** is npm's default install tag, and npm's package page shows
  the README of the version it names. It tracks the newest release, before
  and after 1.0.0: the publish workflow moves it together with `next`
  (owner decision 2026-10-27; before that, `latest` was reserved for 1.0.0
  and stayed on the first upload, `0.1.0-next.0`). It names `0.3.0` once the
  publish workflow runs after the merge (`0.2.0` before that).
  The workflow moves `latest` on every run, so publishing a future
  pre-release without moving `latest` needs a workflow change first.
- Dailybot v4 and other production consumers must pin exact package versions
  in their manifests and lockfiles. They must not rely on a moving dist-tag;
  `next` is for deliberate pre-release integration only.

Promoting a version to a dist-tag does not change that version's bytes. Publish
a new immutable version for every fix or change; never overwrite an existing
version.

## Workspace dependencies and consumers

Task 172 made every published dependency an intentional semver range: the
published package manifests pin internal `@texuli/*` dependencies to exact
versions (for `0.3.0`, every internal pin is exactly `0.3.0`; compatibility
between Texuli packages is exact, per "Independent package versions" above), while the private development
manifests (`apps/website`, `apps/agent`, `packages/examples`, `packages/editor`) keep the
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
| 16 npm packages | `0.3.0` (dist-tags `latest` and `next`) | Each package manifest; published by the publish workflow after the merge (before it: `0.2.0` for 15 packages on 2026-10-27; previews `0.1.0-next.3` and `0.1.0-next.2` on 2026-10-27; `0.1.0-next.1`: 2026-10-25, run 40238083612). |
| `@texuli/date` | `0.3.0` (first publication) | `packages/date/package.json`; published with the other 15 packages, before `@texuli/primitives`, which depends on it. |
| Blueprint spec (repository) | `0.3.0`, digest `a95f691514814a39e5f7f1b98b1598ab08af0e2151a2c019c51eb8d58c0a7848` | `packages/spec/versions.json`; every generated file is stamped `// Spec 0.3.0, digest …`. Not yet on npm. |
| Blueprint spec (npm) | `0.2.0`, digest `d9eccaba1826e7d87648a4a33787d873245592dda843607a10b2c68a77f1806f` | Shipped by `@texuli/spec@0.3.0`, whose generated sources carry the `0.2.0` stamp. |
| `@texuli/spec` (npm) | `0.3.0` | Ships the spec `0.2.0` generated sources (above). |
| `@texuli/drag`, `@texuli/workflows` | `0.0.0`, private | Not on npm; in development. |
| Native modules (`texuli-spec`, `texuli-compose`) | source-consumed, no artifact | `native/` builds from `packages/spec/generated/kotlin`; planned Maven coordinates `com.texuli` (decision [ADR-005](DECISIONS.md)). Not published. |

- A normative spec change takes a new spec version and a fresh digest pin in
  `packages/spec/versions.json` (`tests/spec.test.ts` enforces the pin);
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
| 0.3.0 | Date foundation | `@texuli/date`, before `@texuli/primitives` (first published in `0.3.0`) | Fresh owner GO for the exact version; `@texuli/date` precedes the primitives that depend on it. |
| Next (planned) | Drag foundation | `@texuli/drag`, before `@texuli/primitives` and `@texuli/data` | Fresh owner GO for its first version; it must be published **before** every package that depends on it (`@texuli/primitives`, `@texuli/data`, `@texuli/workflows`). |
| 175 | Controls | `@texuli/primitives` | Fresh owner GO after its core dependency and behavior, accessibility, size, pack, and consumer gates pass. |
| 176 | Styled package | `texuli` | Fresh owner GO after core, primitives, and tokens compatibility plus style and consumer gates pass. |
| Next (planned) | Workflows | `@texuli/workflows`, after `@texuli/drag` and `texuli`, before `@texuli/player` | Fresh owner GO for its first version; it must be published **before** `@texuli/player`, which depends on it. |
| 177 | Domain packages | `@texuli/charts`, `@texuli/data`, `@texuli/media`, `@texuli/chat`, `@texuli/blocks` | Fresh owner GO for the exact ready set after dependency order, package checks, size, pack, and consumer gates pass. |
| 178 | Catalog and integration tools | `@texuli/catalog`, `@texuli/tools`, `@texuli/astro`, `@texuli/player`, `@texuli/slides`, `@texuli/spec` (the order in `publish.yml`; all six went out in the 2026-10-25 `0.1.0-next.1` run) | Fresh owner GO for each exact release set after implementation, dependency, pack, consumer, and relevant website/build gates pass. |

The two planned rows are not in `.github/workflows/publish.yml` yet; adding
them there waits for an owner-approved release. Until `@texuli/drag` and
`@texuli/workflows` carry a real version, `pnpm verify:packages` refuses the
packages that depend on them (the packer reports
`@texuli/drag: published range must be a real semver range, got "0.0.0"`),
which is the guard that keeps an unpublished dependency out of a published
manifest.

Each outward wave must also pass its task's `pnpm verify:packages` gate and
the applicable tests, type checks, layer checks, behavior, visual, size,
website, and clean-consumer checks from [TESTING_GUIDE](TESTING_GUIDE.md).
Record the exact version, source commit, tarball digest, tests, and chosen
dist-tag before requesting GO. A failure stops downstream waves; fix it in a
new version rather than reusing a published version.

## Honesty in documentation

The npm name reservation (`0.1.0-next.0`) was a prerelease publication by
the owner, not a supported product release. `0.3.0` is a release but not a
stable one: keep `private: true`, the pre-1.0 status, and the absence of a
stable 1.0.0 clear until the corresponding approved stable release actually
exists. A passing pack gate proves only that a tarball
was built and checked; it does not prove that it was published, supported, or
usable by consumers.

## Skill release

The agent skill (`skills/texuli/`) is released apart from the npm packages,
by `.github/workflows/skill-release.yml`. **No skill release has been cut
yet**: the first one happens on the first push to `main` after this
workflow lands, when the run's conditions below hold. Until then the pack
is installed from a checkout ([SKILL_INSTALLATION](SKILL_INSTALLATION.md)).

**Tags.** Skill releases are tagged `skill-vX.Y.Z`. The npm publish
workflow triggers on `v*` tags; GitHub matches tag filters against the
whole tag name, so `skill-v0.3.0` never starts an npm publish, and a
package tag never starts a skill release (the skill workflow does not
trigger on tags at all).

**Trigger.** The workflow runs on `workflow_run` after the `CI` workflow
completes for a push to `main`, and only when CI succeeded. It is skipped
when the head commit is a release commit (`chore(release):`) or carries
`[skip release]`, and when no commit since the last `skill-v` tag touches
`skills/texuli/`.

**Version.** The router's quoted `version:` in `skills/texuli/SKILL.md` is
the only source; the release writes it into every `SKILL.md`
(`pnpm check:skill` fails on a sub-skill that disagrees). The bump comes from
the Conventional Commits that touch `skills/texuli/` since the last stable
`skill-vX.Y.Z` tag: a breaking change (`type!:` or a `BREAKING CHANGE:`
footer) is a major, `feat` a minor, anything else a patch. Before 1.0.0 a
breaking change bumps the minor, as for the packages. When the router is
already ahead of the last tag (the first release, or a deliberate 1.0.0
set by hand in a reviewed commit), that version is released as written.

**Steps.** With `contents: write` only in the release job:

1. `pnpm exec tsx scripts/check-skill.ts --release-plan` decides the version
   and tag; `--release <version>` syncs the version into every `SKILL.md`,
   stamps `skills/texuli/CHANGELOG.md` (the commit subjects, then the folded
   body of the hand-written `## [Unreleased]` block, which is left empty),
   regenerates `SHA256SUMS` (`--write-sums`), refreshes the dogfood mirror
   `.agents/skills/texuli/` and its `skills-lock.json` hash, and validates the
   pack.
2. The release commit `chore(release): texuli skill X.Y.Z [skip release]`
   and the annotated tag `skill-vX.Y.Z` are pushed together with
   `git push --atomic`: either both land or neither does, so a rejected push
   (branch protection, or `main` moved on) leaves no dangling tag.
3. `git archive` builds `texuli-skill-X.Y.Z.tar.gz` from the tag (the pack
   only, unpacking to `texuli/`); `SHA256SUMS` lists the archive and every
   unpacked file, and the job checks both with `sha256sum -c` and
   `setup.sh --verify --dir … --expect-version` before publishing.
4. `gh release create` publishes the GitHub Release with the stamped
   changelog section as its notes and both assets.
5. A separate job with read-only permissions and no persisted credentials
   installs the new tag with the skills CLI, pinned by its tree URL, into a
   temp project and asserts the installed version and checksums.

Pushing the release commit to a protected `main` needs the
`AUTOMATION_GITHUB_TOKEN` secret (a token allowed to bypass branch
protection); without it the job falls back to `GITHUB_TOKEN` and the
atomic push fails cleanly. Pre-releases of the skill are not automated.

**Provenance.** Releases are checksummed, not signed. The pack's own
`SHA256SUMS` travels with the files; only the release `SHA256SUMS` asset is
independent provenance ([TRUST.md](../skills/texuli/TRUST.md#provenance)).
