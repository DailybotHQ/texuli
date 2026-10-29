// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BLOCK_FAMILIES as BLOCKS_FAMILIES } from '../../blocks/src/core/schema/vocabulary.ts';
import {
  BLOCK_FAMILIES,
  CALLOUT_TONES,
  collectRefs,
  countNodes,
  DOCUMENT_LIMITS,
  documentPlainText,
  findNode,
} from '../src/model/index.ts';
import type { TexuliDocument } from '../src/model/types.ts';
import {
  documentJsonSchema,
  isDocument,
  loadUntrustedDocument,
  validateDocument,
} from '../src/schema/index.ts';
import { everyBlock, time } from './fixtures.ts';

type Mutate = (doc: TexuliDocument & Record<string, unknown>) => void;
const blocks = (doc: TexuliDocument) => doc.blocks as unknown as Record<string, unknown>[];

function deep(levels: number): TexuliDocument {
  const doc = everyBlock();
  let inner: Record<string, unknown> = { id: 'leaf', type: 'paragraph', content: [] };
  for (let i = 0; i < levels; i += 1) inner = { id: `q${i}x`, type: 'quote', blocks: [inner] };
  doc.blocks = [inner as never];
  doc.annotations = undefined;
  return doc;
}

describe('document schema', () => {
  it('accepts a document with every block type and copies it', () => {
    const input = everyBlock();
    const result = validateDocument(input);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document).toEqual(input);
    expect(result.document).not.toBe(input);
    expect(isDocument(input)).toBe(true);
    expect(countNodes(input)).toBe(25);
    expect(findNode(input, 'i2p')?.parent?.id).toBe('i2');
    expect(collectRefs(input).map((ref) => `${ref.kind}:${ref.ref}`)).toEqual([
      'page:pages/roadmap',
      'sheet:sheets/budget-2026',
    ]);
    expect(documentPlainText(input)).toContain('Mind the gap.');
  });

  it('refuses hostile and malformed documents with stable codes', () => {
    const push = (d: TexuliDocument, block: Record<string, unknown>) => {
      blocks(d).push(block);
    };
    const set = (target: unknown, key: string, value: unknown) => {
      (target as Record<string, unknown>)[key] = value;
    };
    const run = (marks: unknown[], text = 'x') => [{ type: 'text', text, marks }];
    const cases: [string, Mutate, string][] = [
      ['unsupported format', (d) => set(d, 'format', 'other'), 'unsupported-format'],
      ['future version', (d) => set(d, 'formatVersion', 2), 'unsupported-version'],
      ['unknown block', (d) => push(d, { id: 'z', type: 'iframe' }), 'unknown-block'],
      ['unknown key', (d) => set(blocks(d)[5], 'style', 'x'), 'unknown-key'],
      ['duplicate id', (d) => push(d, { id: 'p1', type: 'divider' }), 'duplicate-id'],
      ['bad id', (d) => push(d, { id: '../x', type: 'divider' }), 'pattern'],
      [
        'javascript link',
        (d) =>
          push(d, {
            id: 'js',
            type: 'paragraph',
            content: run([{ type: 'link', href: 'javascript:alert(1)' }]),
          }),
        'unsafe-url',
      ],
      [
        'http link (untrusted)',
        (d) =>
          push(d, {
            id: 'ht',
            type: 'paragraph',
            content: run([{ type: 'link', href: 'http://example.com' }]),
          }),
        'unsafe-url',
      ],
      [
        'data image',
        (d) => push(d, { id: 'di', type: 'media', ref: 'data:image/png;base64,AAAA', alt: '' }),
        'unsafe-url',
      ],
      [
        'repeated mark',
        (d) =>
          push(d, { id: 'rm', type: 'paragraph', content: run([{ type: 'em' }, { type: 'em' }]) }),
        'duplicate-mark',
      ],
      [
        'bidi override',
        (d) => push(d, { id: 'bd', type: 'paragraph', content: run([], 'a\u202eb') }),
        'unsafe-text',
      ],
      ['embed with both sources', (d) => set(blocks(d)[12], 'ref', 'x'), 'embed-source'],
      [
        'component with children',
        (d) => set(blocks(d)[12], 'inline', { id: 'badge', children: [] }),
        'invalid-component',
      ],
      [
        'invalid deck',
        (d) =>
          push(d, {
            id: 'dk',
            type: 'embed',
            kind: 'deck',
            inline: { formatVersion: 2, slides: 'no' },
          }),
        'invalid-deck',
      ],
      [
        'oversized props',
        (d) =>
          set(
            blocks(d)[11],
            'props',
            Object.fromEntries(
              ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k) => [k, 'x'.repeat(9_999)])
            )
          ),
        'payload-too-large',
      ],
      [
        'one column',
        (d) => {
          (blocks(d)[9] as { columns: unknown[] }).columns.pop();
        },
        'too-few',
      ],
      [
        'list item without a paragraph',
        (d) => {
          const list = blocks(d)[3] as { items: { blocks: unknown[] }[] };
          list.items[0]?.blocks.unshift({ id: 'dv', type: 'divider' });
        },
        'list-item-start',
      ],
      ['too deep', (d) => set(d, 'blocks', deep(DOCUMENT_LIMITS.depth + 1).blocks), 'too-deep'],
      [
        'too many blocks',
        (d) => {
          for (const half of [0, 1])
            push(d, {
              id: `half${half}`,
              type: 'quote',
              blocks: Array.from({ length: DOCUMENT_LIMITS.blocks / 2 }, (_, i) => ({
                id: `x${half}-${i}`,
                type: 'divider',
              })),
            });
        },
        'too-many-blocks',
      ],
      [
        'prototype key',
        (d) => {
          Object.defineProperty(d.meta, '__proto__', { value: {}, enumerable: true });
        },
        'unsafe-key',
      ],
    ];
    for (const [name, mutate, code] of cases) {
      const doc = everyBlock() as TexuliDocument & Record<string, unknown>;
      mutate(doc);
      const result = validateDocument(doc);
      expect(result.ok, name).toBe(false);
      expect(
        result.issues.map((issue) => issue.code),
        name
      ).toContain(code);
    }
  });

  it('applies the developer tier to links and media, and keeps orphaned comments as warnings', () => {
    const doc = everyBlock();
    blocks(doc).push({
      id: 'dev',
      type: 'paragraph',
      content: [{ type: 'text', text: 'x', marks: [{ type: 'link', href: 'http://example.com' }] }],
    });
    expect(validateDocument(doc).ok).toBe(false);
    expect(validateDocument(doc, { trust: 'developer' }).ok).toBe(true);
    const orphan = everyBlock();
    orphan.blocks = orphan.blocks.filter((block) => block.id !== 'p1');
    const result = validateDocument(orphan);
    expect(result.ok).toBe(true);
    expect(result.issues.map((issue) => [issue.code, issue.severity])).toEqual([
      ['unknown-anchor', 'warning'],
    ]);
  });

  it('loads untrusted JSON text with a byte cap before parsing, in linear time', () => {
    expect(loadUntrustedDocument(JSON.stringify(everyBlock())).ok).toBe(true);
    expect(loadUntrustedDocument('{').issues[0]?.code).toBe('invalid-input');
    expect(loadUntrustedDocument('x'.repeat(100), { maxBytes: 10 }).issues[0]?.code).toBe(
      'invalid-input'
    );
    // Hostile: 1,000,000 nested arrays and 200,000 tiny runs stay bounded.
    const nested = `${'['.repeat(100_000)}${']'.repeat(100_000)}`;
    expect(
      time(() => expect(loadUntrustedDocument(`{"blocks":${nested}}`).ok).toBe(false))
    ).toBeLessThan(2_000);
    const doc = everyBlock();
    blocks(doc).push({
      id: 'many',
      type: 'paragraph',
      content: Array.from({ length: 200_000 }, () => ({ type: 'break' })),
    });
    const elapsed = time(() => expect(validateDocument(doc).ok).toBe(false));
    expect(elapsed).toBeLessThan(3_000);
  });

  it('exports a JSON Schema and mirrors the blocks families and tones', () => {
    const schema = documentJsonSchema();
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(Object.keys(schema.$defs as object)).toContain('block');
    expect(JSON.stringify(schema)).toContain('texuli-document');
    expect([...BLOCK_FAMILIES]).toEqual([...BLOCKS_FAMILIES]);
    expect(CALLOUT_TONES).toEqual(['neutral', 'accent', 'info', 'success', 'warning', 'danger']);
  });
});
