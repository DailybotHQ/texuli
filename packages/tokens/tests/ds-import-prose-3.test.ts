import { describe, expect, it } from 'vitest';
import { importBrand } from '../src/design-system/import.ts';

describe('design-system prose brief round 3', () => {
  it('captures font phrases with case-sensitive family names', () => {
    const cases = [
      ['font is Inter', 'sans', 'Inter'],
      ['heading font is Fraunces', 'heading', 'Fraunces'],
      ['typeface of Inter', 'sans', 'Inter'],
      ['mono uses IBM Plex Mono', 'mono', 'IBM Plex Mono'],
      ['Headings use Fraunces', 'heading', 'Fraunces'],
      ['monospace IBM Plex Mono', 'mono', 'IBM Plex Mono'],
    ] as const;

    for (const [brief, family, name] of cases) {
      const result = importBrand(`${brief}, rounded corners`);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.document.typography?.families?.[family]?.stack[0]).toBe(name);
      expect(result.document.shape?.radius).toBe(12);
      expect(result.losses).toEqual([]);
    }
  });

  it('maps motion and surface phrases in longer clauses without leftover words', () => {
    for (const [brief, personality] of [
      ['subtle motion and glass surfaces', 'subtle'],
      ['expressive motion', 'expressive'],
    ] as const) {
      const result = importBrand(brief);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.document.motion?.personality).toBe(personality);
      if (brief.includes('glass')) expect(result.document.surface?.style).toBe('glass');
      expect(result.losses).toEqual([]);
    }
  });

  it('truncates overlong character and clause input with a loss', () => {
    for (const brief of [
      `brand #0f766e, ${'rounded, '.repeat(2_000)}`,
      `brand #0f766e, ${'rounded, '.repeat(300)}`,
    ]) {
      const result = importBrand(brief);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.document.color?.brand?.seed).toBe('#0f766e');
      expect(result.losses.some((loss) => /truncated at/.test(loss.reason))).toBe(true);
    }
  });
});
