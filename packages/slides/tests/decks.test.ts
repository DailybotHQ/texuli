// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs';
import { CHART_KINDS } from '@texuli/blocks/data/engine';
import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';
import { checkCompositionGrammar, defaultGrammarRoles } from '@texuli/catalog/render/grammar';
import { renderCatalogFromBuild, renderCatalogTree } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import { buildDeckPptx } from '../src/export/index.ts';
import {
  BLOCK_CATALOG_IDS,
  catalogIdForBlock,
  DECK_BLOCK_CATALOG_IDS,
  DECK_SLIDE_CATALOG_ID,
  type DeckDraftResult,
  parseDeckGrammar,
  parseDeckRenderTree,
  projectLegacyDeck,
  toDeckGrammar,
  toDeckRenderTree,
  validateDeckDraft,
} from '../src/grammar/index.ts';
import {
  composeSlide,
  parseDeck,
  resolveSlideMaster,
  resolveSlideTheme,
} from '../src/model/index.ts';
import { gateDeckMedia } from '../src/stage/media.ts';
import { loadDeckLibraryTheme } from '../src/stage/theme.ts';
import {
  createDeckFromTemplate,
  DECK_TEMPLATE_IDS,
  DECK_TEMPLATES,
  type DeckTemplateId,
} from '../src/templates/index.ts';

const build = await buildCatalog(await discoverManifestGroups());

describe('deck model and grammar', () => {
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

  it('deck model validates content, notes, themes and masters, and refuses invalid decks', () => {
    // validates block content, notes, masters, theme refs and stage settings
    {
      const result = parseDeck(basicDeck);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.deck.meta.themeRef).toEqual({ kind: 'catalog', id: 'ocean' });
      expect(result.deck.slides[0]?.notes).toContain('\n');
      expect(result.deck.settings.startIndex).toBe(0);
    }
    // rejects duplicate slide ids, invalid masters, oversized notes and malformed blocks
    {
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
    }
    // validates theme modes and permits a per-slide theme override
    {
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
    }
    // resolves built-in master layouts and requires declared slide references
    {
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
    }
  });

  it('deck grammar maps, round-trips and projects legacy decks, refusing mismatched families', () => {
    // maps core block types onto the existing catalog grammar ids
    {
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
    }
    // round-trips the canonical structured grammar and rejects mixed or mismatched ids
    {
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
    }
    // projects the existing layout-deck and layout-card catalog shape to slides
    {
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
              {
                id: 'blocks-media',
                props: { block: { type: 'list', items: [{ text: 'Agenda' }] } },
              },
            ],
          },
        ],
      });
      expect(mismatchedFamily).toMatchObject({
        success: false,
        issues: [{ path: 'children[0].children[0].id' }],
      });
    }
  });
});

describe('legacy chart projection', () => {
  function deckWith(chart: Record<string, unknown>) {
    return {
      id: 'layout-deck',
      props: { title: 'Harborline review' },
      children: [{ id: 'layout-card', props: { title: 'Numbers' }, children: [chart] }],
    };
  }

  function projectChart(id: string, props: Record<string, unknown>) {
    return projectLegacyDeck(deckWith({ id, props }));
  }

  it('legacy deck projection of chart nodes: extended ids, labels, combo, every kind, refused ids and props', () => {
    // projects extended chart ids with their props
    {
      const projected = projectChart('charts-pie', {
        title: 'Plan mix',
        description: 'Share of fictional workspaces by plan.',
        data: [{ id: 'team', label: 'Team', value: 62 }],
      });
      expect(projected.success).toBe(true);
      if (!projected.success) return;
      expect(projected.deck.slides[0]?.blocks[0]).toMatchObject({
        type: 'chart',
        kind: 'pie',
        title: 'Plan mix',
        props: { data: [{ id: 'team', label: 'Team', value: 62 }] },
      });
    }
    // maps a compact chart label to the block title
    {
      const projected = projectChart('charts-gauge', {
        label: 'Uptime',
        description: 'Fictional uptime this week.',
        value: 99,
      });
      expect(projected.success).toBe(true);
      if (!projected.success) return;
      expect(projected.deck.slides[0]?.blocks[0]).toMatchObject({
        kind: 'gauge',
        title: 'Uptime',
        props: { value: 99 },
      });
    }
    // projects combo through charts-cartesian with inline series
    {
      const projected = projectChart('charts-cartesian', {
        kind: 'combo',
        title: 'Load',
        description: 'Fictional load.',
        series: [{ id: 'a', label: 'A', points: [{ x: 'Mon', y: 1 }] }],
      });
      expect(projected.success).toBe(true);
    }
    for (const kind of CHART_KINDS) {
      const result = projectChart(`charts-${kind}`, { title: 'T', description: 'D' });
      // Data is missing, so blocks rejects the props, never the id.
      expect(result.success, kind).toBe(false);
      if (result.success) continue;
      expect(result.issues[0]?.path, kind).not.toMatch(/\.id$/);
    }
    expect(projectChart('charts-radar', { title: 'T', description: 'D' })).toMatchObject({
      success: false,
      issues: [{ path: 'children[0].children[0].id' }],
    });
    expect(
      projectChart('charts-pie', {
        title: 'T',
        description: 'D',
        data: [{ id: 'a', label: 'A', value: 1 }],
        class: 'injected',
      }).success
    ).toBe(false);
  });
});

describe('deck render tree (G11)', () => {
  const catalog = renderCatalogFromBuild(build.catalog);

  function makeDeck() {
    const parsed = parseDeck({
      meta: {
        title: 'Quarterly review',
        description: 'Fictional quarter for Example Co.',
        locale: 'en-GB',
        aspect: '4:3',
        themeRef: { kind: 'catalog', id: 'graphite', mode: 'system' },
      },
      masters: ['title', 'content'],
      settings: { startIndex: 0, loop: true, defaultTransition: 'fade-up' },
      slides: [
        {
          id: 'opening',
          title: 'Opening',
          master: 'title',
          notes: 'Welcome everyone.\nKeep it short.',
          transition: 'none',
          blocks: [{ type: 'heading', level: 3, text: 'Three priorities' }],
        },
        {
          id: 'numbers',
          title: 'Numbers',
          themeRef: 'ocean',
          blocks: [
            { type: 'list', items: [{ text: 'Revenue up' }, { text: 'Churn down' }] },
            { type: 'code', lang: 'ts', code: 'const growth = 0.12;' },
          ],
        },
      ],
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    return parsed.deck;
  }

  it('renders every slide at the untrusted tier, passes the composition grammar and round-trips', () => {
    // renders every slide and block through the built catalog at the untrusted tier
    {
      const tree = toDeckRenderTree(makeDeck());
      expect(tree.children?.map((node) => node.id)).toEqual([
        DECK_SLIDE_CATALOG_ID,
        DECK_SLIDE_CATALOG_ID,
      ]);
      const result = renderCatalogTree(tree, { catalog, tier: 'untrusted' });
      expect(result.diagnostics).toEqual([]);
      const root = result.roots[0];
      expect(root).toMatchObject({ kind: 'component', id: 'layout-deck' });
      if (root?.kind !== 'component') return;
      expect(root.props).toMatchObject({ aspect: '4:3', locale: 'en-GB' });
      expect(root.children[0]).toMatchObject({
        kind: 'component',
        id: 'deck-slide',
        props: {
          slideId: 'opening',
          notes: 'Welcome everyone.\nKeep it short.',
          transition: 'none',
        },
      });
    }
    // passes the default composition grammar like a report does
    {
      const { roots } = renderCatalogTree(toDeckRenderTree(makeDeck()), {
        catalog,
        tier: 'untrusted',
      });
      const grammar = checkCompositionGrammar(roots, { roles: defaultGrammarRoles });
      expect(grammar.issues).toEqual([]);
      expect(grammar.ok).toBe(true);

      // A block heading that skips below its slide title is caught per slide.
      const deep = toDeckRenderTree(makeDeck());
      const first = deep.children?.[0];
      if (first?.children?.[0]) {
        first.children[0] = {
          id: 'blocks-text',
          props: { block: { type: 'heading', level: 4, text: 'Too deep' } },
        };
      }
      const skipped = checkCompositionGrammar(
        renderCatalogTree(deep, { catalog, tier: 'untrusted' }).roots,
        { roles: defaultGrammarRoles }
      );
      expect(skipped.issues.map((issue) => `${issue.path} ${issue.code}`)).toEqual([
        '0.children.0.children.0 heading-skip',
      ]);
    }
    // round-trips the deck through the tree, including JSON
    {
      const deck = makeDeck();
      const tree = JSON.parse(JSON.stringify(toDeckRenderTree(deck)));
      expect(parseDeckRenderTree(tree)).toEqual({ success: true, deck, issues: [] });
    }
  });

  it('rejects invalid trees with paths and refuses HTML-looking notes', () => {
    // rejects ambiguous, mistyped and invalid trees with tree paths
    {
      const tree = toDeckRenderTree(makeDeck());
      expect(parseDeckRenderTree({ ...tree, props: { ...tree.props, slides: [] } }).issues).toEqual(
        [
          {
            path: 'props.slides',
            message: 'The render tree form uses deck-slide children, not slides[].',
          },
        ]
      );
      expect(
        parseDeckRenderTree({ ...tree, children: [{ id: 'layout-card', props: {} }] }).issues[0]
          ?.path
      ).toBe('children[0]');
      expect(parseDeckRenderTree({ ...tree, children: [] }).issues[0]?.path).toBe('children');

      const badId = JSON.parse(JSON.stringify(tree));
      badId.children[1].props.slideId = 'Not An Id';
      expect(parseDeckRenderTree(badId).issues[0]?.path).toBe('children[1].props.slideId');

      const badBlock = JSON.parse(JSON.stringify(tree));
      badBlock.children[0].children[0] = { id: 'blocks-text', props: { block: { type: 'list' } } };
      expect(parseDeckRenderTree(badBlock).success).toBe(false);

      const badTransition = JSON.parse(JSON.stringify(tree));
      badTransition.children[0].props.transition = 'zoom';
      const rendered = renderCatalogTree(badTransition, { catalog, tier: 'untrusted' });
      expect(rendered.diagnostics.map((d) => `${d.path} ${d.code}`)).toContain(
        '0.children.0 schema-failure'
      );
      expect(parseDeckRenderTree(badTransition).success).toBe(false);
    }
    // refuses HTML-looking slide notes in the renderer, keeping the sink-free contract
    {
      const tree = toDeckRenderTree(makeDeck());
      const first = tree.children?.[0];
      if (first) first.props = { ...first.props, notes: '<img src=x onerror=alert(1)>' };
      const result = renderCatalogTree(tree, { catalog, tier: 'untrusted' });
      expect(result.diagnostics.map((d) => d.code)).toContain('html-string');
    }
  });
});

describe('agent decks with slot masters', () => {
  const catalog = renderCatalogFromBuild(build.catalog);

  describe('agent decks with slot masters', () => {
    it('validates divider-separated slots at the untrusted tier and reports where blocks land', () => {
      const parsed = parseDeck({
        meta: { title: 'Board update' },
        masters: ['two-column', 'quote', 'title'],
        slides: [
          {
            id: 'compare',
            title: 'Before and after',
            master: 'two-column',
            blocks: [
              { type: 'text', markdown: 'Before' },
              { type: 'divider' },
              { type: 'text', markdown: 'After' },
              { type: 'divider' },
              { type: 'text', markdown: 'Source: example.com' },
            ],
          },
          {
            id: 'voice',
            title: 'Customer voice',
            master: 'quote',
            blocks: [
              { type: 'quote', quote: 'It just works.' },
              { type: 'divider' },
              { type: 'text', markdown: 'Ops lead' },
            ],
          },
          { id: 'cover', title: 'Board update', master: 'title', blocks: [] },
        ],
      });
      if (!parsed.success) throw new Error(parsed.issues[0]?.message);
      const result = validateDeckDraft(toDeckRenderTree(parsed.deck), { catalog });
      expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
      expect(result.slides.map((slide) => [slide.slideId, slide.slots])).toEqual([
        ['compare', ['contentStart', 'contentEnd', 'footer']],
        ['voice', ['quote', 'attribution']],
        ['cover', ['body']],
      ]);
    });
  });
});

describe('agent decks with fragments', () => {
  const catalog = renderCatalogFromBuild(build.catalog);

  function makeDeck() {
    const parsed = parseDeck({
      meta: { title: 'Stepped review', aspect: '16:9' },
      slides: [
        {
          id: 'opening',
          title: 'Opening',
          blocks: [{ type: 'heading', level: 2, text: 'Welcome' }],
        },
        {
          id: 'goals',
          title: 'Goals',
          notes: 'Reveal one goal at a time.',
          blocks: [
            { type: 'heading', level: 3, text: 'This quarter' },
            {
              type: 'list',
              step: 1,
              reveal: 'fade-up',
              items: [{ text: 'Ship the export' }, { text: 'Cut latency' }],
            },
            { type: 'callout', tone: 'info', step: 3, body: 'Both goals met.' },
            {
              type: 'code',
              lang: 'ts',
              code: 'const a = 1;\nconst b = 2;',
              step: 2,
              highlights: ['1', '2', '1-2'],
            },
          ],
        },
      ],
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    return parsed.deck;
  }

  describe('agent decks with fragments', () => {
    const tree = () => toDeckRenderTree(makeDeck()) as unknown as Record<string, unknown>;

    it('validates a stepped deck and fails closed on every hostile step, pinning the nested-step diagnostic', () => {
      // validates a stepped deck at the untrusted tier and resolves its step counts
      {
        const result = validateDeckDraft(tree(), { catalog });
        expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
        // The list reveals at steps 1-2, the callout at 3, the code highlights at 2-4.
        expect(result.slides.map((slide) => slide.stepCount)).toEqual([0, 4]);
        expect(result.deck?.slides[1]?.blocks[1]).toMatchObject({ step: 1, reveal: 'fade-up' });
      }
      for (const [name, block] of HOSTILE_STEPS) {
        const result = validateDeckDraft(withGoalsBlock(block), { catalog });
        expect(result.ok, name).toBe(false);
        expect(result.deck, name).toBeNull();
        expect(result.slides, name).toEqual([]);
        expect(
          result.diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
          name
        ).toBe(true);
      }
      // pins the deck diagnostic for a nested step
      {
        const result = validateDeckDraft(
          withGoalsBlock({
            type: 'columns',
            columns: [[{ type: 'text', markdown: 'x', step: 1 }], []],
          }),
          { catalog }
        );
        expect(result.diagnostics.filter((diagnostic) => diagnostic.check === 'deck')).toEqual([
          {
            check: 'deck',
            code: 'deck-schema',
            severity: 'error',
            path: 'children[1].children.1.columns.0.0.step',
            message: 'Reveal steps apply only to top-level slide blocks.',
          },
        ]);
      }
    });

    const withGoalsBlock = (block: unknown) => {
      const value = JSON.parse(JSON.stringify(tree()));
      const node = value.children[1].children[1];
      node.props.block = block;
      const type = (block as { type?: unknown }).type;
      if (type === 'columns') node.id = catalogIdForBlock(type);
      return value;
    };

    const HOSTILE_STEPS: ReadonlyArray<[string, unknown]> = [
      ['a negative step', { type: 'text', markdown: 'x', step: -1 }],
      ['a fractional step', { type: 'text', markdown: 'x', step: 1.5 }],
      ['a string step', { type: 'text', markdown: 'x', step: '2' }],
      ['a step past the block bound', { type: 'text', markdown: 'x', step: 33 }],
      ['an unknown reveal token', { type: 'text', markdown: 'x', reveal: 'spin' }],
      ['an object reveal', { type: 'text', markdown: 'x', reveal: { kind: 'fade' } }],
      [
        'a nested step',
        { type: 'columns', columns: [[{ type: 'text', markdown: 'x', step: 1 }], []] },
      ],
      [
        'item reveals past the slide limit',
        { type: 'list', step: 32, items: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] },
      ],
    ];
  });
});

describe('deck templates', () => {
  const catalog = renderCatalogFromBuild(build.catalog);

  const STRUCTURE: Record<DeckTemplateId, [string, string][]> = {
    report: [
      ['cover', 'title'],
      ['summary', 'content'],
      ['numbers', 'content'],
      ['trend', 'media-left'],
      ['risks', 'content'],
      ['next', 'closing'],
    ],
    pitch: [
      ['cover', 'title'],
      ['problem', 'section'],
      ['solution', 'media-right'],
      ['proof', 'content'],
      ['voice', 'quote'],
      ['ask', 'closing'],
    ],
    review: [
      ['cover', 'title'],
      ['goals', 'content'],
      ['shipped', 'two-column'],
      ['demo', 'media-left'],
      ['next', 'closing'],
    ],
  };

  it('publishes frozen report, pitch and review templates, each pinned and valid', async () => {
    expect(DECK_TEMPLATE_IDS).toEqual(['report', 'pitch', 'review']);
    expect(Object.keys(DECK_TEMPLATES)).toEqual(['report', 'pitch', 'review']);
    expect(Object.isFrozen(DECK_TEMPLATES)).toBe(true);
    for (const id of DECK_TEMPLATE_IDS) {
      const template = DECK_TEMPLATES[id];
      const deck = createDeckFromTemplate(id);
      expect(deck.slides.map((slide) => [slide.id, slide.master])).toEqual(STRUCTURE[id]);
      expect(deck.masters).toEqual([...new Set(STRUCTURE[id].map(([, master]) => master))]);
      expect(deck.meta).toMatchObject({
        aspect: '16:9',
        themeRef: { kind: 'catalog', id: template.themeId },
      });
      expect(deck.settings.defaultTransition).toBe('fade');
      expect(deck.slides.every((slide) => slide.title && slide.themeRef === undefined)).toBe(true);
      expect(deck.slides.some((slide) => slide.notes)).toBe(true);

      // Validates clean as an untrusted agent tree.
      const result = validateDeckDraft(toDeckRenderTree(createDeckFromTemplate(id)), { catalog });
      expect(result.diagnostics).toEqual([]);
      expect(result.ok).toBe(true);
      expect(result.draft.checks).toMatchObject({
        render: 'pass',
        blocks: 'pass',
        grammar: 'pass',
        sinks: 'pass',
      });

      // Places its image in the media region and passes the paint policy.
      const mediaSlide = deck.slides.find((slide) => slide.master?.startsWith('media-'));
      if (!mediaSlide) throw new Error('template has no media slide');
      const media = composeSlide(mediaSlide).regions.find((region) => region.slot === 'media');
      const block = media?.blocks[0];
      expect(block?.type === 'image' || block?.type === 'figure').toBe(true);
      expect(block && 'src' in block ? block.src : '').toBe(
        Object.values(DECK_TEMPLATES[id].imageSlots)[0]
      );
      if (block) expect(gateDeckMedia(block).block).not.toBeNull();

      // The default theme id exists in the token library.
      const theme = await loadDeckLibraryTheme(DECK_TEMPLATES[id].themeId);
      expect(theme.id).toBe(DECK_TEMPLATES[id].themeId);
    }
  });

  it('options rebrand, replace images and refuse invalid input; every call is fresh', () => {
    // rebrands every slide with one theme reference and takes title, aspect and locale
    {
      const deck = createDeckFromTemplate('pitch', {
        title: 'Northwind',
        themeRef: { kind: 'catalog', id: 'emerald', mode: 'dark' },
        aspect: '4:3',
        locale: 'en-GB',
      });
      expect(deck.meta).toMatchObject({ title: 'Northwind', aspect: '4:3', locale: 'en-GB' });
      expect(deck.slides[0]?.title).toBe('Northwind');
      for (const slide of deck.slides) {
        expect(resolveSlideTheme(deck, slide)).toEqual({
          kind: 'catalog',
          id: 'emerald',
          mode: 'dark',
        });
      }
      expect(createDeckFromTemplate('report', { themeRef: 'sepia-print' }).meta.themeRef).toEqual({
        kind: 'catalog',
        id: 'sepia-print',
      });
    }
    // replaces placeholder images by slot
    {
      const deck = createDeckFromTemplate('review', {
        images: {
          demo: { src: 'assets/export.png', alt: 'Export dialog', width: 800, height: 450 },
        },
      });
      const demo = deck.slides.find((slide) => slide.id === 'demo');
      expect(demo?.blocks[0]).toMatchObject({
        type: 'figure',
        src: 'assets/export.png',
        alt: 'Export dialog',
      });
    }
    // returns a fresh deck on every call
    {
      const first = createDeckFromTemplate('report');
      first.slides.pop();
      expect(createDeckFromTemplate('report').slides).toHaveLength(6);
    }
    expect(() => createDeckFromTemplate('report', { title: 'Two\nlines' })).toThrow(TypeError);
    expect(() => createDeckFromTemplate('pitch', { locale: 'not a tag' })).toThrow(/meta.locale/);
    expect(() => createDeckFromTemplate('review', { themeRef: 'Not An Id' })).toThrow(/themeRef/);
    expect(() =>
      createDeckFromTemplate('report', {
        images: { chart: { src: 'javascript:alert(1)', alt: 'x', width: 1, height: 1 } },
      })
    ).toThrow(TypeError);
    expect(() => createDeckFromTemplate('slides' as DeckTemplateId)).toThrow(
      /Unknown deck template/
    );
  });

  it('exports through PPTX, reporting what it leaves out', () => {
    expect(buildDeckPptx(createDeckFromTemplate('report')).omitted).toEqual([
      { slideId: 'numbers', blockType: 'kpi', path: '$[0]' },
      { slideId: 'trend', blockType: 'figure', path: '$[0]' },
    ]);
    expect(buildDeckPptx(createDeckFromTemplate('pitch')).omitted).toEqual([
      { slideId: 'solution', blockType: 'image', path: '$[1]' },
      { slideId: 'proof', blockType: 'stat', path: '$[0]' },
    ]);
    expect(buildDeckPptx(createDeckFromTemplate('review')).omitted).toEqual([
      { slideId: 'goals', blockType: 'checklist', path: '$[0]' },
      { slideId: 'demo', blockType: 'figure', path: '$[0]' },
    ]);
  });
});

describe('golden decks', () => {
  const DIR = 'packages/slides/tests/golden';
  const catalog = renderCatalogFromBuild(build.catalog);

  interface GoldenDeck {
    golden: string;
    tree: unknown;
  }
  interface HostileCase {
    name: string;
    tree: unknown;
  }

  const load = <T>(name: string): T => JSON.parse(readFileSync(`${DIR}/${name}.json`, 'utf8')) as T;
  const codes = (result: DeckDraftResult) =>
    result.diagnostics.map((d) => `${d.severity}:${d.check}:${d.code}@${d.path}`);
  const resolved = (result: DeckDraftResult) =>
    result.slides.map((slide) => ({
      slideId: slide.slideId,
      master: slide.master.id,
      transition: slide.transition,
      theme:
        slide.themeRef?.kind === 'catalog'
          ? `${slide.themeRef.id}:${slide.themeRef.mode ?? '-'}`
          : null,
      steps: slide.stepCount,
    }));

  describe('golden decks', () => {
    it('golden decks validate, resolve masters, themes and transitions, and accept JSON text', () => {
      expect(readdirSync(DIR).sort()).toEqual([
        'deck-hostile.json',
        'deck-legacy-cards.json',
        'deck-notes-and-steps.json',
        'deck-theme-and-masters.json',
      ]);
      // deck-notes-and-steps: validates at the untrusted tier and keeps notes and steps
      {
        const golden = load<GoldenDeck>('deck-notes-and-steps');
        const result = validateDeckDraft(golden.tree, { catalog });
        expect(codes(result)).toEqual([]);
        expect(result.ok).toBe(true);
        expect(result.status).toBe('valid');
        expect(result.draft.checks).toMatchObject({
          render: 'pass',
          blocks: 'pass',
          grammar: 'pass',
          root: 'pass',
          sinks: 'pass',
        });
        expect(result.deck?.slides[0]?.notes).toBe(
          'Open with the two goals.\nPause before the third bullet.'
        );
        expect(resolved(result)).toEqual([
          { slideId: 'goals', master: 'content', transition: 'fade', theme: null, steps: 2 },
          { slideId: 'demo', master: 'content', transition: 'fade', theme: null, steps: 1 },
          { slideId: 'next', master: 'content', transition: 'fade', theme: null, steps: 0 },
        ]);
        // Re-encoding the validated deck (with normalized defaults) validates to the same deck.
        const again = validateDeckDraft(
          toDeckRenderTree(result.deck as NonNullable<typeof result.deck>),
          {
            catalog,
          }
        );
        expect(again.deck).toEqual(result.deck);
      }
      // deck-theme-and-masters: resolves masters, transitions and slide-over-deck themes
      {
        const golden = load<GoldenDeck>('deck-theme-and-masters');
        const result = validateDeckDraft(golden.tree, { catalog });
        expect(codes(result)).toEqual([]);
        expect(resolved(result)).toEqual([
          {
            slideId: 'cover',
            master: 'title',
            transition: 'none',
            theme: 'graphite:system',
            steps: 0,
          },
          {
            slideId: 'compare',
            master: 'two-column',
            transition: 'fade-up',
            theme: 'graphite:system',
            steps: 0,
          },
          { slideId: 'voice', master: 'quote', transition: 'fade', theme: 'ocean:dark', steps: 0 },
          {
            slideId: 'close',
            master: 'closing',
            transition: 'fade-up',
            theme: 'sepia-print:-',
            steps: 0,
          },
        ]);
        expect(result.slides[1]?.master.slots).toEqual([
          'title',
          'contentStart',
          'contentEnd',
          'footer',
        ]);

        const reduced = validateDeckDraft(golden.tree, { catalog, reducedMotion: true });
        expect(reduced.slides.map((slide) => slide.transition)).toEqual([
          'none',
          'none',
          'none',
          'none',
        ]);
      }
      // deck-legacy-cards: still projects the card shape, with a warning
      {
        const result = validateDeckDraft(load<GoldenDeck>('deck-legacy-cards').tree, { catalog });
        expect(result.ok).toBe(true);
        expect(codes(result)).toEqual(['warning:deck:deck-legacy-cards@children']);
        expect(
          result.deck?.slides.map((slide) => [slide.id, slide.title, slide.blocks[0]?.type])
        ).toEqual([
          ['slide-1', 'Agenda', 'list'],
          ['slide-2', 'Burn-down', 'chart'],
        ]);
      }
      // accepts a golden deck as JSON text, the way an agent returns it
      {
        const text = JSON.stringify(load<GoldenDeck>('deck-notes-and-steps').tree);
        expect(validateDeckDraft(text, { catalog }).ok).toBe(true);
        const broken = validateDeckDraft(`${text.slice(0, -2)}`, { catalog });
        expect(broken.ok).toBe(false);
        expect(broken.status).toBe('parse');
        expect(broken.deck).toBeNull();
      }
    });
  });

  describe('hostile golden decks fail closed', () => {
    const EXPECTED: Record<string, readonly string[]> = {
      'bad-slide-id': ['error:deck:deck-schema@children[0].props.slideId'],
      'duplicate-slide-id': ['error:deck:deck-schema@children[1].props.slideId'],
      'missing-slide-id': [
        'error:render:missing-required@0.children.0',
        'error:render:schema-failure@0.children.0',
        'error:deck:deck-schema@children[0].props.slideId',
      ],
      'unknown-master': [
        'error:render:schema-failure@0.children.0',
        'error:render:schema-failure@0.children.0',
        'error:deck:deck-schema@children[0].props.master',
      ],
      'undeclared-master': ['error:deck:deck-schema@children[0].props.master'],
      'unknown-transition': [
        'error:render:schema-failure@0.children.0',
        'error:render:schema-failure@0.children.0',
        'error:deck:deck-schema@children[0].props.transition',
      ],
      'bad-theme-ref': ['error:deck:deck-schema@props.themeRef.kind'],
      'foreign-child': ['error:deck:deck-schema@children[1]'],
      'malformed-block': [
        'error:blocks:block-schema@0.children.0.children.0',
        'error:deck:deck-schema@children[0].children[0].props.block',
      ],
      'family-mismatch': [
        'error:render:block-family-mismatch@0.children.0.children.0',
        'error:render:schema-failure@0.children.0.children.0',
        'error:deck:deck-schema@children[0].children[0].id',
      ],
      'script-url-image': [
        'error:sinks:sink@tree.children[0].children[0].props.block.src',
        'error:sinks:sink@tree.children[0].children[0].props.block.src',
        'error:blocks:block-schema@0.children.0.children.0',
        'error:deck:deck-schema@children[0].children[0].props.block',
      ],
      'html-in-notes': [
        'error:sinks:sink@tree.children[0].props.notes',
        'error:render:html-string@0.children.0',
        'error:render:schema-failure@0.children.0',
      ],
      'style-and-class-props': [
        'error:sinks:sink@tree.children[0].props.class',
        'error:sinks:sink@tree.children[0].props.style',
        'error:render:forbidden-prop@0.children.0',
        'error:render:forbidden-prop@0.children.0',
      ],
      'slides-and-children': ['error:deck:deck-schema@props.slides'],
      'not-a-deck-root': ['error:root:frame-root@0'],
      'empty-deck': ['error:deck:deck-schema@children'],
    };
    const cases = load<{ cases: HostileCase[] }>('deck-hostile').cases;

    it('refuses every hostile case with exactly its pinned diagnostics', () => {
      expect(cases.map((c) => c.name).sort()).toEqual(Object.keys(EXPECTED).sort());
      for (const { name, tree } of cases) {
        const result = validateDeckDraft(tree, { catalog });
        expect(result.ok, name).toBe(false);
        expect(result.status, name).not.toBe('valid');
        expect(result.deck, name).toBeNull();
        expect(result.slides, name).toEqual([]);
        expect(codes(result), name).toEqual(EXPECTED[name]);
      }
    });

    it('refuses oversized notes and an untitled deck', () => {
      const notes = validateDeckDraft(
        {
          id: 'layout-deck',
          props: { title: 'Long notes' },
          children: [{ id: 'deck-slide', props: { slideId: 'one', notes: 'n'.repeat(6_001) } }],
        },
        { catalog }
      );
      expect(notes.ok).toBe(false);
      expect(codes(notes)).toContain('error:deck:deck-schema@children[0].props.notes');

      const untitled = validateDeckDraft(
        {
          id: 'layout-deck',
          props: {},
          children: [{ id: 'deck-slide', props: { slideId: 'one' } }],
        },
        { catalog }
      );
      expect(untitled.ok).toBe(false);
      expect(codes(untitled)).toContain('error:deck:deck-schema@props.title');
    });
  });
});
