/**
 * /web-and-native/ — portability deep-dive copy, citations and excerpts
 * (PLAN_006 T-51, per the T-16 demo spec's "Implementation spec for T-51").
 *
 * The rule the module enforces on itself (the committed why-kmp pattern):
 * every claim's `sources` phrases appear word for word in the cited
 * repository file and in this module's copy, and the three code excerpts are
 * byte-for-byte substrings of the files they name (joined from their
 * segments). The highlight rule is mechanical: a marked segment is either
 * SHARED_ID (present in all three cited surfaces) or SHARED_SUMMARY
 * (identical in the manifest and the Kotlin projection), so the page's
 * "one declaration, two languages" claim is re-proven by the unit test on
 * every run — evidence beats adjectives.
 *
 * Honesty: the limits are on screen, in plain language, anchored to the
 * repository files that state them. Banned: promised dates, "coming soon",
 * "production-ready", "write once", any claim that the Compose renderer is
 * published or that an iOS renderer ships today.
 */

/** A repository file plus the exact phrase the copy shares with it. */
export interface CitedPhrase {
  /** Repository-relative path of the cited file. */
  readonly file: string;
  /** The exact phrase (whitespace-normalized) the file and the copy share. */
  readonly phrase: string;
}

/** A piece of section copy plus the sources every phrase of it rests on. */
export interface PortabilityPiece {
  readonly text: string;
  readonly sources: readonly CitedPhrase[];
}

/** One step of the mechanism walk. */
export interface PortabilityStep {
  readonly title: string;
  readonly body: string;
  readonly sources: readonly CitedPhrase[];
}

/** A segment of a verbatim excerpt; `mark` highlights a shared string. */
export interface ExcerptSegment {
  readonly text: string;
  readonly mark?: boolean;
}

/** A verbatim repository excerpt shown as one panel of the walk. */
export interface PortabilityExcerpt {
  /** Repository-relative path, shown as the citation. */
  readonly file: string;
  /** The panel's role in the walk, shown as the figcaption lead. */
  readonly label: string;
  readonly segments: readonly ExcerptSegment[];
}

/** A link to a real on-site route, resolved through `withBase` at render. */
export interface PortabilityLink {
  readonly href: string;
  readonly label: string;
}

export const MANIFEST_FILE = 'packages/catalog/src/manifests/display/manifests.ts';
export const TS_PROJECTION_FILE = 'packages/spec/generated/typescript/vocabulary.ts';
export const KOTLIN_PROJECTION_FILE =
  'packages/spec/generated/kotlin/com/texuli/spec/Vocabulary.kt';
export const NATIVE_README = 'native/README.md';
export const TEXULI_THEME =
  'native/texuli-compose/src/commonMain/kotlin/com/texuli/compose/TexuliTheme.kt';
export const SEMANTICS = 'native/conformance/semantics.json';
export const GUIDE = 'apps/website/src/pages/guides/why-svelte-kotlin/index.astro';

/**
 * The strings the highlights claim are shared. The unit test proves both:
 * SHARED_ID appears in the manifest and in both generated projections;
 * SHARED_SUMMARY is byte-identical in the manifest and the Kotlin projection.
 */
export const SHARED_ID = 'badge';
export const SHARED_SUMMARY = 'A compact status or category label.';

export const PORTABILITY_EXCERPTS: readonly PortabilityExcerpt[] = [
  {
    file: MANIFEST_FILE,
    label: 'Declared once — the catalog manifest',
    segments: [
      { text: "export const badgeManifest = defineCatalogManifest({\n  id: '" },
      { text: SHARED_ID, mark: true },
      { text: "',\n  package: PKG,\n  label: 'Badge',\n  summary: '" },
      { text: SHARED_SUMMARY, mark: true },
      { text: "',\n  tier: 'app'," },
    ],
  },
  {
    file: TS_PROJECTION_FILE,
    label: 'Projected to TypeScript — shipped in the npm packages',
    segments: [
      { text: '  ' },
      { text: SHARED_ID, mark: true },
      {
        text: ": {\n    label?: string;\n    variant?:\n      | 'default'\n      | 'secondary'\n      | 'outline'\n      | 'success'\n      | 'warning'\n      | 'destructive'\n      | 'info'\n      | 'neutral';\n  };",
      },
    ],
  },
  {
    file: KOTLIN_PROJECTION_FILE,
    label: 'Projected to Kotlin — generated and tested in this repository',
    segments: [
      { text: '        SpecComponent(\n            id = "' },
      { text: SHARED_ID, mark: true },
      { text: '",\n            label = "Badge",\n            summary = "' },
      { text: SHARED_SUMMARY, mark: true },
      {
        text: '",\n            group = "display",\n            placement = SpecComponentPlacement.APP,\n            emit = listOf(),\n            capability = SpecComponentCapability.UNKNOWN,',
      },
    ],
  },
];

/** The caption under the panels; its two claims are proven mechanically. */
export const SHARED_NOTE =
  'The highlighted strings are the point: the component id badge is the same identifier in the manifest and in both generated projections, and the summary sentence is byte-identical in the manifest and the Kotlin projection — one declaration becoming two languages with no manual sync.';

export const PORTABILITY_LEDE: PortabilityPiece = {
  text: 'Portability in Texuli is the shape of the repository, not a promise about the future: every component is declared once in the manifests and projected into both languages, so what moves between the runtimes is the contract itself — and everything the contract can prove.',
  sources: [{ file: GUIDE, phrase: 'declared once in the manifests' }],
};

/** The mechanism walk: define once, project twice, tokens, behavior. */
export const PORTABILITY_STEPS: readonly PortabilityStep[] = [
  {
    title: 'Define once',
    body: "Every Texuli component's props, kinds, enums and tiers are declared once in the manifests — nothing about the interface is written twice by hand.",
    sources: [
      {
        file: GUIDE,
        phrase: "component's props, kinds, enums and tiers are declared once in the manifests",
      },
    ],
  },
  {
    title: 'Project twice',
    body: 'The same manifest data generates the TypeScript projection shipped in the npm packages and the Kotlin projection generated and tested in this repository. The badge summary sentence — "A compact status or category label." — is byte-identical in the manifest and the Kotlin projection: one declaration, two languages, no manual sync.',
    sources: [
      { file: MANIFEST_FILE, phrase: 'A compact status or category label.' },
      { file: KOTLIN_PROJECTION_FILE, phrase: 'A compact status or category label.' },
    ],
  },
  {
    title: 'Tokens cross',
    body: "The web themes through the --tx-* token contract. The native side starts honest and small: TexuliTheme is a minimal token theme until texuli-tokens is generated from the spec's token roles (design §3). The values mirror the default Texuli theme's neutral roles.",
    sources: [
      {
        file: TEXULI_THEME,
        phrase:
          "minimal token theme until texuli-tokens is generated from the spec's token roles (design §3)",
      },
      {
        file: TEXULI_THEME,
        phrase: "The values mirror the default Texuli theme's neutral roles",
      },
    ],
  },
  {
    title: 'Semantic roles cross',
    body: 'The same semantic rules — role, accessible name and, for headings, the level — hold on both sides: the web trace and the native trace apply these rules to a validated render tree. GoldenConformanceTest loads each golden with loadBlueprint, traces the plan, and must equal the web trace — so on the spec goldens both renderers expose the same roles, names and heading levels. Keyboard, focus and interaction behavior are not part of the trace.',
    sources: [
      { file: SEMANTICS, phrase: 'apply these rules to a validated render tree' },
      {
        file: NATIVE_README,
        phrase:
          'GoldenConformanceTest loads each golden with loadBlueprint, traces the plan, and must equal the web trace',
      },
    ],
  },
];

/**
 * What does NOT move today — on screen, because the section earns trust by
 * saying it. Every limit anchors to the repository file that states it.
 */
export const PORTABILITY_LIMITS: readonly PortabilityPiece[] = [
  {
    text: 'No transpilation: Svelte is never compiled to Compose. The native build consumes the blueprint contract from @texuli/spec and never imports TypeScript or Svelte — two renderers, one contract.',
    sources: [
      { file: NATIVE_README, phrase: 'consumes the blueprint contract from' },
      { file: NATIVE_README, phrase: 'and never imports TypeScript or Svelte' },
    ],
  },
  {
    text: 'Nothing is published to Maven Central yet: the native modules are consumed in place from this repository, and publication under the com.texuli coordinates (ADR-005) is planned, not done.',
    sources: [
      { file: NATIVE_README, phrase: 'Nothing is published to Maven Central yet' },
      { file: NATIVE_README, phrase: 'consumed in place from this repository' },
    ],
  },
  {
    text: 'No iOS renderer ships today: iOS is compiled for texuli-spec only, for a SwiftUI adapter that is still a design decision — Android is pending the same decision.',
    sources: [
      {
        file: NATIVE_README,
        phrase: 'iOS is compiled for texuli-spec only, for a SwiftUI adapter',
      },
      { file: NATIVE_README, phrase: 'Android is pending the same decision' },
    ],
  },
  {
    text: 'Web-extension props do not cross: on the native side extension props are dropped, and unknown ids become visible placeholders — never silence.',
    sources: [
      { file: NATIVE_README, phrase: 'extension props are dropped' },
      { file: NATIVE_README, phrase: 'unknown ids become visible placeholders' },
    ],
  },
  {
    text: 'And no slogan: Texuli does not claim an interface written for the web runs unchanged on native. Each runtime renders from the contract with its own tested renderer — the web in Svelte, native in Compose, in development.',
    sources: [{ file: NATIVE_README, phrase: 'in development' }],
  },
];

/** Real on-site routes; verified to exist at build time. */
export const PORTABILITY_LINKS: readonly PortabilityLink[] = [
  { href: '/component-pages/badge/', label: 'See the badge rendered on the web' },
  { href: '/guides/why-svelte-kotlin/', label: 'Read the deep dive: why Svelte and Kotlin' },
];
