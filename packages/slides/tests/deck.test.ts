import { describe, expect, it } from 'vitest';
import {
  BLOCK_CATALOG_IDS,
  DECK_BLOCK_CATALOG_IDS,
  parseDeckGrammar,
  projectLegacyDeck,
  toDeckGrammar,
} from '../src/grammar/index.ts';
import { parseDeck, resolveSlideMaster, resolveSlideTheme } from '../src/model/index.ts';

const basicDeck = {
  meta: { title: 'Quarterly update', aspect: '16:9', themeRef: 'ocean' },
  masters: ['title', 'content'],
  settings: { startIndex: 0, loop: false, showProgress: true },
  slides: [
    {
      id: 'overview',
      title: 'Overview',
      notes: 'Welcome to the review.\nThree priorities follow.',
      master: 'title',
      blocks: [
        { type: 'heading', level: 2, text: 'Three priorities' },
        { type: 'list', items: [{ text: 'Ship the core' }, { text: 'Support the team' }] },
      ],
    },
  ],
};

describe('deck model and grammar', () => {
  it('validates block content, notes, masters, theme refs and stage settings', () => {
    const result = parseDeck(basicDeck);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.deck.meta.themeRef).toEqual({ kind: 'catalog', id: 'ocean' });
    expect(result.deck.slides[0]?.notes).toContain('\n');
    expect(result.deck.settings.startIndex).toBe(0);
  });

  it('rejects duplicate slide ids, invalid masters, oversized notes and malformed blocks', () => {
    const duplicate = structuredClone(basicDeck);
    duplicate.slides.push({ ...duplicate.slides[0]! });
    expect(parseDeck(duplicate)).toMatchObject({
      success: false,
      issues: [{ path: 'slides[1].id' }],
    });

    expect(
      parseDeck({
        ...basicDeck,
        slides: [{ ...basicDeck.slides[0], master: 'freeform', blocks: [] }],
      })
    ).toMatchObject({ success: false, issues: [{ path: 'slides[0].master' }] });

    expect(
      parseDeck({ ...basicDeck, slides: [{ ...basicDeck.slides[0], notes: 'x'.repeat(6_001) }] })
    ).toMatchObject({ success: false, issues: [{ path: 'slides[0].notes' }] });

    expect(
      parseDeck({
        ...basicDeck,
        slides: [
          {
            ...basicDeck.slides[0],
            blocks: [{ type: 'image', src: 'javascript:alert(1)', width: 10, height: 10 }],
          },
        ],
      })
    ).toMatchObject({ success: false, issues: [{ path: 'slides[0].blocks.0.src' }] });

    expect(
      parseDeck({
        ...basicDeck,
        slides: [{ ...basicDeck.slides[0], notes: 'Do not reorder \u202e this text' }],
      })
    ).toMatchObject({ success: false, issues: [{ path: 'slides[0].notes' }] });
  });

  it('validates theme modes and permits a per-slide theme override', () => {
    const result = parseDeck({
      ...basicDeck,
      slides: [
        { ...basicDeck.slides[0], themeRef: { kind: 'catalog', id: 'forest', mode: 'dark' } },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.deck.slides[0]?.themeRef).toEqual({
        kind: 'catalog',
        id: 'forest',
        mode: 'dark',
      });
      expect(resolveSlideTheme(result.deck, result.deck.slides[0]!)).toEqual({
        kind: 'catalog',
        id: 'forest',
        mode: 'dark',
      });
    }

    const inherited = parseDeck({
      ...basicDeck,
      slides: [{ ...basicDeck.slides[0], themeRef: undefined }],
    });
    expect(inherited.success).toBe(true);
    if (inherited.success) {
      expect(resolveSlideTheme(inherited.deck, inherited.deck.slides[0]!)).toEqual(
        inherited.deck.meta.themeRef
      );
    }

    expect(
      parseDeck({
        ...basicDeck,
        meta: { ...basicDeck.meta, themeRef: { kind: 'catalog', id: 'ocean', mode: 'sepia' } },
      })
    ).toMatchObject({ success: false, issues: [{ path: 'meta.themeRef.mode' }] });
  });

  it('resolves built-in master layouts and requires declared slide references', () => {
    expect(resolveSlideMaster()).toEqual({
      id: 'content',
      arrangement: 'stack',
      slots: ['title', 'body', 'footer'],
    });
    expect(resolveSlideMaster('two-column')).toEqual({
      id: 'two-column',
      arrangement: 'split',
      slots: ['title', 'contentStart', 'contentEnd', 'footer'],
    });

    const result = parseDeck({
      ...basicDeck,
      masters: ['content'],
      slides: [{ ...basicDeck.slides[0], master: 'title' }],
    });
    expect(result).toMatchObject({
      success: false,
      issues: [
        { path: 'slides[0].master', message: 'Master id must be declared in deck masters.' },
      ],
    });
  });

  it('maps core block types onto the existing catalog grammar ids', () => {
    const parsed = parseDeck(basicDeck);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const grammar = toDeckGrammar(parsed.deck);
    expect(grammar.id).toBe('layout-deck');
    expect(grammar.props.masters).toEqual(['title', 'content']);
    expect(grammar.props.themeRef).toEqual({ kind: 'catalog', id: 'ocean' });
    expect(grammar.props.slides[0]?.children.map((node) => node.id)).toEqual([
      'blocks-text',
      'blocks-text',
    ]);
    expect(BLOCK_CATALOG_IDS.image).toBe('blocks-media');
    expect(BLOCK_CATALOG_IDS.chart).toBe('blocks-data');
    expect(DECK_BLOCK_CATALOG_IDS).toContain('blocks-interactive');
  });

  it('round-trips the canonical structured grammar and rejects mixed or mismatched ids', () => {
    const parsed = parseDeck(basicDeck);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const grammar = toDeckGrammar(parsed.deck);
    const roundTrip = parseDeckGrammar(grammar);
    expect(roundTrip).toEqual(parsed);

    expect(parseDeckGrammar({ ...grammar, children: [] })).toMatchObject({
      success: false,
      issues: [{ path: 'children' }],
    });

    const wrongFamily = structuredClone(grammar);
    wrongFamily.props.slides[0]!.children[0]!.id = 'blocks-media';
    expect(parseDeckGrammar(wrongFamily)).toMatchObject({
      success: false,
      issues: [{ path: 'props.slides[0].children[0].id' }],
    });
  });

  it('projects the existing layout-deck and layout-card catalog shape to slides', () => {
    const projected = projectLegacyDeck({
      id: 'layout-deck',
      props: { title: 'Harborline kickoff' },
      children: [
        {
          id: 'layout-card',
          props: { title: 'Where we are' },
          children: [
            {
              id: 'blocks-text',
              props: {
                block: { type: 'list', items: [{ text: 'Boards beta is ready' }] },
              },
            },
            {
              id: 'charts-bar',
              props: {
                title: 'Teams onboarded',
                description: 'Teams onboarded by month',
                series: [
                  {
                    id: 'teams',
                    label: 'Teams',
                    points: [{ x: 'Oct', y: 42 }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(projected.success).toBe(true);
    if (!projected.success) return;
    expect(projected.deck.slides[0]).toMatchObject({
      id: 'slide-1',
      title: 'Where we are',
      blocks: [{ type: 'list' }, { type: 'chart', kind: 'bar' }],
    });

    const mismatchedFamily = projectLegacyDeck({
      id: 'layout-deck',
      props: { title: 'Harborline kickoff' },
      children: [
        {
          id: 'layout-card',
          children: [
            { id: 'blocks-media', props: { block: { type: 'list', items: [{ text: 'Agenda' }] } } },
          ],
        },
      ],
    });
    expect(mismatchedFamily).toMatchObject({
      success: false,
      issues: [{ path: 'children[0].children[0].id' }],
    });
  });
});
