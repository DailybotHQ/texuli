import { describe, expect, it } from 'vitest';
import { importBrand } from '../src/design-system/import.ts';

describe('design-system prose brief tokenization', () => {
  it('keeps colors, fonts and style phrases separate', () => {
    const briefs = [
      'rounded #0f766e Inter font',
      'font Inter in #0f766e rounded',
      'font Inter rounded',
    ];

    for (const brief of briefs) {
      const result = importBrand(brief);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.document.typography?.families?.sans?.stack[0]).toBe('Inter');
      expect(result.document.typography?.families?.sans?.stack[0]).not.toContain('rounded');
      expect(result.document.shape?.radius).toBe(12);
    }
  });

  it('reads a heading font phrase and maps available style vocabulary', () => {
    const result = importBrand('Headings in Fraunces, rounded corners, calm, compact spacing');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.typography?.families?.heading?.stack[0]).toBe('Fraunces');
    expect(result.document.shape?.radius).toBe(12);
    expect(result.document.motion?.personality).toBe('subtle');
    expect(result.document.space?.density).toBe(0.875);
    expect(result.losses).toEqual([]);
  });

  it('reports every unused word after recognized phrases', () => {
    const result = importBrand('compact spacing custom glow');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.space?.density).toBe(0.875);
    expect(result.document.elevation?.style).toBe('glow');
    expect(result.losses).toContainEqual(
      expect.objectContaining({ reason: expect.stringContaining('custom') })
    );
  });
});
