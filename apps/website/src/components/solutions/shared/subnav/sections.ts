/**
 * Section model for `SolutionLayout` (PLAN_015 T-f-layout): the documented block order from
 * `../types.ts`, the in-page anchor ids, the sticky subnav items, the section tones that give
 * the landing its rhythm, and the breadcrumb trail. Pure functions, so the layout's
 * decisions are unit-tested without rendering Astro.
 */
import type { SolutionEntry } from '../../../../data/solutions/schema.ts';
import type { SolutionLandingContent } from '../types.ts';

/** The block order documented in `../types.ts`: hero → demo → … → next steps. */
export const SOLUTION_SECTION_ORDER = [
  'hero',
  'demo',
  'stories',
  'how',
  'quickstart',
  'recipes',
  'agents',
  'platforms',
  'next',
] as const;
export type SolutionSectionKey = (typeof SOLUTION_SECTION_ORDER)[number];

/**
 * In-page anchor ids. `demo` stays `demo` so hero calls to action can point at `#demo`.
 * Blocks must not reuse these ids: the layout's section wrappers own them.
 */
export const SOLUTION_SECTION_IDS: Readonly<Record<SolutionSectionKey, string>> = {
  hero: 'overview',
  demo: 'demo',
  stories: 'features',
  how: 'how-it-works',
  quickstart: 'quickstart',
  recipes: 'recipes',
  agents: 'agents',
  platforms: 'platforms',
  next: 'next-steps',
};

/** Short subnav labels; the blocks' own headings carry the full titles. */
export const SOLUTION_SECTION_LABELS: Readonly<Record<SolutionSectionKey, string>> = {
  hero: 'Overview',
  demo: 'Demo',
  stories: 'Features',
  how: 'How it works',
  quickstart: 'Quickstart',
  recipes: 'Recipes',
  agents: 'Agents',
  platforms: 'Platforms',
  next: 'Next steps',
};

/** The sections a landing renders, in order; `recipes` is optional in the contract. */
export function solutionSections(content: SolutionLandingContent): SolutionSectionKey[] {
  return SOLUTION_SECTION_ORDER.filter((key) => key !== 'recipes' || content.recipes !== undefined);
}

export interface SolutionSubnavItem {
  readonly key: SolutionSectionKey;
  readonly id: string;
  readonly label: string;
  readonly href: `#${string}`;
}

/** Subnav links for every section after the hero (the hero is the top of the page). */
export function solutionSubnavItems(content: SolutionLandingContent): SolutionSubnavItem[] {
  return solutionSections(content)
    .filter((key) => key !== 'hero')
    .map((key) => ({
      key,
      id: SOLUTION_SECTION_IDS[key],
      label: SOLUTION_SECTION_LABELS[key],
      href: `#${SOLUTION_SECTION_IDS[key]}`,
    }));
}

export type SolutionSectionTone = 'base' | 'raised';

/**
 * Alternating tones after the hero, counted over the sections actually rendered, so an
 * omitted optional section never puts two raised bands side by side.
 */
export function solutionSectionTones(
  sections: readonly SolutionSectionKey[]
): Readonly<Partial<Record<SolutionSectionKey, SolutionSectionTone>>> {
  const tones: Partial<Record<SolutionSectionKey, SolutionSectionTone>> = {};
  let index = 0;
  for (const key of sections) {
    if (key === 'hero') continue;
    tones[key] = index % 2 === 0 ? 'base' : 'raised';
    index += 1;
  }
  return tones;
}

export interface SolutionCrumb {
  readonly name: string;
  readonly href: string;
}

/**
 * The visible trail. The nav-derived trail (`breadcrumbTrail`, the same source as the
 * BreadcrumbList JSON-LD) wins once `NAV_GROUPS` lists the landing (ADR-031). Until then,
 * the landing shows the ADR-031 hierarchy: Home / Solutions / <name>.
 */
export function solutionBreadcrumbs(
  entry: Pick<SolutionEntry, 'name' | 'route'>,
  navTrail: readonly SolutionCrumb[]
): SolutionCrumb[] {
  const last = navTrail.at(-1);
  if (navTrail.length >= 2 && last?.href === entry.route) return [...navTrail];
  return [
    { name: 'Home', href: '/' },
    { name: 'Solutions', href: '/solutions/' },
    { name: entry.name, href: entry.route },
  ];
}
