/**
 * Copy, links and the real-theme data loader for the unified landing's hero
 * (PLAN_006 T-40; narrative blueprint §1 "Hero direction", §5 s1, §6).
 *
 * Framework-free on purpose: the Astro component renders this module as-is
 * and the unit test (`apps/website/tests/section-contracts.test.ts`) pins the same
 * strings, so the test covers what ships. Every fact here is a repository
 * fact today:
 *
 * - the eyebrow, h1 and sub-message are the blueprint's recorded hero
 *   decision (option (a): platform eyebrow, earned h1, honest platform sub);
 * - the CTA pair is `Start building` (the getting-started guide) and
 *   `See the native story` (`/native/`);
 * - the visual moment is the real token engine: six library themes loaded
 *   at build from `@texuli/tokens/library-expand`, painted as real swatch
 *   tiles — no screenshots, no invented product shots;
 *
 * Honesty placement (blueprint §6): the hero claims the *system*, not
 * released artifacts. No version, no npm claim, no dates — the footer's
 * status line is the single place the npm release is claimed sitewide.
 */

/** A hero call to action; app-authored site links, developer trust tier. */
export interface WebHeroLink {
  /** A real site route, resolved through `withBase` at render time. */
  href: string;
  label: string;
  role: 'primary' | 'secondary';
}

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

/** Heading ids: the component wires `aria-labelledby` from these. */
export const WEB_HERO_IDS = {
  hero: 'web-hero-title',
  themes: 'web-hero-themes-title',
} as const;

/** Blueprint §1: the eyebrow does the platform work. */
export const WEB_HERO_EYEBROW = 'One catalog · web and native';

/** Blueprint §1: the h1 keeps its earned identity. */
export const WEB_HERO_TITLE = 'Interfaces from texels.';

/** Blueprint §1: the platform sub-message, web today and native stated as staged reality. */
export const WEB_HERO_SUB =
  'Texuli is an owned component system: texels compose into primitives, ' +
  'primitives into components. It ships for the web in Svelte 5 today, and the same catalog ' +
  'contract drives a Kotlin Multiplatform renderer in development. People build with it; ' +
  'agents render through it.';

/** The blueprint's CTA pair, in order. */
export const WEB_HERO_ACTIONS: readonly WebHeroLink[] = [
  { href: '/guides/getting-started/', label: 'Start building', role: 'primary' },
  { href: '/native/', label: 'See the native story', role: 'secondary' },
];

/** Where the visual moment leads: the real galleries behind the real data. */
export const WEB_HERO_GRID_LINKS: readonly WebHeroLink[] = [
  { href: '/gallery-themes/', label: 'Browse the theme gallery', role: 'secondary' },
  { href: '/component-pages/', label: 'Browse the component catalog', role: 'secondary' },
];

/** Caption under the swatch grid: the moment is data, not a product shot. */
export const WEB_HERO_GRID_CAPTION =
  'Real data, no screenshots: these six themes are loaded from the theme engine that styles ' +
  'every component — the same library the theme gallery serves.';

/**
 * The six builtin preset ids of the expanded theme library
 * (`BUILTIN_PRESET_IDS` in `@texuli/tokens/library-expand`): real themes,
 * loaded at build so the hero can never show a theme that does not exist.
 */
export const WEB_HERO_THEME_IDS: readonly string[] = [
  'violet',
  'ocean',
  'emerald',
  'rose',
  'amber',
  'monochrome',
];

/** Load the hero's themes from the real token library. */
export async function loadHeroThemes(): Promise<readonly HeroTheme[]> {
  const { getFullThemeLibraryMeta, loadFullLibraryTheme } = await import(
    '@texuli/tokens/library-expand'
  );
  const meta = await getFullThemeLibraryMeta();
  const nameById = new Map(meta.map((entry) => [entry.id, entry.name]));
  return Promise.all(
    WEB_HERO_THEME_IDS.map(async (id): Promise<HeroTheme> => {
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
export const WEB_HERO_PROOF_LABEL = 'Texuli by the numbers';

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
