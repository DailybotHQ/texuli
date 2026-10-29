// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  BLOCK_CATALOG,
  BLOCK_LIMITS,
  type BlockLimits,
  evaluateFormula,
  getCatalogEntry,
  headingOutline,
  listCatalogTypes,
  parseFormula,
  parseUntrustedBlocks,
  safeParseBlocks,
  slugifyHeading,
  validateBlocksForAuthoring,
} from '../src/core/index.ts';

const failure = (input: unknown, limits?: Partial<BlockLimits>) => {
  const result = parseUntrustedBlocks(input, limits);
  expect(result.success).toBe(false);
  if (result.success) throw new Error('expected block input to be rejected');
  expect(result.issues[0]).toMatchObject({
    code: expect.any(String),
    path: expect.any(Array),
    jsonPath: expect.any(String),
    message: expect.any(String),
    fix: expect.any(String),
  });
  return result.issues[0]!;
};

describe('BLOCK_LIMITS', () => {
  it('exports frozen outer guards including diagram caps', () => {
    expect(Object.isFrozen(BLOCK_LIMITS)).toBe(true);
    expect(BLOCK_LIMITS).toMatchObject({
      maxBlocks: 2_000,
      maxContainerDepth: 3,
      maxDataUriBytes: 192 * 1024,
      maxDocumentDataUriBytes: 512 * 1024,
      flowNodes: 12,
      treeNodes: 64,
      treeDepth: 6,
      boardColumns: 6,
      boardCardsPerColumn: 8,
      terminalLines: 40,
    });
  });
});

describe('safeParseBlocks', () => {
  it('accepts the core vocabulary and rejects unknown types; refuses javascript hrefs on cta actions', () => {
    {
      // accepts the core vocabulary and rejects unknown types
      const blocks = [
        { type: 'heading', level: 1, text: 'Hello' },
        { type: 'text', markdown: 'A **safe** paragraph.' },
        { type: 'list', items: [{ text: 'One' }, { text: 'Two' }] },
        { type: 'divider' },
        {
          type: 'cta',
          actions: [{ label: 'Docs', href: 'https://example.com/docs' }],
        },
      ];
      const parsed = safeParseBlocks(blocks);
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data).toHaveLength(5);

      const bad = safeParseBlocks([{ type: 'script', code: 'alert(1)' }]);
      expect(bad.success).toBe(false);
    }
    {
      // refuses javascript hrefs on cta actions
      const parsed = safeParseBlocks([
        {
          type: 'cta',
          actions: [{ label: 'X', href: 'javascript:alert(1)' }],
        },
      ]);
      expect(parsed.success).toBe(false);
    }
  });

  it('keeps the presentation fields (align, size, list markers, quote role and avatar, icons, divider label, stat title, source and trend) and refuses bad values', () => {
    const accepted: readonly (readonly [Record<string, unknown>, Record<string, unknown>])[] = [
      [{ type: 'heading', level: 2, text: 'Plan', align: 'center' }, { align: 'center' }],
      [
        { type: 'text', markdown: 'Body', size: 'lg', align: 'start' },
        { size: 'lg', align: 'start' },
      ],
      [
        {
          type: 'list',
          style: 'check',
          items: [{ text: 'Ship', done: true }, { text: 'Measure' }],
        },
        { style: 'check', items: [{ text: 'Ship', done: true }, { text: 'Measure' }] },
      ],
      [
        { type: 'list', style: 'icon', items: [{ text: 'Fast', icon: 'circle-check' }] },
        { style: 'icon', items: [{ text: 'Fast', icon: 'circle-check' }] },
      ],
      [
        { type: 'list', ordered: true, style: 'number', items: [{ text: 'One' }] },
        { ordered: true, style: 'number' },
      ],
      [
        { type: 'quote', quote: 'Q', cite: 'Ada', role: 'CTO', avatar: 'avatar:av-007' },
        { role: 'CTO', avatar: 'avatar:av-007' },
      ],
      [{ type: 'quote', quote: 'Q', avatar: 'people/ada.webp' }, { avatar: 'people/ada.webp' }],
      [{ type: 'callout', body: 'B', icon: 'info' }, { icon: 'info' }],
      [{ type: 'divider', label: 'Part two' }, { label: 'Part two' }],
      [{ type: 'divider', variant: 'space' }, { variant: 'space' }],
      [
        { type: 'cards', items: [{ title: 'Fast', icon: 'rocket' }] },
        { items: [{ title: 'Fast', icon: 'rocket' }] },
      ],
      [
        {
          type: 'stat',
          title: 'Q3',
          source: 'Fictional data',
          items: [{ label: 'Active', value: '128', trend: [1, 2.5, 3] }],
        },
        {
          title: 'Q3',
          source: 'Fictional data',
          items: [{ label: 'Active', value: '128', trend: [1, 2.5, 3] }],
        },
      ],
    ];
    for (const [input, kept] of accepted) {
      const parsed = safeParseBlocks([input]);
      expect(parsed.success, JSON.stringify(input)).toBe(true);
      if (parsed.success) expect(parsed.data[0], JSON.stringify(input)).toMatchObject(kept);
    }

    const refused: readonly (readonly [Record<string, unknown>, readonly (string | number)[]])[] = [
      [{ type: 'heading', level: 2, text: 'x', align: 'end' }, ['align']],
      [{ type: 'heading', level: 2, text: 'x', align: 'justify' }, ['align']],
      [{ type: 'text', markdown: 'x', size: 'xl' }, ['size']],
      [{ type: 'list', style: 'stars', items: [{ text: 'x' }] }, ['style']],
      [{ type: 'list', ordered: true, style: 'bullet', items: [{ text: 'x' }] }, ['ordered']],
      [{ type: 'list', items: [{ text: 'x', done: true }] }, ['items', 0, 'done']],
      [{ type: 'list', style: 'check', items: [{ text: 'x', done: 'yes' }] }, ['items', 0, 'done']],
      [{ type: 'list', style: 'icon', items: [{ text: 'x' }] }, ['items', 0, 'icon']],
      [{ type: 'list', items: [{ text: 'x', icon: '<svg onload=x>' }] }, ['items', 0, 'icon']],
      [{ type: 'quote', quote: 'q', role: 'line\nbreak' }, ['role']],
      [{ type: 'quote', quote: 'q', avatar: 'https://example.com/a.png' }, ['avatar']],
      [{ type: 'quote', quote: 'q', avatar: 'javascript:alert(1)' }, ['avatar']],
      [{ type: 'quote', quote: 'q', avatar: 'data:image/svg+xml;base64,PHN2Zz4=' }, ['avatar']],
      [{ type: 'quote', quote: 'q', avatar: 'avatar:av-999' }, ['avatar']],
      [{ type: 'callout', body: 'b', icon: 'Info' }, ['icon']],
      [{ type: 'callout', body: 'b', icon: 'a'.repeat(49) }, ['icon']],
      [{ type: 'divider', variant: 'dots' }, ['variant']],
      [{ type: 'divider', variant: 'space', label: 'x' }, ['label']],
      [{ type: 'cards', items: [{ title: 't', icon: 'url(x)' }] }, ['items', 0, 'icon']],
      [{ type: 'stat', title: '', items: [{ label: 'a', value: '1' }] }, ['title']],
      [{ type: 'stat', source: 5, items: [{ label: 'a', value: '1' }] }, ['source']],
      [{ type: 'stat', items: [{ label: 'a', value: '1', trend: [1] }] }, ['items', 0, 'trend']],
      [
        { type: 'stat', items: [{ label: 'a', value: '1', trend: [1, Number.NaN] }] },
        ['items', 0, 'trend', 1],
      ],
      [
        { type: 'stat', items: [{ label: 'a', value: '1', trend: Array(61).fill(1) }] },
        ['items', 0, 'trend'],
      ],
    ];
    for (const [input, path] of refused) {
      const parsed = safeParseBlocks([input]);
      expect(parsed.success, JSON.stringify(input)).toBe(false);
      if (!parsed.success)
        expect(parsed.issues[0]?.path, JSON.stringify(input)).toEqual([0, ...path]);
    }
  });
});

describe('parseUntrustedBlocks', () => {
  it('round-trips valid core blocks from objects and JSON text, and 2 related cases', async () => {
    {
      // round-trips valid core blocks from objects and JSON text
      const blocks = [
        { type: 'heading', level: 2, text: 'Section' },
        { type: 'text', markdown: 'Body line one.\n\nBody line two.' },
        { type: 'code', lang: 'ts', code: 'const n = 1;\n' },
        {
          type: 'columns',
          columns: [[{ type: 'text', markdown: 'Left' }], [{ type: 'text', markdown: 'Right' }]],
        },
      ];
      expect(parseUntrustedBlocks(blocks)).toEqual({ success: true, blocks, issues: [] });
      expect(parseUntrustedBlocks(JSON.stringify(blocks))).toEqual({
        success: true,
        blocks,
        issues: [],
      });
    }
    // rejects hostile and oversized input without throwing
    expect(failure('{').code).toBe('invalid-json');
    expect(failure({ type: 'divider' }).code).toBe('invalid-input');
    expect(failure(JSON.stringify([{ type: 'divider' }]), { maxBytes: 4 }).code).toBe('too-large');
    expect(failure(`${'['.repeat(13)}0${']'.repeat(13)}`).code).toBe('too-deep');
    expect(failure(Array.from({ length: 2_001 }, () => ({ type: 'divider' }))).code).toBe(
      'too-many'
    );
    expect(failure([{ type: 'nope' }]).code).toBe('invalid-blocks');
    expect(failure(JSON.parse('[{"type":"divider","__proto__":{"polluted":true}}]')).code).toBe(
      'unsafe-key'
    );
    expect(
      failure([{ type: 'cta', actions: [{ label: 'X', href: 'javascript:alert(1)' }] }]).code
    ).toBe('invalid-blocks');
    // strips Trojan Source and zero-width characters from text before schema
    await (async () => {
      const result = parseUntrustedBlocks([
        { type: 'heading', level: 2, text: 'Hello\u200B\u202EWorld' },
      ]);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.blocks[0]).toEqual({ type: 'heading', level: 2, text: 'HelloWorld' });
      expect(JSON.stringify(result.blocks)).not.toMatch(/\\u200b|\\u202e|\u200b|\u202e/i);
    })();
  });
});

describe('formula AST', () => {
  it('parses and evaluates a closed calculator expression; refuses unknown ops, reserved names and cycles; flags unknown variables when a known set is provided', async () => {
    // parses and evaluates a closed calculator expression
    await (async () => {
      const parsed = parseFormula({
        op: 'mul',
        left: { op: 'var', name: 'seats' },
        right: { op: 'num', value: 12 },
      });
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      expect(parsed.variables).toEqual(['seats']);
      expect(evaluateFormula(parsed.formula, { seats: 3 })).toBe(36);
    })();
    {
      // refuses unknown ops, reserved names and cycles
      expect(parseFormula({ op: 'eval', code: '1+1' }).success).toBe(false);
      expect(parseFormula({ op: 'var', name: 'constructor' }).success).toBe(false);
      const cyclic: Record<string, unknown> = { op: 'num', value: 1 };
      cyclic.self = cyclic;
      expect(parseFormula(cyclic).diagnostics[0]?.code).toBe('cyclic-formula');
    }
    {
      // flags unknown variables when a known set is provided
      const parsed = parseFormula(
        { op: 'add', left: { op: 'var', name: 'seats' }, right: { op: 'var', name: 'typo' } },
        { variables: ['seats'] }
      );
      expect(parsed.success).toBe(false);
      expect(parsed.diagnostics.some((d) => d.code === 'unknown-variable')).toBe(true);
    }
  });
});

describe('catalog metadata', () => {
  it('covers every core type with useWhen, dontUseWhen, limits, a11y and examples; validateBlocksForAuthoring returns path diagnostics for bad input', () => {
    // covers every core type with useWhen, dontUseWhen, limits, a11y and examples
    expect(listCatalogTypes().length).toBe(BLOCK_CATALOG.length);
    for (const entry of BLOCK_CATALOG) {
      expect(entry.useWhen.length).toBeGreaterThan(0);
      expect(entry.dontUseWhen.length).toBeGreaterThan(0);
      expect(entry.limits.length).toBeGreaterThan(0);
      expect(entry.a11y.length).toBeGreaterThan(0);
      expect(safeParseBlocks([entry.exampleMinimal]).success).toBe(true);
      expect(safeParseBlocks([entry.exampleRich]).success).toBe(true);
      expect(getCatalogEntry(entry.type)?.label).toBe(entry.label);
    }
    {
      // validateBlocksForAuthoring returns path diagnostics for bad input
      const result = validateBlocksForAuthoring([{ type: 'heading', level: 9, text: 'x' }]);
      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.jsonPath).toContain('$');
    }
  });
});

describe('text helpers', () => {
  it('builds a heading outline with stable slugs', () => {
    const outline = headingOutline([
      { type: 'heading', level: 1, text: 'Hello World' },
      { type: 'text', markdown: 'Body' },
      { type: 'heading', level: 2, text: 'Hello World' },
    ]);
    expect(outline).toEqual([
      expect.objectContaining({ level: 1, id: 'hello-world' }),
      expect.objectContaining({ level: 2, id: 'hello-world-2' }),
    ]);
    expect(slugifyHeading('Q3 Review!')).toBe('q3-review');
  });
});
