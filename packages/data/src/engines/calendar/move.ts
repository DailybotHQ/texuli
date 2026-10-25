/**
 * Rescheduling math for calendar views: where an occurrence lands after a move
 * by whole days and wall-clock minutes, whether it stays inside the allowed
 * dates, and how keys and pointer drags translate into moves. Pure: the view
 * reads geometry and keys, this decides the new `start` / `end`.
 */
import {
  addDays,
  dateIn,
  type IsoDate,
  parseInstant,
  parseIsoDate,
  toIso,
  wallTime,
  zonedInstant,
} from './dates.ts';
import type { CalendarView } from './grid.ts';
import type { Occurrence } from './recurrence.ts';

/** Keyboard and pointer moves in a time grid step by this many minutes. */
export const SLOT_MINUTES = 15;

/** A reschedule: whole days, then wall-clock minutes. Duration never changes. */
export interface CalendarMove {
  days: number;
  minutes: number;
}

export const NO_MOVE: CalendarMove = { days: 0, minutes: 0 };

export function isNoMove(move: CalendarMove): boolean {
  return move.days === 0 && move.minutes === 0;
}

/** The new `start` / `end`, in the occurrence's format (instants, or dates when all-day). */
export interface MoveTarget {
  start: string;
  end: string;
}

type Span = Pick<Occurrence, 'start' | 'end' | 'allDay'>;

/**
 * A key that stays the same while an occurrence moves: the series id for a
 * one-off entry (its occurrence id is its start, which a move changes), and
 * `seriesId|occurrenceId` for a repeating one (the occurrence id is the
 * original start, which overrides keep).
 */
export function eventKey(
  occurrence: Pick<Occurrence, 'seriesId' | 'occurrenceId' | 'recurring'>
): string {
  return occurrence.recurring
    ? `${occurrence.seriesId}|${occurrence.occurrenceId}`
    : occurrence.seriesId;
}

/**
 * Where `occurrence` lands after `move`. Timed entries keep their wall-clock
 * time in `timeZone` when moved by days (09:00 stays 09:00 across a DST
 * change), then shift by `move.minutes`; the duration is preserved.
 */
export function applyMove(occurrence: Span, move: CalendarMove, timeZone: string): MoveTarget {
  if (occurrence.allDay) {
    return { start: addDays(occurrence.start, move.days), end: addDays(occurrence.end, move.days) };
  }
  const start = parseInstant(occurrence.start);
  const duration = parseInstant(occurrence.end) - start;
  let moved = start;
  if (move.days !== 0) {
    const wall = wallTime(start, timeZone);
    const { year, month, day } = parseIsoDate(addDays(dateIn(start, timeZone), move.days));
    moved = zonedInstant({ ...wall, year, month, day }, timeZone);
  }
  moved += move.minutes * 60_000;
  return { start: toIso(moved), end: toIso(moved + duration) };
}

/** The first and last civil dates a span covers in `timeZone` (all-day `end` is exclusive). */
export function spanDates(span: Span, timeZone: string): { first: IsoDate; last: IsoDate } {
  if (span.allDay) return { first: span.start, last: addDays(span.end, -1) };
  const start = parseInstant(span.start);
  const end = parseInstant(span.end);
  return { first: dateIn(start, timeZone), last: dateIn(Math.max(start, end - 1), timeZone) };
}

export interface MoveBounds {
  timeZone: string;
  /** First allowed date, inclusive. */
  min?: IsoDate;
  /** Last allowed date, inclusive. */
  max?: IsoDate;
}

/** Whether every date `span` covers is inside `[min, max]`. */
export function withinBounds(span: Span, bounds: MoveBounds): boolean {
  const { first, last } = spanDates(span, bounds.timeZone);
  return (!bounds.min || first >= bounds.min) && (!bounds.max || last <= bounds.max);
}

export type MoveResult =
  | { ok: true; target: MoveTarget }
  | { ok: false; reason: 'no-move' | 'out-of-range' };

/** `applyMove` with the checks a view needs before emitting a change. */
export function moveOccurrence(
  occurrence: Span,
  move: CalendarMove,
  bounds: MoveBounds
): MoveResult {
  if (isNoMove(move)) return { ok: false, reason: 'no-move' };
  const target = applyMove(occurrence, move, bounds.timeZone);
  if (!withinBounds({ ...target, allDay: occurrence.allDay }, bounds)) {
    return { ok: false, reason: 'out-of-range' };
  }
  return { ok: true, target };
}

export interface KeyMoveOptions {
  view: CalendarView;
  allDay: boolean;
  rtl?: boolean;
  slotMinutes?: number;
}

/**
 * The move for an arrow key (the view adds the modifier, such as Ctrl).
 * Month: left / right by a day, up / down by a week. Week and day: left /
 * right by a day, up / down by a slot (all-day entries move by days only).
 * Left and right swap in RTL. Agenda and other keys: null.
 */
export function keyMove(key: string, options: KeyMoveOptions): CalendarMove | null {
  if (options.view === 'agenda') return null;
  const forward = options.rtl ? -1 : 1;
  if (key === 'ArrowLeft') return { days: -forward, minutes: 0 };
  if (key === 'ArrowRight') return { days: forward, minutes: 0 };
  const vertical = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
  if (vertical === 0) return null;
  if (options.view === 'month') return { days: vertical * 7, minutes: 0 };
  if (options.allDay) return null;
  return { days: 0, minutes: vertical * (options.slotMinutes ?? SLOT_MINUTES) };
}

export interface PointerMoveOptions {
  view: CalendarView;
  allDay: boolean;
  /** Width of one day column, in pixels. */
  columnWidth: number;
  /** Month: height of one week row. Week and day: height of one minute. In pixels. */
  rowHeight: number;
  rtl?: boolean;
  slotMinutes?: number;
}

/**
 * The move for a pointer drag of `dx`, `dy` pixels: whole columns across,
 * whole weeks (month) or snapped slots (time grid) down. Agenda: no move.
 */
export function pointerMove(dx: number, dy: number, options: PointerMoveOptions): CalendarMove {
  if (options.view === 'agenda') return NO_MOVE;
  const columns = options.columnWidth > 0 ? Math.round(dx / options.columnWidth) : 0;
  const days = (options.rtl ? -columns : columns) || 0;
  if (options.rowHeight <= 0) return { days, minutes: 0 };
  if (options.view === 'month') {
    return { days: days + (Math.round(dy / options.rowHeight) || 0) * 7, minutes: 0 };
  }
  if (options.allDay) return { days, minutes: 0 };
  const slot = options.slotMinutes ?? SLOT_MINUTES;
  return { days, minutes: (Math.round(dy / options.rowHeight / slot) || 0) * slot };
}

export type MoveChoiceId =
  | 'earlier-slot'
  | 'later-slot'
  | 'earlier-hour'
  | 'later-hour'
  | 'previous-day'
  | 'next-day'
  | 'previous-week'
  | 'next-week';

export interface MoveChoice {
  id: MoveChoiceId;
  move: CalendarMove;
  /** Where it lands, or null when it would leave the allowed dates. */
  target: MoveTarget | null;
}

/**
 * The destinations a "Move" menu offers for an occurrence: slot and hour
 * steps in the week and day views (timed entries only), then day and week
 * steps. Each carries its target, or null when `bounds` refuse it. Agenda: none.
 */
export function moveChoices(
  occurrence: Span,
  options: { view: CalendarView; bounds: MoveBounds; slotMinutes?: number }
): MoveChoice[] {
  if (options.view === 'agenda') return [];
  const slot = options.slotMinutes ?? SLOT_MINUTES;
  const steps: [MoveChoiceId, CalendarMove][] = [];
  if (options.view !== 'month' && !occurrence.allDay) {
    steps.push(
      ['earlier-slot', { days: 0, minutes: -slot }],
      ['later-slot', { days: 0, minutes: slot }]
    );
    if (slot !== 60)
      steps.push(
        ['earlier-hour', { days: 0, minutes: -60 }],
        ['later-hour', { days: 0, minutes: 60 }]
      );
  }
  steps.push(
    ['previous-day', { days: -1, minutes: 0 }],
    ['next-day', { days: 1, minutes: 0 }],
    ['previous-week', { days: -7, minutes: 0 }],
    ['next-week', { days: 7, minutes: 0 }]
  );
  return steps.map(([id, move]) => {
    const result = moveOccurrence(occurrence, move, options.bounds);
    return { id, move, target: result.ok ? result.target : null };
  });
}
