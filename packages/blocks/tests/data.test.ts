import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { safeParseBlock } from '../src/core/index.ts';
import { checkDataBlock } from '../src/data/check.ts';
import DataBlockView from '../src/data/DataBlockView.svelte';
import { isDataFamilyBlock } from '../src/data/family.ts';

afterEach(() => cleanup());

describe('data block schemas', () => {
  it('parses a valid table and rejects oversized tables', () => {
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
  });

  it('parses stat and kpi rows and rejects empty items', () => {
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
  });

  it('parses chart blocks and requires description', () => {
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
  });

  it('rejects hostile table cell content and unsafe chart colors', () => {
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
  });
});

describe('checkDataBlock + DataBlockView', () => {
  it('renders a validated table and rejects non-data types', async () => {
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
  });

  it('renders stat items', () => {
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
  });

  it('shows invalid notice for hostile input', () => {
    render(DataBlockView, {
      props: { block: { type: 'table', columns: 'nope' } },
    });
    expect(screen.getByRole('note').textContent).toMatch(/could not be shown/i);
  });
});
