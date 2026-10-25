import { describe, expect, it } from 'vitest';
import {
  type ChartFormatSpec,
  formatChartValue,
  MAX_CACHED_FORMATTERS,
} from '../src/compact/shared.ts';

/*
 * Declarative chart formats reuse one Intl formatter per spec (Task 185 found
 * a new formatter per value: 100k values took about 8.5 s). The wall-clock
 * limit lives in tests/perf/plan004-surfaces.test.ts (pnpm test:perf).
 */

describe('chart format spec cache', () => {
  it('formats exactly like a fresh Intl formatter for each spec', () => {
    const specs: ChartFormatSpec[] = [
      { type: 'number', locale: 'en-US', notation: 'compact' },
      { type: 'number', locale: 'en-US', style: 'currency', currency: 'USD' },
      { type: 'number', locale: 'de-DE', minimumFractionDigits: 2, maximumFractionDigits: 2 },
      { type: 'date', locale: 'en-US', dateStyle: 'medium', timeZone: 'UTC' },
    ];
    const fresh = [
      new Intl.NumberFormat('en-US', { style: 'decimal', notation: 'compact' }),
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'standard' }),
      new Intl.NumberFormat('de-DE', {
        style: 'decimal',
        notation: 'standard',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }),
    ];
    for (const value of [0, 1234.5, 1_700_000_000_000]) {
      specs.forEach((spec, i) => {
        // Twice: the second call is served from the cache.
        expect(formatChartValue(value, spec)).toBe(fresh[i]?.format(value));
        expect(formatChartValue(value, spec)).toBe(fresh[i]?.format(value));
      });
    }
  });

  it('falls back for options Intl rejects, every time', () => {
    const bad: ChartFormatSpec = { type: 'number', style: 'currency' };
    expect(formatChartValue(12, bad)).toBe(formatChartValue(12));
    expect(formatChartValue(12, bad)).toBe(formatChartValue(12));
  });

  it('keeps working past the cache bound', () => {
    for (let i = 0; i <= MAX_CACHED_FORMATTERS * 2; i++) {
      const spec: ChartFormatSpec = { type: 'number', maximumFractionDigits: i % 21 };
      // 1.5 prints as "2" with zero fraction digits and "1.5" otherwise.
      expect(formatChartValue(1.5, { ...spec, minimumFractionDigits: 0, locale: 'en-US' })).toMatch(
        /^(2|1\.5)$/
      );
    }
  });
});
