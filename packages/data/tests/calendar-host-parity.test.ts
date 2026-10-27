// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CalendarSeries } from '../src/engines/calendar/index.ts';
import Harness from './fixtures/CalendarRescheduleHarness.svelte';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

interface Details {
  title: string;
  locked?: boolean;
}

const events: CalendarSeries<Details>[] = [
  {
    id: 'review',
    start: '2026-04-15T13:00:00Z',
    end: '2026-04-15T14:00:00Z',
    data: { title: 'Design review' },
  },
  {
    id: 'audit',
    start: '2026-04-14T09:00:00Z',
    end: '2026-04-14T10:00:00Z',
    data: { title: 'Vendor audit', locked: true },
  },
  {
    id: 'offsite',
    start: '2026-04-16',
    end: '2026-04-17',
    allDay: true,
    data: { title: 'Team offsite' },
  },
];

const chip = (key: string) =>
  document.querySelector<HTMLElement>(`[data-calendar-event="${key}"]`) as HTMLElement;
const slot = () => document.querySelector<HTMLElement>('[data-slot][data-focused]');
const announcer = () => document.querySelector('[data-calendar-announcer]')?.textContent ?? '';
const columnOf = (element: Element | null) =>
  element?.closest('[data-day-column]')?.getAttribute('data-day-column');
const heading = () => screen.getByRole('heading', { level: 2 }).textContent;

async function ready(): Promise<void> {
  await waitFor(() => expect(chip('review')).toBeTruthy());
}

describe('CalendarView parity: creating events', () => {
  it('creates a timed event from the focused empty slot, by keyboard, and 3 related cases', async () => {
    // creates a timed event from the focused empty slot, by keyboard
    await (async () => {
      const onCreate = vi.fn();
      render(Harness, { props: { initial: events, onCreate } });
      await ready();
      const first = slot() as HTMLElement;
      expect(first.getAttribute('data-slot')).toBe('2026-04-15');
      expect(first.getAttribute('aria-label')).toMatch(
        /^Empty slot, Wednesday, April 15, 2026, 9:00\sAM\. Enter adds an event$/
      );
      first.focus();
      await fireEvent.keyDown(first, { key: 'ArrowDown' });
      await fireEvent.keyDown(slot() as HTMLElement, { key: 'ArrowRight' });
      await waitFor(() => expect(slot()?.getAttribute('data-slot')).toBe('2026-04-16'));
      expect(document.activeElement).toBe(slot());
      expect(slot()?.getAttribute('data-minute')).toBe(String(9 * 60 + 15));
      await fireEvent.click(slot() as HTMLElement);
      expect(onCreate).toHaveBeenCalledWith({
        date: '2026-04-16',
        start: '2026-04-16T09:15:00.000Z',
        end: '2026-04-16T10:15:00.000Z',
        allDay: false,
      });
    })();
    cleanup();
    vi.restoreAllMocks();
    // creates from a click on an empty part of a day column and all-day from a date
    await (async () => {
      const onCreate = vi.fn();
      render(Harness, { props: { initial: events, onCreate } });
      await ready();
      const column = document.querySelector<HTMLElement>(
        '[data-day-column="2026-04-14"]'
      ) as HTMLElement;
      vi.spyOn(column, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 100,
        height: 1440,
        right: 100,
        bottom: 1440,
        toJSON: () => ({}),
      });
      await fireEvent.click(column, { clientY: 614 });
      expect(onCreate).toHaveBeenLastCalledWith({
        date: '2026-04-14',
        start: '2026-04-14T10:00:00.000Z',
        end: '2026-04-14T11:00:00.000Z',
        allDay: false,
      });
      // Clicking an event opens it; it never creates.
      await fireEvent.click(chip('audit'));
      expect(onCreate).toHaveBeenCalledTimes(1);

      const date = document.querySelector<HTMLElement>(
        '[data-calendar-date="2026-04-17"]'
      ) as HTMLElement;
      expect(date.getAttribute('aria-label')).toMatch(/Enter adds an all-day event$/);
      await fireEvent.click(date);
      expect(onCreate).toHaveBeenLastCalledWith({
        date: '2026-04-17',
        start: '2026-04-17',
        end: '2026-04-18',
        allDay: true,
      });
    })();
    cleanup();
    vi.restoreAllMocks();
    // creates all-day events from month dates
    await (async () => {
      const onCreate = vi.fn();
      render(Harness, { props: { initial: events, onCreate, view: 'month' } });
      await ready();
      const date = document.querySelector<HTMLElement>(
        '[data-calendar-date="2026-04-20"]'
      ) as HTMLElement;
      expect(date.getAttribute('data-slot')).toBe('2026-04-20');
      await fireEvent.click(date);
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ start: '2026-04-20', allDay: true })
      );
    })();
    cleanup();
    vi.restoreAllMocks();
    // offers no slot and no create when onCreate is missing or the calendar is read-only
    await (async () => {
      const onCreate = vi.fn();
      render(Harness, { props: { initial: events, onCreate, readOnly: true } });
      await ready();
      expect(slot()).toBeNull();
      expect(document.querySelector('[data-slot]')).toBeNull();
      const date = document.querySelector<HTMLElement>(
        '[data-calendar-date="2026-04-17"]'
      ) as HTMLElement;
      expect(date.getAttribute('aria-label')).not.toMatch(/adds/);
      await fireEvent.click(date);
      expect(onCreate).not.toHaveBeenCalled();
    })();
  });
});

describe('CalendarView parity: the now line', () => {
  it('draws now from the injected clock on its date only, and follows Today, and 2 related cases', async () => {
    // draws now from the injected clock on its date only, and follows Today
    await (async () => {
      render(Harness, {
        props: { initial: events, now: '2026-04-15T13:30:00Z', anchor: '2026-04-15' },
      });
      await ready();
      const line = document.querySelector<HTMLElement>('[data-now-line]');
      expect(columnOf(line)).toBe('2026-04-15');
      expect(line?.getAttribute('style')).toContain('inset-block-start: 40.5rem');
      expect(line?.getAttribute('aria-hidden')).toBe('true');
      expect(document.querySelectorAll('[data-now-line]')).toHaveLength(1);
      await fireEvent.click(screen.getByRole('button', { name: 'Next period' }));
      await waitFor(() => expect(document.querySelector('[data-now-line]')).toBeNull());
      await fireEvent.click(screen.getByRole('button', { name: 'Today' }));
      await waitFor(() => expect(document.querySelector('[data-now-line]')).toBeTruthy());
    })();
    cleanup();
    vi.restoreAllMocks();
    // sets today from the clock and moves the line when the clock moves
    await (async () => {
      const view = render(Harness, {
        props: { initial: events, now: '2026-04-15T13:30:00Z', anchor: '2026-04-15' },
      });
      await ready();
      await view.rerender({ initial: events, now: '2026-04-16T08:00:00Z', anchor: '2026-04-15' });
      await waitFor(() =>
        expect(columnOf(document.querySelector('[data-now-line]'))).toBe('2026-04-16')
      );
    })();
    cleanup();
    vi.restoreAllMocks();
    // draws no line without a clock or outside the visible range
    await (async () => {
      render(Harness, { props: { initial: events } });
      await ready();
      expect(document.querySelector('[data-now-line]')).toBeNull();
      cleanup();
      render(Harness, {
        props: { initial: events, now: '2026-05-20T10:00:00Z', anchor: '2026-04-15' },
      });
      await ready();
      expect(document.querySelector('[data-now-line]')).toBeNull();
    })();
  });
});

describe('CalendarView parity: Space to grab', () => {
  it('picks an event up with Space, moves it with arrows and drops it with Enter, and 3 related cases', async () => {
    // picks an event up with Space, moves it with arrows and drops it with Enter
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange } });
      await ready();
      chip('review').focus();
      await fireEvent.keyDown(chip('review'), { key: ' ' });
      expect(chip('review').getAttribute('aria-pressed')).toBe('true');
      await waitFor(() => expect(announcer()).toMatch(/^Picked up Design review\./));
      await fireEvent.keyDown(chip('review'), { key: 'ArrowRight' });
      await waitFor(() => expect(columnOf(chip('review'))).toBe('2026-04-16'));
      await waitFor(() => expect(document.activeElement).toBe(chip('review')));
      await fireEvent.keyDown(chip('review'), { key: 'ArrowDown' });
      await waitFor(() =>
        expect(announcer()).toMatch(/^Design review: Thursday, April 16, 2026, 1:15\sPM/)
      );
      expect(onChange).not.toHaveBeenCalled();
      await fireEvent.keyDown(chip('review'), { key: 'Enter' });
      await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
      expect(onChange.mock.calls[0]?.[0]).toMatchObject({
        id: 'review',
        start: '2026-04-16T13:15:00.000Z',
        end: '2026-04-16T14:15:00.000Z',
      });
      await waitFor(() => expect(document.activeElement).toBe(chip('review')));
      expect(chip('review').hasAttribute('aria-pressed')).toBe(false);
    })();
    cleanup();
    vi.restoreAllMocks();
    // drops with Space too, cancels with Escape, and treats a drop in place as a cancel
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange } });
      await ready();
      await fireEvent.keyDown(chip('review'), { key: ' ' });
      await fireEvent.keyDown(chip('review'), { key: 'ArrowLeft' });
      await waitFor(() => expect(columnOf(chip('review'))).toBe('2026-04-14'));
      await fireEvent.keyDown(chip('review'), { key: 'Escape' });
      await waitFor(() => expect(columnOf(chip('review'))).toBe('2026-04-15'));
      await waitFor(() => expect(announcer()).toBe('Move cancelled.'));
      await fireEvent.keyDown(chip('review'), { key: ' ' });
      await fireEvent.keyDown(chip('review'), { key: ' ' });
      await waitFor(() => expect(announcer()).toBe('Move cancelled.'));
      expect(onChange).not.toHaveBeenCalled();
      await fireEvent.keyDown(chip('review'), { key: ' ' });
      await fireEvent.keyDown(chip('review'), { key: 'ArrowUp' });
      await fireEvent.keyDown(chip('review'), { key: ' ' });
      await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
      expect(onChange.mock.calls[0]?.[0]).toMatchObject({ start: '2026-04-15T12:45:00.000Z' });
    })();
    cleanup();
    vi.restoreAllMocks();
    // never grabs a locked event and keeps a grab inside the allowed dates
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange, max: '2026-04-16' } });
      await ready();
      await fireEvent.keyDown(chip('audit'), { key: ' ' });
      expect(chip('audit').hasAttribute('aria-pressed')).toBe(false);
      await fireEvent.keyDown(chip('review'), { key: ' ' });
      await fireEvent.keyDown(chip('review'), { key: 'ArrowRight' });
      await fireEvent.keyDown(chip('review'), { key: 'ArrowRight' });
      await waitFor(() =>
        expect(announcer()).toBe("Design review can't move outside the allowed dates.")
      );
      expect(columnOf(chip('review'))).toBe('2026-04-16');
    })();
    cleanup();
    vi.restoreAllMocks();
    // leaves Space alone on a display-only calendar
    await (async () => {
      render(Harness, { props: { initial: events, move: false } });
      await ready();
      const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      chip('review').dispatchEvent(space);
      expect(space.defaultPrevented).toBe(false);
      expect(chip('review').hasAttribute('aria-pressed')).toBe(false);
    })();
  });
});

describe('CalendarView parity: titles and names', () => {
  it('adds the year to the range title when it is not the current year or spans years, and 2 related cases', async () => {
    // adds the year to the range title when it is not the current year or spans years
    await (async () => {
      render(Harness, { props: { initial: events } });
      await ready();
      expect(heading()).toBe('Apr 12 – Apr 18');
      cleanup();
      render(Harness, { props: { initial: events, today: '2025-11-03' } });
      await ready();
      expect(heading()).toBe('Apr 12 – Apr 18, 2026');
      cleanup();
      render(Harness, { props: { initial: events, anchor: '2026-12-30', today: '2026-12-30' } });
      await waitFor(() => expect(heading()).toBe('Dec 27, 2026 – Jan 2, 2027'));
    })();
    cleanup();
    vi.restoreAllMocks();
    // shows the year in every title with showYear="always", and only when needed with "auto"
    await (async () => {
      const titles = async (showYear?: 'auto' | 'always') => {
        render(Harness, { props: { initial: events, ...(showYear ? { showYear } : {}) } });
        await ready();
        const seen: Record<string, string | null> = {};
        for (const mode of ['Week', 'Month', 'Day', 'Agenda']) {
          await fireEvent.click(screen.getByRole('button', { name: mode }));
          await waitFor(() =>
            expect(document.querySelector('[data-calendar]')?.getAttribute('data-view')).toBe(
              mode.toLowerCase()
            )
          );
          seen[mode] = heading();
        }
        cleanup();
        return seen;
      };
      expect(await titles('always')).toEqual({
        Week: 'Apr 12 – Apr 18, 2026',
        Month: 'April 2026',
        Day: 'Wednesday, April 15, 2026',
        Agenda: 'Apr 15 – Apr 28, 2026',
      });
      const auto = {
        Week: 'Apr 12 – Apr 18',
        Month: 'April 2026',
        Day: 'Wednesday, April 15, 2026',
        Agenda: 'Apr 15 – Apr 28',
      };
      expect(await titles('auto')).toEqual(auto);
      expect(await titles()).toEqual(auto);
    })();
    cleanup();
    vi.restoreAllMocks();
    // names all-day events "Title, All day" first
    await (async () => {
      render(Harness, { props: { initial: events } });
      await ready();
      expect(chip('offsite').getAttribute('aria-label')).toBe(
        'Team offsite, All day, Thursday, April 16, 2026, press Enter to open'
      );
    })();
  });
});
