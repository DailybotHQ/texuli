/**
 * The unified landing's correlation section: the flagship portability demo,
 * "one line in, two languages out" (PLAN_006 T-42; demo spec T-16
 * `portability-demo.md`, option 2 "spec-contract walkthrough"; narrative
 * blueprint §5 s5).
 *
 * Kept out of the .astro so the unit test
 * (`apps/website/tests/section-contracts.test.ts`) can pin every excerpt byte
 * for byte against the file it cites: if a regeneration of the spec
 * projections changes a quoted line, the test fails and the demo cannot
 * drift away from the real artifacts. The excerpts are code-authored text
 * constants rendered as text — never markup.
 *
 * What the demo shows, in order: the badge manifest authored once in
 * `@texuli/catalog`, the TypeScript projection the spec generator writes
 * (with the catalog JSON line it was generated from — the TypeScript
 * vocabulary carries ids and prop types, not summaries), and the Kotlin
 * projection, which carries the identical summary string. The native
 * renderer appears only as a status chip, never as an emulator screenshot.
 */

/** One verbatim excerpt of a repository file. */
export interface CorrExcerpt {
  /** Repository-relative path, shown as the citation. */
  file: string;
  /** Exact text of the file (byte for byte), indentation included. */
  code: string;
}

/** One panel of the walkthrough. */
export interface CorrPanel {
  id: 'manifest' | 'typescript' | 'kotlin';
  /** Step number shown on the panel. */
  step: number;
  title: string;
  /** What this artifact is, in one sentence. */
  description: string;
  /** The panel's primary file. */
  file: string;
  excerpts: readonly CorrExcerpt[];
}

/** A highlighted run of excerpt text. */
export interface CorrSegment {
  text: string;
  shared: boolean;
}

const MANIFEST_FILE = 'packages/catalog/src/manifests/display/manifests.ts';
const TS_FILE = 'packages/spec/generated/typescript/vocabulary.ts';
const SPEC_JSON_FILE = 'packages/spec/catalog/components.json';
const KOTLIN_FILE = 'packages/spec/generated/kotlin/com/texuli/spec/Vocabulary.kt';

/** Heading ids: the component wires `aria-labelledby` from these. */
export const WEB_CORR_IDS = {
  section: 'web-correlation-title',
  today: 'web-correlation-today',
  planned: 'web-correlation-planned',
} as const;

/** The section heading. */
export const WEB_CORR_TITLE = 'One line in, two languages out';

/** The string the demo highlights: declared once, identical in every panel. */
export const WEB_CORR_SHARED_STRING = 'A compact status or category label.';

export const WEB_CORR_LEDE =
  'Web and native correlate through one contract, not through a port. ' +
  'Follow the badge: its summary is written once in a catalog manifest, and the spec ' +
  'generator carries the same string into TypeScript and Kotlin with no manual sync.';

/** The demo spec's one honest caption line. */
export const WEB_CORR_CAPTION =
  'One declaration, two projections. The Kotlin renderer consumes this contract ' +
  '(in development).';

/** The demo spec's status chip for step 6, the native side. */
export const WEB_CORR_STATUS_CHIP =
  'Native renderer: in development, consumed in place from the repository. ' +
  'Maven publication pending (ADR-005).';

export const WEB_CORR_PANELS: readonly CorrPanel[] = [
  {
    id: 'manifest',
    step: 1,
    title: 'Authored once',
    description: 'The badge manifest in the agent catalog: id, label and summary.',
    file: MANIFEST_FILE,
    excerpts: [
      {
        file: MANIFEST_FILE,
        code: [
          'export const badgeManifest = /* @__PURE__ */ manifestData({',
          "  id: 'badge',",
          '  package: PKG,',
          "  label: 'Badge',",
          "  summary: 'A compact status or category label.',",
          "  tier: 'app',",
        ].join('\n'),
      },
    ],
  },
  {
    id: 'typescript',
    step: 2,
    title: 'TypeScript projection',
    description:
      'The generated vocabulary types the props; the summary travels in the spec catalog ' +
      'JSON it is generated from.',
    file: TS_FILE,
    excerpts: [
      {
        file: TS_FILE,
        code: [
          '  badge: {',
          '    label?: string;',
          '    variant?:',
          "      | 'default'",
          "      | 'secondary'",
          "      | 'outline'",
          "      | 'success'",
          "      | 'warning'",
          "      | 'destructive'",
          "      | 'info'",
          "      | 'neutral';",
          '  };',
        ].join('\n'),
      },
      {
        file: SPEC_JSON_FILE,
        code: '      "summary": "A compact status or category label."',
      },
    ],
  },
  {
    id: 'kotlin',
    step: 3,
    title: 'Kotlin projection',
    description: 'The generated Kotlin vocabulary: the identical summary string.',
    file: KOTLIN_FILE,
    excerpts: [
      {
        file: KOTLIN_FILE,
        code: [
          '        SpecComponent(',
          '            id = "badge",',
          '            label = "Badge",',
          '            summary = "A compact status or category label.",',
          '            group = "display",',
        ].join('\n'),
      },
    ],
  },
];

/** What moves between web and native today: contract artifacts. */
export const WEB_CORR_MOVES_TODAY: readonly string[] = [
  'Every component is declared once in the manifests of the agent catalog.',
  'The spec generator generates both a TypeScript and a Kotlin projection of that contract, ' +
    'stamped with the same spec digest.',
  'The spec package validates blueprints against that contract, with fixtures and tests in ' +
    'the repository.',
  'The web renders the badge today as a real Svelte 5 component.',
];

/** What is planned: each row names its gate, none carries a date. */
export const WEB_CORR_PLANNED: readonly string[] = [
  'Maven publication of the native modules under com.texuli is pending (ADR-005); nothing ' +
    'is on Maven Central yet.',
  'A released Compose renderer: today it is in development, consuming the generated Kotlin ' +
    'contract in place, with documented per-component statuses.',
  'A rendered native column in this demo is planned for when the renderer leaves development.',
];

/** The demo's link to the real rendered component on this site. */
export const WEB_CORR_DEMO_LINK = {
  href: '/component-pages/badge/',
  label: 'See the badge rendered on the web',
} as const;

/**
 * The architecture page, from the section that tells its story. The header's
 * platform doors hide under 40rem, so the page body carries this path too.
 */
export const WEB_CORR_ARCH_LINK = {
  href: '/web-and-native/',
  label: 'Read how web and native share one contract',
} as const;

/** Split code on the shared string: the template renders shared runs as `<mark>`. */
export function highlightShared(
  code: string,
  shared: string = WEB_CORR_SHARED_STRING
): CorrSegment[] {
  const segments: CorrSegment[] = [];
  let rest = code;
  for (let at = rest.indexOf(shared); at !== -1; at = rest.indexOf(shared)) {
    if (at > 0) segments.push({ text: rest.slice(0, at), shared: false });
    segments.push({ text: shared, shared: true });
    rest = rest.slice(at + shared.length);
  }
  if (rest.length > 0 || segments.length === 0) segments.push({ text: rest, shared: false });
  return segments;
}

/** Strip the common leading indentation so a deep excerpt reads flush. */
export function dedent(code: string): string {
  const lines = code.split('\n');
  const indent = Math.min(
    ...lines.filter((line) => line.trim() !== '').map((line) => /^ */.exec(line)?.[0].length ?? 0)
  );
  return lines.map((line) => line.slice(indent)).join('\n');
}
