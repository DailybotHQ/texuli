import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { GUIDES_SECTIONS } from '../../src/components/guides/nav.ts';
import {
  solutionDocsBackLink,
  solutionDocsBreadcrumbs,
  solutionDocsNavSection,
  withSolutionDocsNav,
} from '../../src/components/solutions/docs-layout/nav.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';
import type { SolutionEntry } from '../../src/data/solutions/schema.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(resolve(WEBSITE, path), 'utf8');
const LAYOUT = 'src/components/solutions/docs-layout/SolutionDocsLayout.astro';
const layout = read(LAYOUT);
const markupOf = (source: string): string => source.slice(source.lastIndexOf('---') + 3);

const slides = SOLUTIONS.find((entry) => entry.slug === 'slides') as SolutionEntry;

describe('Solution docs route plumbing (ADR-028)', () => {
  it('points every registry entry at /guides/solutions/<slug>/, not /docs/solutions/', () => {
    expect(slides).toBeDefined();
    for (const entry of SOLUTIONS) {
      expect(entry.docs).toBe(`/guides/solutions/${entry.slug}/`);
      expect(entry.docs).not.toMatch(/\/docs\/solutions\//);
      expect(entry.route).toBe(`/solutions/${entry.slug}/`);
    }
    const dashboards = SOLUTIONS.find((entry) => entry.slug === 'dashboards');
    expect(dashboards?.docs).toBe('/guides/solutions/dashboards/');
    expect(siteRouteExists('/guides/solutions/dashboards/')).toBe(true);
  });

  it('builds the back-to-overview link from the landing route', () => {
    expect(solutionDocsBackLink(slides)).toEqual({
      href: '/solutions/slides/',
      label: 'Back to overview',
    });
  });

  it('uses the nav trail once listed, and Home / Guides / name until then', () => {
    expect(solutionDocsBreadcrumbs(slides, [])).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Guides', href: '/guides/' },
      { name: 'Slides', href: '/guides/solutions/slides/' },
    ]);
    const nav = [
      { name: 'Home', href: '/' },
      { name: 'Guides', href: '/guides/' },
      { name: 'Slides', href: '/guides/solutions/slides/' },
    ];
    expect(solutionDocsBreadcrumbs(slides, nav)).toEqual(nav);
  });

  it('builds a Guides sidebar group from the registry, matching each docs route', () => {
    const group = solutionDocsNavSection(SOLUTIONS);
    expect(group.label).toBe('Solutions');
    expect(group.items.map((item) => item.href)).toEqual(SOLUTIONS.map((entry) => entry.docs));
    expect(group.items.map((item) => item.label)).toEqual(SOLUTIONS.map((entry) => entry.name));
    const base = GUIDES_SECTIONS.filter((section) => section.label !== 'Solutions');
    const spliced = withSolutionDocsNav(base, SOLUTIONS);
    const scale = spliced.findIndex((section) => section.label === 'Scale');
    expect(spliced[scale - 1]?.label).toBe('Solutions');
    // The guides sidebar ships the group once, before Scale.
    expect(GUIDES_SECTIONS.filter((section) => section.label === 'Solutions')).toHaveLength(1);
    expect(GUIDES_SECTIONS.map((section) => section.label)).toEqual(
      spliced.map((section) => section.label)
    );
  });
});

describe('SolutionDocsLayout', () => {
  it('wraps GuidesShell (BaseLayout) and links back to the landing through the URL policy', () => {
    expect(layout).toContain("import GuidesShell from '../../guides/GuidesShell.astro';");
    expect(layout).toContain('solutionDocsBackLink(entry)');
    expect(layout).toContain("safeHref(back.href, 'developer')");
    expect(layout).toContain('data-solution-docs-back={entry.slug}');
    expect(layout).toContain('{back.label}');
    expect(layout).toMatch(/<GuidesShell[\s\S]*?<slot \/>/);
  });

  it('ships no island, sink, plan name or docs-solutions path', () => {
    const markup = markupOf(layout);
    expect(markup).not.toMatch(/client:[a-z]+/);
    expect(layout).not.toMatch(/<script\b/);
    expect(layout).not.toMatch(/set:html|\{@html|innerHTML/);
    expect(markup).not.toMatch(/\sstyle=/);
    expect(layout).not.toMatch(/PLAN_015|docs-solutions/);
    expect(layout).not.toMatch(
      /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):|text-align:\s*(left|right)/
    );
  });
});
