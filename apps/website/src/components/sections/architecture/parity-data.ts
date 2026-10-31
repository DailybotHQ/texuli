/**
 * /web-and-native/ — web/native parity data (PLAN_006 T-50).
 *
 * One row per capability, with the honest web and native status sourced from
 * the T-16 feasibility findings (analysis_results/portability-demo.md) and
 * the committed native evidence section. Three statuses only:
 *
 * - `exists`    — ships today: published on npm or rendered on the site;
 * - `in-repo`   — real and tested in this repository, not published;
 * - `planned`   — decided or intended (ADR-005, native README), not built.
 *
 * Every cell cites the repository surface the status rests on; the unit test
 * asserts each surface exists in the checkout, so a row can never survive a
 * rename. Honesty rules: no promised dates, no "coming soon", no claim that
 * the Compose renderer is published, and the planned marker follows the
 * site convention (`data-status="planned"` plus the visible word).
 */

export type ParityStatus = 'exists' | 'in-repo' | 'planned';

export interface ParityCell {
  readonly status: ParityStatus;
  /** The one-sentence proof for the status. */
  readonly detail: string;
  /** Repository-relative surface the status rests on (path or directory). */
  readonly surface: string;
}

export interface ParityRow {
  readonly capability: string;
  readonly web: ParityCell;
  readonly native: ParityCell;
}

/** Visible status words, in the order the legend explains them. */
export const STATUS_LABELS: Readonly<Record<ParityStatus, string>> = {
  exists: 'Exists',
  'in-repo': 'In this repository',
  planned: 'Planned',
};

/** The legend line, stating exactly what each status means. */
export const STATUS_LEGEND =
  'Exists — ships today. In this repository — real and tested here, not published. Planned — decided or intended, not built. No status is inferred: every cell cites the surface it rests on.';

export const PARITY_ROWS: readonly ParityRow[] = [
  {
    capability: 'Component vocabulary and prop schemas',
    web: {
      status: 'exists',
      detail: 'Generated from the manifests and shipped in the npm packages (0.11.1).',
      surface: 'packages/spec/generated/typescript/vocabulary.ts',
    },
    native: {
      status: 'in-repo',
      detail: 'The same manifests generate the Kotlin projection, tested in this repository.',
      surface: 'packages/spec/generated/kotlin/com/texuli/spec/Vocabulary.kt',
    },
  },
  {
    capability: 'Blueprint validation',
    web: {
      status: 'exists',
      detail: 'The spec validator refuses invalid blueprints: closed ids, schemas, limits.',
      surface: 'packages/spec/src/validate.ts',
    },
    native: {
      status: 'in-repo',
      detail: 'The native validator refuses the same invalid fixtures with the same codes.',
      surface: 'native/texuli-spec/src/commonMain/kotlin/com/texuli/spec/runtime/SpecValidator.kt',
    },
  },
  {
    capability: 'Rendering',
    web: {
      status: 'exists',
      detail: 'The sink-free renderer paints catalog trees with no HTML strings.',
      surface: 'packages/catalog/src/render',
    },
    native: {
      status: 'in-repo',
      detail:
        'The Compose renderer is in development: it paints a documented slice, and anything outside it paints a visible placeholder.',
      surface: 'native/texuli-compose',
    },
  },
  {
    capability: 'Charts',
    web: {
      status: 'exists',
      detail: 'Chart math and every chart family, one lazy subpath per family.',
      surface: 'packages/charts/src',
    },
    native: {
      status: 'in-repo',
      detail: 'A bounded compact-chart slice: sparkline, bullet, gauge, progress ring.',
      surface: 'native/texuli-compose/src/commonMain/kotlin/com/texuli/compose/ChartWidgets.kt',
    },
  },
  {
    capability: 'Media',
    web: {
      status: 'exists',
      detail: 'Image, gallery, video, audio, captions and an image editor.',
      surface: 'packages/media/src',
    },
    native: {
      status: 'in-repo',
      detail: 'Image, figure, video and gallery frames; image decoding is planned.',
      surface: 'native/texuli-compose',
    },
  },
  {
    capability: 'Tokens and theming',
    web: {
      status: 'exists',
      detail: 'The OKLCH theme engine behind the --tx-* token contract.',
      surface: 'packages/tokens/src',
    },
    native: {
      status: 'in-repo',
      detail:
        'TexuliTheme mirrors the default theme’s neutral roles; the full engine generated from the spec’s token roles is planned.',
      surface: 'native/texuli-compose/src/commonMain/kotlin/com/texuli/compose/TexuliTheme.kt',
    },
  },
  {
    capability: 'Semantic conformance',
    web: {
      status: 'in-repo',
      detail: 'The web trace is the reference side of the dual-target golden gate.',
      surface: 'native/conformance/web/trace.ts',
    },
    native: {
      status: 'in-repo',
      detail: 'The golden gate requires each native trace to equal the web trace.',
      surface:
        'native/conformance/src/jvmTest/kotlin/com/texuli/conformance/GoldenConformanceTest.kt',
    },
  },
  {
    capability: 'App shells and layouts',
    web: {
      status: 'exists',
      detail: 'Content layouts, app shells and marketing layouts ship in the styled package.',
      surface: 'packages/texuli/src/layouts',
    },
    native: {
      status: 'planned',
      detail: 'App-shell layouts are planned; the renderer shows visible placeholders today.',
      surface: 'native/README.md',
    },
  },
  {
    capability: 'Distribution',
    web: {
      status: 'exists',
      detail: 'All 26 packages are on npm in the 0.11 line (see docs/RELEASE.md), pre-1.0.',
      surface: 'packages/texuli/package.json',
    },
    native: {
      status: 'planned',
      detail:
        'Maven Central under the com.texuli coordinates (ADR-005) is planned; the modules are consumed in place from this repository.',
      surface: 'native/README.md',
    },
  },
];

/**
 * The convention this section shares with the committed native evidence
 * section: planned work carries `data-status="planned"` on the rendered
 * element plus the visible word "Planned" — never color alone.
 */
export const PLANNED_MARKER = 'planned';
