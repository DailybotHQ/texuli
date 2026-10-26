/**
 * T-82 — theme-as-URL share links (punch-list row 8): the recipe (seed or
 * words, contrast target, preview mode, role edits) encodes into and decodes
 * out of a `#theme=` hash entirely locally, and every broken or hostile
 * input fails closed instead of half-applying.
 */
import { describe, expect, it } from 'vitest';
import {
  decodeStudioShare,
  encodeStudioShare,
  generateStudioTheme,
  isStudioShareHash,
  type StudioShareState,
} from '../src/components/theme-studio/studio.ts';

function baseState(overrides: Partial<StudioShareState> = {}): StudioShareState {
  return {
    source: 'color',
    seed: '#2b6ce0',
    secondary: '',
    words: 'calm ocean',
    neutral: 'zinc',
    contrast: 'AA',
    mode: 'light',
    edits: [],
    ...overrides,
  };
}

describe('encodeStudioShare', () => {
  it('produces a hash that only holds the recipe', () => {
    const hash = encodeStudioShare(baseState());
    expect(hash).toMatch(/^#theme=/);
    expect(hash).toContain('s=c');
    expect(hash).toContain('seed=%232b6ce0');
    expect(hash).toContain('w=calm+ocean');
    expect(hash).toContain('m=l');
  });

  it('carries role edits under r.<mode>.<role>, normalized', () => {
    const hash = encodeStudioShare(
      baseState({
        edits: [
          { role: 'primary', mode: 'dark', hex: '#ABC' },
          { role: 'link', mode: 'light', hex: '#0f766e' },
        ],
      })
    );
    expect(hash).toContain('r.d.primary=%23aabbcc');
    expect(hash).toContain('r.l.link=%230f766e');
  });

  it('maps an image source to the color it produced, never image data', () => {
    const hash = encodeStudioShare(baseState({ source: 'image', seed: '#123456' }));
    expect(hash).not.toContain('s=i');
    expect(hash).toContain('s=c');
    expect(hash).toContain('seed=%23123456');
  });

  it('rejects states that cannot be a link', () => {
    expect(encodeStudioShare(baseState({ contrast: 'A' as 'AA' }))).toBeNull();
    expect(encodeStudioShare(baseState({ mode: 'system' as 'light' }))).toBeNull();
    expect(
      encodeStudioShare(baseState({ words: 'x'.repeat(121), source: 'words', seed: '' }))
    ).toBeNull();
  });
});

describe('decodeStudioShare', () => {
  it('round-trips the state it encoded', () => {
    const state = baseState({
      secondary: '#e11d48',
      contrast: 'AAA',
      mode: 'dark',
      edits: [{ role: 'accent', mode: 'light', hex: '#7c3aed' }],
    });
    const hash = encodeStudioShare(state);
    expect(hash).toBeTruthy();
    const result = decodeStudioShare(hash as string);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.share.source).toBe('color');
    expect(result.share.seed).toBe('#2b6ce0');
    expect(result.share.secondary).toBe('#e11d48');
    expect(result.share.words).toBe('calm ocean');
    expect(result.share.neutral).toBe('zinc');
    expect(result.share.contrast).toBe('AAA');
    expect(result.share.mode).toBe('dark');
    expect(result.share.edits).toEqual([{ role: 'accent', mode: 'light', hex: '#7c3aed' }]);
  });

  it('feeds a working generation when opened', () => {
    const hash = encodeStudioShare(baseState({ words: 'warm sunset', source: 'words', seed: '' }));
    const result = decodeStudioShare(hash as string);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const generated = generateStudioTheme({
      source: result.share.source,
      seed: result.share.seed,
      words: result.share.words,
      contrast: result.share.contrast,
    });
    expect(generated.ok).toBe(true);
  });

  it('fails closed on anything that is not a usable theme link', () => {
    expect(isStudioShareHash('#other=1')).toBe(false);
    expect(decodeStudioShare('#other=1').ok).toBe(false);
    expect(decodeStudioShare('#theme=').ok).toBe(false);
    expect(decodeStudioShare('#theme=s=x&c=AA&m=l').ok).toBe(false);
    expect(decodeStudioShare('#theme=s=c&c=AA').ok).toBe(false);
    expect(decodeStudioShare('#theme=s=c&c=AA&m=x').ok).toBe(false);
    // An image recipe never travels; the link says so instead of regenerating.
    const image = decodeStudioShare('#theme=s=i&c=AA&m=l');
    expect(image.ok).toBe(false);
    if (!image.ok) expect(image.message).toMatch(/image/i);
    // Unreadable role edits refuse the whole link.
    expect(decodeStudioShare('#theme=s=c&seed=%23123456&c=AA&m=l&r.l.notarole=%23111111').ok).toBe(
      false
    );
    expect(decodeStudioShare('#theme=s=c&seed=%23123456&c=AA&m=l&r.l.primary=zzz').ok).toBe(false);
    // A long word list cannot sneak past the cap on the way back in.
    expect(decodeStudioShare(`#theme=s=w&w=${'x'.repeat(121)}&c=AA&m=l`).ok).toBe(false);
  });
});
