import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import DonutChart from '../src/part-whole/DonutChart.svelte';
import {
  type PartWholeTableLabels,
  partWholeColor,
  treeTableRows,
} from '../src/part-whole/model.ts';
import PieChart from '../src/part-whole/PieChart.svelte';
import SunburstChart from '../src/part-whole/SunburstChart.svelte';
import TreemapChart from '../src/part-whole/TreemapChart.svelte';

afterEach(cleanup);

const labels: PartWholeTableLabels = {
  table: 'Open data table',
  category: 'Category',
  value: 'Value',
};

const data = [
  { id: 'platform', label: 'Platform', value: 42 },
  { id: 'services', label: 'Services', value: 28 },
  { id: 'support', label: 'Support', value: 18 },
  { id: 'other', label: 'Other', value: 12 },
] as const;

const tree = {
  id: 'company',
  label: 'Example Co.',
  children: [
    {
      id: 'product',
      label: 'Product',
      children: [
        { id: 'platform', label: 'Platform', value: 42 },
        { id: 'support', label: 'Support', value: 18 },
      ],
    },
    {
      id: 'services',
      label: 'Services',
      children: [
        { id: 'implementation', label: 'Implementation', value: 24 },
        { id: 'training', label: 'Training', value: 16 },
      ],
    },
  ],
} as const;

describe('part-whole charts', () => {
  it('renders accessible pie and donut descriptions with an expandable data table', async () => {
    const { container } = render(PieChart, {
      title: 'Revenue mix',
      description: 'Platform is the largest part of revenue.',
      data,
      labels,
    });
    const svg = screen.getByRole('img', { name: /Revenue mix/ });
    const labelledBy = svg.getAttribute('aria-labelledby')?.split(' ') ?? [];
    expect(document.getElementById(labelledBy[0] ?? '')?.textContent).toBe('Revenue mix');
    expect(document.getElementById(labelledBy[1] ?? '')?.textContent).toContain('largest part');
    expect(container.querySelectorAll('[data-slice]')).toHaveLength(4);
    expect(screen.getByRole('list', { name: 'Chart categories' }).textContent).toContain(
      'Platform'
    );
    expect(
      screen
        .getByRole('list', { name: 'Chart categories' })
        .querySelector('.tx-chart-legend__symbol path')
        ?.getAttribute('fill')
    ).toBe(partWholeColor(0));
    expect(screen.getAllByText('Platform').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-slice="platform"]')?.getAttribute('fill')).toContain(
      '--tx-chart-1'
    );
    expect(container.querySelector('.center-total')).toBeNull();

    await fireEvent.click(screen.getByText('Open data table'));
    const table = container.querySelector('table');
    expect(table?.textContent).toContain('Platform');
    expect(table?.textContent).toContain('42');
    cleanup();

    const donut = render(DonutChart, {
      title: 'Revenue share',
      description: 'Revenue parts around a total.',
      data,
      labels,
    });
    expect(donut.container.querySelectorAll('[data-slice]')).toHaveLength(4);
    expect(donut.container.querySelector('.center-total')?.textContent).toBe('100');
  });

  it('renders a treemap and gives its table every hierarchy level and aggregate', async () => {
    const { container } = render(TreemapChart, {
      title: 'Revenue by team',
      description: 'Rectangle area represents revenue.',
      root: tree,
      labels,
    });
    const svg = screen.getByRole('img', { name: /Revenue by team/ });
    expect(svg.querySelector('desc')?.textContent).toContain('area represents revenue');
    expect(container.querySelectorAll('[data-cell]')).toHaveLength(4);
    expect(container.querySelector('[data-cell="platform"]')?.getAttribute('fill')).toContain(
      '--tx-chart-1'
    );

    await fireEvent.click(screen.getByText('Open data table'));
    expect(container.querySelector('table')?.textContent).toContain('Example Co.');
    expect(container.querySelector('table')?.textContent).toContain('Product');
    expect(container.querySelector('table')?.textContent).toContain('60');
    expect(treeTableRows(tree).map((row) => [row.label, row.value])).toEqual([
      ['Example Co.', 100],
      ['Product', 60],
      ['Platform', 42],
      ['Support', 18],
      ['Services', 40],
      ['Implementation', 24],
      ['Training', 16],
    ]);
  });

  it('renders nested sunburst arcs with descriptions and a full data table', async () => {
    const { container } = render(SunburstChart, {
      title: 'Revenue hierarchy',
      description: 'Inner rings group outer-ring parts.',
      root: tree,
      labels,
    });
    const svg = screen.getByRole('img', { name: /Revenue hierarchy/ });
    expect(svg.querySelector('desc')?.textContent).toContain('group outer-ring parts');
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(6);
    expect(svg.querySelectorAll('[data-depth="2"]')).toHaveLength(4);

    await fireEvent.click(screen.getByText('Open data table'));
    expect(container.querySelector('table')?.textContent).toContain('Training');
    expect(container.querySelector('table')?.textContent).toContain('16');
  });

  it('uses the semantic token palette as the chart fallback', () => {
    expect(partWholeColor(0)).toBe('var(--tx-chart-1, var(--tx-primary, CanvasText))');
    expect(partWholeColor(8)).toBe('var(--tx-chart-1, var(--tx-primary, CanvasText))');
    expect(partWholeColor(1)).toContain('var(--tx-success, CanvasText)');
    expect(partWholeColor(Number.NaN)).toBe(partWholeColor(0));
  });
});
