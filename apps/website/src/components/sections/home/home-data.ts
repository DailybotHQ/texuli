/**
 * Build-time data for the texuli.com landing (PLAN_012): real library
 * themes for the swatch strip, the theme count, the catalog / primitives /
 * examples counts, and the published package count. Everything is read
 * from the source it names when the site builds; nothing is typed in.
 */

/** The palette values one real theme contributes to the swatch tile. */
export interface HeroThemeSwatches {
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  accent: string;
}

/** One real library theme, ready to paint. */
export interface HeroTheme {
  id: string;
  name: string;
  swatches: HeroThemeSwatches;
}

/** The six library themes the landing paints as swatches. */
export const HOME_THEME_IDS: readonly string[] = [
  'violet',
  'ocean',
  'emerald',
  'rose',
  'amber',
  'monochrome',
];

export async function loadHeroThemes(): Promise<readonly HeroTheme[]> {
  const { getFullThemeLibraryMeta, loadFullLibraryTheme } = await import(
    '@texuli/tokens/library-expand'
  );
  const meta = await getFullThemeLibraryMeta();
  const nameById = new Map(meta.map((entry) => [entry.id, entry.name]));
  return Promise.all(
    HOME_THEME_IDS.map(async (id): Promise<HeroTheme> => {
      const theme = await loadFullLibraryTheme(id);
      return {
        id,
        name: nameById.get(id) ?? id,
        swatches: {
          background: theme.light.background.default,
          foreground: theme.light.foreground.default,
          primary: theme.light.primary.default,
          primaryForeground: theme.light.primaryForeground.default,
          accent: theme.light.accent.default,
        },
      };
    })
  );
}

/** The real size of the theme library, computed at build — never hardcoded. */
export async function countAllThemes(): Promise<number> {
  const { getFullThemeLibraryMeta } = await import('@texuli/tokens/library-expand');
  return (await getFullThemeLibraryMeta()).length;
}

/** One proof-strip entry: a count read from the repository at build. */
export interface HeroProofStat {
  /** Stable hook for tests and the strip's `data-tx-hero-proof` attribute. */
  id: 'components' | 'primitives' | 'examples';
  value: number;
  label: string;
  /** The page that lists every item counted; app-authored site route. */
  href: string;
}

/** The proof strip's accessible name (core punch list row 6). */

/**
 * The proof strip under the hero CTAs (core punch list row 6; blueprint §5
 * s2): real counts only, each read at build from the same source the page
 * it links to renders — the catalog manifests behind `/component-pages/`,
 * the primitives reference behind `/primitives-page/`, and the examples
 * snapshot behind `/examples/`. The theme count stays the visual's h2.
 */
export async function loadHeroProof(): Promise<readonly HeroProofStat[]> {
  const [{ COMPONENT_PAGES }, { PRIMITIVES }, { buildExampleCatalog }] = await Promise.all([
    import('../../component-pages/load-manifests.ts'),
    import('../../primitives-page/primitives.ts'),
    import('../../examples/catalog.ts'),
  ]);
  return [
    {
      id: 'components',
      value: COMPONENT_PAGES.length,
      label: 'catalog components',
      href: '/component-pages/',
    },
    {
      id: 'primitives',
      value: PRIMITIVES.length,
      label: 'owned primitives',
      href: '/primitives-page/',
    },
    {
      id: 'examples',
      value: buildExampleCatalog().length,
      label: 'examples',
      href: '/examples/',
    },
  ];
}

const PACKAGE_MANIFESTS = import.meta.glob<{ name: string; private?: boolean }>(
  '../../../../../../packages/*/package.json',
  { import: 'default', eager: true }
);

/** Workspace packages that publish to npm (everything not marked private). */
export function countPublishedPackages(): number {
  return Object.values(PACKAGE_MANIFESTS).filter((manifest) => manifest.private !== true).length;
}
