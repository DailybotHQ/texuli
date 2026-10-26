import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { compile } from 'svelte/compiler';
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

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    expect(screen.getByRole('list', { name: 'Category' }).textContent).toContain('Platform');
    expect(
      screen
        .getByRole('list', { name: 'Category' })
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

  it('renders every positive pie slice, even a sliver next to a dominant one', () => {
    const { container } = render(PieChart, {
      title: 'Skewed mix',
      description: 'One dominant part and a sliver of the total.',
      data: [
        { id: 'dominant', label: 'Dominant', value: 1000 },
        { id: 'sliver', label: 'Sliver', value: 1 },
      ],
      labels,
    });
    // Both categories appear in the legend and table, so both must render.
    expect(container.querySelector('[data-slice="sliver"]')?.getAttribute('d')).not.toBe('');
    expect(container.querySelector('[data-slice="dominant"]')?.getAttribute('d')).not.toBe('');
  });

  it('localizes the legend group name from the table labels', () => {
    const localized: PartWholeTableLabels = {
      table: 'Abrir tabla de datos',
      category: 'Categoría',
      value: 'Valor',
    };
    const { container } = render(PieChart, {
      title: 'Mezcla',
      description: 'Partes del total.',
      data,
      labels: localized,
    });
    expect(screen.getByRole('list', { name: 'Categoría' })).toBeTruthy();
    cleanup();
    const sunburst = render(SunburstChart, {
      title: 'Jerarquía',
      description: 'Los anillos agrupan partes.',
      root: tree,
      labels: localized,
    });
    expect(sunburst.container.querySelector('g')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Categoría' })).toBeTruthy();
    cleanup();
    const treemap = render(TreemapChart, {
      title: 'Equipos',
      description: 'El área representa los ingresos.',
      root: tree,
      labels: localized,
    });
    expect(treemap.container.querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Categoría' })).toBeTruthy();
  });

  it('hides the donut center total when it cannot fit the inner hole', () => {
    const { container } = render(DonutChart, {
      title: 'Narrow hole',
      description: 'The formatted total is wider than the inner hole.',
      data: [
        { id: 'big', label: 'Big', value: 7_654_321 },
        { id: 'small', label: 'Small', value: 1_234_567 },
      ],
      labels,
      innerRatio: 0.1,
    });
    // "8,888,888" would collide with the slices at this inner ratio; the
    // value stays reachable in the data table instead of overlapping them.
    expect(container.querySelector('.center-total')).toBeNull();
  });

  it('keeps a fitting center total at the default donut ratio', () => {
    const { container } = render(DonutChart, {
      title: 'Roomy hole',
      description: 'The default inner ratio fits the total.',
      data: [
        { id: 'alpha', label: 'Alpha', value: 61 },
        { id: 'beta', label: 'Beta', value: 39 },
      ],
      labels,
    });
    expect(container.querySelector('.center-total')?.textContent).toBe('100');
  });

  it('names sunburst and treemap SVGs from the figure caption like pie', () => {
    render(SunburstChart, {
      title: 'Revenue hierarchy',
      description: 'Inner rings group outer-ring parts.',
      root: tree,
      labels,
    });
    const sunburstSvg = screen.getByRole('img', { name: /Revenue hierarchy/ });
    const sunburstIds = sunburstSvg.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
    const sunburstTitle = document.getElementById(sunburstIds[0] ?? '');
    const sunburstDescription = document.getElementById(sunburstIds[1] ?? '');
    expect(sunburstTitle?.tagName).toBe('H3');
    expect(sunburstTitle?.closest('figcaption')).toBeTruthy();
    expect(sunburstTitle?.textContent).toBe('Revenue hierarchy');
    expect(sunburstDescription?.tagName).toBe('P');
    expect(sunburstDescription?.closest('figcaption')).toBeTruthy();
    expect(sunburstDescription?.textContent).toContain('group outer-ring parts');
    // SVG keeps a decorative title/desc pair without stealing the labelledby ids.
    expect(sunburstSvg.querySelector('title')?.getAttribute('id')).toBeNull();
    expect(sunburstSvg.querySelector('desc')?.getAttribute('id')).toBeNull();
    cleanup();

    const treemap = render(TreemapChart, {
      title: 'Revenue by team',
      description: 'Rectangle area represents revenue.',
      root: tree,
      labels,
    });
    const treemapSvg = screen.getByRole('img', { name: /Revenue by team/ });
    const treemapIds = treemapSvg.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
    const treemapTitle = document.getElementById(treemapIds[0] ?? '');
    const treemapDescription = document.getElementById(treemapIds[1] ?? '');
    expect(treemapTitle?.tagName).toBe('H3');
    expect(treemapTitle?.closest('figcaption')).toBeTruthy();
    expect(treemapTitle?.textContent).toBe('Revenue by team');
    expect(treemapDescription?.tagName).toBe('P');
    expect(treemapDescription?.closest('figcaption')).toBeTruthy();
    expect(treemapSvg.querySelector('title')?.getAttribute('id')).toBeNull();
    expect(treemapSvg.querySelector('desc')?.getAttribute('id')).toBeNull();
    expect(treemap.container.querySelector('figcaption h3')?.textContent).toBe('Revenue by team');
  });

  it('requires a non-empty title and accessible description on every part-whole chart', () => {
    expect(() =>
      render(PieChart, {
        title: '',
        description: 'Parts of the total.',
        data,
        labels,
      })
    ).toThrow(/non-empty title/);
    expect(() =>
      render(PieChart, {
        title: 'Revenue mix',
        description: '   ',
        data,
        labels,
      })
    ).toThrow(/accessible description/);
    expect(() =>
      render(DonutChart, {
        title: '  ',
        description: 'Parts around a total.',
        data,
        labels,
      })
    ).toThrow(/non-empty title/);
    expect(() =>
      render(SunburstChart, {
        title: 'Hierarchy',
        description: '',
        root: tree,
        labels,
      })
    ).toThrow(/accessible description/);
    expect(() =>
      render(TreemapChart, {
        title: '',
        description: 'Area is share.',
        root: tree,
        labels,
      })
    ).toThrow(/non-empty title/);
  });

  it('keeps the sibling caption styles for the figure title and description', () => {
    const sources = ['PieChart.svelte', 'SunburstChart.svelte', 'TreemapChart.svelte'] as const;
    for (const file of sources) {
      const source = readFileSync(resolve(__dirname, `../src/part-whole/${file}`), 'utf8');
      const css = compile(source, {
        filename: file,
        css: 'external',
      }).css?.code;
      // Family contract shared with cartesian / histogram / calendar: 1rem h3
      // and a spaced description. No bare h2 figure titles.
      expect(css, file).toMatch(/figcaption[^{]*h3[^{]*\{[^}]*font-size:\s*1rem/);
      expect(css, file).toMatch(/figcaption[^{]*h3[^{]*\{[^}]*margin-block:\s*0/);
      expect(css, file).toMatch(/figcaption[^{]*p[^{]*\{[^}]*margin-block:\s*0\.25rem\s+0\.75rem/);
      expect(source, file).not.toMatch(/<h2[\s>]/);
    }
  });
});
