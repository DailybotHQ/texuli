/**
 * The `/built-with/` index (ADR-027: products built with Texuli keep their own brand and
 * domain). Cards come from `data/products`, listed products only (`LISTED_PRODUCTS`; an
 * unlisted concept never appears). Status, offerings and domain are the product record's;
 * a card links its case study only when that page exists, and its own site through the URL
 * policy. Products are grouped by who builds them: the Texuli team, then the community.
 */

import { safeHref } from '@texuli/core/url-policy';
import {
  LISTED_PRODUCTS,
  type ProductEntry,
  type ProductGroup,
  type ProductStatus,
} from '../../../data/products/index.ts';
import { siteRouteExists } from '../../foundation/nav-data.ts';

export type RouteExists = (route: string) => boolean;

export const BUILT_WITH_PAGE = {
  title: 'Built with Texuli',
  description:
    'Products built on Texuli. Each keeps its own brand and domain; status shows what is available today and what is planned.',
  hero: {
    id: 'built-with-title',
    eyebrow: 'Products',
    title: 'Built with Texuli',
    lede: 'Products built with Texuli keep their own brand and domain. Each card shows what is available today and what is only planned.',
  },
  groups: {
    owner: {
      id: 'built-with-owner',
      title: 'From the Texuli team',
      empty: 'No products are listed yet.',
    },
    community: {
      id: 'built-with-community',
      title: 'From the community',
      empty: 'No community products are listed yet.',
    },
  } satisfies Record<ProductGroup, { id: string; title: string; empty: string }>,
} as const;

export interface ProductCardView {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly status: ProductStatus;
  readonly offerings: readonly Readonly<{ label: string; status: ProductStatus }>[];
  /** The product's own site (`https://<domain>`), when it has a domain and passes the URL policy. */
  readonly site: Readonly<{ href: string; label: string }> | undefined;
  /** The case study route, only when its page exists. */
  readonly caseStudy: string | undefined;
}

/** The case study route of a product. */
export function caseStudyRoute(product: Pick<ProductEntry, 'id'>): string {
  return `/built-with/${product.id}/`;
}

/** One card view; never adds a status, offering or domain the record does not hold. */
export function productCard(
  product: ProductEntry,
  exists: RouteExists = siteRouteExists
): ProductCardView {
  const siteHref = product.domain ? safeHref(`https://${product.domain}`, 'developer') : undefined;
  const route = caseStudyRoute(product);
  return {
    id: product.id,
    name: product.name,
    summary: product.summary,
    status: product.status,
    offerings: product.offerings.map((o) => ({ label: o.label, status: o.status })),
    site: siteHref && product.domain ? { href: siteHref, label: product.domain } : undefined,
    caseStudy: exists(route) ? route : undefined,
  };
}

/** Listed products grouped owner → community, in data order. */
export function builtWithGroups(
  products: readonly ProductEntry[] = LISTED_PRODUCTS,
  exists: RouteExists = siteRouteExists
): Array<{ group: ProductGroup; cards: ProductCardView[] }> {
  const listed = products.filter((p) => p.visibility === 'listed');
  return (['owner', 'community'] as const).map((group) => ({
    group,
    cards: listed.filter((p) => p.group === group).map((p) => productCard(p, exists)),
  }));
}
