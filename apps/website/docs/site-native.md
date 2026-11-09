# Texuli Native site pages

**App:** `apps/website`
**Pages:** `/native/` and `/native/compatibility/`
**Landing source:** `src/pages/native/index.astro`
**Compatibility source:** `src/pages/native/compatibility/index.astro`
**Sections:** `src/components/sections/native/`
**Compatibility data:** `src/data/native/compatibility.ts`

## Native landing

`/native/` introduces Texuli's Kotlin Multiplatform work and shows the current maturity plainly. The web renderer is available. The Compose renderer is in development and paints a subset of the catalog. The shared spec builds for JVM and iOS; Compose Desktop is the current UI target. Android and Compose iOS renderers are planned, and no native artifact is published.

The page is assembled in this order:

1. Native status and starting points.
2. A real blueprint fixture and its contract.
3. One interactive web and Compose Desktop demo.
4. Why the project uses Kotlin Multiplatform.
5. Components that travel across the shared blueprint.
6. Complex solutions and their current native status.
7. A compatibility summary by platform and component group.
8. Repository evidence and the planned-work ledger.
9. Frequently asked questions.
10. Principles and next steps for building.

All component counts and statuses come from compatibility data generated from the parity catalog and conformance evidence. The page does not hand-type those values.

## Compatibility reference

The full component table lives at `/native/compatibility/`. It is a static page in the docs shell with CSS-only group and status filters, evidence links, and no hydrated island. The native landing keeps a compact platform and group summary with a link to this table.

The split keeps the larger table from overwhelming the landing's page budget. `/native/` has a 122 KB gzip page budget and permits at most one island; that island is the demo, loaded when visible. The compatibility route has its own budget and remains static.

## Sources of truth

- `native/docs/parity.json` is generated from the spec catalog and native registry by `scripts/native-parity.ts`.
- `native/conformance/expected/` contains checked-in golden and parity traces.
- `src/data/native/compatibility.ts` derives component and platform statuses from the parity data, Gradle targets, native source files, and those traces.
- `native/texuli-spec/build.gradle.kts` configures JVM and iOS targets. `native/texuli-compose/build.gradle.kts` configures the JVM target used by Compose Desktop.
- `native/README.md` and `native/docs/ADOPTION.md` describe the native modules and adoption limits in detail.

The full table and evidence paths are also recorded in `native/docs/PARITY.md`. To refresh and check its generated source, run `pnpm exec tsx scripts/native-parity.ts --check` from the repository root.

## Supporting documentation content

The verified native documentation source files are in `src/content/native-docs/`: `getting-started.md`, `architecture.md`, `compatibility.md`, and `testing.md`. They cover the local checkout workflow, module and target boundaries, the generated support matrix, and the checks available today. They do not imply that unpublished native modules can be consumed from an external project. They are source notes for a later docs route and are not rendered as pages yet.

## Validation

- `pnpm build` runs the website type check and static build.
- `pnpm --filter @texuli/website typecheck` runs Astro diagnostics.
- `pnpm vitest run apps/website/tests/solutions/native-page.test.ts apps/website/tests/solutions/native-matrix.test.ts` checks the landing assembly, island limit, generated counts, matrix rows, and evidence links.
- `pnpm exec tsx scripts/native-parity.ts --check` verifies the generated parity document.
- `./native/gradlew -p native check` runs the native build and its configured tests when JDK 21 and the required Kotlin/Native toolchain are available.
