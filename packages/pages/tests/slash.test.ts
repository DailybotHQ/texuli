import {
  BLOCK_CATALOG,
  checkCodeBlock,
  checkDataBlock,
  checkEmbedBlock,
  checkInteractiveBlock,
  checkMapBlock,
  checkMediaBlock,
  checkStructureBlock,
  checkTextBlock,
  parseDiagram,
} from '@texuli/blocks';
import { validateDraft } from '@texuli/catalog/validate';
import { createIdSource, type DocumentBlock } from '@texuli/document/model';
import { validateDocument } from '@texuli/document/schema';
import { createPlayerCatalog } from '@texuli/player';
import { describe, expect, it } from 'vitest';
import {
  type BlockCatalogLike,
  blockSlashItems,
  coreSlashItems,
  DEFAULT_COMPONENT_EMBEDS,
  filterSlashItems,
  loadBlockItems,
  type SlashItem,
} from '../src/editor/slash.ts';
import { componentBlueprint, deckBlueprint } from '../src/shared/embeds.ts';
import { DEFAULT_PAGES_LABELS } from '../src/shared/labels.ts';
import { doc } from './fixtures.ts';

const core = () => coreSlashItems(DEFAULT_PAGES_LABELS, { pages: true });
const values = (items: readonly SlashItem[]) => items.map((item) => item.value);

describe('slash menu items', () => {
  it('offers every block type: text, layout, a page, component and deck embeds, and every @texuli/blocks family', async () => {
    const items = [...core(), ...(await loadBlockItems())];
    expect(values(items)).toEqual(
      expect.arrayContaining([
        'paragraph',
        'heading-1',
        'heading-2',
        'heading-3',
        'list-bullet',
        'list-ordered',
        'list-todo',
        'quote',
        'code',
        'divider',
        'callout',
        'toggle',
        'columns-2',
        'columns-3',
        'page',
        'component:charts-line',
        'deck',
      ])
    );
    const families = new Set(
      items.filter((item) => item.group === 'blocks').map((item) => item.keywords[1])
    );
    expect([...families].sort()).toEqual(
      [
        'code',
        'data',
        'diagram',
        'embed',
        'interactive',
        'map',
        'media',
        'structure',
        'text',
      ].sort()
    );
    // Without a host page factory there is no page item.
    expect(values(coreSlashItems(DEFAULT_PAGES_LABELS))).not.toContain('page');
  });

  it('creates blocks with fresh ids that pass the document validator', async () => {
    const items = [...core(), ...(await loadBlockItems())];
    const newId = createIdSource('n');
    const blocks = items
      .map((item) => item.create(newId, { ref: 'pages/new', title: 'New page' }))
      .filter((block): block is DocumentBlock => block !== null);
    expect(blocks).toHaveLength(items.length);
    const result = validateDocument(doc(blocks));
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('wraps content blocks whose samples pass their own family validator', async () => {
    const check: Record<string, (block: unknown) => boolean> = {
      text: (b) => checkTextBlock(b).ok,
      structure: (b) => checkStructureBlock(b).ok,
      media: (b) => checkMediaBlock(b).ok,
      data: (b) => checkDataBlock(b).ok,
      code: (b) => checkCodeBlock(b).ok,
      interactive: (b) => checkInteractiveBlock(b).ok,
      map: (b) => checkMapBlock(b).ok,
      embed: (b) => checkEmbedBlock(b).ok,
      diagram: (b) => parseDiagram(b).success,
    };
    const items = await loadBlockItems();
    expect(items.length).toBeGreaterThanOrEqual(BLOCK_CATALOG.length);
    for (const item of items) {
      const block = item.create(createIdSource('w'));
      if (block?.type !== 'block') throw new Error(item.value);
      const ok = check[block.family]?.({ ...block.props, type: block.block });
      expect(ok, item.value).toBe(true);
    }
  });

  it('defaults component embeds and the sample deck to blueprints the catalog accepts at the untrusted tier', () => {
    const catalog = createPlayerCatalog();
    for (const option of DEFAULT_COMPONENT_EMBEDS) {
      const blueprint = componentBlueprint({ id: option.id, props: option.props ?? {} });
      const result = validateDraft(blueprint, { catalog, tier: 'untrusted' });
      expect(
        result.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message),
        option.id
      ).toEqual([]);
      expect(result.ok, option.id).toBe(true);
    }
    const deckItem = core().find((item) => item.value === 'deck');
    const deck = deckItem?.create(createIdSource('d'));
    if (deck?.type !== 'embed' || !deck.inline) throw new Error('deck item');
    const result = validateDraft(deckBlueprint(deck.inline), { catalog, tier: 'untrusted' });
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
    // A component the catalog does not know is refused.
    expect(
      validateDraft(componentBlueprint({ id: 'no-such-component' }), { catalog, tier: 'untrusted' })
        .ok
    ).toBe(false);
  });

  it('ignores catalog entries without an example and repeated types', () => {
    const catalog: BlockCatalogLike[] = [
      {
        type: 'stat',
        label: 'Stat',
        family: 'data',
        exampleMinimal: { type: 'stat', label: 'A', value: '1' },
      },
      { type: 'stat', label: 'Stat again', family: 'data', exampleMinimal: { type: 'stat' } },
      { type: 'odd', label: 'Odd', family: 'data', exampleMinimal: null },
    ];
    const items = blockSlashItems(catalog).filter((item) => item.keywords[1] === 'data');
    expect(values(items)).toEqual(['block:stat']);
  });
});

describe('slash menu filter', () => {
  it('filters as you type, ranks label prefixes first and folds case and accents', () => {
    const items = core();
    expect(values(filterSlashItems(items, ''))).toEqual(values(items));
    expect(values(filterSlashItems(items, 'head')).slice(0, 3)).toEqual([
      'heading-1',
      'heading-2',
      'heading-3',
    ]);
    // A keyword match ranks after a label match.
    const list = values(filterSlashItems(items, 'list'));
    expect(list.slice(0, 3)).toEqual(['list-bullet', 'list-ordered', 'list-todo']);
    // Every word must match.
    expect(values(filterSlashItems(items, 'numbered list'))).toEqual(['list-ordered']);
    expect(values(filterSlashItems(items, 'HÉADING 2'))).toEqual(['heading-2']);
    expect(values(filterSlashItems(items, 'chart'))).toEqual(
      expect.arrayContaining(['component:charts-line', 'component:charts-donut'])
    );
    expect(filterSlashItems(items, 'zzz-nothing')).toEqual([]);
  });

  it('stays linear on hostile queries and long menus', () => {
    const many: SlashItem[] = Array.from({ length: 5_000 }, (_, index) => ({
      value: `item-${index}`,
      label: `Item ${index} ${'a'.repeat(50)}`,
      group: 'blocks',
      keywords: ['x'.repeat(200)],
      create: () => null,
    }));
    const query = `${'a '.repeat(10_000)}b`;
    const started = performance.now();
    filterSlashItems(many, query);
    filterSlashItems(many, 'a'.repeat(100_000));
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
