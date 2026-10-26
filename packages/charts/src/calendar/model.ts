import { sequentialColor } from '../colors/index.ts';
import {
  type CalendarCell,
  type CalendarLayout,
  calendarLayout,
  extent,
  formatDate,
} from '../math/index.ts';

export interface CalendarTableLabels {
  table: string;
  date: string;
  value: string;
  noData: string;
}

export interface CalendarHeatmapOptions {
  start: string | number;
  end: string | number;
  values?: Readonly<Record<string, number>> | ReadonlyMap<string, number>;
  weekStartsOn?: number;
  cellSize?: number;
  gap?: number;
}

export const CALENDAR_TABLE_LABELS: CalendarTableLabels = {
  table: 'View data table',
  date: 'Date',
  value: 'Value',
  noData: 'No data',
};

export function calendarLabels(
  labels: Partial<CalendarTableLabels> | undefined
): CalendarTableLabels {
  return { ...CALENDAR_TABLE_LABELS, ...labels };
}

/** Build a UTC day grid from the public `calendarLayout` chart math. */
export function createCalendarHeatmapLayout(options: CalendarHeatmapOptions): CalendarLayout {
  const cellSize = Number.isFinite(options.cellSize) ? Math.max(4, options.cellSize as number) : 12;
  const gap = Number.isFinite(options.gap) ? Math.max(0, options.gap as number) : 2;
  return calendarLayout(
    { start: options.start, end: options.end },
    {
      ...(options.values === undefined ? {} : { values: options.values }),
      ...(options.weekStartsOn === undefined ? {} : { weekStartsOn: options.weekStartsOn }),
      cellSize,
      gap,
    }
  );
}

export function calendarColorIndex(
  value: number | null,
  cells: readonly CalendarCell[]
): number | null {
  if (value === null) return null;
  const finite = cells
    .map((cell) => cell.value)
    .filter((candidate): candidate is number => candidate !== null);
  if (finite.length === 0) return null;
  const [min, max] = extent(finite) ?? [0, 0];
  if (min === max) return 4;
  // Halved terms keep the ratio finite when max - min would overflow.
  const t = (value / 2 - min / 2) / (max / 2 - min / 2);
  return Number.isFinite(t) ? Math.min(8, Math.max(0, Math.round(t * 8))) : null;
}

export function calendarFill(index: number | null): string {
  if (index === null) return 'var(--tx-muted, var(--tx-surface, Canvas))';
  const slot = Math.min(8, Math.max(0, Math.trunc(index)));
  return sequentialColor(slot / 8);
}

export function formatCalendarDate(date: string): string {
  return formatDate(Date.parse(`${date}T00:00:00.000Z`));
}

/** Month tick labels use the host locale while keeping the chart's UTC calendar semantics. */
export function formatCalendarMonth(month: string, locale?: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return month;
  const date = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return month;
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatCalendarValue(value: number | null, noData = 'No data'): string {
  return value === null
    ? noData
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}
