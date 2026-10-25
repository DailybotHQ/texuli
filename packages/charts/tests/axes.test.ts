import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Axis from '../src/axis/Axis.svelte';
import type { AxisFormatter } from '../src/axis/model.ts';
import { formatAxisValue, formatNumericAxisTick, formatTimeAxisTick } from '../src/axis/model.ts';

afterEach(cleanup);

describe('axis formatting', () => {
  it('formats strings, numbers, compact magnitudes and exact fractional steps deterministically', () => {
    expect(formatAxisValue('Mon')).toBe('Mon');
    expect(formatAxisValue(1234.567)).toBe('1,234.57');
    expect(formatNumericAxisTick(1250, { compact: true })).toBe('1.3K');
    expect(formatNumericAxisTick(0.5, { step: 0.25 })).toBe('0.50');
  });

  it('formats time ticks using the selected UTC interval', () => {
    expect(formatTimeAxisTick(Date.UTC(2026, 2, 2), { unit: 'year', step: 1 })).toBe('2026');
    expect(formatTimeAxisTick(Date.UTC(2026, 2, 2), { unit: 'day', step: 1 })).toBe('Mar 2');
  });
});

describe('Axis', () => {
  it('renders reusable x/y tick geometry, labels, baseline and optional grid lines', () => {
    const { container } = render(Axis, {
      props: {
        orientation: 'y',
        ticks: [
          { value: 0, position: 100 },
          { value: 10, position: 0 },
        ],
        length: 100,
        gridLength: 200,
        format: (value: Parameters<AxisFormatter>[0]) => `${value} requests`,
      },
    });
    const axis = container.querySelector('[data-chart-axis="y"]');
    expect(axis?.getAttribute('aria-hidden')).toBe('true');
    expect(axis?.querySelectorAll('.tx-chart-axis__domain')).toHaveLength(1);
    expect(axis?.querySelectorAll('.tx-chart-axis__grid')).toHaveLength(2);
    expect(axis?.querySelectorAll('.tx-chart-axis__tick')).toHaveLength(2);
    expect(axis?.textContent).toContain('0 requests');
    expect(axis?.textContent).toContain('10 requests');
  });
});
