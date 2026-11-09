/**
 * Build-time navigation model (T-site-ia, ADR-031): `NAV_GROUPS` from `site.ts`
 * with the guides (reading order) and the component and primitive lists (from
 * the catalog, alphabetical) expanded, plus the sidebar sections, the pager,
 * the docs-page test, and the landing global nav. Imported only by `.astro`
 * files, so islands never bundle the catalog.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SOLUTION_SLUGS, type SolutionSlug } from '../../data/solutions/schema.ts';
import { COMPONENT_PAGES } from '../component-pages/load-manifests.ts';
import { GUIDES_SECTIONS } from '../guides/nav.ts';
import { PRIMITIVES } from '../primitives-page/primitives.ts';
import {
  NAV_GROUPS,
  type NavGroup,
  type NavLink,
  navState,
  normalizePath,
  REPOSITORY_URL,
  withBase,
} from './site.ts';

/** `apps/website/src/pages`, resolved from this module so Vitest and Astro agree. */
const PAGES_DIR = join(import.meta.dirname, '../../pages');

/**
 * Whether a site-relative path has an Astro page today. Used so the header
 * never ships a Solutions or Built-with href before its page exists (ADR-031).
 */
export function siteRouteExists(href: string): boolean {
  const path = href.split('#')[0]?.split('?')[0] ?? '';
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  const rel = path.replace(/^\/+|\/+$/g, '');
  const folder = rel === '' ? PAGES_DIR : join(PAGES_DIR, rel);
  return existsSync(join(folder, 'index.astro')) || existsSync(`${folder}.astro`);
}

/** One item of the ADR-031 landing header. */
export interface LandingNavItem {
  readonly label: string;
  readonly href: string;
  /** GitHub: an https URL, rendered through the URL policy. */
  readonly external?: boolean;
}

/**
 * The seven-item contract (ADR-031). `LANDING_NAV` drops any site path whose
 * page is not in `src/pages/` yet, so `/solutions/` appears when that route ships.
 */
export const LANDING_NAV_CONTRACT: readonly LandingNavItem[] = [
  { label: 'Solutions', href: '/solutions/' },
  { label: 'Components', href: '/component-pages/' },
  { label: 'Native', href: '/native/' },
  { label: 'Themes', href: '/gallery-themes/' },
  { label: 'Agents', href: '/agents-page/' },
  { label: 'Docs', href: '/guides/' },
  { label: 'GitHub', href: REPOSITORY_URL, external: true },
];

/** Landing header items whose routes exist (GitHub always). Desktop and phone share this list. */
export const LANDING_NAV: readonly LandingNavItem[] = LANDING_NAV_CONTRACT.filter(
  (item) => item.external === true || siteRouteExists(item.href)
);

const SOLUTION_NAV_LABELS: Readonly<Record<SolutionSlug, string>> = {
  slides: 'Slides',
  documents: 'Documents',
  workflows: 'Workflows',
  canvas: 'Canvas',
  sheets: 'Sheets',
};

/**
 * Sidebar Solutions links from the promoted slugs (schema.ts until
 * `data/solutions/index.ts` merges). A slug is listed only when its landing page exists.
 */
export function solutionNavLinks(): NavLink[] {
  const links: NavLink[] = [];
  if (siteRouteExists('/solutions/')) links.push({ href: '/solutions/', label: 'Explore all' });
  for (const slug of SOLUTION_SLUGS) {
    const href = `/solutions/${slug}/`;
    if (siteRouteExists(href)) links.push({ href, label: SOLUTION_NAV_LABELS[slug] });
  }
  return links;
}

function builtWithNavLinks(): NavLink[] {
  const links: NavLink[] = [];
  if (siteRouteExists('/built-with/')) {
    links.push({ href: '/built-with/', label: 'Built with Texuli' });
  }
  if (siteRouteExists('/built-with/protoyard/')) {
    links.push({ href: '/built-with/protoyard/', label: 'Protoyard' });
  }
  return links;
}

export interface ResolvedNavGroup {
  id: string;
  label: string;
  links: readonly NavLink[];
}

/**
 * Groups ADR-031 adds to the docs sidebar once their pages exist. Not folded
 * into `SITE_NAV_GROUPS` here: `docs-reading.test.ts` pins the current seven
 * group labels, and `NAV_GROUPS` in `site.ts` is a shared file (patch in the
 * lane result).
 */
export function ecosystemNavGroups(): ResolvedNavGroup[] {
  const groups: ResolvedNavGroup[] = [];
  const solutions = solutionNavLinks();
  if (solutions.length > 0) groups.push({ id: 'solutions', label: 'Solutions', links: solutions });
  const built = builtWithNavLinks();
  if (built.length > 0) groups.push({ id: 'built-with', label: 'Built with Texuli', links: built });
  return groups;
}

const byLabel = (a: NavLink, b: NavLink) => a.label.localeCompare(b.label, 'en');

/** Families the component pages group into, in sidebar order. */
export const COMPONENT_FAMILIES: readonly {
  label: string;
  /** Landing page of the family, when it has one; otherwise a plain heading. */
  href?: string;
  match: (entry: (typeof COMPONENT_PAGES)[number]) => boolean;
}[] = [
  { label: 'Blocks', href: '/blocks-page/', match: (e) => e.id.startsWith('blocks-') },
  { label: 'Charts', href: '/charts-page/', match: (e) => e.id.startsWith('charts-') },
  { label: 'Media', href: '/media-page/', match: (e) => e.id.startsWith('media-') },
  { label: 'Display', match: (e) => e.group === 'display' },
  { label: 'Forms', match: (e) => e.group === 'forms' },
  { label: 'Layouts', match: (e) => e.group === 'layouts' },
  { label: 'Overlays', match: (e) => e.group === 'overlays' },
];

/** Component pages grouped by family: a titled, indented list per family. */
function componentFamilyLinks(): NavLink[] {
  const links: NavLink[] = [];
  const taken = new Set<string>();
  for (const family of COMPONENT_FAMILIES) {
    const children = COMPONENT_PAGES.filter((entry) => {
      if (taken.has(entry.id) || !family.match(entry)) return false;
      taken.add(entry.id);
      return true;
    })
      .map((entry) => ({ href: `/component-pages/${entry.id}/`, label: entry.label }))
      .sort(byLabel);
    if (children.length === 0) continue;
    const parent: NavLink = family.href
      ? { href: family.href, label: family.label, children }
      : { label: family.label, children };
    links.push(parent);
  }
  return links;
}

function expanded(kind: NavGroup['expand']): NavLink[] {
  if (kind === 'guides') {
    // Reading order; the guides overview is the group's own first link.
    return GUIDES_SECTIONS.flatMap((section) => section.items)
      .filter((item) => normalizePath(item.href) !== '/guides/')
      .map((item) => ({ href: item.href, label: item.label }));
  }
  if (kind === 'components') {
    return componentFamilyLinks();
  }
  if (kind === 'primitives') {
    return PRIMITIVES.map((doc) => ({ href: `/primitives-page/${doc.id}/`, label: doc.name })).sort(
      byLabel
    );
  }
  return [];
}

/** Every group with its generated links. */
export const SITE_NAV_GROUPS: readonly ResolvedNavGroup[] = NAV_GROUPS.map((group) => ({
  id: group.id,
  label: group.label,
  links: [
    ...group.links.slice(0, group.expandAt ?? group.links.length),
    ...expanded(group.expand),
    ...group.links.slice(group.expandAt ?? group.links.length),
  ],
}));

/** Every navigation link in sidebar order: the pager's reading order. */
export const SITE_NAV_ORDER: readonly (NavLink & { href: string })[] = SITE_NAV_GROUPS.flatMap(
  (group) =>
    group.links
      .flatMap((link) => [link, ...(link.children ?? [])])
      .filter((link): link is NavLink & { href: string } => Boolean(link.href))
);

export interface SiteNavItem {
  label: string;
  /** Omitted on family headings that only name their children. */
  href?: string;
  current?: 'page' | 'section';
  children?: SiteNavItem[];
}

/**
 * Sidebar sections for the page at `current`. The page itself is
 * `aria-current="page"`; the nearest listed ancestor is `section` only when
 * the page has no link of its own. Family parents render their children one
 * indented level under them.
 */
export function navSections(
  base: string,
  current: string
): { label: string; items: SiteNavItem[] }[] {
  const exact = SITE_NAV_ORDER.some((link) => navState(link.href ?? '', current) === 'page');
  const toItem = (link: NavLink): SiteNavItem => {
    const state = link.href ? navState(link.href, current) : undefined;
    const item: SiteNavItem = { label: link.label };
    if (link.href) item.href = withBase(base, link.href);
    if (state === 'page' || (state === 'section' && !exact)) item.current = state;
    if (link.children?.length) {
      item.children = link.children.map((child) => {
        const childState = child.href ? navState(child.href, current) : undefined;
        const childItem: SiteNavItem = {
          label: child.label,
          href: withBase(base, child.href ?? '/'),
        };
        if (childState === 'page' || (childState === 'section' && !exact))
          childItem.current = childState;
        return childItem;
      });
      // A family heading is current only through its children.
      if (!item.current && item.children.some((child) => child.current)) item.current = 'section';
    }
    return item;
  };
  return SITE_NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.links.map(toItem),
  }));
}

/** Previous and next pages in sidebar order, for a page that is in the list. */
export function pagerFor(current: string): {
  previous?: (NavLink & { href: string }) | undefined;
  next?: (NavLink & { href: string }) | undefined;
} {
  const here = normalizePath(current);
  const index = SITE_NAV_ORDER.findIndex((link) => link.href && normalizePath(link.href) === here);
  if (index < 0) return {};
  const previous = SITE_NAV_ORDER[index - 1];
  const next = SITE_NAV_ORDER[index + 1];
  return { ...(previous ? { previous } : {}), ...(next ? { next } : {}) };
}

/**
 * Docs pages get the reading layout: prose width, "On this page", the pager
 * and "Copy page". Galleries, studios and showcases keep the wide layout.
 * DOC_SHELL_ROUTES holds the first-class reading routes outside the section
 * trees (T-32: the architecture page joins them).
 */
export const DOC_SHELL_ROUTES: readonly string[] = [
  '/skill/',
  '/foundation/',
  '/component-pages/',
  '/primitives-page/',
  '/web-and-native/',
  '/developers/',
  '/mcp-server/',
  '/tokens/',
  '/tokens/components/',
];

export function isDocsPath(current: string): boolean {
  const here = normalizePath(current);
  return (
    /^\/component-pages\/[^/]+\/$/.test(here) ||
    /^\/primitives-page\/[^/]+\/$/.test(here) ||
    here.startsWith('/guides/') ||
    DOC_SHELL_ROUTES.includes(here)
  );
}
