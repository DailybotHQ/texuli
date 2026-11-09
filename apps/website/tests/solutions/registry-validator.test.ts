import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SolutionEntry } from '../../src/data/solutions/schema.ts';
import { validateSolutionRegistry } from '../../src/data/solutions/validate.ts';

// Fixture only: real entries are written by T-f-registry-entries.
const slides: SolutionEntry = {
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
    {
      platform: 'compose-desktop',
      status: 'in development',
      evidence: ['native/docs/parity.json'],
    },
    { platform: 'android', status: 'planned', evidence: [] },
    { platform: 'ios', status: 'planned', evidence: [] },
  ],
  demo: { id: 'slides', title: 'Try a deck', scenarios: ['pitch'], limits: ['No network'] },
  art: { hero: { slot: 'solution-slides-hero', variant: 'plate' } },
  limits: ['No hosted version.'],
  links: [{ label: 'Docs', href: '/guides/solutions/slides/' }],
};

const PAGES = resolve(import.meta.dirname, '../../src/pages');
/** The fixture's routes that have no page yet: pages ship during PLAN_015, so this is computed. */
const MISSING_ROUTES = [
  ['[0].docs', 'guides/solutions/slides'],
  ['[0].route', 'solutions/slides'],
]
  .filter(([, dir]) => !existsSync(resolve(PAGES, dir as string, 'index.astro')))
  .map(([path]) => path as string)
  .sort();

describe('Solutions registry file-system validator', () => {
  it('accepts a fixture whose packages, subpaths, evidence and native statuses match the checkout', () => {
    const result = validateSolutionRegistry([slides]);
    expect(result.issues).toEqual([]);
    expect(result.planned.map((issue) => issue.path).sort()).toEqual(MISSING_ROUTES);
  });

  it('rejects a package name that is not in packages/*/package.json', () => {
    const bad: SolutionEntry = {
      ...slides,
      packages: [{ name: '@texuli/not-a-package', subpaths: ['.'], role: 'Missing' }],
    };
    expect(validateSolutionRegistry([bad]).issues.map((issue) => issue.path)).toContain(
      '[0].packages[0].name'
    );
  });

  it('rejects a subpath that the package does not export', () => {
    const bad: SolutionEntry = {
      ...slides,
      packages: [{ name: '@texuli/deck', subpaths: ['./no-such-export'], role: 'Deck' }],
    };
    expect(validateSolutionRegistry([bad]).issues.map((issue) => issue.path)).toContain(
      '[0].packages[0].subpaths[0]'
    );
  });

  it('rejects evidence that is not a file in the repository', () => {
    const bad: SolutionEntry = {
      ...slides,
      platforms: [
        slides.platforms[0]!,
        {
          platform: 'compose-desktop',
          status: 'in development',
          evidence: ['native/docs/does-not-exist.json'],
        },
      ],
    };
    expect(validateSolutionRegistry([bad]).issues.map((issue) => issue.path)).toContain(
      '[0].platforms[1].evidence[0]'
    );
  });

  it('rejects a Compose Desktop status above the parity.json ceiling for Decks', () => {
    const bad: SolutionEntry = {
      ...slides,
      platforms: [
        slides.platforms[0]!,
        {
          platform: 'compose-desktop',
          status: 'available',
          evidence: ['native/docs/parity.json'],
        },
      ],
    };
    expect(validateSolutionRegistry([bad]).issues.map((issue) => issue.path)).toContain(
      '[0].platforms[1].status'
    );
  });

  it('rejects an Android status other than planned', () => {
    const bad: SolutionEntry = {
      ...slides,
      platforms: [
        slides.platforms[0]!,
        { platform: 'android', status: 'in development', evidence: ['native/docs/parity.json'] },
      ],
    };
    expect(validateSolutionRegistry([bad]).issues.map((issue) => issue.path)).toContain(
      '[0].platforms[1].status'
    );
  });

  it('treats missing landing and docs pages as planned unless requireRoutes is set', () => {
    const allowed = validateSolutionRegistry([slides]);
    expect(allowed.issues).toEqual([]);
    expect(allowed.planned.map((issue) => issue.path).sort()).toEqual(MISSING_ROUTES);

    const required = validateSolutionRegistry([slides], { requireRoutes: true });
    expect(required.planned).toEqual([]);
    expect(required.issues.map((issue) => issue.path).sort()).toEqual(MISSING_ROUTES);
  });

  it('still surfaces schema issues from checkSolutionRegistry', () => {
    expect(validateSolutionRegistry([slides, slides]).issues.map((issue) => issue.path)).toContain(
      '[1].slug'
    );
  });
});
