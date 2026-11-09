import { describe, expect, it } from 'vitest';
import {
  checkLandingContent,
  type SolutionLandingContent,
} from '../../src/components/solutions/shared/types.ts';
import {
  checkSolutionEntry,
  checkSolutionRegistry,
  isSafeRegistryHref,
  SOLUTION_SLUGS,
  SOLUTION_STATUSES,
  type SolutionEntry,
} from '../../src/data/solutions/schema.ts';

// A contract fixture, not registry content: the real entries live in src/data/solutions/entries/.
const entry: SolutionEntry = {
  slug: 'slides',
  name: 'Slides',
  status: 'in development',
  tagline: 'Decks from JSON or Markdown.',
  summary: 'A presentation stage on a deck model.',
  route: '/solutions/slides/',
  docs: '/guides/solutions/slides/',
  replaces: '/slides-page/',
  packages: [
    { name: '@texuli/deck', subpaths: ['./model', './engine'], role: 'Deck model and engine' },
    { name: '@texuli/slides', subpaths: ['.'], role: 'Presentation stage' },
  ],
  capabilities: [
    { id: 'present', title: 'Present', summary: 'Step through slides.', status: 'in development' },
  ],
  platforms: [
    { platform: 'web', status: 'in development', evidence: [] },
    { platform: 'android', status: 'planned', evidence: [] },
  ],
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
  how: {
    title: 'How',
    steps: [{ title: 'Parse', body: 'Parse the deck.', package: '@texuli/deck' }],
  },
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

describe('Solutions registry contract', () => {
  it('names the five promoted Solutions and the status vocabulary', () => {
    expect(SOLUTION_SLUGS).toEqual(['slides', 'documents', 'workflows', 'canvas', 'sheets']);
    expect(SOLUTION_STATUSES).toEqual(['available', 'in development', 'experimental', 'planned']);
  });

  it('accepts a valid entry', () => {
    expect(checkSolutionEntry(entry)).toEqual([]);
  });

  it.each([
    ['status', { ...entry, status: 'beta' as never }],
    ['route', { ...entry, route: '/slides/' }],
    ['docs', { ...entry, docs: '/docs/slides/' }],
    ['replaces', { ...entry, replaces: '/slides/' }],
    ['packages[0].name', { ...entry, packages: [{ name: 'react', subpaths: ['.'], role: 'x' }] }],
    [
      'packages[0].subpaths[0]',
      { ...entry, packages: [{ name: '@texuli/deck', subpaths: ['model'], role: 'x' }] },
    ],
    ['capabilities', { ...entry, capabilities: [] }],
    [
      'platforms',
      { ...entry, platforms: [{ platform: 'android', status: 'planned', evidence: [] }] },
    ],
    [
      'platforms[1].evidence',
      {
        ...entry,
        platforms: [entry.platforms[0]!, { platform: 'ios', status: 'available', evidence: [] }],
      },
    ],
    ['demo.id', { ...entry, demo: { ...entry.demo, id: 'sheets' } }],
    ['art.hero.variant', { ...entry, art: { hero: { slot: 'x', variant: 'poster' as never } } }],
    ['limits', { ...entry, limits: [] }],
    ['links[0].href', { ...entry, links: [{ label: 'Bad', href: 'javascript:alert(1)' }] }],
  ] as const)('rejects an invalid %s', (path, bad) => {
    expect(checkSolutionEntry(bad as SolutionEntry).map((i) => i.path)).toContain(path);
  });

  it('rejects duplicate slugs in a registry', () => {
    expect(checkSolutionRegistry([entry, entry]).map((i) => i.path)).toContain('[1].slug');
  });

  it('allows only site-relative or https links', () => {
    expect(isSafeRegistryHref('/solutions/')).toBe(true);
    expect(isSafeRegistryHref('https://example.com/')).toBe(true);
    expect(isSafeRegistryHref('//evil.example/')).toBe(false);
    expect(isSafeRegistryHref('http://example.com/')).toBe(false);
    expect(isSafeRegistryHref('data:text/html,x')).toBe(false);
  });
});

describe('Solution landing block contract', () => {
  it('accepts content consistent with its entry', () => {
    expect(checkLandingContent(entry, content)).toEqual([]);
  });

  it('flags unknown capabilities, foreign packages, a secondary first CTA and a missing docs link', () => {
    const bad: SolutionLandingContent = {
      ...content,
      hero: { ...content.hero, ctas: [{ kind: 'secondary', label: 'Docs', href: '/guides/' }] },
      stories: {
        title: 'S',
        stories: [{ id: 's1', title: 'T', body: 'B', capabilities: ['fly'] }],
      },
      how: { title: 'H', steps: [{ title: 'Paint', body: 'B', package: '@texuli/canvas' }] },
      next: { links: [] },
    };
    expect(checkLandingContent(entry, bad)).toEqual([
      'the first hero call to action must be primary',
      'story "s1" names unknown capability "fly"',
      'how step "Paint" names a package outside the entry',
      'next steps must link the docs route',
    ]);
  });
});
