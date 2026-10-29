import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type CohortRow,
  CohortTable,
  cellValue,
  cohortAverages,
  formatCohortValue,
  heatLevel,
  heatMax,
  periodCount,
} from '../src/cohort/index.ts';

afterEach(() => cleanup());

const rows: CohortRow[] = [
  { label: 'Jan 2026', size: 200, cells: [1, 0.5, 0.25] },
  { label: 'Feb 2026', size: 100, cells: [1, { value: 0.8, incomplete: true }, null] },
  { label: 'Mar 2026', size: 50, cells: [1] },
];

describe('cohort model (G20)', () => {
  it('normalizes cells, averages by size, formats and steps heat', () => {
    expect(cellValue(0.5)).toEqual({ value: 0.5, incomplete: false });
    expect(cellValue(undefined)).toEqual({ value: null, incomplete: false });
    expect(cellValue(Number.NaN)).toEqual({ value: null, incomplete: false });
    expect(cellValue({ value: 0.8, incomplete: true })).toEqual({ value: 0.8, incomplete: true });
    expect(periodCount(rows)).toBe(3);
    // Weighted by size over the cohorts that reached each period.
    const [p0, p1, p2] = cohortAverages(rows);
    expect(p0).toBe(1);
    expect(p1).toBeCloseTo((0.5 * 200 + 0.8 * 100) / 300);
    expect(p2).toBe(0.25);
    // Without sizes: a plain mean; a period nobody reached is null.
    expect(
      cohortAverages([
        { label: 'a', cells: [0.2, null] },
        { label: 'b', cells: [0.4] },
      ])
    ).toEqual([0.30000000000000004, null]);
    expect(formatCohortValue(0.4567)).toBe('45.7%');
    expect(formatCohortValue(12345, 'count')).toBe('12,345');
    expect([0, 0.19, 0.2, 0.5, 0.99, 1, 2].map((value) => heatLevel(value, 1))).toEqual([
      0, 0, 1, 2, 4, 4, 4,
    ]);
    expect(heatLevel(null, 1)).toBeNull();
    expect(heatLevel(5, 0)).toBeNull();
    expect(heatMax(rows, 'rate')).toBe(1);
    expect(heatMax([{ label: 'a', cells: [500, 120, 80] }], 'count')).toBe(500);
    expect(heatMax([{ label: 'a', cells: [500, 120, 80] }], 'count', true)).toBe(120);
  });
});

describe('CohortTable (G20)', () => {
  it('renders a captioned table with column and row headers, readable numbers, averages and heat steps', () => {
    render(CohortTable, {
      props: {
        rows,
        periods: ['Month 0', 'Month 1'],
        caption: 'Monthly retention by signup month',
        heat: true,
        average: true,
      },
    });
    const table = screen.getByRole('table', { name: 'Monthly retention by signup month' });
    expect(table.querySelector('caption')?.textContent).toBe('Monthly retention by signup month');
    // Column headers: cohort, size, then each period (missing names fall back).
    const columnHeaders = within(table).getAllByRole('columnheader');
    expect(columnHeaders.map((header) => header.textContent?.trim())).toEqual([
      'Cohort',
      'Users',
      'Month 0',
      'Month 1',
      'Period 2',
    ]);
    for (const header of columnHeaders) expect(header.getAttribute('scope')).toBe('col');
    // Row headers name each cohort (and the averages row) with scope=row.
    const rowHeaders = within(table).getAllByRole('rowheader');
    expect(rowHeaders.map((header) => header.textContent?.trim())).toEqual([
      'Jan 2026',
      'Feb 2026',
      'Mar 2026',
      'Average',
    ]);
    for (const header of rowHeaders) {
      expect(header.tagName).toBe('TH');
      expect(header.getAttribute('scope')).toBe('row');
    }
    expect(table.querySelector('tfoot th[scope="row"]')?.textContent?.trim()).toBe('Average');
    // Numbers are text; missing periods read "No data yet"; incomplete values say so.
    const feb = within(table)
      .getByRole('rowheader', { name: 'Feb 2026' })
      .closest('tr') as HTMLElement;
    const febCells = within(feb).getAllByRole('cell');
    expect(febCells.map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      '100',
      '100%',
      '80%* (incomplete)',
      '— No data yet',
    ]);
    expect(febCells[3]?.querySelector('[aria-hidden="true"]')?.textContent).toBe('—');
    expect(febCells[2]?.querySelector('[aria-hidden="true"]')?.textContent).toBe('*');
    // Heat steps are attributes on the value cells only.
    const jan = within(table)
      .getByRole('rowheader', { name: 'Jan 2026' })
      .closest('tr') as HTMLElement;
    expect(
      within(jan)
        .getAllByRole('cell')
        .map((cell) => cell.getAttribute('data-heat'))
    ).toEqual([null, '4', '2', '1']);
    // The Average row's size cell is the mean cohort size (350 / 3), not the total.
    const footer = table.querySelector('tfoot tr') as HTMLElement;
    expect(
      within(footer)
        .getAllByRole('cell')
        .map((cell) => cell.textContent?.trim())
    ).toEqual(['117', '100%', '60%', '25%']);
  });

  it('formats counts, hides heat when off, and keeps every heat step on a contrast-safe pair', () => {
    render(CohortTable, {
      props: {
        rows: [{ label: 'Week of Mar 2', cells: [1200, 640] }],
        caption: 'Active users',
        captionHidden: true,
        valueKind: 'count',
        labels: { cohort: 'Signup week' },
        format: (value: number) => `${value} users`,
      },
    });
    expect(screen.getByRole('columnheader', { name: 'Signup week' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Users' })).toBeNull();
    expect(screen.getAllByRole('cell').map((cell) => cell.textContent?.trim())).toEqual([
      '1200 users',
      '640 users',
    ]);
    expect(document.querySelector('[data-heat]')).toBeNull();
    const css = readFileSync(join(process.cwd(), 'packages/data/src/cohort/cohort.css'), 'utf8');
    // Tints stay light under the normal text; the top step is the primary pair.
    for (const step of [0, 1, 2, 3]) {
      const share = Number(
        new RegExp(
          `data-heat=["']${step}["']\\][^{]*\\{[^}]*var\\(--tx-primary, Highlight\\) (\\d+)%`
        ).exec(css)?.[1]
      );
      expect(share).toBeLessThanOrEqual(34);
    }
    expect(css).toMatch(/data-heat=["']4["']\][^{]*\{[^}]*color: var\(--tx-primary-foreground/);
    expect(css).toMatch(/forced-colors: active/);
  });
});
