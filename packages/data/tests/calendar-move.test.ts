import { describe, expect, it } from 'vitest';
import {
  applyMove,
  eventKey,
  isNoMove,
  keyMove,
  moveChoices,
  moveOccurrence,
  NO_MOVE,
  pointerMove,
  spanDates,
  withinBounds,
} from '../src/engines/calendar/index.ts';

const timed = { start: '2026-04-15T13:00:00Z', end: '2026-04-15T14:30:00Z', allDay: false };
const allDay = { start: '2026-04-15', end: '2026-04-17', allDay: true };

describe('calendar move engine', () => {
  it('keys one-off events by series and repeating ones by series and original start', () => {
    expect(
      eventKey({ seriesId: 'review', occurrenceId: '2026-04-15T13:00:00Z', recurring: false })
    ).toBe('review');
    expect(
      eventKey({ seriesId: 'weekly', occurrenceId: '2026-04-13T15:00:00Z', recurring: true })
    ).toBe('weekly|2026-04-13T15:00:00Z');
  });

  it('moves timed events by days and minutes and keeps their duration', () => {
    expect(applyMove(timed, { days: 1, minutes: 0 }, 'UTC')).toEqual({
      start: '2026-04-16T13:00:00.000Z',
      end: '2026-04-16T14:30:00.000Z',
    });
    expect(applyMove(timed, { days: -2, minutes: 45 }, 'UTC')).toEqual({
      start: '2026-04-13T13:45:00.000Z',
      end: '2026-04-13T15:15:00.000Z',
    });
  });

  it('keeps the wall-clock time when a day move crosses a DST change', () => {
    // 09:00 in New York on Saturday 2026-03-07 (EST) is 09:00 on Sunday 2026-03-08 (EDT).
    const nine = { start: '2026-03-07T14:00:00Z', end: '2026-03-07T15:00:00Z', allDay: false };
    expect(applyMove(nine, { days: 1, minutes: 0 }, 'America/New_York')).toEqual({
      start: '2026-03-08T13:00:00.000Z',
      end: '2026-03-08T14:00:00.000Z',
    });
  });

  it('moves all-day events by whole dates with an exclusive end', () => {
    expect(applyMove(allDay, { days: 7, minutes: 0 }, 'UTC')).toEqual({
      start: '2026-04-22',
      end: '2026-04-24',
    });
    expect(spanDates(allDay, 'UTC')).toEqual({ first: '2026-04-15', last: '2026-04-16' });
  });

  it('checks every covered date against min and max, inclusive', () => {
    const bounds = { timeZone: 'UTC', min: '2026-04-10', max: '2026-04-16' };
    expect(withinBounds(allDay, bounds)).toBe(true);
    expect(withinBounds({ ...allDay, start: '2026-04-16', end: '2026-04-18' }, bounds)).toBe(false);
    expect(withinBounds({ ...allDay, start: '2026-04-09', end: '2026-04-10' }, bounds)).toBe(false);
    // A timed event that ends at midnight does not cover the next date.
    const toMidnight = {
      start: '2026-04-16T22:00:00Z',
      end: '2026-04-17T00:00:00Z',
      allDay: false,
    };
    expect(withinBounds(toMidnight, bounds)).toBe(true);
  });

  it('reports why a move cannot happen', () => {
    const bounds = { timeZone: 'UTC', max: '2026-04-15' };
    expect(isNoMove(NO_MOVE)).toBe(true);
    expect(moveOccurrence(timed, NO_MOVE, bounds)).toEqual({ ok: false, reason: 'no-move' });
    expect(moveOccurrence(timed, { days: 1, minutes: 0 }, bounds)).toEqual({
      ok: false,
      reason: 'out-of-range',
    });
    expect(moveOccurrence(timed, { days: -1, minutes: 0 }, bounds)).toEqual({
      ok: true,
      target: { start: '2026-04-14T13:00:00.000Z', end: '2026-04-14T14:30:00.000Z' },
    });
  });

  it('maps arrow keys to moves per view, with RTL and all-day rules', () => {
    expect(keyMove('ArrowRight', { view: 'month', allDay: false })).toEqual({
      days: 1,
      minutes: 0,
    });
    expect(keyMove('ArrowDown', { view: 'month', allDay: false })).toEqual({ days: 7, minutes: 0 });
    expect(keyMove('ArrowUp', { view: 'week', allDay: false })).toEqual({ days: 0, minutes: -15 });
    expect(keyMove('ArrowDown', { view: 'day', allDay: false, slotMinutes: 30 })).toEqual({
      days: 0,
      minutes: 30,
    });
    expect(keyMove('ArrowRight', { view: 'week', allDay: false, rtl: true })).toEqual({
      days: -1,
      minutes: 0,
    });
    expect(keyMove('ArrowDown', { view: 'week', allDay: true })).toBeNull();
    expect(keyMove('ArrowLeft', { view: 'agenda', allDay: false })).toBeNull();
    expect(keyMove('Enter', { view: 'week', allDay: false })).toBeNull();
  });

  it('maps pointer drags to whole columns, weeks and snapped slots', () => {
    const month = { view: 'month' as const, allDay: false, columnWidth: 100, rowHeight: 90 };
    expect(pointerMove(240, 100, month)).toEqual({ days: 9, minutes: 0 });
    expect(pointerMove(240, 0, { ...month, rtl: true })).toEqual({ days: -2, minutes: 0 });
    // Time grid: one pixel per minute, 15-minute slots.
    const week = { view: 'week' as const, allDay: false, columnWidth: 100, rowHeight: 1 };
    expect(pointerMove(110, 22, week)).toEqual({ days: 1, minutes: 15 });
    expect(pointerMove(-40, -23, week)).toEqual({ days: 0, minutes: -30 });
    expect(pointerMove(110, 300, { ...week, allDay: true })).toEqual({ days: 1, minutes: 0 });
    expect(pointerMove(500, 500, { ...week, view: 'agenda' })).toEqual(NO_MOVE);
    expect(pointerMove(500, 500, { ...week, columnWidth: 0, rowHeight: 0 })).toEqual({
      days: 0,
      minutes: 0,
    });
  });

  it('lists Move menu destinations per view and marks the ones outside the dates', () => {
    const bounds = { timeZone: 'UTC', max: '2026-04-20' };
    const week = moveChoices(timed, { view: 'week', bounds });
    expect(week.map((choice) => choice.id)).toEqual([
      'earlier-slot',
      'later-slot',
      'earlier-hour',
      'later-hour',
      'previous-day',
      'next-day',
      'previous-week',
      'next-week',
    ]);
    expect(week.find((choice) => choice.id === 'later-hour')?.target).toEqual({
      start: '2026-04-15T14:00:00.000Z',
      end: '2026-04-15T15:30:00.000Z',
    });
    expect(week.find((choice) => choice.id === 'next-week')?.target).toBeNull();
    // Month view and all-day entries move by days and weeks only; hour steps fold into 60-minute slots.
    expect(moveChoices(timed, { view: 'month', bounds }).map((choice) => choice.id)).toEqual([
      'previous-day',
      'next-day',
      'previous-week',
      'next-week',
    ]);
    expect(moveChoices(allDay, { view: 'day', bounds })).toHaveLength(4);
    expect(moveChoices(timed, { view: 'day', bounds, slotMinutes: 60 })).toHaveLength(6);
    expect(moveChoices(timed, { view: 'agenda', bounds })).toEqual([]);
  });
});
