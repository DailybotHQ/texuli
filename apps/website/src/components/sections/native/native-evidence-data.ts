/**
 * /native/ — evidence + roadmap data (PLAN_006 T-47).
 *
 * Single source for the section component and its unit test. Every `path`
 * is repo-relative and must exist in the checkout: the unit test asserts
 * each one with `existsSync`, and pins the cited facts to the registry in
 * `native/README.md`, so the page cannot drift from what the repository
 * actually holds ("sourced at build, never hand-copied").
 *
 * Honesty rules (analysis_results/narrative-blueprint.md §4 and §6):
 * - shipped rows name artifacts that exist in this repository today;
 * - planned rows carry the planned marker (`data-status="planned"` on the
 *   rendered list item, under the visible "Planned" heading the site
 *   already uses for planned work);
 * - no dates presented as promises, no store badges, no invented versions,
 *   and no claim that anything is published to Maven Central.
 */

export interface NativeEvidenceItem {
  /** Short name shown as the row title. */
  readonly name: string;
  /** One-line role, in customer language. */
  readonly role: string;
  /** Repo-relative path, rendered as code (the site does not mirror files). */
  readonly path: string;
}

/**
 * The native surface of the repository: the three Gradle modules of the
 * self-contained `native/` build, the generated Kotlin projection they
 * compile in place, the registry that documents them, and the semantic
 * rule file the dual-target golden gate is built on.
 */
export const NATIVE_MODULES: readonly NativeEvidenceItem[] = [
  {
    name: 'texuli-spec',
    role: 'The native contract module: the generated Kotlin models, enums and decoders, plus the strict JSON reader, the blueprint validator and the render plan. Compiles for the JVM and for iOS targets.',
    path: 'native/texuli-spec',
  },
  {
    name: 'texuli-compose',
    role: 'The Compose renderer: the token theme, the native registry and typed host intents, with layout, text, list, table, board, stat, media and compact-chart widgets. Anything outside the documented slice paints a visible placeholder, never silence.',
    path: 'native/texuli-compose',
  },
  {
    name: 'conformance',
    role: 'The native half of the dual-target golden gate: each spec golden must trace identically on web and native, every invalid fixture must be refused with the TypeScript validator’s codes, and six Kotlin Multiplatform app migrations pin each widget’s status.',
    path: 'native/conformance',
  },
  {
    name: 'generated Kotlin projection',
    role: 'The Kotlin projection generated from the same manifests as the shipped TypeScript packages — compiled in place by the native modules, never copied, so both languages stay one declaration apart.',
    path: 'packages/spec/generated/kotlin/com/texuli/spec',
  },
  {
    name: 'native/README.md',
    role: 'The registry this section summarizes: widget statuses, the Kotlin test map, the target graph and the build-health baseline.',
    path: 'native/README.md',
  },
  {
    name: 'semantics.json',
    role: 'The target-neutral semantic rules — role, accessible name and heading level per catalog id — that the web and native traces must both satisfy.',
    path: 'native/conformance/semantics.json',
  },
];

/**
 * What exists and passes today. Every row is verifiable in this checkout;
 * the unit test pins the named suites to the registry.
 */
export const NATIVE_SHIPPED: readonly string[] = [
  'The Kotlin projection is generated and tested in this repository, from the same manifest data the shipped TypeScript packages are built from.',
  'texuli-spec compiles for the JVM and for iOS (arm64 and simulator targets); texuli-compose and conformance run their suites on the JVM.',
  'The Compose renderer paints a documented slice: page, document, deck, card and grid layouts; text blocks and ordered and unordered lists; static boards; stat and KPI blocks; accessible tables; image, figure, video and gallery media frames; and a bounded compact-chart slice (sparkline, bullet, gauge, progress ring).',
  'The dual-target golden gate passes: GoldenConformanceTest requires each spec golden’s native semantic trace to equal the web trace, and InvalidFixtureParityTest refuses every invalid fixture with exactly the TypeScript validator’s codes.',
  'Six Kotlin Multiplatform app migrations pin every widget’s documented status, from a starter screen to a static game scoreboard.',
  'HostilePropsTest drives wrong types, depth bombs and control strings through every projection: nothing throws, and everything stays in bounds.',
  'The web runtime is published: all 26 packages are on npm in the 0.10 line (see docs/RELEASE.md), a pre-1.0 line.',
];

/**
 * Planned means planned. Each row names its gate — a design decision or an
 * owner go — and none carries a date. Nothing native is published to any
 * registry yet: both modules are consumed in place from this repository.
 */
export const NATIVE_PLANNED: readonly string[] = [
  'Maven Central publication under the fixed com.texuli coordinates (ADR-005) is planned. The namespace is verifiable by DNS, but publication wiring still needs the owner’s go — nothing is on Maven Central yet, and both modules stay consumed in place from this repository.',
  'An Android target for the renderer, pending a design decision.',
  'A SwiftUI adapter over the iOS texuli-spec projection, pending the same decision.',
  'Image decoding is planned: data-URI pixels and a host-supplied loader for https and relative sources, plus a conformance golden with media.',
  'App-shell layouts and the remaining chart families are planned — visible placeholders in the renderer today.',
];

/** Real on-site routes this section may link to; verified to exist. */
export const NATIVE_LINKS: readonly {
  readonly href: string;
  readonly label: string;
}[] = [
  { href: '/web-and-native/', label: 'One contract, two runtimes' },
  { href: '/guides/why-svelte-kotlin/', label: 'Why Svelte and Kotlin' },
];

/**
 * Strings the copy cites; each must appear verbatim in `native/README.md`.
 * The unit test fails if the registry stops saying what this page claims.
 */
export const REGISTRY_FACTS: readonly string[] = [
  'texuli-spec',
  'texuli-compose',
  'GoldenConformanceTest',
  'InvalidFixtureParityTest',
  'HostilePropsTest',
  'KmpStarterMigrationTest',
  'KmpTapDuelMigrationTest',
  'Nothing is published to Maven Central yet',
];
