import { describe, expect, it } from 'vitest';
import { generateDesignSystem } from '../src/design-system/generate.ts';
import { importBrand } from '../src/design-system/import.ts';

describe('design-system prose brief importer', () => {
  it('assigns role colors in prose and keeps a font in the same clause', () => {
    const result = importBrand('Inter font in #0f766e; the brand uses #0f766e and accent #f59e0b');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.typography?.families?.sans?.stack[0]).toBe('Inter');
    expect(result.document.color?.brand?.seed).toBe('#0f766e');
    expect(result.document.color?.brand?.accent).toBe('#f59e0b');
  });

  it('accepts role words before a value and reports unrelated prose', () => {
    const result = importBrand('secondary is #0f766e, use a calm interface');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.color?.brand?.secondary).toBe('#0f766e');
    expect(result.warnings.some((warning) => warning.code === 'unsafe-value')).toBe(false);
    expect(result.losses).toContainEqual(
      expect.objectContaining({ reason: expect.stringContaining('calm interface') })
    );
  });

  it('names the changed token when automatic AA repair pins a role', () => {
    const result = generateDesignSystem({
      css: ':root { --brand: #e11d48; --sidebar-primary: #ffff00; }',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.repairs).toContainEqual(
      expect.objectContaining({
        variable: '--tx-sidebar-primary',
        reason: expect.stringContaining('--tx-sidebar-primary'),
      })
    );
  });
});
