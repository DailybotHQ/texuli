/**
 * Guides navigation: getting started through performance.
 * Paths are relative to the site base. Reuses docs-shell pager helpers.
 */

import {
  docsPager as baseDocsPager,
  type DocsNavLink,
  type DocsNavSection,
  flattenDocsNav,
  normalizeDocsPath,
  type TocEntry,
} from '../docs-shell/nav.ts';

export type { DocsNavLink, DocsNavSection, TocEntry };
export { flattenDocsNav, normalizeDocsPath };

/** Sidebar sections for `/guides/`. */
export const GUIDES_SECTIONS: readonly DocsNavSection[] = [
  {
    label: 'Start',
    items: [
      {
        href: '/guides/',
        label: 'Overview',
        summary: 'What the guides cover',
      },
      {
        href: '/guides/getting-started/',
        label: 'Getting started',
        summary: 'Install or copy Texuli into a project',
      },
      {
        href: '/guides/why-svelte-kotlin/',
        label: 'Why Svelte and Kotlin',
        summary: 'The two runtimes behind Texuli',
      },
    ],
  },
  {
    label: 'Appearance',
    items: [
      {
        href: '/guides/theming/',
        label: 'Theming',
        summary: 'Themes, tokens and CSS layers',
      },
      {
        href: '/guides/dark-mode/',
        label: 'Dark mode',
        summary: 'Light, dark and system with no flash',
      },
    ],
  },
  {
    label: 'Inclusive UI',
    items: [
      {
        href: '/guides/accessibility/',
        label: 'Accessibility',
        summary: 'Keyboard, labels and WCAG 2.x contrast',
      },
      {
        href: '/guides/rtl-i18n/',
        label: 'RTL and i18n',
        summary: 'Logical CSS, dir and locale',
      },
      {
        href: '/guides/forms/',
        label: 'Forms',
        summary: 'Field, Input and validation',
      },
    ],
  },
  {
    label: 'Scale',
    items: [
      {
        href: '/guides/performance/',
        label: 'Performance',
        summary: 'Lazy subpaths and budgets',
      },
    ],
  },
];

/** Previous / next for a guides path. */
export function guidesPager(currentPath: string): {
  prev?: DocsNavLink;
  next?: DocsNavLink;
  current?: DocsNavLink;
} {
  return baseDocsPager(currentPath, GUIDES_SECTIONS);
}

/** Flat reading order for tests and indexes. */
export function flattenGuidesNav(): DocsNavLink[] {
  return flattenDocsNav(GUIDES_SECTIONS);
}
