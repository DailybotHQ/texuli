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
  it('accepts the core vocabulary and rejects unknown types', () => {
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
  });

  it('refuses javascript hrefs on cta actions', () => {
    const parsed = safeParseBlocks([
      {
        type: 'cta',
        actions: [{ label: 'X', href: 'javascript:alert(1)' }],
      },
    ]);
    expect(parsed.success).toBe(false);
  });
});

describe('parseUntrustedBlocks', () => {
  it('round-trips valid core blocks from objects and JSON text', () => {
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
  });

  it('rejects hostile and oversized input without throwing', () => {
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
  });

  it('strips Trojan Source and zero-width characters from text before schema', () => {
    const result = parseUntrustedBlocks([
      { type: 'heading', level: 2, text: 'Hello\u200B\u202EWorld' },
    ]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.blocks[0]).toEqual({ type: 'heading', level: 2, text: 'HelloWorld' });
    expect(JSON.stringify(result.blocks)).not.toMatch(/\\u200b|\\u202e|\u200b|\u202e/i);
  });
});

describe('formula AST', () => {
  it('parses and evaluates a closed calculator expression', () => {
    const parsed = parseFormula({
      op: 'mul',
      left: { op: 'var', name: 'seats' },
      right: { op: 'num', value: 12 },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.variables).toEqual(['seats']);
    expect(evaluateFormula(parsed.formula, { seats: 3 })).toBe(36);
  });

  it('refuses unknown ops, reserved names and cycles', () => {
    expect(parseFormula({ op: 'eval', code: '1+1' }).success).toBe(false);
    expect(parseFormula({ op: 'var', name: 'constructor' }).success).toBe(false);
    const cyclic: Record<string, unknown> = { op: 'num', value: 1 };
    cyclic.self = cyclic;
    expect(parseFormula(cyclic).diagnostics[0]?.code).toBe('cyclic-formula');
  });

  it('flags unknown variables when a known set is provided', () => {
    const parsed = parseFormula(
      { op: 'add', left: { op: 'var', name: 'seats' }, right: { op: 'var', name: 'typo' } },
      { variables: ['seats'] }
    );
    expect(parsed.success).toBe(false);
    expect(parsed.diagnostics.some((d) => d.code === 'unknown-variable')).toBe(true);
  });
});

describe('catalog metadata', () => {
  it('covers every core type with useWhen, dontUseWhen, limits, a11y and examples', () => {
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
  });

  it('validateBlocksForAuthoring returns path diagnostics for bad input', () => {
    const result = validateBlocksForAuthoring([{ type: 'heading', level: 9, text: 'x' }]);
    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]?.jsonPath).toContain('$');
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
