/**
 * Home 2.2 "Complete Solutions" band: copy from the plan's home storyboard (band 4,
 * "More than widgets: complete systems."), cards from the Solutions registry. Facts on a
 * card (name, tagline, status, platforms) come from the entry, never typed here.
 *
 * Links follow the route rules:
 * - a card links its landing (`entry.route`) only when that page exists;
 * - until then it links the current demo page the landing will replace (`entry.replaces`),
 *   when that page exists. The `*-page` route redirects to the landing only once the landing
 *   ships (ADR-028, `public/_redirects` emits a move only when its target page exists), and
 *   from that moment the card links the landing instead, so it never links a redirect;
 * - "All solutions" appears only when `/solutions/` exists.
 */

import { SOLUTIONS } from '../../../../data/solutions/index.ts';
import type { SolutionEntry, SolutionStatus } from '../../../../data/solutions/schema.ts';
import { siteRouteExists } from '../../../foundation/nav-data.ts';

export type RouteExists = (route: string) => boolean;

export const HOME_SOLUTIONS_COPY = {
  id: 'home-solutions-title',
  kicker: 'Solutions',
  title: 'More than widgets: complete systems.',
  body: 'Embeddable open-source systems that complete a task end to end: decks, documents, workflows, canvases and sheets, each built from the same Texuli pieces.',
  art: 'home-universe',
  catalog: { label: 'All solutions', href: '/solutions/' },
} as const;

const STATUS_RANK: Readonly<Record<SolutionStatus, number>> = {
  planned: 0,
  experimental: 1,
  'in development': 2,
  available: 3,
};

export interface HomeSolutionCard {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly status: SolutionStatus;
  readonly web: SolutionStatus;
  /** The most advanced native status the entry lists (capped by `validate.ts`). */
  readonly native: SolutionStatus;
  readonly link: Readonly<{ href: string; label: string; kind: 'landing' | 'demo' }> | undefined;
}

/** The highest native status among the entry's non-web platforms; `planned` when none. */
export function nativeStatus(entry: Pick<SolutionEntry, 'platforms'>): SolutionStatus {
  let best: SolutionStatus = 'planned';
  for (const platform of entry.platforms) {
    if (platform.platform === 'web') continue;
    if (STATUS_RANK[platform.status] > STATUS_RANK[best]) best = platform.status;
  }
  return best;
}

/** One card per registry entry, in catalog order. */
export function homeSolutionCards(
  exists: RouteExists = siteRouteExists,
  solutions: readonly SolutionEntry[] = SOLUTIONS
): HomeSolutionCard[] {
  return solutions.map((entry) => {
    const web = entry.platforms.find((p) => p.platform === 'web')?.status ?? entry.status;
    let link: HomeSolutionCard['link'];
    if (exists(entry.route))
      link = { href: entry.route, label: `Explore ${entry.name}`, kind: 'landing' };
    else if (entry.replaces && exists(entry.replaces))
      link = { href: entry.replaces, label: `Try the ${entry.name} demo`, kind: 'demo' };
    return {
      slug: entry.slug,
      name: entry.name,
      tagline: entry.tagline,
      status: entry.status,
      web,
      native: nativeStatus(entry),
      link,
    };
  });
}

/** The band's catalog link, only when the catalog page exists. */
export function homeSolutionsCatalog(
  exists: RouteExists = siteRouteExists
): typeof HOME_SOLUTIONS_COPY.catalog | undefined {
  return exists(HOME_SOLUTIONS_COPY.catalog.href) ? HOME_SOLUTIONS_COPY.catalog : undefined;
}
