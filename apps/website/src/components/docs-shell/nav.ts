/**
 * Docs shell navigation: a closed, local tree for the demo docs area.
 * Paths are relative to the site base. No external edit links.
 */

export interface DocsNavLink {
  href: string;
  label: string;
  /** Short description for the pager. */
  summary?: string;
}

export interface DocsNavSection {
  label: string;
  items: readonly DocsNavLink[];
}

/** Sidebar sections for `/docs-shell/`. */
export const DOCS_SECTIONS: readonly DocsNavSection[] = [
  {
    label: 'Start',
    items: [
      {
        href: '/docs-shell/',
        label: 'Overview',
        summary: 'How the docs shell is laid out',
      },
      {
        href: '/docs-shell/getting-started/',
        label: 'Getting started',
        summary: 'Read a page end to end',
      },
    ],
  },
  {
    label: 'Shell',
    items: [
      {
        href: '/docs-shell/navigation/',
        label: 'Navigation',
        summary: 'Sidebar, mobile menu, previous and next',
      },
    ],
  },
];

/** Flat reading order for previous / next. */
export function flattenDocsNav(sections: readonly DocsNavSection[] = DOCS_SECTIONS): DocsNavLink[] {
  return sections.flatMap((section) => [...section.items]);
}

export function docsPager(
  currentPath: string,
  sections: readonly DocsNavSection[] = DOCS_SECTIONS
): { prev?: DocsNavLink; next?: DocsNavLink; current?: DocsNavLink } {
  const flat = flattenDocsNav(sections);
  const here = normalizeDocsPath(currentPath);
  const index = flat.findIndex((item) => normalizeDocsPath(item.href) === here);
  if (index < 0) return {};
  return {
    current: flat[index],
    prev: index > 0 ? flat[index - 1] : undefined,
    next: index < flat.length - 1 ? flat[index + 1] : undefined,
  };
}

export function normalizeDocsPath(path: string): string {
  const trimmed = path.replace(/\/index\.html$/, '/').replace(/\/+$/, '');
  const withSlash = `${trimmed.startsWith('/') ? '' : '/'}${trimmed}/`;
  return withSlash.replace(/\/{2,}/g, '/');
}

export interface TocEntry {
  id: string;
  label: string;
  level: 2 | 3;
}
