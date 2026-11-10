import { describe, expect, it } from 'vitest';
import { generateDesignSystem } from '../src/design-system/generate.ts';
import { importBrand } from '../src/design-system/import.ts';
import { importSiteCss } from '../src/design-system/import-css.ts';

describe('design-system generator importer repairs', () => {
  it('keeps the declared brand seed and pins the failing role to repair AA', () => {
    const result = generateDesignSystem({
      css: ':root { --brand: #e11d48; --primary: #ffff00; }',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.color?.brand?.seed).toBe('#e11d48');
    expect(result.report.repairs).not.toContainEqual(
      expect.objectContaining({ path: '$.color.brand.seed' })
    );
    expect(result.report.repairs).toContainEqual(
      expect.objectContaining({
        path: '$.color.roles.light.primaryForeground',
        reason: expect.stringContaining('brand seed'),
      })
    );
    expect(result.report.guarantees.passed).toBe(true);
  });

  it('finds hex and CSS named colors inside bounded brand prose', () => {
    const hex = importBrand('Deep teal #0f766e brand');
    expect(hex.ok).toBe(true);
    if (hex.ok) expect(hex.document.color?.brand?.seed).toBe('#0f766e');

    const named = importBrand('Deep teal brand');
    expect(named.ok).toBe(true);
    if (named.ok) expect(named.document.color?.brand?.seed).toBe('#008080');

    const oversized = importBrand(`${'teal '.repeat(201)}`);
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.errors[0]?.code).toBe('input-limit');
  });

  it('prefers the declared sans token over body font-family in either rule order and reports it', () => {
    const stylesheets = [
      ':root { --font-sans: Inter, Arial, sans-serif; } body { font-family: "Site Body", sans-serif; }',
      'body { font-family: "Site Body", sans-serif; } :root { --font-sans: Inter, Arial, sans-serif; }',
    ];

    for (const css of stylesheets) {
      const result = importSiteCss(css);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.document.typography?.families?.sans?.stack).toEqual([
        'Inter',
        'Arial',
        'sans-serif',
      ]);
      expect(result.losses).toContainEqual(
        expect.objectContaining({
          reason: expect.stringContaining('--font-sans'),
          value: '"Site Body", sans-serif',
        })
      );
    }
  });
});
