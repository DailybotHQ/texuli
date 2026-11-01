/**
 * texuli.com landing copy and data (PLAN_012). The bands, their copy and
 * their routes are fixed by the plan's landing IA; every count is computed
 * from the source it links to, never typed in. Copy budgets are pinned by
 * apps/website/tests/landing.test.ts.
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
export const HOME_INSTALL_COMMAND = 'pnpm add texuli';

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
    stat('components', 'components'),
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
    'primitives, primitives into styled components, and components into whole applications. ' +
    'Every layer is yours to read, theme and extend.',
  slot: 'home-pieces',
  steps: [
    { label: 'Texels', href: '/foundation/' },
    { label: 'Primitives', href: '/primitives-page/' },
    { label: 'Components', href: '/component-pages/' },
    { label: 'Apps', href: '/showcase/' },
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
 * Bands 3–7, in order. The art alternates sides (end, start, end, …);
 * `{themeCount}` and `{painted}`/`{total}` are filled from their sources.
 */
export const HOME_STORIES: readonly HomeStory[] = [
  {
    id: 'universal',
    kicker: 'Universal',
    title: 'One library. Every interface.',
    body:
      'Dashboards, documents, chat, forms, spreadsheets, slides and canvases come from the ' +
      'same pieces, so a whole product speaks one design language.',
    slot: 'home-universe',
    chips: [
      { label: 'Data and dashboards', href: '/dashboards-page/' },
      { label: 'Charts', href: '/charts-page/' },
      { label: 'Media', href: '/media-page/' },
      { label: 'Chat', href: '/agent-chat/' },
      { label: 'Forms', href: '/forms-page/' },
      { label: 'Sheets', href: '/sheets-page/' },
      { label: 'Canvas', href: '/canvas-page/' },
      { label: 'Documents', href: '/documents-page/' },
      { label: 'Slides', href: '/slides-page/' },
      { label: 'Workflows', href: '/workflows-page/' },
    ],
  },
  {
    id: 'web-native',
    kicker: 'Web + native',
    title: 'Svelte on the web. Native next.',
    body:
      'One blueprint contract describes the interface. Svelte 5 renders it on the web today; ' +
      'a Kotlin Multiplatform renderer validates the same contract and paints a growing slice natively.',
    slot: 'home-web-native',
    points: [
      { label: 'Svelte 5 on the web: every component' },
      {
        label: 'Kotlin Multiplatform: in development, {painted} of {total} components paint today',
      },
      { label: 'One spec, shared conformance fixtures', href: '/native/' },
    ],
    actions: [{ href: '/web-and-native/', label: 'See web and native side by side', role: 'text' }],
  },
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
  {
    id: 'agents',
    kicker: 'For agents',
    title: 'Built for agents.',
    body:
      'Agents describe interfaces as data against a closed catalog; Texuli validates and renders ' +
      'them with no HTML sinks. Agents never ship code, and every page has a Markdown twin.',
    slot: 'home-agents',
    points: [
      { label: 'MCP server, local and remote', href: '/mcp-server/' },
      { label: 'The agent catalog', href: '/agents-page/' },
      { label: 'The agent skill', href: '/skill/' },
    ],
  },
  {
    id: 'accessible',
    kicker: 'Accessible',
    title: 'Accessible and owned.',
    body:
      'Every primitive is built in-house on WAI-ARIA patterns and tested with keyboards and ' +
      'screen readers. No third-party UI dependency, and a size budget on every entry.',
    slot: 'home-accessible',
    points: [
      { label: 'Accessibility guide', href: '/guides/accessibility/' },
      { label: 'Owned primitives', href: '/primitives-page/' },
      { label: 'Performance budgets', href: '/guides/performance/' },
    ],
  },
];

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
      label: 'components in the blueprint catalog',
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
    { title: 'Install', body: 'One package for the styled components.', href: undefined },
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
