// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fromMarkdown, MARKDOWN_CODEC_LIMITS, toMarkdown } from '../src/editor/markdown.ts';
import {
  EDITOR_LIMITS,
  type EditorBlock,
  type EditorDocument,
  editorLeaves,
  editorPlainText,
  validateEditorDocument,
} from '../src/editor/model.ts';

/** A document without its runtime ids, for comparisons. */
function shape(doc: EditorDocument): unknown {
  const strip = (blocks: readonly EditorBlock[]): unknown =>
    blocks.map((block) => {
      const { id: _id, ...rest } = block as EditorBlock & Record<string, unknown>;
      if (block.type === 'quote') return { ...rest, blocks: strip(block.blocks) };
      if (block.type === 'list')
        return {
          ...rest,
          items: block.items.map(({ id: _i, ...item }) => ({
            ...item,
            blocks: strip(item.blocks),
          })),
        };
      return rest;
    });
  return strip(doc.blocks);
}

const read = (source: string) => fromMarkdown(source).doc;

describe('reading Markdown', () => {
  it('reads every block of the subset, and 3 related cases', () => {
    {
      // reads every block of the subset
      const doc = read(
        [
          '# Title',
          '',
          'Text with **strong**, *em*, ~~strike~~, `code` and [a link](https://example.com).',
          '',
          '- one',
          '- [two](https://example.com/2)',
          '    - nested',
          '',
          '3. third',
          '4. fourth',
          '',
          '- [x] done',
          '- [ ] open',
          '',
          '> quoted',
          '',
          '```ts',
          'const x = 1;',
          '```',
          '',
          '---',
          '',
          '![A chart](asset-7)',
        ].join('\n')
      );
      expect(validateEditorDocument(doc)).toEqual([]);
      expect(doc.blocks.map((b) => b.type)).toEqual([
        'heading',
        'paragraph',
        'list',
        'list',
        'list',
        'quote',
        'code',
        'divider',
        'media',
      ]);
      expect(doc.blocks[3]).toMatchObject({ kind: 'ordered', start: 3 });
      expect(doc.blocks[4]).toMatchObject({
        kind: 'todo',
        items: [{ checked: true }, { checked: false }],
      });
      expect(doc.blocks[6]).toMatchObject({ lang: 'ts', text: 'const x = 1;' });
      expect(doc.blocks[8]).toMatchObject({ ref: 'asset-7', alt: 'A chart' });
      const marks = (doc.blocks[1] as Extract<EditorBlock, { type: 'paragraph' }>).content.flatMap(
        (n) => (n.type === 'text' ? n.marks.map((m) => m.type) : [])
      );
      expect(marks).toEqual(['strong', 'em', 'strike', 'code', 'link']);
    }
    {
      // keeps raw HTML as literal text and refuses executable links
      const { doc, diagnostics } = fromMarkdown(
        '<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>'
      );
      expect(editorPlainText(doc)).toBe('<script>alert(1)</script> x <img src=x onerror=alert(1)>');
      expect(JSON.stringify(doc)).not.toContain('javascript');
      expect(diagnostics.map((d) => d.code)).toEqual(['link-rejected']);
    }
    {
      // reads images inside text as their alt text, hard breaks as breaks, soft breaks as spaces
      const doc = read('see ![alt text](https://example.com/i.png) here  \nnext\\\nlast\nsoft');
      expect(doc.blocks[0]).toMatchObject({
        type: 'paragraph',
        content: [
          { text: 'see alt text here' },
          { type: 'break' },
          { text: 'next' },
          { type: 'break' },
          { text: 'last soft' },
        ],
      });
    }
    {
      // clamps deep headings and caps nesting
      const { doc, diagnostics } = fromMarkdown(`###### Deep\n\n${'>'.repeat(50)} core`);
      expect(doc.blocks[0]).toMatchObject({ type: 'heading', level: 4 });
      expect(Math.max(...editorLeaves(doc).map((l) => l.depth))).toBeLessThanOrEqual(
        EDITOR_LIMITS.depth
      );
      expect(diagnostics.map((d) => d.code)).toEqual(['heading-clamped', 'depth-capped']);
    }
  });

  it('bounds hostile input in size and time', () => {
    const big = fromMarkdown('x'.repeat(MARKDOWN_CODEC_LIMITS.source + 10));
    expect(big.diagnostics[0]?.code).toBe('text-truncated');
    const smaller = fromMarkdown('abcdef', { maxSource: 3 });
    expect(editorPlainText(smaller.doc)).toBe('abc');
    for (const unit of ['*a ', '_a ', '**a ', '[a', '`a ', '~~a ']) {
      const started = performance.now();
      const { doc } = fromMarkdown(
        unit.repeat(Math.floor(MARKDOWN_CODEC_LIMITS.source / unit.length))
      );
      expect(performance.now() - started).toBeLessThan(3_000);
      expect(validateEditorDocument(doc)).toEqual([]);
    }
    const blocks = fromMarkdown('p\n\n'.repeat(5_000));
    expect(blocks.doc.blocks.length).toBeLessThanOrEqual(EDITOR_LIMITS.blocks);
    expect(blocks.diagnostics.map((d) => d.code)).toContain('blocks-capped');
  }, 30_000);
});

describe('writing Markdown', () => {
  const source = [
    '# Title with a `#`',
    '',
    'A **strong *mixed* run**, ~~gone~~ and [**bold link**](https://example.com/a%20b).',
    '',
    'Escapes: \\*not em\\*, \\_x\\_, 1\\. not a list, \\[not a link\\], back\\\\slash',
    '',
    '1. first',
    '2. second',
    '',
    '    continued',
    '',
    '    - nested',
    '',
    '- [x] done',
    '',
    '> quote',
    '>',
    '> - in a quote',
    '',
    '````md',
    '```',
    'inner fence',
    '```',
    '````',
    '',
    '---',
  ].join('\n');
  it('round-trips a document exactly; escapes line starts that would open another block; spells adjacent marks so they read back the same', () => {
    {
      // round-trips a document exactly
      const doc = read(source);
      const written = toMarkdown(doc);
      expect(shape(read(written))).toEqual(shape(doc));
      expect(toMarkdown(read(written))).toBe(written);
    }
    {
      // escapes line starts that would open another block
      const doc: EditorDocument = {
        version: 1,
        blocks: ['# no', '- no', '> no', '1. no', '```', '---', '+ no'].map((text, i) => ({
          id: `p${i}`,
          type: 'paragraph',
          content: [{ type: 'text', text, marks: [] }],
        })),
      };
      const back = read(toMarkdown(doc));
      expect(back.blocks.every((b) => b.type === 'paragraph')).toBe(true);
      expect(editorPlainText(back)).toBe(editorPlainText(doc));
    }
    {
      // spells adjacent marks so they read back the same
      const doc: EditorDocument = {
        version: 1,
        blocks: [
          {
            id: 'p',
            type: 'paragraph',
            content: [
              { type: 'text', text: 'both', marks: [{ type: 'strong' }, { type: 'em' }] },
              { type: 'text', text: 'em', marks: [{ type: 'em' }] },
              { type: 'text', text: 'strong', marks: [{ type: 'strong' }] },
              { type: 'text', text: ' tick`s ', marks: [{ type: 'code' }] },
            ],
          },
        ],
      };
      expect(shape(read(toMarkdown(doc)))).toEqual(shape(doc));
    }
  });
});

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe('round-trip property', () => {
  const PIECES = [
    'word',
    'other',
    ' ',
    ' ',
    '  ',
    '*',
    '**',
    '_',
    '__',
    '~~',
    '`',
    '``',
    '[',
    ']',
    '(',
    ')',
    '](https://example.com)',
    '\\',
    '#',
    '# ',
    '> ',
    '- ',
    '1. ',
    '[ ] ',
    '[x] ',
    '    ',
    '\n',
    '\n',
    '\n\n',
    '  \n',
    '\\\n',
    '<',
    '>',
    '<https://example.com>',
    '![',
    'é',
    '👍',
    '---',
    '```',
    '!',
    '.',
    'javascript:x',
    '|',
    '{',
    '}',
  ];
  const inputs = (() => {
    const random = rng(8);
    return Array.from({ length: 2_000 }, () => {
      const length = 1 + Math.floor(random() * 40);
      let input = '';
      for (let i = 0; i < length; i += 1) input += PIECES[Math.floor(random() * PIECES.length)];
      return input;
    });
  })();
  const same = (a: EditorDocument, b: EditorDocument) =>
    JSON.stringify(shape(a)) === JSON.stringify(shape(b));
  it('writing is stable: what was written reads and writes back unchanged (2,000 seeded inputs), and 1 related cases', () => {
    // writing is stable: what was written reads and writes back unchanged (2,000 seeded inputs)
    for (const input of inputs) {
      const written = toMarkdown(read(input));
      const again = toMarkdown(read(written));
      if (again !== written || !same(read(again), read(written))) {
        throw new Error(
          `input ${JSON.stringify(input)}\nwritten ${JSON.stringify(written)}\nagain ${JSON.stringify(again)}`
        );
      }
    }
    {
      // reading what was written gives the same document, except for spans the subset cannot spell
      const lossy = inputs.filter((input) => {
        const once = read(input);
        return !same(read(toMarkdown(once)), once);
      });
      // Measured with seed 8; any growth means the writer lost fidelity.
      expect(lossy.length).toBeLessThanOrEqual(LOSSY_BUDGET);
    }
  }, 30_000);
});

/**
 * Inputs (of 2,000) whose first reading the subset cannot spell exactly. All
 * five are an em mark on a lone `*` or `_` (`****` reads as `*` then em `*`):
 * the escaped delimiter next to the closer reads back as literal text.
 */
const LOSSY_BUDGET = 5;
