/**
 * Copy and structure for the /native/ hero + status section (PLAN_006 T-45).
 *
 * Framework-free on purpose: the Astro component renders this module as-is,
 * and the unit test (`apps/website/tests/section-contracts.test.ts`) pins
 * the same strings, so the test covers what ships. Every claim here is a
 * repository fact today:
 *
 * - the web packages are on npm as 0.9.0 (dist-tags `latest` and `next`);
 * - the Kotlin projection of the spec is generated and tested in-repo;
 * - the native Compose renderer is in development and conformance-tested,
 *   never published (`native/README.md`);
 * - Maven Central publication is planned under ADR-005's `com.texuli`
 *   coordinates and nothing is on Maven.
 *
 * Banned here, forever: invented versions, promised dates, "coming soon",
 * "write once", "production-ready native".
 */

/** The status kinds a ledger row can hold, in honesty order. */
export type NativeStatusKind = 'shipped' | 'development' | 'planned';

export interface NativeStatusRow {
  /** Stable id for tests and anchors. */
  id: string;
  /** What the row is about, e.g. "Web runtime". */
  term: string;
  kind: NativeStatusKind;
  /** The visible status word inside the badge. */
  statusLabel: string;
  /** The one-sentence proof for that status. */
  detail: string;
}

export interface NativeHeroLink {
  /** A real site route, resolved through `withBase` at render time. */
  href: string;
  label: string;
  role: 'primary' | 'secondary';
}

export const nativeHeroContent = {
  /** Heading ids: the component wires `aria-labelledby` from these. */
  ids: {
    hero: 'native-hero-title',
    status: 'native-status-title',
  },
  eyebrow: 'Texuli native · in development',
  title: 'The same catalog, rendered by Compose.',
  lead:
    'One component contract drives both runtimes. The web side ships today: every published package ' +
    'is on npm as 0.9.0. The native side renders Compose through Kotlin Multiplatform and ' +
    'is in development — conformance-tested in this repository, published nowhere yet.',
  statusHeading: 'What exists today',
  statusIntro: 'What ships, what is being built, and what is only planned — stated plainly.',
  statusRows: [
    {
      id: 'web-runtime',
      term: 'Web runtime',
      kind: 'shipped',
      statusLabel: 'Shipped',
      detail:
        'All 26 packages are published to npm in the 0.9 line (see docs/RELEASE.md), pre-1.0, and ' +
        'texuli.com builds from this repository.',
    },
    {
      id: 'spec-contract',
      term: 'Spec contract',
      kind: 'shipped',
      statusLabel: 'Shipped',
      detail:
        'One manifest projects both ways today: the TypeScript projection ships in the npm ' +
        'packages, and the Kotlin projection is generated and tested in ' +
        'packages/spec/generated/kotlin/.',
    },
    {
      id: 'native-renderer',
      term: 'Native renderer',
      kind: 'development',
      statusLabel: 'In development',
      detail:
        'A Compose renderer driven by Kotlin Multiplatform: page, document and deck layouts, ' +
        'text lists, boards, tables, media frames and a bounded compact-chart slice. ' +
        'Conformance-tested in this repository against the same semantic goldens as the web.',
    },
    {
      id: 'maven-central',
      term: 'Maven Central',
      kind: 'planned',
      statusLabel: 'Planned (ADR-005)',
      detail:
        'Publication under the fixed com.texuli coordinates is planned (ADR-005). Until then ' +
        'the native modules texuli-spec and texuli-compose are consumed in place from this ' +
        'repository — nothing is on Maven yet.',
    },
  ] satisfies NativeStatusRow[],
  links: [
    {
      href: '/guides/why-svelte-kotlin/',
      label: 'Read the deep dive: why Svelte and Kotlin',
      role: 'primary',
    },
    {
      href: '/web-and-native/',
      label: 'Why web and native, one contract',
      role: 'secondary',
    },
  ] satisfies NativeHeroLink[],
} as const;

export type NativeHeroContent = typeof nativeHeroContent;
