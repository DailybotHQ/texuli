import { CalendarDate } from '@texuli/primitives/calendar';

/** A ready-made range a person can pick in one step. */
export interface DateRangePreset {
  id: string;
  /** Visible label (translatable through `DateRangePresetLabels`). */
  label: string;
  start: string;
  end: string;
}

export interface DateRangePresetLabels {
  today: string;
  yesterday: string;
  last7: string;
  last30: string;
  thisMonth: string;
  lastMonth: string;
}

export const DEFAULT_DATE_RANGE_PRESET_LABELS: Readonly<DateRangePresetLabels> =
  /* @__PURE__ */ Object.freeze({
    today: 'Today',
    yesterday: 'Yesterday',
    last7: 'Last 7 days',
    last30: 'Last 30 days',
    thisMonth: 'This month',
    lastMonth: 'Last month',
  });

/** Today as `YYYY-MM-DD` in the local time zone. */
export function localToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function parse(iso: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new CalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
  return date.toString() === iso ? date : null;
}

/**
 * The common ranges relative to `today` (`YYYY-MM-DD`, default the local
 * day): today, yesterday, the last 7 and 30 days (today included), this month
 * so far and last month. Pure: the same `today` always gives the same ranges.
 */
export function dateRangePresets(
  today: string = localToday(),
  labels: Partial<DateRangePresetLabels> = {}
): DateRangePreset[] {
  const day = parse(today);
  if (!day) return [];
  const text = { ...DEFAULT_DATE_RANGE_PRESET_LABELS, ...labels };
  const monthStart = day.set({ day: 1 });
  const lastMonthStart = monthStart.add({ months: -1 });
  const range = (id: keyof DateRangePresetLabels, start: CalendarDate, end: CalendarDate) => ({
    id,
    label: text[id],
    start: start.toString(),
    end: end.toString(),
  });
  return [
    range('today', day, day),
    range('yesterday', day.add({ days: -1 }), day.add({ days: -1 })),
    range('last7', day.add({ days: -6 }), day),
    range('last30', day.add({ days: -29 }), day),
    range('thisMonth', monthStart, day),
    range('lastMonth', lastMonthStart, monthStart.add({ days: -1 })),
  ];
}

/** The preset a range matches exactly, if any (drives `aria-pressed`). */
export function matchingPreset(
  presets: readonly DateRangePreset[],
  start: string | null,
  end: string | null
): DateRangePreset | undefined {
  return presets.find((preset) => preset.start === start && preset.end === end);
}
