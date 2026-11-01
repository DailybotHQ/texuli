/**
 * texuli.com landing copy and data (PLAN_012). The bands, their copy and
 * their routes are fixed by the plan's landing IA; every count is computed
 * from the source it links to, never typed in. Copy budgets are pinned by
 * apps/website/tests/landing.test.ts.
 */
import { countAllThemes, loadHeroProof } from '../web/web-hero-content.ts';

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
