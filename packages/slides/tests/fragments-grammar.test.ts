// @vitest-environment node
import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';
import { renderCatalogFromBuild } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import { catalogIdForBlock, toDeckRenderTree, validateDeckDraft } from '../src/grammar/index.ts';
import { parseDeck } from '../src/model/index.ts';

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);

function makeDeck() {
  const parsed = parseDeck({
    meta: { title: 'Stepped review', aspect: '16:9' },
    slides: [
      { id: 'opening', title: 'Opening', blocks: [{ type: 'heading', level: 2, text: 'Welcome' }] },
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

  it('validates a stepped deck at the untrusted tier and resolves its step counts', () => {
    const result = validateDeckDraft(tree(), { catalog });
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    // The list reveals at steps 1-2, the callout at 3, the code highlights at 2-4.
    expect(result.slides.map((slide) => slide.stepCount)).toEqual([0, 4]);
    expect(result.deck?.slides[1]?.blocks[1]).toMatchObject({ step: 1, reveal: 'fade-up' });
  });

  const withGoalsBlock = (block: unknown) => {
    const value = JSON.parse(JSON.stringify(tree()));
    const node = value.children[1].children[1];
    node.props.block = block;
    const type = (block as { type?: unknown }).type;
    if (type === 'columns') node.id = catalogIdForBlock(type);
    return value;
  };

  it.each([
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
  ])('fails closed on %s without throwing', (_name, block) => {
    const result = validateDeckDraft(withGoalsBlock(block), { catalog });
    expect(result.ok).toBe(false);
    expect(result.deck).toBeNull();
    expect(result.slides).toEqual([]);
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')).toBe(true);
  });

  it('pins the deck diagnostic for a nested step', () => {
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
  });
});
