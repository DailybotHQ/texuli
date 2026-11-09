import { describe, expect, it } from 'vitest';
import {
  type DesignSystemImportLoss,
  importBrand,
  importDtcg,
  importLogoPixels,
  importRolePalette,
  importTheme,
  importTokensStudio,
} from '../src/design-system/import.ts';
import { generateThemeFromSeed } from '../src/generator/seed.ts';

function assertLossReport(result: { losses: DesignSystemImportLoss[] }) {
  expect(Array.isArray(result.losses)).toBe(true);
  for (const loss of result.losses) {
    expect(Object.keys(loss).sort()).toEqual(
      loss.value === undefined ? ['path', 'reason'] : ['path', 'reason', 'value']
    );
    expect(loss.path.startsWith('$')).toBe(true);
    expect(loss.reason.length).toBeGreaterThan(0);
  }
}

describe('design-system importer fidelity and loss reports', () => {
  it('keeps W3C DTCG typography, shape, spacing and motion tokens and reports dropped tokens', () => {
    const result = importDtcg({
      typography: {
        roles: {
          body: {
            size: { $type: 'dimension', $value: { value: 18, unit: 'px' } },
            weight: { $type: 'fontWeight', $value: 600 },
            line: { $type: 'number', $value: 1.45 },
            tracking: { $type: 'number', $value: -0.01 },
          },
        },
      },
      shape: {
        radius: { $type: 'dimension', $value: { value: 0.5, unit: 'rem' } },
        borderWidth: { $type: 'dimension', $value: { value: 1, unit: 'px' } },
      },
      space: {
        base: { $type: 'dimension', $value: { value: 4, unit: 'px' } },
        density: { $type: 'number', $value: 1.125 },
      },
      motion: { durations: { fast: { $type: 'duration', $value: { value: 120, unit: 'ms' } } } },
      unsupported: { effect: { $type: 'string', $value: 'sparkle' } },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document).toMatchObject({
      typography: {
        roles: { body: { size: 18, weight: 600, line: 1.45, tracking: -0.01 } },
      },
      shape: { radius: 8, borderWidth: 1 },
      space: { base: 4, density: 1.125 },
      motion: { durations: { fast: 120 } },
    });
    expect(result.losses).toContainEqual({
      path: '$.unsupported.effect',
      reason: 'No design-system field takes this token.',
    });
    assertLossReport(result);
  });

  it('keeps Tokens Studio typography, shape, spacing and motion tokens with a common dropped-value report', () => {
    const result = importTokensStudio({
      global: {
        typography: {
          roles: {
            body: {
              size: { type: 'dimension', value: '17px' },
              weight: { type: 'fontWeight', value: 500 },
            },
          },
        },
        shape: { radius: { type: 'dimension', value: '0.375rem' } },
        space: {
          base: { type: 'dimension', value: '4px' },
          density: { type: 'number', value: 0.9 },
        },
        motion: { durations: { fast: { type: 'duration', value: '140ms' } } },
        unsupported: { effect: { type: 'other', value: 'sparkle' } },
      },
      $metadata: { tokenSetOrder: ['global'] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document).toMatchObject({
      typography: { roles: { body: { size: 17, weight: 500 } } },
      shape: { radius: 6 },
      space: { base: 4, density: 0.9 },
      motion: { durations: { fast: 140 } },
    });
    expect(result.losses).toContainEqual({
      path: '$.global.unsupported.effect',
      reason: 'No design-system field takes this token.',
    });
    assertLossReport(result);
  });

  it('gives every importer the same path/reason loss report when it drops a value', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
    const theme = generateThemeFromSeed({ seed: '#0f766e' });
    const themeWithUnsupportedField = { ...theme, components: { button: 'pill' } };
    const results = [
      importBrand('brand #0f766e, an unrecognized request'),
      importDtcg({ unknown: { token: { $type: 'string', $value: 'dropped' } } }),
      importTokensStudio({ global: { unknown: { value: 'dropped', type: 'other' } } }),
      importRolePalette({ light: { primary: '#0f766e' }, unknown: 'dropped' }),
      importTheme(themeWithUnsupportedField),
      importLogoPixels({ data: pixels }),
    ];

    for (const result of results) assertLossReport(result);
    expect(results.slice(0, 5).every((result) => result.losses.length > 0)).toBe(true);
    expect(results[5]?.losses).toEqual([]);
  });
});
