/**
 * texuli.com landing copy and data. `HOME_BANDS` is the one source of the band order
 * (Home 2.2: nine bands carrying the ten storyboard messages); every count is computed
 * from the source it links to, never typed in. The Home 2.2 sections keep their own copy
 * modules beside them (`hero-22/`, `web-native/`, `solutions/`, `agents-22/`,
 * `built-with/`, `final-22/`); the bands kept from the first landing (pitch, the brand
 * story, the accessible story with the proof row) read their copy here. Copy budgets are
 * pinned by apps/website/tests/landing.test.ts.
 */
import { NATIVE_SLICE } from '../native/native-parity.ts';
import { countAllThemes, loadHeroProof } from './home-data.ts';

export interface HomeLink {
  href: string;
  label: string;
  role: 'primary' | 'secondary' | 'text';
}

export interface HomeStat {
  id: 'components' | 'primitives' | 'themes' | 'packages' | 'examples';
  value: number;
  label: string;
  href: string;
}

export const HOME_IDS = {
  hero: 'home-hero-title',
} as const;

/** The one install command the landing offers to copy. */
export const HOME_INSTALL_COMMAND = 'pnpm add texuli @texuli/tokens';

export const HOME_HERO = {
  badge: ['Open source', 'MIT', 'Svelte 5', 'Kotlin Multiplatform'],
  /** The h1, split so the second part carries the accent (as in the social image). */
  title: { lead: 'Build any', accent: 'interface.' },
  sub:
    'One owned library of accessible components and themes for building universal ' +
    'interfaces in Svelte 5, with a native Kotlin Multiplatform twin in development.',
  actions: [
    { href: '/guides/getting-started/', label: 'Start building', role: 'primary' },
    { href: '/component-pages/', label: 'Browse components', role: 'secondary' },
    { href: '/web-and-native/', label: 'Web + native', role: 'text' },
  ] satisfies readonly HomeLink[],
  proofLabel: 'Texuli by the numbers',
  /** The release hub, linked from the badge line (no version number to drift). */
  news: { href: '/whats-new/', label: 'What’s new' },
} as const;

/** The hero's proof row: the catalog, primitives and examples counts plus the theme count. */
export async function loadHomeHeroProof(): Promise<readonly HomeStat[]> {
  const [proof, themes] = await Promise.all([loadHeroProof(), countAllThemes()]);
  const byId = new Map(proof.map((stat) => [stat.id, stat]));
  const stat = (id: 'components' | 'primitives' | 'examples', label: string): HomeStat => {
    const found = byId.get(id);
    if (!found) throw new Error(`missing hero proof stat ${id}`);
    return { id, value: found.value, label, href: found.href };
  };
  return [
    stat('components', 'component pages'),
    stat('primitives', 'primitives'),
    { id: 'themes', value: themes, label: 'themes', href: '/gallery-themes/' },
    stat('examples', 'examples'),
  ];
}

/** Word count of a copy string, as the budgets count it. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export interface HomeStep {
  label: string;
  href: string;
}

/** Band 2: the ladder from texels to applications. */
export const HOME_PITCH = {
  kicker: "How it's built",
  title: 'Small pieces. Infinite possibilities.',
  body:
    'Texuli starts from texels: tiny, framework-free behaviors. They compose into owned ' +
    'primitives, primitives into styled components, and components into complete Solutions. ' +
    'Every layer is yours to read, theme and extend.',
  slot: 'home-pieces',
  steps: [
    { label: 'Texels', href: '/web-and-native/#how-layered' },
    { label: 'Primitives', href: '/primitives-page/' },
    { label: 'Components', href: '/component-pages/' },
    { label: 'Solutions', href: '/solutions/' },
  ] satisfies readonly HomeStep[],
} as const;

export interface HomeStory {
  id: 'universal' | 'web-native' | 'brand' | 'agents' | 'accessible';
  /** The topic kicker; the texel mark beside it grows one cube per story. */
  kicker: string;
  title: string;
  body: string;
  slot: string;
  /** Short points (at most three), each optionally a link. */
  points?: readonly { label: string; href?: string }[];
  /** A chip list of linked destinations. */
  chips?: readonly HomeStep[];
  actions?: readonly HomeLink[];
}

/**
 * Home 2.2 band order (`audit/home-storyboard.md` §3), the one source `index.astro` and the
 * landing test follow. Each band names the storyboard targets it carries: T5 ("same
 * contracts, platform-native experiences") rides with T3 in the Web & Native band, as the
 * storyboard decided, so nine bands carry all ten messages.
 */
export const HOME_BANDS = [
  { id: 'hero', component: 'HomeHero22', targets: ['T1'] },
  { id: 'pieces', component: 'HomePitch', targets: ['T2'] },
  { id: 'web-native', component: 'HomeWebNative', targets: ['T3', 'T5'] },
  { id: 'solutions', component: 'HomeSolutions', targets: ['T4'] },
  { id: 'agents', component: 'HomeAgents22', targets: ['T6'] },
  { id: 'design-systems', component: 'HomeStories', targets: ['T7'] },
  { id: 'built-with', component: 'HomeBuiltWith', targets: ['T8'] },
  { id: 'own', component: 'LandingStory', targets: ['T9'] },
  { id: 'final', component: 'HomeFinal22', targets: ['T10'] },
] as const;

/**
 * The story bands kept from the first landing that `HomeStories` renders: the brand story
 * (T7, design systems across platforms). `{themeCount}` is filled from the theme library.
 */
export const HOME_STORIES: readonly HomeStory[] = [
  {
    id: 'brand',
    kicker: 'Your brand',
    title: 'Your brand in one JSON file.',
    body:
      'Pick one of {themeCount} themes or describe your own design system in one document. ' +
      'Texuli compiles it with contrast guarantees and every component follows.',
    slot: 'home-design-systems',
    actions: [
      { href: '/design-systems/', label: 'Design systems', role: 'secondary' },
      { href: '/gallery-themes/', label: 'Theme gallery', role: 'text' },
    ],
  },
];

/**
 * T9, "Made to own and extend": the accessible story, with the computed proof row
 * (`loadHomeProof`) rendered inside it as the band's proof (the former proof band merged in).
 */
export const HOME_OWN: HomeStory = {
  id: 'accessible',
  kicker: 'Yours to own',
  title: 'Accessible and owned.',
  body:
    'Every primitive is built in-house on WAI-ARIA patterns and tested with keyboards and ' +
    'screen readers. MIT licensed, no third-party UI dependency, and a size budget on every entry.',
  slot: 'home-accessible',
  points: [
    { label: 'Accessibility guide', href: '/guides/accessibility/' },
    { label: 'Owned primitives', href: '/primitives-page/' },
    { label: 'Performance budgets', href: '/guides/performance/' },
  ],
};

/** Fill `{name}` placeholders; an unknown name throws so copy cannot ship a raw brace. */
export function fillCopy(text: string, values: Readonly<Record<string, number | string>>): string {
  return text.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`no value for {${name}} in landing copy`);
    return String(value);
  });
}

const CATALOG_RAW = import.meta.glob<string>(
  '../../../../../../packages/spec/catalog/components.json',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  }
);

/** How many catalog components paint natively today, of the whole catalog (from the parity matrix). */
export function loadNativeSlice(): { painted: number; total: number } {
  return { painted: NATIVE_SLICE.painted, total: NATIVE_SLICE.total };
}

export interface HomeProofStat {
  id: 'packages' | 'blueprint' | 'agent-safe';
  value: number;
  label: string;
  href: string;
}

/** Band 8: what is built in the open, counted from the packages and the spec catalog. */
export const HOME_PROOF = {
  title: 'Built in the open',
  label: 'Texuli in the open',
} as const;

export async function loadHomeProof(): Promise<readonly HomeProofStat[]> {
  const { countPublishedPackages } = await import('./home-data.ts');
  const catalog = Object.values(CATALOG_RAW)[0];
  if (!catalog) throw new Error('spec catalog not found');
  const components = (JSON.parse(catalog) as { components: { emit: string[] }[] }).components;
  return [
    {
      id: 'packages',
      value: countPublishedPackages(),
      label: 'packages on npm, MIT licensed',
      href: '/guides/getting-started/',
    },
    {
      id: 'blueprint',
      value: components.length,
      label: 'ids in the blueprint catalog, layouts included',
      href: '/component-pages/',
    },
    {
      id: 'agent-safe',
      value: components.filter((entry) => entry.emit.includes('untrusted')).length,
      label: 'components agents may emit, validated',
      href: '/agents-page/',
    },
  ];
}

/** Band 9: from install to interface, three steps and one command. */
export const HOME_QUICKSTART = {
  title: 'From install to interface in three steps.',
  slot: 'home-quickstart',
  steps: [
    {
      title: 'Install',
      body: 'The styled components and the theme tokens.',
      href: '/guides/getting-started/',
    },
    {
      title: 'Pick a theme',
      body: 'Start from the library or your own brand.',
      href: '/gallery-themes/',
    },
    {
      title: 'Compose',
      body: 'Put components together into your interface.',
      href: '/guides/getting-started/',
    },
  ],
  note: 'Pre-1.0: pin the version.',
} as const;

/** Band 10: the closing call to action on the `home-final` band art. */
export const HOME_FINAL = {
  title: 'Start with one texel.',
  sub: 'Open source, MIT, and ready for people and agents.',
  slot: 'home-final',
  actions: [
    { href: '/guides/getting-started/', label: 'Start building', role: 'primary' },
    { href: '/playground/', label: 'Open the playground', role: 'secondary' },
    { href: '/agents-page/', label: 'For agents', role: 'text' },
  ] satisfies readonly HomeLink[],
} as const;
