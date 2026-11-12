import { describe, expect, it } from 'vitest';
import { getBaseEmoji, getEmoji, getToneVariants, searchEmojis } from '../src/catalog.ts';
import { findEmojis, parseEmojiTokens, toShortcodes, toUnicode } from '../src/index.ts';
import { toUnicode as toUnicodeDialect, toUnicodeLegacy } from '../src/legacy-engine.ts';

describe('@texuli/emojis engine', () => {
  it('converts canonical Texuli shortcodes without loading catalog metadata', () => {
    expect(toUnicode('Ship it :rocket:!')).toBe('Ship it 🚀!');
    expect(toShortcodes('Ship it 🚀!')).toBe('Ship it :rocket:!');
    expect(toUnicode('unknown :not_in_catalog:')).toBe('unknown :not_in_catalog:');
  });

  it('longest-matches complex sequences and preserves UTF-16 offsets and intervening text', () => {
    const text = 'A👩‍💻👍🏽🇺🇸1️⃣Z';
    const matches = findEmojis(text);
    expect(matches.map((item) => item.id)).toEqual([
      '1f469-200d-1f4bb',
      '1f44d-1f3fd',
      '1f1fa-1f1f8',
      '31-fe0f-20e3',
    ]);
    expect(matches[0]?.start).toBe(1);
    expect(matches[0]?.end).toBe(6);
    const tokens = parseEmojiTokens(text);
    expect(tokens.map((token) => token.type)).toEqual([
      'text',
      'emoji',
      'emoji',
      'emoji',
      'emoji',
      'text',
    ]);
    expect(tokens[0]).toMatchObject({ text: 'A', start: 0, end: 1 });
    expect(tokens.at(-1)).toMatchObject({ text: 'Z', start: text.length - 1, end: text.length });
  });

  it('matches qualification aliases and subdivision tag sequences as one emoji', () => {
    expect(findEmojis('❤')[0]?.id).toBe('2764-fe0f');
    const england = getEmoji('1f3f4-e0067-e0062-e0065-e006e-e0067-e007f');
    expect(england).toBeDefined();
    expect(findEmojis(england?.unicode ?? '')).toMatchObject([
      { id: england?.id, start: 0, end: england?.unicode.length },
    ]);
  });

  it('does not throw on arbitrary input and provides metadata through the catalog subpath', () => {
    expect(() => findEmojis(null as never)).not.toThrow();
    expect(getEmoji('1f680')?.shortcode).toBe(':rocket:');
    expect(getBaseEmoji('1f44d-1f3fd')?.id).toBe('1f44d');
    expect(getToneVariants('1f44d').length).toBeGreaterThan(0);
    expect(searchEmojis('launch', { limit: 3 })[0]?.emoji.id).toBe('1f680');
  });

  it('keeps imported legacy aliases opt-in and reports strict conflicts', () => {
    expect(toUnicodeLegacy(':tada:').text).toBe('🎉');
    expect(toUnicodeDialect(':tada:', { dialect: 'legacy' })).toBe('🎉');
    expect(toUnicodeLegacy(':pa:', { mode: 'strict' }).conflicts).toHaveLength(1);
    expect(toUnicodeLegacy(':pa:', { mode: 'permissive' }).text).not.toBe(':pa:');
  });
});
