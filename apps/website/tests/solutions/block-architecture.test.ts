import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  architectureStack,
  architectureView,
} from '../../src/components/solutions/shared/architecture/architecture-model.ts';
import { PACKAGE_STACK } from '../../src/components/solutions/shared/architecture/package-stack.ts';
import type { SolutionHowProps } from '../../src/components/solutions/shared/types.ts';
import { getSolution, SOLUTIONS } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const BLOCK = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/shared/architecture/SolutionHow.astro'),
  'utf8'
);
const ARCHITECTURE = readFileSync(resolve(REPO, 'docs/ARCHITECTURE.md'), 'utf8');

const props = (overrides: Partial<SolutionHowProps> = {}): SolutionHowProps => ({
  entry: getSolution('slides'),
  title: 'How it works',
  steps: [
    {
      title: 'Write the deck',
      body: 'Parse JSON or Markdown into a deck.',
      package: '@texuli/deck',
    },
    { title: 'Present it', body: 'Mount the stage.', package: '@texuli/slides' },
    { title: 'Ship', body: 'Host the page.' },
  ],
  ...overrides,
});

describe('package stack data', () => {
  it('matches each package.json and the ARCHITECTURE.md layer table', () => {
    for (const [name, stack] of Object.entries(PACKAGE_STACK)) {
      const dir = name === 'texuli' ? 'texuli' : name.replace('@texuli/', '');
      const pkg = JSON.parse(readFileSync(resolve(REPO, 'packages', dir, 'package.json'), 'utf8'));
      expect(pkg.name).toBe(name);
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).filter(
        (d) => d === 'texuli' || d.startsWith('@texuli/')
      );
      expect([...stack.dependsOn].sort(), name).toEqual(deps.sort());
      expect(ARCHITECTURE, name).toContain(`| L${stack.layer} | \`${name}\` |`);
      for (const dep of stack.dependsOn) {
        const below = PACKAGE_STACK[dep];
        if (below) expect(below.layer, `${name} -> ${dep}`).toBeLessThanOrEqual(stack.layer);
      }
    }
  });

  it('covers every registry package and its direct dependencies', () => {
    for (const entry of SOLUTIONS) {
      for (const pkg of entry.packages) {
        expect(PACKAGE_STACK[pkg.name], pkg.name).toBeDefined();
        for (const dep of PACKAGE_STACK[pkg.name]?.dependsOn ?? []) {
          expect(PACKAGE_STACK[dep], `${pkg.name} -> ${dep}`).toBeDefined();
        }
      }
    }
  });
});

describe('SolutionHow view model', () => {
  it('draws the entry packages highest layer first, then the foundations they use', () => {
    const { packages, foundation } = architectureStack(getSolution('slides'));
    expect(packages.map((p) => [p.name, p.layerLabel])).toEqual([
      ['@texuli/slides', 'L8'],
      ['@texuli/deck', 'L0'],
    ]);
    expect(packages[0]?.role).toBe('Presentation stage, layouts, print and PPTX export');
    expect(packages[0]?.href).toBe('https://www.npmjs.com/package/@texuli/slides');
    expect(foundation.map((p) => p.name)).toEqual([
      '@texuli/player',
      '@texuli/catalog',
      '@texuli/blocks',
      '@texuli/media',
      '@texuli/tokens',
      '@texuli/core',
    ]);
    expect(foundation.some((p) => p.name === '@texuli/deck')).toBe(false);
  });

  it('builds a stack and a text summary for every Solution', () => {
    for (const entry of SOLUTIONS) {
      const view = architectureView(
        props({ entry, steps: [{ title: 'Use it', body: 'Install.' }] })
      );
      expect(view.headingId).toBe(`solution-how-${entry.slug}`);
      expect(view.packages).toHaveLength(entry.packages.length);
      expect(view.summary.startsWith(`${entry.name} is built from `)).toBe(true);
      for (const pkg of [...view.packages, ...view.foundation]) {
        expect(view.summary).toContain(pkg.name);
        expect(pkg.href?.startsWith('https://www.npmjs.com/package/')).toBe(true);
      }
    }
  });

  it('numbers the steps and keeps their packages', () => {
    const view = architectureView(props());
    expect(view.steps.map((s) => [s.index, s.package])).toEqual([
      [1, '@texuli/deck'],
      [2, '@texuli/slides'],
      [3, undefined],
    ]);
  });

  it('refuses props that break the block contract', () => {
    expect(() => architectureView(props({ title: ' ' }))).toThrow(/title is empty/);
    expect(() => architectureView(props({ steps: [] }))).toThrow(/at least one step/);
    expect(() =>
      architectureView(props({ steps: [{ title: 'X', body: 'Y', package: '@texuli/sheets' }] }))
    ).toThrow(/outside the entry/);
    expect(() => architectureView(props({ steps: [{ title: 'X', body: '' }] }))).toThrow(
      /title and a body/
    );
  });
});

describe('SolutionHow markup', () => {
  it('is static: a labelled h2, no island, no HTML sinks', () => {
    expect(BLOCK).not.toMatch(/client:|set:html|\{@html|innerHTML|<script/);
    expect(BLOCK.match(/<h2\b/g)).toHaveLength(1);
    expect(BLOCK).toContain('aria-labelledby={view.headingId}');
    expect(BLOCK).toContain('<h2 id={view.headingId}>{view.title}</h2>');
  });

  it('draws the diagram as text lists with a caption', () => {
    expect(BLOCK).toContain('<ol class="solution-how__steps" role="list">');
    expect(BLOCK).toContain(
      '<figcaption class="solution-how__caption">{view.summary}</figcaption>'
    );
    expect(BLOCK).toContain('data-tier="packages"');
    expect(BLOCK).toContain('data-tier="foundation"');
    expect(BLOCK).toContain('href={pkg.href}');
  });
});
