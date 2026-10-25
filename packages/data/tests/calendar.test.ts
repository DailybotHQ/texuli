// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CalendarView from '../src/calendar/CalendarView.svelte';
import { eventsOnDate, formatCalendar, occurrenceDates } from '../src/calendar/model.ts';
import type { CalendarItem } from '../src/calendar/types.ts';
import { type CalendarSeries, dayBounds, layoutDay } from '../src/engines/calendar/index.ts';

afterEach(cleanup);

/** The date button (not an event chip, whose name also carries its date). */
function dateButton(name: RegExp): HTMLElement {
  const match = screen
    .getAllByRole('button', { name })
    .find((button) => button.hasAttribute('data-calendar-date'));
  if (!match) throw new Error(`no date button named ${name}`);
  return match;
}

interface Details {
  title: string;
}

const events: CalendarSeries<Details>[] = [
  {
    id: 'review',
    start: '2026-04-15T13:00:00Z',
    end: '2026-04-15T14:00:00Z',
    data: { title: 'Design review' },
  },
  {
    id: 'sync',
    start: '2026-04-15T13:30:00Z',
    end: '2026-04-15T14:30:00Z',
    data: { title: 'Research sync' },
  },
  {
    id: 'all-day',
    start: '2026-04-15',
    end: '2026-04-16',
    allDay: true,
    data: { title: 'Team lunch' },
  },
];

function items(): CalendarItem[] {
  return events.map((event) => ({
    ...event,
    allDay: event.allDay ?? false,
    seriesId: event.id,
    occurrenceId: event.start,
    recurring: false,
    overridden: false,
    id: event.id,
    key: event.id,
    title: event.data?.title ?? event.id,
    tone: 'primary',
    movable: false,
  }));
}

describe('calendar view model', () => {
  it('groups events by their civil dates in the requested zone and keeps all-day end exclusive', () => {
    expect(
      occurrenceDates(
        { start: '2026-04-15T01:00:00Z', end: '2026-04-15T02:00:00Z', allDay: false },
        'America/Los_Angeles'
      )
    ).toEqual({ first: '2026-04-14', last: '2026-04-14' });
    expect(eventsOnDate(items(), '2026-04-15', 'UTC').map((event) => event.id)).toEqual([
      'all-day',
      'review',
      'sync',
    ]);
    expect(eventsOnDate(items(), '2026-04-16', 'UTC')).toEqual([]);
  });

  it('formats dates and event times with the selected locale and IANA time zone', () => {
    const fmt = formatCalendar('en-US', 'America/Los_Angeles');
    expect(fmt.time('2026-04-15T13:00:00Z')).toMatch(/6:00/);
    expect(fmt.hour(6)).toMatch(/6/);
    expect(fmt.monthTitle('2026-04-15')).toContain('April');
    expect(fmt.longDate('2026-04-15')).toContain('Wednesday');
  });

  it('uses real 23- and 25-hour civil days around daylight-saving changes', () => {
    const spring = dayBounds('2026-03-08', 'America/Los_Angeles');
    const fall = dayBounds('2026-11-01', 'America/Los_Angeles');
    expect(spring.end - spring.start).toBe(23 * 60 * 60_000);
    expect(fall.end - fall.start).toBe(25 * 60 * 60_000);
  });

  it('places overlapping events in deterministic side-by-side columns', () => {
    const layout = layoutDay(items(), { date: '2026-04-15', timeZone: 'UTC' });
    expect(layout).toHaveLength(2);
    expect(layout.map((item) => item.column)).toEqual([0, 1]);
    expect(layout.map((item) => item.columnCount)).toEqual([2, 2]);
  });
});

describe('CalendarView', () => {
  it('renders an accessible week grid with all-day and overlapping timed events', async () => {
    const onOpen = vi.fn();
    render(CalendarView, {
      props: { events, anchor: '2026-04-15', today: '2026-04-15', timeZone: 'UTC', onOpen },
    });
    expect(screen.getByRole('region', { name: 'Calendar' }).getAttribute('data-view')).toBe('week');
    await waitFor(() => expect(screen.getByRole('button', { name: /Design review/ })).toBeTruthy());
    expect(screen.getByRole('button', { name: /Research sync/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Team lunch/ })).toBeTruthy();
    const timed = screen.getByRole('button', { name: /Design review/ }).parentElement;
    expect(timed?.getAttribute('style')).toContain('inset-inline-start: 0%');
    await fireEvent.click(screen.getByRole('button', { name: /Design review/ }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('switches among month, day and agenda, and navigates the month grid with RTL-aware keys', async () => {
    render(CalendarView, {
      props: { events, anchor: '2026-04-15', today: '2026-04-15', dir: 'rtl' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    await waitFor(() => expect(screen.getByRole('grid', { name: /April 2026/ })).toBeTruthy());
    const fifteenth = dateButton(/Wednesday, April 15, 2026/);
    fifteenth.focus();
    await fireEvent.keyDown(fifteenth, { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(dateButton(/Thursday, April 16, 2026/).getAttribute('tabindex')).toBe('0')
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    expect(screen.getByRole('region', { name: 'Calendar' }).getAttribute('data-view')).toBe('day');
    await fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
    await waitFor(() => expect(document.querySelector('[data-agenda]')).toBeTruthy());
  });

  it('keeps date navigation available in week, day and agenda modes', async () => {
    render(CalendarView, {
      props: { events, anchor: '2026-04-15', today: '2026-04-15', timeZone: 'UTC' },
    });
    await waitFor(() => expect(dateButton(/Wednesday, April 15, 2026/)).toBeTruthy());
    const wednesday = dateButton(/Wednesday, April 15, 2026/);
    wednesday.focus();
    await fireEvent.keyDown(wednesday, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(dateButton(/Thursday, April 16, 2026/).getAttribute('tabindex')).toBe('0')
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
    await waitFor(() => expect(dateButton(/Thursday, April 16, 2026/)).toBeTruthy());
    const agendaDate = dateButton(/Thursday, April 16, 2026/);
    agendaDate.focus();
    await fireEvent.keyDown(agendaDate, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(dateButton(/Friday, April 17, 2026/).getAttribute('tabindex')).toBe('0')
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    await waitFor(() => expect(dateButton(/Friday, April 17, 2026/)).toBeTruthy());
    const dayDate = dateButton(/Friday, April 17, 2026/);
    dayDate.focus();
    await fireEvent.keyDown(dayDate, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(dateButton(/Saturday, April 18, 2026/).getAttribute('tabindex')).toBe('0')
    );
  });
});
