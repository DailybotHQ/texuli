/**
 * Home 2.2 hero copy (PLAN_015 T-home-hero). One source for the hero's
 * eyebrow, h1, subhead, platform status line and three calls to action.
 *
 * Sources: the plan's home storyboard (row 1, "Hero", which keeps the pinned
 * h1 "Build any interface.") and vision §49.1. Status words follow the
 * repository's facts: the web library is published on npm (pre-1.0), and
 * the native renderer is in development (Compose Desktop paints a slice of
 * the catalog; Android and iOS painting are planned). No status here may
 * read "available" for native.
 */

/** One status a hero badge may show (the site's status vocabulary). */
export type HeroStatusWord = 'available' | 'in development' | 'experimental' | 'planned';

export interface HeroPlatformStatus {
  /** Stable id for tests and `data-*` hooks. */
  id: 'web' | 'native';
  platform: string;
  status: HeroStatusWord;
}

export interface HeroAction {
  href: string;
  label: string;
  /** Visual weight: one primary, one secondary, one text link. */
  role: 'primary' | 'secondary' | 'text';
}

export const HERO_22_IDS = {
  heading: 'home-hero-22-title',
  status: 'home-hero-22-status',
} as const;

export const HERO_22 = {
  eyebrow: ['Open source', 'Web + Native vision', 'Built for humans and agents'],
  /** The h1, split so the second part carries the accent (as in the social image). */
  title: { lead: 'Build any', accent: 'interface.' },
  sub:
    'From accessible components to complete editors and apps. Build on the web today; ' +
    'shared contracts bring the same systems to native.',
  statusLabel: 'Platform status',
  status: [
    { id: 'web', platform: 'Web', status: 'available' },
    { id: 'native', platform: 'Native', status: 'in development' },
  ] satisfies readonly HeroPlatformStatus[],
  actions: [
    { href: '/solutions/', label: 'Explore solutions', role: 'primary' },
    { href: '/native/', label: 'Explore native', role: 'secondary' },
    { href: '/guides/getting-started/', label: 'Get started', role: 'text' },
  ] satisfies readonly HeroAction[],
} as const;
