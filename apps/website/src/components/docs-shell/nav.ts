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
  {
    label: 'Slides',
    items: [
      {
        href: '/slides-page/',
        label: 'Slides overview',
        summary: 'A live deck stage, the starter templates and the slides examples',
      },
      {
        href: '/slides-page/#package-docs',
        label: 'Slides package docs',
        summary: 'Where the @texuli/slides docs live in the repository',
      },
      {
        href: '/examples/slides-tour/',
        label: 'Slides tour example',
        summary: 'Reveal steps, slot masters, presenter view and fullscreen in one deck',
      },
      {
        href: '/showcase/slide-deck/',
        label: 'Slide deck showcase',
        summary: 'A static showcase screen built from Texuli components',
      },
    ],
  },
  {
    label: 'Editor',
    items: [
      {
        href: '/editor-page/',
        label: 'Editor overview',
        summary: 'A live rich text editor, its nodes and marks, and the editor examples',
      },
      {
        href: '/editor-page/#package-docs',
        label: 'Editor package docs',
        summary: 'Where the @texuli/editor docs live in the repository',
      },
      {
        href: '/examples/editor-toolbar/',
        label: 'Editor toolbar example',
        summary: 'The formatting toolbar, the link dialog and the saved Markdown',
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
