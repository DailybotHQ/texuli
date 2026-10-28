// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { deckToMarkdown, parseDeckMarkdown, writeDeckMarkdown } from '../src/markdown/index.ts';
import { jsonEqual } from '../src/markdown/text.ts';
import {
  DECK_CATALOG_LAYOUT_IDS,
  DECK_LAYOUTS,
  type Deck,
  type DeckCatalogLayoutId,
  layoutSteppablePaths,
  migrateDeck,
  parseDeck,
} from '../src/model/index.ts';
import cedar from './fixtures/migrate/protoyard-cedar-training.json';
import createAnything from './fixtures/migrate/protoyard-create-anything.json';
import harbor from './fixtures/migrate/protoyard-harbor-ops-pitch.json';
import northwind from './fixtures/migrate/protoyard-northwind-qbr.json';

type Bag = Record<string, unknown>;

function valid(input: unknown): Deck {
  const result = parseDeck(input);
  expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  return result.deck as Deck;
}

/** The oracle: JSON → Markdown → JSON is the same deck, and the Markdown is a fixed point. */
function roundTrip(deck: Deck): string {
  const written = writeDeckMarkdown(deck);
  const back = parseDeckMarkdown(written.markdown);
  expect(back.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  expect(back.ok).toBe(true);
  expect(jsonEqual(back.deck, deck)).toBe(true);
  expect(deckToMarkdown(back.deck as Deck)).toBe(written.markdown);
  return written.markdown;
}

function layoutDeck(id: DeckCatalogLayoutId, props: Bag): Deck {
  return valid({
    formatVersion: 2,
    meta: { title: 'Layouts' },
    slides: [{ id: 's1', layout: id, props }],
  });
}

/** A copy of the sample with a fragment on every steppable path. */
function stepped(id: DeckCatalogLayoutId): Bag {
  const props = structuredClone(DECK_LAYOUTS[id].sample) as Bag;
  let step = 1;
  for (const path of layoutSteppablePaths(id)) {
    if (path === '') continue;
    const [key, star] = path.split('.');
    const value = props[key ?? ''];
    if (star === '*' && Array.isArray(value)) {
      for (const item of value as Bag[]) {
        item.step = step++;
        item.fragment = 'fade-up';
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value) && key !== 'spec') {
      (value as Bag).step = step++;
      (value as Bag).tone = 'accent';
    }
  }
  return props;
}

describe('deck markdown round-trip: the 20 layouts', () => {
  it.each(DECK_CATALOG_LAYOUT_IDS)(
    '%s writes structured Markdown that reads back the same props',
    (id) => {
      for (const props of [structuredClone(DECK_LAYOUTS[id].sample) as Bag, stepped(id)]) {
        const markdown = roundTrip(layoutDeck(id, props));
        expect(markdown).toContain(`layout=${id}`);
        expect(markdown).not.toMatch(/::: (?:props|slide)\b/);
      }
    }
  );

  it('falls back to an exact ::: props fence when Markdown cannot carry a field', () => {
    const props = structuredClone(DECK_LAYOUTS['comparison-table'].sample) as Bag;
    (props.rows as Bag[])[0] = {
      label: 'Plan',
      values: ['Yes', 'No', 'Maybe'].slice(0, (props.columns as unknown[]).length),
    };
    const markdown = roundTrip(layoutDeck('comparison-table', props));
    expect(markdown).toContain('::: props');
  });

  it('reads hand-written layout slides', () => {
    const markdown = [
      '---\ntitle: Hand written\n---',
      '<!-- .slide: layout=title-hero -->\n# Launch review\n\nWhat we shipped\n\n*October 2026 · Example Inc.*',
      '<!-- .slide: layout=three-column-cards -->\n## Pillars\n\n::: card {icon=rocket}\n### Speed\nShip weekly.\n:::\n\n::: card {fragment}\n### Scale\nServe more teams.\n:::\n\n::: card {fragment}\n### Safety\nNo HTML sinks.\n:::',
      '<!-- .slide: layout=team-avatars -->\n## Team\n\n- **Ada Example** — Design <!-- .element: avatar=av-001 -->\n- **Bo Example**',
      '<!-- .slide: layout=closing-cta -->\n# Try it\n\nBuild a deck today.\n\n[Open the docs](https://example.com/docs)\n\n*Fictional data*',
      '<!-- .slide: layout=video-left -->\n## Demo\n\n::: video {src=clips/demo.mp4 label="Product demo" muted autoplay}\n:::\n\n### Watch\nA short loop.',
    ].join('\n\n---\n\n');
    const result = parseDeckMarkdown(markdown);
    expect(result.issues).toEqual([]);
    const slides = result.deck?.slides as unknown as Bag[];
    expect(slides.map((slide) => slide.props)).toEqual([
      { title: 'Launch review', subtitle: 'What we shipped', meta: 'October 2026 · Example Inc.' },
      {
        title: 'Pillars',
        cards: [
          { icon: 'rocket', heading: 'Speed', body: 'Ship weekly.' },
          { heading: 'Scale', body: 'Serve more teams.', step: 1 },
          { heading: 'Safety', body: 'No HTML sinks.', step: 2 },
        ],
      },
      {
        title: 'Team',
        people: [{ name: 'Ada Example', role: 'Design', avatar: 'av-001' }, { name: 'Bo Example' }],
      },
      {
        title: 'Try it',
        text: 'Build a deck today.',
        cta: { label: 'Open the docs', href: 'https://example.com/docs' },
        footnote: 'Fictional data',
      },
      {
        title: 'Demo',
        video: { src: 'clips/demo.mp4', label: 'Product demo', autoplay: true, muted: true },
        heading: 'Watch',
        body: 'A short loop.',
      },
    ]);
  });

  it('reports missing fields and extra content in layout slides', () => {
    const result = parseDeckMarkdown(
      '---\ntitle: T\n---\n\n<!-- .slide: layout=two-column-split -->\n## Only a title\n\n- stray list'
    );
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['md-layout-missing', 'md-layout-extra']));
    expect(result.ok).toBe(false);
  });
});

describe('deck markdown round-trip: decks', () => {
  const fixtures: [string, unknown][] = [
    ['protoyard-cedar-training', cedar],
    ['protoyard-create-anything', createAnything],
    ['protoyard-harbor-ops-pitch', harbor],
    ['protoyard-northwind-qbr', northwind],
  ];

  it.each(fixtures)(
    '%s (migrated to v2) round-trips model-equal and byte-stable',
    (_name, input) => {
      const migrated = migrateDeck(structuredClone(input));
      roundTrip(valid(migrated.deck));
    }
  );

  it('round-trips every slide kind, block and deck field Markdown can carry', () => {
    const deck = valid({
      formatVersion: 2,
      meta: {
        title: 'Everything',
        description: 'A fictional deck',
        author: 'Ada Example',
        date: '2026-10-27',
        locale: 'en',
        dir: 'ltr',
      },
      style: {
        theme: { kind: 'catalog', id: 'nord', mode: 'dark' },
        aspect: '16:9',
        transition: 'slide',
        background: { kind: 'solid', color: '#10243e' },
        slideNumbers: true,
        math: true,
      },
      navigation: { start: 'blocks', loop: true, autoSlideMs: 0 },
      outline: {
        title: 'Agenda',
        sections: [
          { id: 'intro', title: 'Intro', slideIds: ['blocks', 'widget'] },
          { id: 'stack-whole', slideIds: ['whole', 'custom'], stack: true },
        ],
      },
      slides: [
        {
          id: 'blocks',
          layout: 'free',
          master: 'two-column',
          title: 'All the blocks',
          transition: 'morph',
          background: {
            kind: 'image-full',
            src: 'images/bg.png',
            alt: 'Blue field',
            tone: 'dark',
            overlay: 0.5,
          },
          steps: ['Start', 'Middle'],
          notes: 'Say hello.\n---\n```\nnot code',
          blocks: [
            { type: 'heading', level: 2, text: 'A *literal* star', id: 'top' },
            { type: 'text', markdown: 'Some **bold** and `code`.', step: 1, fragment: 'fade-up' },
            {
              type: 'list',
              items: [{ text: 'one' }, { text: 'two\n- nested' }],
              ordered: true,
              step: 2,
              fragment: 'grow',
              tone: 'info',
            },
            { type: 'quote', quote: 'Stay curious.', cite: 'Ada Example', reveal: 'fade', step: 4 },
            { type: 'divider' },
            {
              type: 'table',
              columns: [
                { id: 'c1', label: 'Name' },
                { id: 'c2', label: 'Role' },
              ],
              rows: [{ c1: 'Ada | B', c2: null }],
            },
            {
              type: 'image',
              src: 'https://example.com/a.png',
              alt: 'A chart',
              width: 800,
              height: 450,
              caption: 'Q3',
            },
            {
              type: 'code',
              code: 'const a = 1;\n```\nconst b = 2;',
              lang: 'ts',
              highlights: ['1', '3'],
              filename: 'a.ts',
              lineNumbers: true,
              step: 9,
            },
            { type: 'math', tex: '\\sum_{i=1}^{n} i' },
            {
              type: 'component',
              component: 'data-board',
              props: { columns: [] },
              height: 'lg',
              step: 10,
              fragment: 'in',
            },
            { type: 'callout', title: 'Rich block', body: 'Kept as JSON.' },
            { type: 'text', markdown: 'Two\n\nparagraphs in one block' },
          ],
        },
        {
          id: 'widget',
          layout: 'quote',
          hidden: true,
          props: { quote: 'Small pieces.', cite: 'Texuli' },
        },
        {
          id: 'whole',
          layout: 'component',
          theme: 'nord',
          component: { component: 'workflow-graph', props: { mode: 'view' } },
        },
        { id: 'custom', layout: 'custom', props: { component: 'org-chart', data: { depth: 2 } } },
        {
          id: 'json-theme',
          layout: 'title-hero',
          theme: { kind: 'seed', seed: 7 },
          props: { title: 'Seeded theme' },
        },
      ],
    });
    const markdown = roundTrip(deck);
    expect(writeDeckMarkdown(deck).issues).toEqual([]);
    expect(markdown).toContain('::: block\n{\n  "type": "callout"');
    expect(markdown).toContain('::: slide');
  });

  it('is byte-stable for canonical Markdown', () => {
    const canonical = `---
title: Canonical
math: true
---

# Hello

Some *text* stays.
<!-- .element: fragment -->

- a <!-- .element: fragment=fade-up -->
- b <!-- .element: fragment=fade-up -->

---

<!-- .slide: layout=quote -->

> Small pieces.
>
> — Texuli

Note: Read it slowly.
`;
    const first = parseDeckMarkdown(canonical);
    expect(first.ok).toBe(true);
    const written = deckToMarkdown(first.deck as Deck);
    expect(deckToMarkdown(parseDeckMarkdown(written).deck as Deck)).toBe(written);
    expect(written).toBe(`---
title: Canonical
math: true
---

# Hello

Some *text* stays.
<!-- .element: fragment -->

- a <!-- .element: fragment=fade-up -->
- b <!-- .element: fragment=fade-up -->

---

<!-- .slide: layout=quote -->

> Small pieces.
>
> — Texuli

Note: Read it slowly.
`);
  });

  it('reports deck fields the dialect cannot express instead of dropping them silently', () => {
    const deck = valid({
      formatVersion: 2,
      meta: { title: 'Embedded' },
      style: {
        theme: { kind: 'embedded', theme: { name: 'x' } },
        background: { kind: 'gradient', gradient: 'dusk' },
      },
      slides: [{ id: 'a', layout: 'title-hero', props: { title: 'A' } }],
    });
    const written = writeDeckMarkdown(deck);
    expect(written.issues.map((issue) => [issue.code, issue.jsonPath])).toEqual([
      ['md-unrepresentable', '$.style.theme'],
      ['md-unrepresentable', '$.style.background'],
    ]);
  });
});
