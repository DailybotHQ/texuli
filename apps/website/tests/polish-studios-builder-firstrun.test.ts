/**
 * T-82 — builder first run (punch-list row 3) and the in-UI keyboard map
 * (row 4), pinned at their seams: the bare-draft predicate in the pure model
 * and the markers/copy the islands render.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import { EMPTY_BLUEPRINT, isBareDraft } from '../src/components/builder/model.ts';
import { STARTERS } from '../src/components/builder/starters/model.ts';

function repoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = dirname(dir);
  }
}

function read(path: string): string {
  return readFileSync(resolve(repoRoot(), path), 'utf8');
}

describe('isBareDraft', () => {
  it('is true for the untouched page root in any shape', () => {
    expect(isBareDraft(EMPTY_BLUEPRINT)).toBe(true);
    expect(isBareDraft({ id: 'layout-page', props: {} })).toBe(true);
  });

  it('is false once any child lands, at any depth', () => {
    const withChild: CatalogTreeInput = {
      id: 'layout-page',
      props: {},
      children: [{ id: 'card', props: { title: 'First' }, children: [] }],
    };
    expect(isBareDraft(withChild)).toBe(false);
    const nested: CatalogTreeInput = {
      id: 'layout-page',
      props: {},
      children: [
        { id: 'layout-section', props: {}, children: [{ id: 'card', props: {}, children: [] }] },
      ],
    };
    expect(isBareDraft(nested)).toBe(false);
  });
});

describe('builder first-run affordances', () => {
  const app = read('apps/website/src/components/builder/BuilderApp.svelte');

  it('renders a first-run state with one-click samples that never collide with the toolbar starters', () => {
    expect(app).toContain('data-builder-firstrun');
    expect(app).toContain('data-builder-firstrun-starter=');
    // The e2e suite clicks [data-builder-starter=...]; the first-run cards
    // must carry their own marker so the locators stay single-match.
    const toolbarUses = app.match(/data-builder-starter=/g)?.length ?? 0;
    const firstRunUses = app.match(/data-builder-firstrun-starter=/g)?.length ?? 0;
    expect(toolbarUses).toBe(1);
    expect(firstRunUses).toBe(1);
    expect(app).toContain("starter.id !== 'empty'");
  });

  it('shows the keyboard map in the toolbar', () => {
    expect(app).toContain('data-builder-keys');
    expect(app).toContain('<kbd>F6</kbd>');
    expect(app).toContain('Alt</kbd> + <kbd>Arrows</kbd> move the row');
  });

  it('keeps the starter list honest: every non-empty starter has a sample', () => {
    const sample = STARTERS.filter((starter) => starter.id !== 'empty');
    expect(sample.length).toBe(3);
    for (const starter of sample) {
      expect(starter.label).toBeTruthy();
      expect(starter.summary).toBeTruthy();
    }
  });
});
