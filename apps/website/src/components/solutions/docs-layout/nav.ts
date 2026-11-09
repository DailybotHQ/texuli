/**
 * Route plumbing for Solution technical docs (ADR-028): `/guides/solutions/<slug>/`.
 * Pure functions so the layout and the later slug pages share one nav, breadcrumb
 * and back-to-overview contract. Do not splice this into `GUIDES_SECTIONS` until
 * those pages exist.
 */

import type { SolutionEntry } from '../../../data/solutions/schema.ts';
import type { DocsNavSection } from '../../guides/nav.ts';

export interface SolutionDocsCrumb {
  readonly name: string;
  readonly href: string;
}

export interface SolutionDocsBackLink {
  readonly href: string;
  readonly label: 'Back to overview';
}

/** Landing overview for this Solution (`/solutions/<slug>/`). */
export function solutionDocsBackLink(entry: Pick<SolutionEntry, 'route'>): SolutionDocsBackLink {
  return { href: entry.route, label: 'Back to overview' };
}

/**
 * Visible trail. The nav-derived trail wins once `GUIDES_SECTIONS` lists the page.
 * Until then: Home / Guides / the Solution name (Guides already exists; the catalog may not).
 */
export function solutionDocsBreadcrumbs(
  entry: Pick<SolutionEntry, 'name' | 'docs'>,
  navTrail: readonly SolutionDocsCrumb[]
): SolutionDocsCrumb[] {
  const last = navTrail.at(-1);
  if (navTrail.length >= 2 && last?.href === entry.docs) return [...navTrail];
  return [
    { name: 'Home', href: '/' },
    { name: 'Guides', href: '/guides/' },
    { name: entry.name, href: entry.docs },
  ];
}

/** Sidebar group to insert under `/guides/` when each slug page ships. */
export function solutionDocsNavSection(
  entries: readonly Pick<SolutionEntry, 'name' | 'docs' | 'tagline'>[]
): DocsNavSection {
  return {
    label: 'Solutions',
    items: entries.map((entry) => ({
      href: entry.docs,
      label: entry.name,
      summary: entry.tagline,
    })),
  };
}

/** Inserts the Solutions group before Scale, or at the end if Scale is absent. */
export function withSolutionDocsNav(
  sections: readonly DocsNavSection[],
  entries: readonly Pick<SolutionEntry, 'name' | 'docs' | 'tagline'>[]
): DocsNavSection[] {
  const group = solutionDocsNavSection(entries);
  const index = sections.findIndex((section) => section.label === 'Scale');
  if (index === -1) return [...sections, group];
  return [...sections.slice(0, index), group, ...sections.slice(index)];
}
