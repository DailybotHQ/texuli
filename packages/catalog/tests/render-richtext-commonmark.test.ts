/**
 * Catalog rich text reads through the shared CommonMark inline parser (PLAN_023 T-md-adopt,
 * ADR-034), filtered to its vocabulary. These edge cases changed.
 */
import { describe, expect, it } from 'vitest';
import { renderRichText } from '../src/render/richtext/parse.ts';

const first = (source: string) => renderRichText(source).document.paragraphs[0]?.children;

describe('catalog rich text: new readings', () => {
  it('decodes character references and every CommonMark escape', () => {
    expect(first('A &amp; B \\# x')).toEqual([{ type: 'text', value: 'A & B # x' }]);
  });

  it('reads autolinks, and an image as `!` and a link', () => {
    expect(first('<https://example.com>')).toEqual([
      {
        type: 'link',
        href: 'https://example.com',
        children: [{ type: 'text', value: 'https://example.com' }],
      },
    ]);
    expect(first('![cat](https://example.com/c.png)')).toEqual([
      { type: 'text', value: '!' },
      {
        type: 'link',
        href: 'https://example.com/c.png',
        children: [{ type: 'text', value: 'cat' }],
      },
    ]);
  });

  it('still reads no block structure', () => {
    expect(first('# not a heading')).toEqual([{ type: 'text', value: '# not a heading' }]);
  });
});
