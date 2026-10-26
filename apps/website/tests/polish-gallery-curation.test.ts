/**
 * T-83 — gallery-area curation (PLAN_006 design-punchlist rows 1, 3 and 6).
 *
 * Three page-owned modules put curation on the proof surfaces without touching
 * another lane's islands:
 *
 * - `pages/showcase/hero-screens.ts` picks the "start here" screens of the
 *   showcase index and fails closed when a curated id stops existing;
 * - `pages/gallery-components/start-here.ts` picks the starter components;
 * - `pages/examples/lanes.ts` groups the 157-example catalog into curated
 *   lanes and counts families.
 *
 * Each module runs against the real catalogs so a renamed id or a new example
 * family cannot silently drop out of the pages.
 */
import { describe, expect, it } from 'vitest';
import {
  buildExampleCatalog,
  type ExampleCatalogItem,
} from '../src/components/examples/catalog.ts';
import { SHOWCASE_SCREENS, showcasePath } from '../src/components/showcase/showcase.ts';
import { exampleLanes, examplePackageCounts } from '../src/pages/examples/lanes.ts';
import { pickStartHere, START_HERE_IDS } from '../src/pages/gallery-components/start-here.ts';
import { HERO_IDS, heroScreens } from '../src/pages/showcase/hero-screens.ts';

describe('showcase hero screens', () => {
  it('curates three screens that all exist, in a stable order', () => {
    const heroes = heroScreens(SHOWCASE_SCREENS);
    expect(heroes.map((hero) => hero.screen.id)).toEqual([...HERO_IDS]);
    expect(heroes).toHaveLength(3);
    for (const hero of heroes) {
      expect(showcasePath(hero.screen.id)).toBe(`/showcase/${hero.screen.id}/`);
      expect(hero.why.length).toBeGreaterThan(20);
    }
  });

  it('fails closed: unknown curated ids never render', () => {
    const heroes = heroScreens(SHOWCASE_SCREENS.filter((s) => s.id !== 'kanban'));
    expect(heroes.map((hero) => hero.screen.id)).not.toContain('kanban');
  });

  it('stays inside the fictional Harbor Notes discipline', () => {
    for (const hero of heroScreens(SHOWCASE_SCREENS)) {
      expect(hero.why).toMatch(/fictional|Harbor|widget|board|slide|deck/i);
    }
  });
});

describe('component gallery start-here row', () => {
  const card = (id: string, label = id, category = 'display') => ({
    id,
    label,
    summary: `${label} summary`,
    category,
    package: 'texuli',
    tier: 'component',
    agentEmittable: false,
    tags: [],
    variants: [],
    href: `/component-pages/${id}/`,
    examples: [],
    controls: [],
    initial: {},
  });

  it('keeps the curated order and resolves real cards', () => {
    const picked = pickStartHere(
      [card('card'), card('button'), card('dialog')],
      ['button', 'card', 'dialog']
    );
    expect(picked.map((c) => c.id)).toEqual(['button', 'card', 'dialog']);
  });

  it('skips curated ids that no longer exist instead of rendering dead links', () => {
    const picked = pickStartHere([card('button')], ['button', 'removed-thing']);
    expect(picked.map((c) => c.id)).toEqual(['button']);
  });

  it('every curated starter id exists in the real catalog', async () => {
    const { buildGalleryComponentCards } = await import(
      '../src/components/gallery-components/catalog.ts'
    );
    const cards = buildGalleryComponentCards();
    const picked = pickStartHere(cards);
    expect(picked.map((c) => c.id)).toEqual([...START_HERE_IDS]);
    for (const entry of picked) {
      expect(entry.href).toBe(`/component-pages/${entry.id}/`);
    }
  });
});

function item(partial: Partial<ExampleCatalogItem>): ExampleCatalogItem {
  return {
    id: 'texuli-button',
    title: 'Button',
    description: 'A button.',
    tags: ['texuli'],
    component: 'texuli/button',
    packageId: 'texuli',
    kind: 'button',
    props: [],
    source: null,
    sourcePath: null,
    ...partial,
  };
}

describe('examples lanes', () => {
  const items: ExampleCatalogItem[] = [
    item({ id: 'data-grid', kind: 'grid', packageId: 'data', component: 'data/grid' }),
    item({ id: 'data-stat', kind: 'stat', packageId: 'data' }),
    item({ id: 'texuli-input', kind: 'input', packageId: 'texuli', component: 'texuli/input' }),
    item({ id: 'slides-deck', kind: 'deck', packageId: 'slides' }),
    item({ id: 'blocks-code', kind: 'code', packageId: 'blocks' }),
  ];

  it('groups examples into the curated job lanes, capped, in catalog order', () => {
    const lanes = exampleLanes(items);
    const byId = new Map(lanes.map((lane) => [lane.id, lane]));
    expect(byId.get('dashboards')?.items.map((i) => i.id)).toEqual(['data-grid', 'data-stat']);
    expect(byId.get('forms')?.items.map((i) => i.id)).toEqual(['texuli-input']);
    expect(byId.get('decks')?.items.map((i) => i.id)).toEqual(['slides-deck']);
    expect(byId.get('docs-content')?.items.map((i) => i.id)).toEqual(['blocks-code']);
  });

  it('caps each lane so the shelf stays a shelf', () => {
    const many = Array.from({ length: 20 }, (_, i) => item({ id: `deck-${i}`, kind: 'deck' }));
    const lanes = exampleLanes(many);
    expect(lanes[0]?.items).toHaveLength(6);
  });

  it('counts families over the real catalog: totals add up, decks exist', () => {
    const catalog = buildExampleCatalog();
    const lanes = exampleLanes(catalog);
    expect(lanes.length).toBeGreaterThanOrEqual(4);
    for (const lane of lanes) {
      expect(lane.items.length).toBeGreaterThan(0);
      expect(lane.items.length).toBeLessThanOrEqual(6);
      for (const entry of lane.items) {
        expect(catalog.some((c) => c.id === entry.id)).toBe(true);
      }
    }
    const decks = lanes.find((lane) => lane.id === 'decks');
    expect(decks).toBeDefined();

    const counts = examplePackageCounts(catalog);
    expect(counts.reduce((sum, entry) => sum + entry.count, 0)).toBe(catalog.length);
    expect(counts[0]?.count).toBe(Math.max(...counts.map((c) => c.count)));
  });
});
