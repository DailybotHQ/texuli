// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { scanRepo, scanText } from '../check-trojan-source.ts';

describe('trojan-source gate', () => {
  it('flags literal bidi overrides and zero-width controls in text', () => {
    const sample = `ok\nbad${String.fromCodePoint(0x202e)}line\n`;
    const hits = scanText('fixture.ts', sample);
    expect(hits.some((h) => h.codePoint === 0x202e && h.line === 2)).toBe(true);
  });

  it('accepts ASCII \\u escapes without flagging', () => {
    const sample = 'const re = /[\\u202a-\\u202e]/;\n';
    expect(scanText('escapes.ts', sample)).toEqual([]);
  });

  it('the repository tree has no literal Trojan Source controls outside the allowlist', () => {
    const hits = scanRepo();
    expect(
      hits,
      hits.map((h) => `${h.path}:${h.line} U+${h.codePoint.toString(16)}`).join('\n')
    ).toEqual([]);
  });
});
