import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CalendarHeatmap from '../src/calendar/CalendarHeatmap.svelte';
import {
  calendarColorIndex,
  calendarFill,
  createCalendarHeatmapLayout,
  formatCalendarMonth,
} from '../src/calendar/model.ts';
import { calendarLayout } from '../src/math/index.ts';

afterEach(cleanup);

const values = {
  '2026-03-02': 0,
  '2026-03-03': 2,
  '2026-03-05': 8,
} as const;

describe('calendar heatmap model', () => {
  it('uses UTC calendar math and keeps zero distinct from missing data', () => {
    const options = {
      start: '2026-03-02',
      end: '2026-03-08',
      values,
      weekStartsOn: 1,
      cellSize: 10,
      gap: 2,
    } as const;
    const layout = createCalendarHeatmapLayout(options);
    expect(layout).toEqual(
      calendarLayout(
        { start: options.start, end: options.end },
        {
          values,
          weekStartsOn: options.weekStartsOn,
          cellSize: options.cellSize,
          gap: options.gap,
        }
      )
    );
    expect(layout.cells.map((cell) => cell.value)).toEqual([0, 2, null, 8, null, null, null]);
    expect(calendarColorIndex(null, layout.cells)).toBeNull();
    expect(calendarColorIndex(8, layout.cells)).toBe(8);
    expect(calendarFill(8)).toContain('--tx-chart-sequential-9');
    expect(
      createCalendarHeatmapLayout({ ...options, cellSize: -4, gap: -2 }).cells[0]
    ).toMatchObject({ size: 4, x: 0, y: 0 });
  });
});

describe('CalendarHeatmap', () => {
  it('renders every UTC day and distinguishes no data in the table; requires accessible chart text; labels months by name, not as bare numbers', async () => {
    // renders every UTC day and distinguishes no data in the table
    await (async () => {
      const { container } = render(CalendarHeatmap, {
        title: 'Daily activity',
        description: 'Activity for a fictional week in March.',
        start: '2026-03-02',
        end: '2026-03-08',
        values,
      });

      expect(screen.getByRole('img', { name: /Daily activity/ })).toBeTruthy();
      expect(container.querySelectorAll('[data-day]')).toHaveLength(7);
      expect(container.querySelector('[data-day="2026-03-02"]')?.getAttribute('data-value')).toBe(
        '0'
      );
      expect(container.querySelector('[data-day="2026-03-04"]')?.getAttribute('data-value')).toBe(
        'none'
      );
      await fireEvent.click(screen.getByText('View data table'));
      expect(container.querySelector('table')?.textContent).toContain('No data');
    })();
    cleanup();
    // requires accessible chart text
    expect(() =>
      render(CalendarHeatmap, {
        title: 'Daily activity',
        description: '',
        start: '2026-03-02',
        end: '2026-03-08',
      })
    ).toThrow(/accessible description/);
    cleanup();
    {
      // labels months by name, not as bare numbers
      const { container } = render(CalendarHeatmap, {
        title: 'Daily activity',
        description: 'Fictional activity across March and April 2026.',
        start: '2026-03-01',
        end: '2026-04-30',
        values,
      });
      const labels = [...container.querySelectorAll('.months text')].map(
        (node) => node.textContent ?? ''
      );
      // `YYYY-MM`.slice(5) drew "03"; the plot labels months like the table does (words, UTC).
      expect(labels).toEqual(['Mar 2026', 'Apr 2026']);
      expect(labels).not.toContain('03');
    }
  });
});

describe('calendar month label formatting', () => {
  it('formats a YYYY-MM column label as a short month name in UTC; passes an unparseable month through instead of printing Invalid Date', () => {
    // formats a YYYY-MM column label as a short month name in UTC
    expect(formatCalendarMonth('2026-03')).toBe('Mar 2026');
    expect(formatCalendarMonth('2026-12')).toBe('Dec 2026');
    expect(formatCalendarMonth('2026-03', 'fr-FR')).toBe('mars 2026');
    cleanup();
    // passes an unparseable month through instead of printing Invalid Date
    expect(formatCalendarMonth('not-a-date')).toBe('not-a-date');
  });
});
