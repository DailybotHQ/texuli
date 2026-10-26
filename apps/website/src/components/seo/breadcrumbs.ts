/**
 * Breadcrumb trails derived from the site nav (T-19): the same
 * `SITE_NAV_GROUPS` the sidebar renders, walked for the current path. A page
 * absent from the nav — the landing, previews, the 404 — gets no trail and
 * no markup: there is no invented hierarchy. Family headings without an href
 * (Display, Forms, Layouts, Overlays) cannot be breadcrumb entries, so their
 * children sit directly under the group.
 */
import { SITE_URL } from '../../lib/constances';
import { SITE_NAV_GROUPS } from '../foundation/nav-data.ts';
import { type NavLink, normalizePath } from '../foundation/site.ts';

export interface BreadcrumbEntry {
  name: string;
  /** Site-absolute href (`/guides/theming/`). */
  href: string;
}

/** Home, the group (its first linked page) and any linked family, then self. */
function trail(
  groupLabel: string,
  groupLanding: string | undefined,
  family: NavLink | undefined,
  self: NavLink & { href: string }
): BreadcrumbEntry[] {
  const here = normalizePath(self.href);
  const entries: BreadcrumbEntry[] = [{ name: 'Home', href: '/' }];
  if (groupLanding && normalizePath(groupLanding) !== here)
    entries.push({ name: groupLabel, href: groupLanding });
  if (family?.href) entries.push({ name: family.label, href: family.href });
  entries.push({ name: self.label, href: here });
  return entries;
}

/**
 * The nav's trail for `current`, or `[]` when the page is not listed (no
 * parent chain, no markup). Group entries use each group's first linked page
 * as the section landing, exactly what the sidebar shows.
 */
export function breadcrumbTrail(current: string): BreadcrumbEntry[] {
  const here = normalizePath(current);
  if (here === '/') return [];
  for (const group of SITE_NAV_GROUPS) {
    const landing = group.links.find((link) => link.href)?.href;
    for (const link of group.links) {
      if (link.href && normalizePath(link.href) === here)
        return trail(group.label, landing, undefined, link as NavLink & { href: string });
      const child = link.children?.find(
        (entry) => entry.href && normalizePath(entry.href) === here
      );
      if (child) return trail(group.label, landing, link, child as NavLink & { href: string });
    }
  }
  return [];
}

/** The trail as a schema.org BreadcrumbList, items resolved against SITE_URL. */
export function breadcrumbJsonLd(trail: readonly BreadcrumbEntry[]): {
  '@context': string;
  '@type': 'BreadcrumbList';
  itemListElement: Array<{ '@type': string; position: number; name: string; item: string }>;
} {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: `${SITE_URL}${entry.href}`,
    })),
  };
}
