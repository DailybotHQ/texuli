import { describe, expect, it } from 'vitest';
import { fitChartWidth, MIN_CHART_WIDTH } from '../src/math/layout/fit-width.ts';

// Audit P1-01: charts drew at a fixed 640-unit viewBox, so text shrank with it
// on phones. They now lay out at their measured width.
describe('fitChartWidth', () => {
  it('uses the measured width between the minimum and the preferred width', () => {
    expect(fitChartWidth(288, 640)).toBe(288);
    expect(fitChartWidth(612.4, 640)).toBe(612);
  });

  it('keeps the preferred width for wider boxes and when unmeasured', () => {
    expect(fitChartWidth(1200, 640)).toBe(640);
    expect(fitChartWidth(0, 640)).toBe(640);
    expect(fitChartWidth(undefined, 640)).toBe(640);
    expect(fitChartWidth(Number.NaN, 640)).toBe(640);
  });

  it('never lays out narrower than the minimum (or the preferred width when smaller)', () => {
    expect(fitChartWidth(120, 640)).toBe(MIN_CHART_WIDTH);
    expect(fitChartWidth(120, 200)).toBe(200);
  });
});
