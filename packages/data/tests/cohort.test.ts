import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type CohortRow,
  CohortTable,
  cellValue,
  cohortAverages,
  formatCohortValue,
  heatLevel,
  heatMax,
  periodCount,
  resolveHeatScale,
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

  it('takes a host heat palette, picks the text per step for contrast and refuses unsafe palettes (G51)', async () => {
    // Model: hex steps get the text with the higher contrast; tokens use their gated pair.
    const scale = resolveHeatScale(['#f5f7ff', '#1e3a8a', 'primary-soft', 'success']);
    expect(scale.ok).toBe(true);
    if (!scale.ok) return;
    expect(scale.steps.map((step) => step.color)).toEqual([
      '#000000',
      '#ffffff',
      'var(--tx-primary-soft-foreground)',
      'var(--tx-success-foreground)',
    ]);
    expect(scale.steps[1]?.background).toBe('#1e3a8a');
    expect(scale.steps.every((step) => step.ratio === null || step.ratio >= 4.5)).toBe(true);
    // Refused: a mid gray between two grays, unknown entries, too few or many steps.
    expect(
      resolveHeatScale(['#eeeeee', '#777777'], { light: '#dddddd', dark: '#333333' })
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining('4.5:1'),
    });
    for (const bad of [
      ['red', '#000000'],
      ['var(--x)', 'primary'],
      ['#ffffff'],
      Array(11).fill('#ffffff'),
    ]) {
      expect(resolveHeatScale(bad).ok, bad.join()).toBe(false);
    }
    // Levels follow the step count.
    expect(heatLevel(1, 1, 3)).toBe(2);
    expect(heatLevel(0.4, 1, 3)).toBe(1);

    // View: N steps through CSSOM custom properties on the root.
    const heatRows: CohortRow[] = [{ label: 'Jan', cells: [1, 0.5, 0.1] }];
    render(CohortTable, {
      props: {
        rows: heatRows,
        caption: 'Retention',
        heat: true,
        heatScale: ['#f5f7ff', '#93c5fd', '#1e3a8a'],
      },
    });
    const root = document.querySelector('[data-tx-cohort]') as HTMLElement;
    await Promise.resolve();
    expect(root.getAttribute('data-heat-scale')).toBe('3');
    expect(root.getAttribute('style') ?? '').not.toContain('background');
    expect(root.style.getPropertyValue('--tx-cohort-heat-2')).toBe('#1e3a8a');
    expect(root.style.getPropertyValue('--tx-cohort-heat-2-text')).toBe('#ffffff');
    expect(
      [...document.querySelectorAll('td[data-heat]')].map((cell) => cell.getAttribute('data-heat'))
    ).toEqual(['2', '1', '0']);
    cleanup();
    // A refused palette warns and keeps the built-in steps.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(CohortTable, {
      props: {
        rows: heatRows,
        caption: 'Retention',
        heat: true,
        heatScale: ['#777777', 'hotpink'],
      },
    });
    await Promise.resolve();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('heatScale step 2'));
    warn.mockRestore();
    expect(document.querySelector('[data-tx-cohort]')?.hasAttribute('data-heat-scale')).toBe(false);
    expect(document.querySelector('td[data-heat]')?.getAttribute('data-heat')).toBe('4');
    const css = readFileSync(join(process.cwd(), 'packages/data/src/cohort/cohort.css'), 'utf8');
    for (let step = 0; step < 10; step += 1)
      expect(css).toContain(`var(--tx-cohort-heat-${step}-text, var(--tx-foreground, CanvasText))`);
    expect(css).toMatch(
      /forced-colors: active\) \{\s*\.tx-cohort \.tx-cohort__cell\[data-heat\],\s*\.tx-cohort\[data-heat-scale\]/
    );
  });
});
