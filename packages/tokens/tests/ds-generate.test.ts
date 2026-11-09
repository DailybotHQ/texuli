import { describe, expect, it } from 'vitest';
import { generateDesignSystem as generateFromCore } from '../src/design-system/compile-core.ts';
import { compileDesignSystem } from '../src/design-system/compiler.ts';
import { generateDesignSystem } from '../src/design-system/generate.ts';
import { checkDesignSystemGuarantees } from '../src/design-system/guarantees.ts';
import { validateDesignSystem } from '../src/design-system/validate.ts';
import { generateThemeFromSeed } from '../src/generator/seed.ts';

const inputs = {
  brief: 'brand #0f766e, font Inter, rounded, compact',
  tokens: {
    color: { brand: { seed: { $type: 'color', $value: '#2563eb' } } },
    typography: {
      roles: { body: { size: { $type: 'dimension', $value: { value: 17, unit: 'px' } } } },
    },
  },
  css: ':root { --tx-primary: #0f766e; --tx-radius-md: 12px; --tx-space-1: 4px; }',
  logoPixels: { data: new Uint8ClampedArray([15, 118, 110, 255, 37, 99, 235, 255]) },
  theme: generateThemeFromSeed({ seed: '#7c3aed' }),
} as const;

describe('generateDesignSystem', () => {
  it('is exported from the compiler-core entry without entering the package root', () => {
    expect(generateFromCore).toBe(generateDesignSystem);
  });

  it('produces a complete, validated, compiled document for every source combination', () => {
    const keys = Object.keys(inputs) as (keyof typeof inputs)[];
    for (let mask = 0; mask < 1 << keys.length; mask++) {
      const input: Record<string, unknown> = {};
      keys.forEach((key, index) => {
        if (mask & (1 << index)) input[key] = inputs[key];
      });
      const result = generateDesignSystem(input);
      expect(result.ok, `input combination mask ${mask}`).toBe(true);
      if (!result.ok) continue;
      expect(validateDesignSystem(result.document).ok, `valid mask ${mask}`).toBe(true);
      const compiled = compileDesignSystem(result.document);
      expect(compiled.ok, `compiled mask ${mask}`).toBe(true);
      if (compiled.ok) {
        expect(result.report.guarantees.passed).toBe(true);
        expect(checkDesignSystemGuarantees(compiled)).toEqual([]);
      }
    }
  });

  it('reports later sources that replace imported values and keeps the later source', () => {
    const result = generateDesignSystem({
      brief: 'brand #0f766e',
      tokens: {
        color: { brand: { seed: { $type: 'color', $value: '#2563eb' } } },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.color?.brand?.seed).toBe('#2563eb');
    expect(result.report.losses).toContainEqual({
      path: '$.color.brand.seed',
      reason: 'tokens replaced a value supplied by an earlier input.',
      value: '#0f766e',
    });
  });

  it('repairs a low-contrast imported pin and records why', () => {
    const result = generateDesignSystem({
      tokens: {
        color: {
          roles: {
            light: {
              foreground: { $type: 'color', $value: '#eeeeee' },
              background: { $type: 'color', $value: '#ffffff' },
            },
          },
        },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.repairs.length).toBeGreaterThan(0);
    expect(result.report.repairs[0]).toMatchObject({
      path: '$.color.roles.light.foreground',
      reason: expect.stringContaining('AA guarantees'),
      from: '#eeeeee',
    });
    expect(result.report.guarantees).toMatchObject({ passed: true, issues: [] });
  });

  it('reports the compiler adjustments it makes around imported pins', () => {
    const result = generateDesignSystem({
      tokens: {
        color: {
          pin: {
            sidebar: { $type: 'color', $value: '#ffffff' },
            primary: { $type: 'color', $value: '#ffffff' },
          },
        },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.guarantees.passed).toBe(true);
    expect(result.report.repairs).toContainEqual(
      expect.objectContaining({
        path: '$.color.pin.primary',
        reason: 'sidebar active fill: the pinned primary vanishes on the sidebar fill',
        from: '#ffffff',
      })
    );
  });

  it('returns stable import errors rather than compiling malformed token input', () => {
    const result = generateDesignSystem({ tokens: '{' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('invalid-input');
  });

  it('refuses unsafe identity overrides instead of copying them into the document', () => {
    const result = generateDesignSystem({}, { id: '../unsafe' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.id).toBe('generated-design-system');
    expect(result.report.losses).toContainEqual(
      expect.objectContaining({ path: '$.id', reason: expect.stringContaining('Refused id') })
    );
  });
});
