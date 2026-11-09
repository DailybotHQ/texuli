/**
 * Home 2.2 "Built with Texuli" band (storyboard band 7): "The foundation behind real
 * products." Cards come from the listed products (`data/products`) through the same card
 * model as the `/built-with/` index, so status, offerings and domain are the record's.
 * Each card splits its offerings into "Today" (available) and "Roadmap" (anything else),
 * so a planned offering such as Protoyard Cloud is always labeled as roadmap. Links appear
 * only for routes whose page exists.
 */
import {
  LISTED_PRODUCTS,
  type ProductEntry,
  type ProductStatus,
} from '../../../../data/products/index.ts';
import { type ProductCardView, productCard } from '../../../built-with/index/index-content.ts';
import { siteRouteExists } from '../../../foundation/nav-data.ts';

export type RouteExists = (route: string) => boolean;

export const HOME_BUILT_WITH_COPY = {
  id: 'home-built-with-title',
  kicker: 'Built with Texuli',
  title: 'The foundation behind real products.',
  body: 'Products built with Texuli keep their own brand and domain. Each one shows what is available today and what is still on its roadmap.',
  art: 'home-built-with',
  index: { label: 'All products built with Texuli', href: '/built-with/' },
  today: 'Today',
  roadmap: 'Roadmap',
} as const;

export interface HomeBuiltWithCard extends ProductCardView {
  readonly today: readonly Readonly<{ label: string; status: ProductStatus }>[];
  readonly roadmap: readonly Readonly<{ label: string; status: ProductStatus }>[];
}

/** One card per listed product, offerings split into today and roadmap. */
export function homeBuiltWithCards(
  products: readonly ProductEntry[] = LISTED_PRODUCTS,
  exists: RouteExists = siteRouteExists
): HomeBuiltWithCard[] {
  return products
    .filter((product) => product.visibility === 'listed')
    .map((product) => {
      const card = productCard(product, exists);
      return {
        ...card,
        today: card.offerings.filter((o) => o.status === 'available'),
        roadmap: card.offerings.filter((o) => o.status !== 'available'),
      };
    });
}

/** The band's index link, only when `/built-with/` exists. */
export function homeBuiltWithIndex(exists: RouteExists = siteRouteExists) {
  return exists(HOME_BUILT_WITH_COPY.index.href) ? HOME_BUILT_WITH_COPY.index : undefined;
}
