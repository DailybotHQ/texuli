/**
 * The `/solutions/` catalog (ADR-027, ADR-029): one card per registry Solution with its
 * status, a status per platform, and links to its landing and docs only when those pages
 * exist. The All / Web / Native filters work without JavaScript: each is an in-page link
 * to an anchor, and CSS `:target` hides the cards outside the filter (see
 * `SolutionsCatalog.astro`). Facts come from the registry entry; native statuses are the
 * entry's (capped by `validate.ts` at `native/docs/parity.json`), never raised here.
 */
import { SOLUTIONS } from '../../../data/solutions/index.ts';
import type { SolutionEntry, SolutionStatus } from '../../../data/solutions/schema.ts';
import { siteRouteExists } from '../../foundation/nav-data.ts';
import { type PlatformRowView, platformRows } from '../shared/platforms/platforms-model.ts';

export type RouteExists = (route: string) => boolean;

export const CATALOG_PAGE = {
  title: 'Solutions',
  description:
    'Embeddable open-source systems built from Texuli: slides, documents, workflows, canvases and sheets, each with its status on the web and on native targets.',
  hero: {
    id: 'solutions-catalog-title',
    eyebrow: 'Texuli Solutions',
    title: 'Complete systems, built from small pieces.',
    lede: 'Each Solution completes a task end to end and is built from the same Texuli components and engines. Statuses are stated plainly, per platform.',
    art: 'page-solutions',
  },
  filters: {
    label: 'Filter Solutions by platform',
    all: { id: 'all', label: 'All' },
    web: { id: 'web', label: 'Web' },
    native: { id: 'native', label: 'Native' },
  },
  nativeEmpty:
    'No Solution renders natively yet. Native rendering is planned for each of them; see each card for its targets.',
  listId: 'solutions-list',
} as const;

const RANK: Readonly<Record<SolutionStatus, number>> = {
  planned: 0,
  experimental: 1,
  'in development': 2,
  available: 3,
};

export interface CatalogCard {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly summary: string;
  readonly status: SolutionStatus;
  readonly platforms: readonly PlatformRowView[];
  /** The web status from the entry. */
  readonly web: SolutionStatus;
  /** The most advanced native status the entry lists. */
  readonly native: SolutionStatus;
  /** Filter membership: web when the web target is past planned; native likewise. */
  readonly onWeb: boolean;
  readonly onNative: boolean;
  readonly landing: string | undefined;
  readonly docs: string | undefined;
}

/** One card per registry entry, in catalog order. */
export function catalogCards(
  exists: RouteExists = siteRouteExists,
  solutions: readonly SolutionEntry[] = SOLUTIONS
): CatalogCard[] {
  return solutions.map((entry) => {
    const rows = platformRows(entry);
    const web = rows.find((row) => row.platform === 'web')?.badge.status ?? 'planned';
    let native: SolutionStatus = 'planned';
    for (const row of rows) {
      if (row.platform === 'web') continue;
      if (RANK[row.badge.status] > RANK[native]) native = row.badge.status;
    }
    return {
      slug: entry.slug,
      name: entry.name,
      tagline: entry.tagline,
      summary: entry.summary,
      status: entry.status,
      platforms: rows,
      web,
      native,
      onWeb: web !== 'planned',
      onNative: native !== 'planned',
      landing: exists(entry.route) ? entry.route : undefined,
      docs: exists(entry.docs) ? entry.docs : undefined,
    };
  });
}

/** How many cards each filter shows. */
export function filterCounts(cards: readonly CatalogCard[]) {
  return {
    all: cards.length,
    web: cards.filter((c) => c.onWeb).length,
    native: cards.filter((c) => c.onNative).length,
  };
}
