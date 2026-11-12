/**
 * The editor codec reads through the shared CommonMark parser (PLAN_023 T-md-adopt, ADR-034):
 * the closed subset is a filter over `@texuli/core/markdown`. These are the edge cases whose
 * reading changed; the rest of `editor-markdown.test.ts` is unchanged and stays green.
 */
import { describe, expect, it } from 'vitest';
import { createInlineExtensions } from '../src/editor/extensions.ts';
import { fromMarkdown, toMarkdown } from '../src/editor/markdown.ts';
import type { EditorBlock } from '../src/editor/types.ts';

const shape = (blocks: readonly EditorBlock[]) =>
  JSON.parse(JSON.stringify(blocks, (key, value) => (key === 'id' ? undefined : value)));
const read = (source: string) => shape(fromMarkdown(source).doc.blocks);
const text = (value: string, marks: unknown[] = []) => ({ type: 'text', text: value, marks });

describe('editor Markdown through the shared parser: new readings', () => {
  it('reads setext headings, indented code and any fence info string', () => {
    expect(read('Title\n===')).toEqual([{ type: 'heading', level: 1, content: [text('Title')] }]);
    expect(read('    code line')).toEqual([{ type: 'code', text: 'code line' }]);
    // An info string that is not a language name opens a fence without a language.
    expect(read('```js run\nx\n```')).toEqual([{ type: 'code', text: 'x' }]);
  });

  it('resolves reference links and drops the definition lines', () => {
    expect(read('[ref]\n\n[ref]: https://example.com')).toEqual([
      {
        type: 'paragraph',
        content: [text('ref', [{ type: 'link', href: 'https://example.com' }])],
      },
    ]);
  });

  it('decodes character references and reads single-tilde strikethrough', () => {
    expect(read('A &amp; B &copy;')).toEqual([{ type: 'paragraph', content: [text('A & B ©')] }]);
    expect(read('~one~')).toEqual([
      { type: 'paragraph', content: [text('one', [{ type: 'strike' }])] },
    ]);
  });

  it('reads Markdown inside an HTML block line, tags kept as text', () => {
    expect(read('<div>**a**</div>')).toEqual([
      {
        type: 'paragraph',
        content: [text('<div>'), text('a', [{ type: 'strong' }]), text('</div>')],
      },
    ]);
  });

  it('keeps a refused autolink as its literal text', () => {
    expect(read('<javascript:alert(1)>')).toEqual([
      { type: 'paragraph', content: [text('<javascript:alert(1)>')] },
    ]);
  });

  it('never opens an extension at an escaped sigil or brace', () => {
    const extensions = createInlineExtensions([{ name: 'mention', sigil: '@' }]);
    for (const source of ['\\@{p|P}', '@\\{p|P}', '@{p|P\\}']) {
      const { doc } = fromMarkdown(source, { extensions });
      const block = doc.blocks[0];
      expect(
        block?.type === 'paragraph' &&
          block.content.every((n) => n.type === 'text' && n.marks.length === 0),
        source
      ).toBe(true);
    }
  });
});

describe('editor Markdown writing for the CommonMark reader', () => {
  it('alternates the marker of adjacent lists so they stay two lists', () => {
    const doc = fromMarkdown('* a\n- b').doc;
    expect(doc.blocks).toHaveLength(2);
    const written = toMarkdown(doc);
    expect(written).toBe('- a\n\n* b');
    expect(fromMarkdown(written).doc.blocks).toHaveLength(2);
  });

  it('escapes a line that would underline a setext heading, and `&` before a name', () => {
    for (const value of ['a\n===', 'x &amp; y']) {
      const doc = {
        version: 1 as const,
        blocks: [
          {
            id: 'p',
            type: 'paragraph' as const,
            content: [{ type: 'text' as const, text: value.replace('\n', ' '), marks: [] }],
          },
        ],
      };
      expect(read(toMarkdown(doc))).toEqual(shape(doc.blocks));
    }
  });
});
