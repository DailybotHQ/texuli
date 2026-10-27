// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CalendarView from '../src/calendar/CalendarView.svelte';
import { eventsOnDate, formatCalendar, occurrenceDates } from '../src/calendar/model.ts';
import { type CalendarItem } from '../src/calendar/types.ts';
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
  it('groups events by their civil dates in the requested zone and keeps all-day end exclusive, and 3 related cases', () => {
    // groups events by their civil dates in the requested zone and keeps all-day end exclusive
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
    cleanup();
    {
      // formats dates and event times with the selected locale and IANA time zone
      const fmt = formatCalendar('en-US', 'America/Los_Angeles');
      expect(fmt.time('2026-04-15T13:00:00Z')).toMatch(/6:00/);
      expect(fmt.hour(6)).toMatch(/6/);
      expect(fmt.monthTitle('2026-04-15')).toContain('April');
      expect(fmt.longDate('2026-04-15')).toContain('Wednesday');
    }
    cleanup();
    {
      // uses real 23- and 25-hour civil days around daylight-saving changes
      const spring = dayBounds('2026-03-08', 'America/Los_Angeles');
      const fall = dayBounds('2026-11-01', 'America/Los_Angeles');
      expect(spring.end - spring.start).toBe(23 * 60 * 60_000);
      expect(fall.end - fall.start).toBe(25 * 60 * 60_000);
    }
    cleanup();
    {
      // places overlapping events in deterministic side-by-side columns
      const layout = layoutDay(items(), { date: '2026-04-15', timeZone: 'UTC' });
      expect(layout).toHaveLength(2);
      expect(layout.map((item) => item.column)).toEqual([0, 1]);
      expect(layout.map((item) => item.columnCount)).toEqual([2, 2]);
    }
  });
});

describe('CalendarView', () => {
  it('renders an accessible week grid with all-day and overlapping timed events, and 2 related cases', async () => {
    // renders an accessible week grid with all-day and overlapping timed events
    await (async () => {
      const onOpen = vi.fn();
      render(CalendarView, {
        props: { events, anchor: '2026-04-15', today: '2026-04-15', timeZone: 'UTC', onOpen },
      });
      expect(screen.getByRole('region', { name: 'Calendar' }).getAttribute('data-view')).toBe(
        'week'
      );
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Design review/ })).toBeTruthy()
      );
      expect(screen.getByRole('button', { name: /Research sync/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Team lunch/ })).toBeTruthy();
      const timed = screen.getByRole('button', { name: /Design review/ }).parentElement;
      expect(timed?.getAttribute('style')).toContain('inset-inline-start: 0%');
      await fireEvent.click(screen.getByRole('button', { name: /Design review/ }));
      expect(onOpen).toHaveBeenCalledOnce();
    })();
    cleanup();
    // switches among month, day and agenda, and navigates the month grid with RTL-aware keys
    await (async () => {
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
      expect(screen.getByRole('region', { name: 'Calendar' }).getAttribute('data-view')).toBe(
        'day'
      );
      await fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
      await waitFor(() => expect(document.querySelector('[data-agenda]')).toBeTruthy());
    })();
    cleanup();
    // keeps date navigation available in week, day and agenda modes
    await (async () => {
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
    })();
  });
});

describe('calendar audit (T-62)', () => {
  // T-62 audit lane: failing-first tests for the calendar fix-now findings.
  // CSS and markup contracts that happy-dom cannot lay out are asserted against
  // the component source (the same source-contract pattern as grid-columns.test.ts).
  afterEach(cleanup);

  const here = dirname(fileURLToPath(import.meta.url));
  // Read the shipped source for CSS contracts (Vite would rewrite a static
  // `new URL(..., import.meta.url)` into a dev-server URL, so join paths).
  const sourceOf = (segment: string): string => readFileSync(join(here, segment), 'utf8');

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
  ];

  describe('calendar audit: agenda heading identity', () => {
    it('scopes agenda day heading ids to the component instance', async () => {
      // Two calendars on one page: duplicate ids would make both day sections
      // resolve their aria-labelledby to the first calendar's headings.
      const props = {
        props: { events, anchor: '2026-04-15', today: '2026-04-15', view: 'agenda' as const },
      };
      render(CalendarView, props);
      render(CalendarView, props);
      await waitFor(() => expect(document.querySelectorAll('[data-agenda]')).toHaveLength(2));
      // Every day section of both calendars: its label must be its own heading.
      const sections = [
        ...document.querySelectorAll<HTMLElement>('[data-agenda] .tx-calendar__agenda-day'),
      ];
      expect(sections.length).toBeGreaterThan(2);
      const headingIds = sections.map(
        (section) => section.querySelector('h3')?.getAttribute('id') ?? ''
      );
      expect(new Set(headingIds).size).toBe(headingIds.length);
      // Each day section is labelled by its own heading, not the other calendar's.
      sections.forEach((section) => {
        expect(section.getAttribute('aria-labelledby')).toBe(section.querySelector('h3')?.id);
      });
    });
  });

  describe('calendar audit: labels contract', () => {
    it('names the view-mode group and the truncation note through labels', async () => {
      // One occurrence over the expansion cap so the truncation note renders.
      const many: CalendarSeries<Details>[] = Array.from({ length: 1001 }, (_, index) => ({
        id: `e${index}`,
        start: '2026-04-15T10:00:00Z',
        end: '2026-04-15T11:00:00Z',
        data: { title: `Event ${index}` },
      }));
      render(CalendarView, {
        props: {
          events: many,
          anchor: '2026-04-15',
          today: '2026-04-15',
          view: 'month',
          labels: {
            viewModes: 'Kalenderansichten',
            truncationNote: (count: number) => `Nur die ersten ${count} Termine.`,
          },
        },
      });
      await waitFor(() => expect(screen.getByRole('grid', { name: /April 2026/ })).toBeTruthy());
      expect(screen.getByRole('group', { name: 'Kalenderansichten' })).toBeTruthy();
      await waitFor(() => expect(document.querySelector('.tx-calendar__note')).toBeTruthy());
      expect(document.querySelector('.tx-calendar__note')?.textContent).toBe(
        'Nur die ersten 1000 Termine.'
      );
    }, 20_000);
  });

  describe('calendar audit: month date tap target', () => {
    it('gives month date buttons a 24px minimum tap target', () => {
      // happy-dom has no layout: pin the shipped CSS contract instead.
      const rule = sourceOf('../src/calendar/MonthView.svelte').match(
        /\.tx-calendar__date \{([^}]*)\}/
      );
      expect(rule).toBeTruthy();
      const declared = rule?.[1] ?? '';
      const min = declared.match(/min-block-size:\s*([\d.]+)rem/);
      expect(min).toBeTruthy();
      expect(Number(min?.[1])).toBeGreaterThanOrEqual(1.5);
    });
  });

  describe('calendar audit: forced colors and shadow token', () => {
    it('keeps the pressed view mode visible under forced colors; draws the drag shadow from the shadow token, not hardcoded black', () => {
      {
        // keeps the pressed view mode visible under forced colors
        const css = sourceOf('../src/calendar/CalendarView.svelte');
        expect(css).toMatch(
          /@media \(forced-colors: active\) \{[^@]*aria-pressed="true"[^@]*Highlight[^@]*\}/
        );
      }
      cleanup();
      {
        // draws the drag shadow from the shadow token, not hardcoded black
        const css = sourceOf('../src/calendar/EventButton.svelte');
        expect(css).not.toMatch(/rgb\(0 0 0/);
        expect(css).toMatch(/box-shadow:\s*var\(--tx-shadow-float/);
      }
    });
  });

  describe('calendar audit: regression guard', () => {
    it('keeps the default view-mode group name stable', async () => {
      render(CalendarView, {
        props: { events, anchor: '2026-04-15', today: '2026-04-15' },
      });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Design review/ })).toBeTruthy()
      );
      expect(screen.getByRole('group', { name: 'Calendar view' })).toBeTruthy();
      // The mode buttons still switch views.
      await fireEvent.click(screen.getByRole('button', { name: 'Month' }));
      await waitFor(() => expect(screen.getByRole('grid', { name: /April 2026/ })).toBeTruthy());
    });
  });
});
