// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { deckOutline, deckToText, formatDeckOutline, slideTitle } from '../src/markdown/index.ts';
import { type Deck, migrateDeck, parseDeck } from '../src/model/index.ts';
import createAnything from './fixtures/migrate/protoyard-create-anything.json';

function valid(input: unknown): Deck {
  const result = parseDeck(input);
  expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  return result.deck as Deck;
}

const deck = valid({
  formatVersion: 2,
  meta: { title: 'Launch review' },
  outline: { sections: [{ id: 'intro', title: 'Intro', slideIds: ['cover', 'why'] }] },
  slides: [
    {
      id: 'cover',
      layout: 'title-hero',
      props: { title: 'Launch *review*', subtitle: 'Q3 <b>results</b>' },
      notes: 'Welcome everyone.',
    },
    {
      id: 'why',
      layout: 'quote',
      props: { quote: 'Small pieces. Infinite possibilities.', cite: 'Texuli' },
    },
    {
      id: 'details',
      layout: 'free',
      blocks: [
        { type: 'heading', level: 2, text: 'Details' },
        { type: 'text', markdown: 'Click <a href="javascript:x">here</a>.' },
        { type: 'list', items: [{ text: 'One' }, { text: 'Two' }], ordered: true },
        { type: 'math', tex: '\\frac{1}{2}' },
        { type: 'component', component: 'data-board', props: { title: 'Board' } },
        { type: 'callout', title: 'Note', body: 'Fictional data.' },
      ],
    },
    { id: 'secret', layout: 'section-divider', hidden: true, props: { title: 'Hidden' } },
  ],
});

describe('deck text twins', () => {
  it('deckToText is readable, inert and deterministic', () => {
    const text = deckToText(deck);
    expect(text).toBe(deckToText(deck));
    expect(text).toContain('# Launch review');
    expect(text).toContain('## Intro');
    expect(text).toContain('### 1. Launch \\*review\\*');
    expect(text).toContain('Q3 \\<b\\>results\\</b\\>');
    expect(text).toContain('Click \\<a href="javascript:x">here\\</a>.');
    expect(text).toContain('*Formula: 12*');
    expect(text).toContain('*Component `data-board`*');
    expect(text).toContain('#### Notes\n\nWelcome everyone.');
    expect(text).not.toContain('Hidden');
    expect(text).not.toMatch(/(?<!\\)<[a-z]/);
    expect(deckToText(deck, { includeHidden: true, notes: false })).toContain('Hidden');
    expect(deckToText(deck, { notes: false })).not.toContain('Welcome everyone');
  });

  it('deckOutline lists every slide with its layout, title and section', () => {
    const outline = deckOutline(deck);
    expect(
      outline.slides.map((slide) => [
        slide.id,
        slide.layout,
        slide.title,
        slide.section,
        slide.hidden,
      ])
    ).toEqual([
      ['cover', 'title-hero', 'Launch *review*', 'intro', false],
      ['why', 'quote', 'Small pieces. Infinite possibilities.', 'intro', false],
      ['details', 'free', 'Details', null, false],
      ['secret', 'section-divider', 'Hidden', null, true],
    ]);
    expect(formatDeckOutline(outline).split('\n')[3]).toBe(
      '4. secret · section-divider · Hidden (hidden)'
    );
    expect(slideTitle(deck.slides[2] as Deck['slides'][number])).toBe('Details');
  });

  it('covers a migrated Protoyard flagship deck', () => {
    const input = structuredClone(createAnything);
    const flagship = valid(migrateDeck(input).deck);
    const text = deckToText(flagship);
    expect(text.split('\n').filter((line) => /^#{2,3} \d+\. /.test(line))).toHaveLength(
      flagship.slides.filter((slide) => !slide.hidden).length
    );
    expect(deckOutline(flagship).slides).toHaveLength(flagship.slides.length);
  });
});
