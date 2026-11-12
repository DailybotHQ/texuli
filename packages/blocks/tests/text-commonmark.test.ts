/**
 * Text block Markdown reads through the shared CommonMark parser (PLAN_023 T-md-adopt,
 * ADR-034). These edge cases changed; `text.test.ts` keeps the rest.
 */
import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../src/text/markdown.ts';

describe('text block Markdown: new readings', () => {
  it('reads setext headings and indented code', () => {
    expect(parseMarkdown('Title\n===').blocks).toEqual([
      { type: 'heading', level: 1, children: [{ type: 'text', text: 'Title' }] },
    ]);
    expect(parseMarkdown('    code').blocks).toEqual([
      { type: 'code', lang: undefined, text: 'code' },
    ]);
  });

  it('resolves reference links, hides definitions and decodes character references', () => {
    expect(parseMarkdown('[ref]\n\n[ref]: https://example.com').blocks).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'link', href: 'https://example.com', children: [{ type: 'text', text: 'ref' }] },
        ],
      },
    ]);
    expect(parseMarkdown('A &amp; B').blocks).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'A & B' }] },
    ]);
  });
});
