import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import HistogramChart from '../src/histogram/HistogramChart.svelte';
import { createHistogramLayout, formatHistogramRange } from '../src/histogram/model.ts';
import { bin } from '../src/math/index.ts';

afterEach(cleanup);

const values = [1, 2, 3, 5, 6, 9] as const;

describe('histogram model', () => {
  it('turns bin math into proportional bars without changing the bins', () => {
    const options = { domain: [0, 9] as const, thresholds: [3, 6] as const };
    const layout = createHistogramLayout(values, { ...options, width: 360, height: 220 });
    expect(layout.bars.map(({ x0, x1, count }) => ({ x0, x1, count }))).toEqual(
      bin(values, options)
    );
    expect(layout.bars.map((bar) => bar.count)).toEqual([2, 2, 2]);
    expect(layout.bars.every((bar) => bar.height > 0 && bar.width > 0)).toBe(true);
    expect(formatHistogramRange(3, 6)).toMatch(/3.*6/);
  });
});

describe('HistogramChart', () => {
  it('renders accessible bins and an expandable data table', async () => {
    const { container } = render(HistogramChart, {
      title: 'Response time distribution',
      description: 'Requests are grouped into three response-time ranges.',
      values,
      domain: [0, 9],
      thresholds: [3, 6],
    });

    expect(screen.getByRole('img', { name: /Response time distribution/ })).toBeTruthy();
    expect(container.querySelectorAll('[data-bin]')).toHaveLength(3);
    await fireEvent.click(screen.getByText('View data table'));
    expect(container.querySelector('table')?.textContent).toContain('Count');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('renders labeled count and numeric domain axes', () => {
    const { container } = render(HistogramChart, {
      title: 'Response time distribution',
      description: 'Requests grouped by response time.',
      values,
      domain: [0, 9],
      thresholds: [3, 6],
    });
    expect(container.querySelector('[data-chart-axis="x"]')?.textContent).toContain('0');
    expect(container.querySelector('[data-chart-axis="y"]')?.textContent).toContain('2');
  });

  it('requires accessible chart text', () => {
    expect(() =>
      render(HistogramChart, {
        title: '',
        description: 'Distribution.',
        values,
      })
    ).toThrow(/non-empty title/);
  });
});
