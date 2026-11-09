import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SOLUTION_SECTION_IDS,
  SOLUTION_SECTION_ORDER,
  solutionBreadcrumbs,
  solutionSections,
  solutionSectionTones,
  solutionSubnavItems,
} from '../../src/components/solutions/shared/subnav/sections.ts';
import {
  checkLandingContent,
  type SolutionLandingContent,
} from '../../src/components/solutions/shared/types.ts';
import type { SolutionEntry } from '../../src/data/solutions/schema.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(resolve(WEBSITE, path), 'utf8');
const SHARED = 'src/components/solutions/shared';
const layout = read(`${SHARED}/SolutionLayout.astro`);
const subnav = read(`${SHARED}/subnav/SolutionSubnav.astro`);
const crumbs = read(`${SHARED}/subnav/SolutionBreadcrumbs.astro`);
const types = read(`${SHARED}/types.ts`);
const markupOf = (source: string): string =>
  source.slice(source.lastIndexOf('---') + 3, source.indexOf('<style>'));

// A layout fixture, not registry content: the real entries live in src/data/solutions/entries/.
const entry: SolutionEntry = {
  slug: 'slides',
  name: 'Slides',
  status: 'in development',
  tagline: 'Decks from JSON or Markdown.',
  summary: 'A presentation stage on a deck model.',
  route: '/solutions/slides/',
  docs: '/guides/solutions/slides/',
  packages: [
    { name: '@texuli/deck', subpaths: ['./engine'], role: 'Deck model and engine' },
    { name: '@texuli/slides', subpaths: ['.'], role: 'Presentation stage' },
  ],
  capabilities: [
    { id: 'present', title: 'Present', summary: 'Step through slides.', status: 'in development' },
  ],
  platforms: [{ platform: 'web', status: 'in development', evidence: [] }],
  demo: { id: 'slides', title: 'Try a deck', scenarios: ['pitch'], limits: ['No network'] },
  art: { hero: { slot: 'solution-slides-hero', variant: 'plate' } },
  limits: ['No hosted version.'],
  links: [{ label: 'Docs', href: '/guides/solutions/slides/' }],
};

const content: SolutionLandingContent = {
  hero: {
    eyebrow: 'Solution · Slides',
    title: 'Slides',
    lede: 'Decks from data.',
    ctas: [
      { kind: 'primary', label: 'Try the demo', href: '#demo' },
      { kind: 'secondary', label: 'Read the docs', href: '/guides/solutions/slides/' },
    ],
  },
  demo: { title: 'Try it', tryThis: ['Press the right arrow'], label: 'Slides demo' },
  stories: {
    title: 'Stories',
    stories: [{ id: 's1', title: 'Present', body: 'Step.', capabilities: ['present'] }],
  },
  how: { title: 'How', steps: [{ title: 'Run', body: 'Run the deck.', package: '@texuli/deck' }] },
  quickstart: {
    title: 'Quickstart',
    install: { label: 'Install', language: 'bash', code: 'pnpm add @texuli/slides' },
    samples: [],
    verifiedBy: 'apps/website/tests/solutions/slides-quickstart.test.ts',
  },
  agents: { title: 'Agents', body: 'Agents write decks.', surfaces: [] },
  platforms: { title: 'Platforms' },
  next: { links: [{ label: 'Docs', href: '/guides/solutions/slides/' }] },
};
const withRecipes: SolutionLandingContent = {
  ...content,
  recipes: { title: 'Recipes', recipes: [{ title: 'Embed', summary: 'In a page.', href: '/x/' }] },
};

describe('SolutionLayout section model', () => {
  it('follows the block order documented in types.ts', () => {
    const documented = /SolutionLayout` composes them in order:\s*\n\s*\*\s*(.+?)\.\n/.exec(
      types
    )?.[1];
    expect(documented).toBeDefined();
    const fromDoc = (documented ?? '')
      .split('→')
      .map((part) => part.trim().replace('next steps', 'next'));
    expect(fromDoc).toEqual([...SOLUTION_SECTION_ORDER]);
  });

  it('accepts consistent content and lists sections, omitting optional recipes when absent', () => {
    expect(checkLandingContent(entry, content)).toEqual([]);
    expect(checkLandingContent(entry, withRecipes)).toEqual([]);
    expect(solutionSections(content)).not.toContain('recipes');
    expect(solutionSections(withRecipes)).toEqual([...SOLUTION_SECTION_ORDER]);
  });

  it('builds subnav anchors after the hero with unique ids, and keeps #demo for hero calls to action', () => {
    const items = solutionSubnavItems(withRecipes);
    expect(items.map((item) => item.key)).toEqual(SOLUTION_SECTION_ORDER.slice(1));
    expect(items.map((item) => item.label)).toEqual([
      'Demo',
      'Features',
      'How it works',
      'Quickstart',
      'Recipes',
      'Agents',
      'Platforms',
      'Next steps',
    ]);
    for (const item of items) expect(item.href).toBe(`#${item.id}`);
    const ids = Object.values(SOLUTION_SECTION_IDS);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SOLUTION_SECTION_IDS.demo).toBe('demo');
    const anchors = new Set(ids.map((id) => `#${id}`));
    for (const cta of content.hero.ctas)
      if (cta.href.startsWith('#')) expect(anchors.has(cta.href), cta.href).toBe(true);
    expect(solutionSubnavItems(content).map((item) => item.key)).not.toContain('recipes');
  });

  it('alternates band tones over the rendered sections only', () => {
    const tones = solutionSectionTones(solutionSections(content));
    expect(tones.hero).toBeUndefined();
    expect(tones.demo).toBe('base');
    expect(tones.stories).toBe('raised');
    expect(tones.quickstart).toBe('raised');
    expect(tones.agents).toBe('base');
    const keys = solutionSections(withRecipes).filter((key) => key !== 'hero');
    const all = solutionSectionTones(solutionSections(withRecipes));
    for (let i = 1; i < keys.length; i++)
      expect(all[keys[i] as never], keys[i]).not.toBe(all[keys[i - 1] as never]);
  });

  it('uses the nav trail once the landing is listed, and the ADR-031 trail until then', () => {
    expect(solutionBreadcrumbs(entry, [])).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Solutions', href: '/solutions/' },
      { name: 'Slides', href: '/solutions/slides/' },
    ]);
    const nav = [
      { name: 'Home', href: '/' },
      { name: 'Solutions', href: '/solutions/' },
      { name: 'Slides', href: '/solutions/slides/' },
    ];
    expect(solutionBreadcrumbs(entry, nav)).toEqual(nav);
    expect(
      solutionBreadcrumbs(entry, [
        { name: 'Home', href: '/' },
        { name: 'X', href: '/x/' },
      ])
    ).toHaveLength(3);
  });
});

describe('SolutionLayout markup', () => {
  it('sits on BaseLayout in landing mode and refuses inconsistent content at build time', () => {
    expect(layout).toContain("import BaseLayout from '../../../layouts/BaseLayout.astro';");
    expect(layout).toMatch(/<BaseLayout[\s\S]*?\blanding\b[\s\S]*?>/);
    expect(layout).toContain('checkLandingContent(entry, content)');
    expect(layout).toMatch(/throw new Error\(/);
  });

  it('renders the section slots in the documented order, with recipes conditional', () => {
    const slots = [...markupOf(layout).matchAll(/<slot name="([a-z]+)"/g)].map((m) => m[1]);
    expect(slots).toEqual([...SOLUTION_SECTION_ORDER]);
    expect(layout).toMatch(/content\.recipes && \(/);
    const markup = markupOf(layout);
    expect(markup.indexOf('<SolutionBreadcrumbs')).toBeLessThan(
      markup.indexOf('<slot name="hero"')
    );
    expect(markup.indexOf('<slot name="hero"')).toBeLessThan(markup.indexOf('<SolutionSubnav'));
    expect(markup.indexOf('<SolutionSubnav')).toBeLessThan(markup.indexOf('<slot name="demo"'));
  });

  it('wires exactly one island slot (demo) and ships no script, sink or inline style attribute', () => {
    const markup = markupOf(layout);
    expect((markup.match(/data-solution-island/g) ?? []).length).toBe(1);
    const demoWrapper = markup.slice(
      markup.lastIndexOf('<div', markup.indexOf('<slot name="demo"'))
    );
    expect(demoWrapper.slice(0, demoWrapper.indexOf('<slot'))).toContain('data-solution-island');
    for (const source of [layout, subnav, crumbs]) {
      expect(markupOf(source)).not.toMatch(/client:[a-z]+/);
      expect(source).not.toMatch(/<script\b/);
      expect(source).not.toMatch(/set:html|\{@html|innerHTML/);
      expect(markupOf(source)).not.toMatch(/\sstyle=/);
      expect(markupOf(source)).not.toMatch(/unsafe-inline|unsafe-eval/);
    }
  });

  it('keeps the subnav sticky under the site header, labelled, and links through the URL policy', () => {
    expect(subnav).toMatch(/position:\s*sticky;/);
    expect(subnav).toMatch(/inset-block-start:\s*var\(--site-header-height\)/);
    expect(subnav).toMatch(/aria-label=\{`\$\{entry\.name\} page sections`\}/);
    expect(subnav).toContain("safeHref(entry.docs, 'developer')");
    expect(crumbs).toContain('aria-label="Breadcrumb"');
    expect(crumbs).toContain("safeHref(href, 'developer')");
    expect(crumbs).toContain('breadcrumbTrail(entry.route)');
    expect(layout).toMatch(/scroll-margin-block-start:/);
    for (const source of [layout, subnav, crumbs]) {
      expect(source).not.toMatch(/<h[1-6][\s>]/);
      expect(source).not.toMatch(
        /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):|text-align:\s*(left|right)/
      );
    }
  });
});
