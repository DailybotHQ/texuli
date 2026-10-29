import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { safeParseBlock } from '../src/core/index.ts';
import { checkDataBlock } from '../src/data/check.ts';
import DataBlockView from '../src/data/DataBlockView.svelte';
import { isDataFamilyBlock } from '../src/data/family.ts';

afterEach(() => cleanup());

describe('data block schemas', () => {
  it('parses a valid table and rejects oversized tables, and 3 related cases', () => {
    {
      // parses a valid table and rejects oversized tables
      const ok = safeParseBlock({
        type: 'table',
        caption: 'Scores',
        columns: [
          { id: 'team', label: 'Team' },
          { id: 'score', label: 'Score' },
        ],
        rows: [
          { team: 'Design', score: 92 },
          { team: 'Build', score: null },
        ],
      });
      expect(ok.success).toBe(true);
      if (ok.success) {
        expect(ok.data.type).toBe('table');
        expect(isDataFamilyBlock(ok.data)).toBe(true);
      }

      const bad = safeParseBlock({
        type: 'table',
        columns: Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, label: `C${i}` })),
        rows: [],
      });
      expect(bad.success).toBe(false);
    }
    cleanup();
    {
      // parses stat and kpi rows and rejects empty items
      const stat = safeParseBlock({
        type: 'stat',
        items: [{ label: 'Active', value: '12', delta: '+2', tone: 'success' }],
      });
      expect(stat.success).toBe(true);
      const kpi = safeParseBlock({
        type: 'kpi',
        items: [{ label: 'NPS', value: '54', hint: '90d' }],
      });
      expect(kpi.success).toBe(true);
      expect(safeParseBlock({ type: 'stat', items: [] }).success).toBe(false);
    }
    cleanup();
    {
      // parses chart blocks and requires description
      const chart = safeParseBlock({
        type: 'chart',
        kind: 'bar',
        title: 'Sign-ups',
        description: 'Weekly fictional sign-ups.',
        series: [
          {
            id: 'new',
            label: 'New',
            points: [
              { x: 'W1', y: 10 },
              { x: 'W2', y: 14 },
            ],
          },
        ],
      });
      expect(chart.success).toBe(true);
      expect(
        safeParseBlock({
          type: 'chart',
          kind: 'bar',
          title: 'X',
          description: '',
          series: [{ id: 'a', label: 'A', points: [{ x: '1', y: 1 }] }],
        }).success
      ).toBe(false);
    }
    cleanup();
    {
      // rejects hostile table cell content and unsafe chart colors
      const hostile = safeParseBlock({
        type: 'table',
        columns: [{ id: 'n', label: 'N' }],
        rows: [{ n: 'hello\u0000world' }],
      });
      expect(hostile.success).toBe(false);

      const color = safeParseBlock({
        type: 'chart',
        kind: 'line',
        title: 'T',
        description: 'D',
        series: [
          {
            id: 'a',
            label: 'A',
            color: 'red',
            points: [{ x: '1', y: 1 }],
          },
        ],
      });
      expect(color.success).toBe(false);
    }
  });
});

describe('checkDataBlock + DataBlockView', () => {
  it('renders a validated table and rejects non-data types, and 6 related cases', async () => {
    // renders a validated table and rejects non-data types
    await (async () => {
      const check = checkDataBlock({
        type: 'table',
        columns: [{ id: 'name', label: 'Name' }],
        rows: [{ name: 'Ada' }],
      });
      expect(check.ok).toBe(true);

      render(DataBlockView, {
        props: {
          block: {
            type: 'table',
            columns: [{ id: 'name', label: 'Name' }],
            rows: [{ name: 'Ada' }],
          },
        },
      });
      expect(screen.getByText('Ada')).toBeTruthy();
      expect(document.querySelector('[data-tx-block="table"]')).toBeTruthy();

      expect(checkDataBlock({ type: 'heading', level: 1, text: 'Hi' }).ok).toBe(false);
    })();
    cleanup();
    // renders stat items
    render(DataBlockView, {
      props: {
        block: {
          type: 'stat',
          items: [{ label: 'Active seats', value: '128' }],
        },
      },
    });
    expect(screen.getByText('Active seats')).toBeTruthy();
    expect(screen.getByText('128')).toBeTruthy();
    cleanup();
    // shows invalid notice for hostile input
    render(DataBlockView, {
      props: { block: { type: 'table', columns: 'nope' } },
    });
    expect(screen.getByRole('note').textContent).toMatch(/could not be shown/i);
    cleanup();
    {
      // gives a captionless table an accessible name from the tableSummary label
      render(DataBlockView, {
        props: {
          block: {
            type: 'table',
            columns: [{ id: 'name', label: 'Name' }],
            rows: [{ name: 'Ada' }],
          },
        },
      });
      const table = document.querySelector('table[data-tx-table]');
      expect(table?.getAttribute('aria-label')).toBe('Data table');
    }
    cleanup();
    {
      // lets consumers override the table name and keeps a caption as the name
      const overridden = render(DataBlockView, {
        props: {
          labels: { tableSummary: 'Tabla de datos' },
          block: {
            type: 'table',
            columns: [{ id: 'name', label: 'Name' }],
            rows: [{ name: 'Ada' }],
          },
        },
      });
      expect(
        overridden.container.querySelector('table[data-tx-table]')?.getAttribute('aria-label')
      ).toBe('Tabla de datos');
      overridden.unmount();

      const captioned = render(DataBlockView, {
        props: {
          block: {
            type: 'table',
            caption: 'Fictional scores',
            columns: [{ id: 'name', label: 'Name' }],
            rows: [{ name: 'Ada' }],
          },
        },
      });
      // The caption names the table; no duplicate aria-label.
      expect(
        captioned.container.querySelector('table[data-tx-table]')?.getAttribute('aria-label')
      ).toBeNull();
    }
    cleanup();
    {
      // announces stat and kpi groups with translatable labels
      const stat = render(DataBlockView, {
        props: {
          block: { type: 'stat', items: [{ label: 'Active seats', value: '128' }] },
        },
      });
      expect(screen.getByRole('group', { name: 'Statistics' })).toBeTruthy();
      stat.unmount();

      const kpi = render(DataBlockView, {
        props: {
          block: { type: 'kpi', items: [{ label: 'NPS', value: '54' }] },
        },
      });
      expect(screen.getByRole('group', { name: 'Key performance indicators' })).toBeTruthy();
      kpi.unmount();

      render(DataBlockView, {
        props: {
          labels: { statGroup: 'Estadísticas', kpiGroup: 'Indicadores' },
          block: { type: 'kpi', items: [{ label: 'NPS', value: '54' }] },
        },
      });
      expect(screen.getByRole('group', { name: 'Indicadores' })).toBeTruthy();
    }
    cleanup();
    {
      // surfaces validated item tones as data-tone on each stat
      render(DataBlockView, {
        props: {
          block: {
            type: 'stat',
            items: [
              { label: 'Active seats', value: '128', tone: 'success' },
              { label: 'Median latency', value: '42 ms' },
            ],
          },
        },
      });
      const stats = document.querySelectorAll('[data-tx-stat]');
      expect(stats).toHaveLength(2);
      expect(stats[0]?.getAttribute('data-tone')).toBe('success');
      expect(stats[1]?.hasAttribute('data-tone')).toBe(false);
    }
  });
});

describe('stat presentation fields', () => {
  it('names the group by its title, shows the source and draws a labeled trend sparkline per item', async () => {
    const cases = [
      {
        block: {
          type: 'stat',
          title: 'Q3 at a glance',
          source: 'Source: fictional sample data',
          items: [
            { label: 'Active', value: '128', trend: [90, 104, 128] },
            { label: 'Churn', value: '2%' },
          ],
        },
        labels: undefined,
        group: 'Q3 at a glance',
        trends: ['Active trend'],
        source: 'Source: fictional sample data',
      },
      {
        block: {
          type: 'kpi',
          items: [{ label: 'Revenue', value: '$1.2M', trend: [1, 1.2] }],
        },
        labels: { trendName: 'Tendencia de {label}' },
        group: 'Key performance indicators',
        trends: ['Tendencia de Revenue'],
        source: undefined,
      },
    ] as const;
    for (const { block, labels, group, trends, source } of cases) {
      const { container } = render(DataBlockView, { props: { block, labels } });
      const region = screen.getByRole('group', { name: group });
      // The sparkline module loads on first use.
      await waitFor(() =>
        expect(
          [...region.querySelectorAll('svg[role="img"]')].map((svg) =>
            svg.getAttribute('aria-label')
          )
        ).toEqual(trends)
      );
      expect(container.querySelector('.tx-stat-source')?.textContent).toBe(source);
      cleanup();
    }
  });
});
