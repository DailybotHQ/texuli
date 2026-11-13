/**
 * Chat messages read through the shared CommonMark inline parser (PLAN_023 T-md-adopt,
 * ADR-034), filtered to the flat message vocabulary. These edge cases changed.
 */
import { describe, expect, it } from 'vitest';
import { parseMessageText } from '../src/index.ts';

describe('chat message text: new readings', () => {
  it('reads backslash escapes and character references', () => {
    expect(parseMessageText('\\*not em\\* &amp;')).toEqual([{ type: 'text', value: '*not em* &' }]);
  });

  it('flattens formatting inside a span', () => {
    expect(parseMessageText('**a *b* c**')).toEqual([{ type: 'strong', value: 'a b c' }]);
  });

  it('reads an image as `!` and a link, and keeps a refused link exactly as written', () => {
    expect(parseMessageText('![cat](https://example.com/c.png)')).toEqual([
      { type: 'text', value: '!' },
      { type: 'link', value: 'cat', href: 'https://example.com/c.png' },
    ]);
    expect(parseMessageText('[x](javascript:alert(1) "t")')).toEqual([
      { type: 'text', value: '[x](javascript:alert(1) "t")' },
    ]);
  });

  it('reads a hard break as a line break and no block structure', () => {
    expect(parseMessageText('line  \nnext')).toEqual([{ type: 'text', value: 'line\nnext' }]);
    expect(parseMessageText('# not a heading')).toEqual([
      { type: 'text', value: '# not a heading' },
    ]);
  });
});
