// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { detectDeckShape, loadUntrustedDeck, migrateDeck, parseDeck } from '../src/model/index.ts';
import type { DeckDiagnostic } from '../src/schema/index.ts';
import cedar from './fixtures/migrate/protoyard-cedar-training.json';
import createAnything from './fixtures/migrate/protoyard-create-anything.json';
import harbor from './fixtures/migrate/protoyard-harbor-ops-pitch.json';
import northwind from './fixtures/migrate/protoyard-northwind-qbr.json';
import legacyCards from './fixtures/migrate/texuli-grammar-legacy-cards.json';
import notesAndSteps from './fixtures/migrate/texuli-grammar-notes-and-steps.json';
import themeAndMasters from './fixtures/migrate/texuli-grammar-theme-and-masters.json';
import v1Pitch from './fixtures/migrate/texuli-v1-pitch.json';
import v1Review from './fixtures/migrate/texuli-v1-review.json';

type Json = Record<string, unknown>;

const DATA: Record<string, unknown> = {
  'protoyard-cedar-training.json': cedar,
  'protoyard-create-anything.json': createAnything,
  'protoyard-harbor-ops-pitch.json': harbor,
  'protoyard-northwind-qbr.json': northwind,
  'texuli-grammar-legacy-cards.json': legacyCards,
  'texuli-grammar-notes-and-steps.json': notesAndSteps,
  'texuli-grammar-theme-and-masters.json': themeAndMasters,
  'texuli-v1-pitch.json': v1Pitch,
  'texuli-v1-review.json': v1Review,
};

/** A fresh copy of a fixture's deck: grammar fixtures keep the tree under `tree`. */
function fixture(name: string): unknown {
  const data = structuredClone(DATA[name]) as Json;
  return data.tree ?? data;
}

const FIXTURES = Object.keys(DATA);
const SOURCE: Record<string, string> = {
  'texuli-v1': 'texuli-v1',
  'texuli-grammar': 'texuli-grammar',
  protoyard: 'protoyard',
};
const sourceOf = (name: string) =>
  SOURCE[Object.keys(SOURCE).find((prefix) => name.startsWith(prefix)) as string];
const errors = (issues: readonly DeckDiagnostic[]) => issues.filter((i) => i.severity === 'error');

describe('migrateDeck: fixtures', () => {
  it('has Texuli v1, grammar and Protoyard fixtures', () => {
    expect(FIXTURES.filter((name) => name.startsWith('texuli-v1')).length).toBeGreaterThanOrEqual(
      2
    );
    expect(
      FIXTURES.filter((name) => name.startsWith('texuli-grammar')).length
    ).toBeGreaterThanOrEqual(2);
    expect(FIXTURES.filter((name) => name.startsWith('protoyard')).length).toBeGreaterThanOrEqual(
      3
    );
  });

  it('migrates every fixture to a valid v2 deck, idempotently', () => {
    for (const name of FIXTURES) {
      const input = fixture(name);
      const before = JSON.stringify(input);
      const migration = migrateDeck(input);
      expect(migration.from, name).toBe(sourceOf(name));
      expect(detectDeckShape(input), name).toBe(sourceOf(name));
      expect(errors(migration.issues), name).toEqual([]);
      expect(migration.issues[0]?.code, name).toBe('migrated');
      expect(JSON.stringify(input), `${name} input untouched`).toBe(before);

      const parsed = parseDeck(migration.deck);
      expect(errors(parsed.issues), name).toEqual([]);
      expect(parsed.ok, name).toBe(true);

      const again = migrateDeck(migration.deck);
      expect(again.from, name).toBe('v2');
      expect(again.issues, name).toEqual([]);
      expect(again.deck, name).toEqual(migration.deck);
      const fromParsed = migrateDeck(parsed.deck);
      expect(fromParsed.deck, name).toEqual(parsed.deck);

      const loaded = loadUntrustedDeck(JSON.stringify(input));
      expect(loaded.ok, name).toBe(true);
      expect(loaded.from, name).toBe(sourceOf(name));
      expect(loaded.deck, name).toEqual(parsed.deck);
    }
  });

  it('migrates the 25-slide Protoyard flagship with zero errors and only expected warnings', () => {
    const input = fixture('protoyard-create-anything.json') as Json;
    expect((input.slides as unknown[]).length).toBe(25);
    const loaded = loadUntrustedDeck(input);
    expect(loaded.ok).toBe(true);
    expect(errors(loaded.issues)).toEqual([]);
    expect(loaded.issues.map((issue) => `${issue.code} ${issue.pointer}`)).toEqual([
      'migrated ',
      'migrated /meta/title',
      'migrated /slides/14/props/spec',
    ]);
    const deck = loaded.deck;
    const cover = (input.slides as Json[])[0] as Json;
    expect(cover.layout).toBe('title-hero');
    expect(deck?.meta.title).toBe((cover.props as Json).title);
    expect(deck?.slides).toHaveLength(25);
    expect(deck?.outline).toEqual(input.outline);
    expect(deck?.style).toEqual(input.style);
    expect(loaded.steps.some((steps) => steps.count > 0)).toBe(true);
    const chart = deck?.slides[14] as Json;
    expect((chart.props as Json).spec).toEqual({
      kind: 'area',
      title: 'Prototypes created per week (fictional)',
      description:
        'Fictional data: weekly decks grow tenfold over six weeks while apps grow steadily.',
      series: [
        {
          id: 'series-1',
          label: 'Decks',
          points: [4, 9, 15, 22, 31, 40].map((y, i) => ({ x: `W${i + 1}`, y })),
        },
        {
          id: 'series-2',
          label: 'Apps',
          points: [12, 14, 17, 19, 22, 24].map((y, i) => ({ x: `W${i + 1}`, y })),
        },
      ],
    });
  });

  it('maps v1 settings to style and navigation, losslessly keeping blocks and masters', () => {
    const input = fixture('texuli-v1-pitch.json') as Json;
    const { deck } = migrateDeck(input) as { deck: Json };
    const v1Slides = input.slides as Json[];
    expect(deck.style).toEqual({
      aspect: (input.meta as Json).aspect,
      // A mode-less catalog reference becomes the string shorthand.
      theme: ((input.meta as Json).themeRef as Json).id,
      progress: 'none',
      transition: 'fade-up',
    });
    expect(deck.navigation).toEqual({ start: v1Slides[1]?.id, loop: true });
    (deck.slides as Json[]).forEach((slide, i) => {
      expect(slide.layout).toBe('free');
      expect(slide.master).toBe(v1Slides[i]?.master);
      expect(slide.blocks).toEqual(v1Slides[i]?.blocks);
    });
    expect(deck).not.toHaveProperty('masters');
    expect(deck).not.toHaveProperty('settings');
  });

  it('maps grammar trees: deck-slide props, block nodes, chart nodes and legacy cards', () => {
    const themed = migrateDeck(fixture('texuli-grammar-theme-and-masters.json')).deck as Json;
    expect(themed.style).toEqual({
      aspect: '4:3',
      theme: { kind: 'catalog', id: 'graphite', mode: 'system' },
      transition: 'fade-up',
    });
    expect(themed.navigation).toEqual({ loop: true });
    expect((themed.slides as Json[])[0]).toEqual(
      expect.objectContaining({ id: 'cover', master: 'title', transition: 'none', layout: 'free' })
    );
    const steps = migrateDeck(fixture('texuli-grammar-notes-and-steps.json')).deck as Json;
    const goals = (steps.slides as Json[])[0] as Json;
    expect(goals.notes).toBe('Open with the two goals.\nPause before the third bullet.');
    expect((goals.blocks as Json[])[0]).toEqual(
      expect.objectContaining({ type: 'list', step: 1, reveal: 'fade' })
    );
    expect(parseDeck(steps).steps[0]?.count).toBe(2);
    const cards = migrateDeck(fixture('texuli-grammar-legacy-cards.json')).deck as Json;
    const slides = cards.slides as Json[];
    expect(slides.map((slide) => slide.id)).toEqual(['slide-1', 'slide-2']);
    expect(((slides[1] as Json).blocks as Json[])[0]).toEqual({
      type: 'chart',
      kind: 'bar',
      title: 'Points left',
      description: 'Story points left in the fictional sprint',
      series: [
        {
          id: 'left',
          label: 'Left',
          points: [
            { x: 'Mon', y: 21 },
            { x: 'Fri', y: 6 },
          ],
        },
      ],
    });
  });
});

describe('migrateDeck: rules', () => {
  it('passes v2 through untouched and flags unknown shapes', () => {
    const v2 = { formatVersion: 2, meta: { title: 'T' }, slides: [] };
    expect(migrateDeck(v2)).toEqual({ deck: v2, from: 'v2', issues: [] });
    expect(migrateDeck(v2).deck).toBe(v2);
    for (const input of [null, 'deck', [], { slides: [{}] }, { title: 'x' }]) {
      const result = migrateDeck(input);
      expect(result.from).toBe('unknown');
      expect(result.issues.map((issue) => issue.code)).toEqual(['invalid-deck']);
    }
  });

  it('converts Protoyard style, backgrounds and charts with migration warnings', () => {
    const { deck, issues } = migrateDeck({
      style: {
        paletteSeed: 42,
        background: 'gradient-sunset',
        logo: 'javascript:alert(1)',
        density: 'comfortable',
      },
      outline: { sections: [{ id: 'all', slideIds: ['a', 'b', 'c'] }] },
      slides: [
        { id: 'a', layout: 'quote', props: { quote: 'Q' }, background: 'neon' },
        {
          id: 'b',
          layout: 'chart',
          props: {
            spec: {
              kind: 'donut',
              title: 'Share',
              unit: 'percent',
              labels: ['A', 'B'],
              series: [{ label: 'S', values: [60, 40] }],
              step: 1,
            },
          },
        },
        {
          id: 'c',
          layout: 'chart',
          title: 'Funnel slide',
          props: {
            spec: {
              kind: 'funnel',
              title: 'Deals',
              description: 'Fictional',
              labels: ['In', 'Won'],
              series: [{ label: 'D', values: [9, null] }],
            },
          },
        },
      ],
    }) as { deck: Json; issues: DeckDiagnostic[] };
    expect(deck.meta).toEqual({ title: 'Funnel slide' });
    expect(deck.style).toEqual({
      background: 'solid-color',
      density: 'comfortable',
      theme: { kind: 'seed', seed: 42 },
    });
    const slides = deck.slides as Json[];
    expect(slides[0]?.background).toBe('solid-color');
    expect(((slides[1] as Json).props as Json).spec).toEqual({
      kind: 'donut',
      title: 'Share',
      description: 'Share',
      props: {
        data: [
          { id: 'item-1', label: 'A', value: 60 },
          { id: 'item-2', label: 'B', value: 40 },
        ],
      },
      step: 1,
    });
    expect((((slides[2] as Json).props as Json).spec as Json).props).toEqual({
      steps: [
        { id: 'item-1', label: 'In', value: 9 },
        { id: 'item-2', label: 'Won', value: 0 },
      ],
    });
    expect(issues.every((issue) => issue.code === 'migrated' && issue.severity === 'warning')).toBe(
      true
    );
    expect(issues.map((issue) => issue.pointer)).toEqual([
      '',
      '/meta/title',
      '/style/background',
      '/style/logo',
      '/slides/0/background',
      '/slides/1/props/spec/description',
      '/slides/1/props/spec',
      '/slides/1/props/spec',
      '/slides/2/props/spec',
    ]);
    expect(parseDeck(deck).ok).toBe(true);
    const untitled = migrateDeck({
      style: {},
      slides: [{ id: 'a', layout: 'quote', props: { quote: 'Q' } }],
    }).deck as Json;
    expect(untitled.meta).toEqual({ title: 'Untitled deck' });
  });

  it('reports v1 step gaps, empty slides and bad start indexes', () => {
    const { deck, issues } = migrateDeck({
      meta: { title: 'Gaps', aspect: '16:9' },
      settings: { startIndex: 9 },
      slides: [
        {
          id: 'a',
          blocks: [
            { type: 'text', markdown: 'x', step: 2 },
            { type: 'text', markdown: 'y', step: 5 },
          ],
        },
        { id: 'b', title: 'Only a title', blocks: [] },
        { id: 'c', blocks: [{ type: 'text', markdown: 'z' }], extra: true },
      ],
    }) as { deck: Json; issues: DeckDiagnostic[] };
    expect(issues.map((issue) => issue.pointer)).toEqual([
      '',
      '/navigation',
      '/slides/0',
      '/slides/2',
    ]);
    expect(issues.map((issue) => issue.message.split(' ').slice(0, 2).join(' '))).toEqual([
      'Converted from',
      'settings.startIndex 9',
      'Steps are',
      'Dropped keys',
    ]);
    // An empty v1 slide stays empty; its title is shown by the stage.
    expect((deck.slides as Json[])[1]?.blocks).toEqual([]);
    expect(deck).not.toHaveProperty('navigation');
    expect(parseDeck(deck).ok).toBe(true);
  });

  it('never throws on exotic input', () => {
    const hostile = { meta: {}, slides: [] as unknown[] };
    Object.defineProperty(hostile.slides, 0, {
      enumerable: true,
      get: () => {
        throw new Error('no');
      },
    });
    expect(() => migrateDeck(hostile)).not.toThrow();
    expect(migrateDeck(hostile).issues.map((issue) => issue.code)).toEqual(['invalid-input']);
  });
});
