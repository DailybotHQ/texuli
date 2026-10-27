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
  {
    id: 'weekly',
    start: '2026-04-13T15:00:00Z',
    end: '2026-04-13T16:00:00Z',
    rule: { freq: 'weekly', count: 3 },
    data: { title: 'Weekly planning' },
  },
];

const chip = (key: string) =>
  document.querySelector<HTMLElement>(`[data-calendar-event="${key}"]`) as HTMLElement;
/** The first occurrence of a repeating series (keyed `seriesId|occurrenceId`). */
const occurrenceChip = (seriesId: string) =>
  document.querySelector<HTMLElement>(`[data-calendar-event^="${seriesId}|"]`) as HTMLElement;
const announcer = () => document.querySelector('[data-calendar-announcer]')?.textContent ?? '';

async function ready(): Promise<void> {
  await waitFor(() => expect(chip('review')).toBeTruthy());
}

/** happy-dom has no layout: give day columns (or month cells and rows) a size. */
function layout(view: 'week' | 'month'): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const size =
      view === 'week'
        ? this.hasAttribute('data-day-column')
          ? { width: 100, height: 1440 }
          : this.hasAttribute('data-allday')
            ? { width: 100, height: 32 }
            : { width: 0, height: 0 }
        : this.getAttribute('role') === 'gridcell'
          ? { width: 100, height: 90 }
          : this.getAttribute('role') === 'row'
            ? { width: 700, height: 90 }
            : { width: 0, height: 0 };
    return {
      ...size,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: size.width,
      bottom: size.height,
      toJSON: () => size,
    };
  });
}

async function drag(element: HTMLElement, dx: number, dy: number): Promise<void> {
  const base = { button: 0, isPrimary: true, pointerId: 1, clientX: 50, clientY: 50 };
  await fireEvent.pointerDown(element, base);
  await fireEvent.pointerMove(element, { ...base, clientX: 50 + dx / 2, clientY: 50 + dy / 2 });
  await fireEvent.pointerMove(element, { ...base, clientX: 50 + dx, clientY: 50 + dy });
  await fireEvent.pointerUp(element, { ...base, clientX: 50 + dx, clientY: 50 + dy });
  await fireEvent.click(element);
}

describe('CalendarView rescheduling: names and keys', () => {
  it('names every event chip with its title, date, time and how to open it, and 2 related cases', async () => {
    // names every event chip with its title, date, time and how to open it
    await (async () => {
      render(Harness, { props: { initial: events } });
      await ready();
      const named = (name: RegExp | string) => screen.getByRole('button', { name });
      expect(
        named(
          /^Design review, Wednesday, April 15, 2026, 1:00\sPM – 2:00\sPM, press Enter to open$/
        )
      ).toBe(chip('review'));
      expect(named('Team offsite, All day, Thursday, April 16, 2026, press Enter to open')).toBe(
        chip('offsite')
      );
      expect(
        named(/^Weekly planning, recurring, Monday, April 13, 2026, .+, press Enter to open$/)
      ).toBe(occurrenceChip('weekly'));
      // Movable chips point at the move hint; the locked one does not.
      const hint = document.getElementById(chip('review').getAttribute('aria-describedby') ?? '');
      expect(hint?.textContent).toMatch(
        /^Space picks this event up.*Alt or Control plus arrow keys move it directly/
      );
      expect(chip('audit').hasAttribute('aria-describedby')).toBe(false);
    })();
    cleanup();
    vi.restoreAllMocks();
    // marks each chip with its tone and scrolls headings with the grid
    // Audit P1-16: tones were utility classes that rendered nothing without that
    // utility CSS; day headings and the grid now share one horizontal scroller.
    await (async () => {
      render(Harness, { props: { initial: events } });
      await ready();
      expect(chip('review').dataset.tone).toBe('primary');
      expect(chip('review').className).not.toMatch(/\bbg-|border-l-/);
      const view = document.querySelector('[data-time-view]');
      expect(view?.querySelector('.tx-calendar__time-header')).toBeTruthy();
      expect(view?.querySelector('[data-time-scroller]')).toBeTruthy();
    })();
    cleanup();
    vi.restoreAllMocks();
    // is read-only without onChange or with readOnly
    await (async () => {
      render(Harness, { props: { initial: events, readOnly: true } });
      await ready();
      expect(chip('review').hasAttribute('data-movable')).toBe(false);
      expect(chip('review').hasAttribute('aria-describedby')).toBe(false);
    })();
  });
});

describe('CalendarView rescheduling: keyboard', () => {
  it('moves a focused event by a day with Ctrl+Arrow, announces it and keeps focus on it, and 3 related cases', async () => {
    // moves a focused event by a day with Ctrl+Arrow, announces it and keeps focus on it
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange } });
      await ready();
      chip('review').focus();
      await fireEvent.keyDown(chip('review'), { key: 'ArrowRight', ctrlKey: true });
      await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
      expect(onChange.mock.calls[0]?.[0]).toMatchObject({
        id: 'review',
        occurrenceId: '2026-04-15T13:00:00Z',
        start: '2026-04-16T13:00:00.000Z',
        end: '2026-04-16T14:00:00.000Z',
        allDay: false,
        recurring: false,
      });
      await waitFor(() =>
        expect(announcer()).toMatch(/^Design review moved to Thursday, April 16, 2026, 1:00\sPM/)
      );
      // Same key after the move, and focus followed the chip.
      await waitFor(() => expect(document.activeElement).toBe(chip('review')));
      expect(chip('review').closest('[data-day-column]')?.getAttribute('data-day-column')).toBe(
        '2026-04-16'
      );
    })();
    cleanup();
    vi.restoreAllMocks();
    // moves by a slot with Ctrl+Up/Down in the time grid and by a week in the month
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange } });
      await ready();
      await fireEvent.keyDown(chip('review'), { key: 'ArrowDown', ctrlKey: true });
      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
      expect(onChange.mock.calls[0]?.[0]).toMatchObject({ start: '2026-04-15T13:15:00.000Z' });

      await fireEvent.click(screen.getByRole('button', { name: 'Month' }));
      await waitFor(() => expect(document.querySelector('[data-month-grid]')).toBeTruthy());
      await fireEvent.keyDown(chip('review'), { key: 'ArrowDown', ctrlKey: true });
      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
      expect(onChange.mock.calls[1]?.[0]).toMatchObject({
        start: '2026-04-22T13:15:00.000Z',
        end: '2026-04-22T14:15:00.000Z',
      });
    })();
    cleanup();
    vi.restoreAllMocks();
    // moves one occurrence of a repeating event with its own occurrence id
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange, apply: false } });
      await ready();
      await fireEvent.keyDown(occurrenceChip('weekly'), {
        key: 'ArrowRight',
        ctrlKey: true,
      });
      await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
      expect(onChange.mock.calls[0]?.[0]).toMatchObject({
        id: 'weekly',
        occurrenceId: '2026-04-13T15:00:00.000Z',
        recurring: true,
        start: '2026-04-14T15:00:00.000Z',
      });
    })();
    cleanup();
    vi.restoreAllMocks();
    // respects locked events and the min / max dates
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange, max: '2026-04-15' } });
      await ready();
      await fireEvent.keyDown(chip('audit'), { key: 'ArrowRight', ctrlKey: true });
      await waitFor(() => expect(announcer()).toBe("Vendor audit can't be moved."));
      await fireEvent.keyDown(chip('review'), { key: 'ArrowRight', ctrlKey: true });
      await waitFor(() =>
        expect(announcer()).toBe("Design review can't move outside the allowed dates.")
      );
      expect(onChange).not.toHaveBeenCalled();
      // Plain arrows on an event do nothing to it.
      await fireEvent.keyDown(chip('review'), { key: 'ArrowRight' });
      expect(onChange).not.toHaveBeenCalled();
    })();
  });
});

describe('CalendarView rescheduling: pointer', () => {
  it('drags a timed event to another day and a later slot without opening it, and 3 related cases', async () => {
    // drags a timed event to another day and a later slot without opening it
    await (async () => {
      const onChange = vi.fn();
      const onOpen = vi.fn();
      render(Harness, { props: { initial: events, onChange, onOpen } });
      await ready();
      layout('week');
      await drag(chip('review'), 100, 31);
      await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
      expect(onChange.mock.calls[0]?.[0]).toMatchObject({
        id: 'review',
        start: '2026-04-16T13:30:00.000Z',
        end: '2026-04-16T14:30:00.000Z',
      });
      expect(onOpen).not.toHaveBeenCalled();
      expect(chip('review').hasAttribute('data-dragging')).toBe(false);
      await waitFor(() =>
        expect(announcer()).toMatch(/^Design review moved to Thursday, April 16/)
      );
    })();
    cleanup();
    vi.restoreAllMocks();
    // drags an all-day event by days and a month event by weeks
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange } });
      await ready();
      layout('week');
      await drag(chip('offsite'), -100, 200);
      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
      expect(onChange.mock.calls[0]?.[0]).toMatchObject({ start: '2026-04-15', end: '2026-04-16' });

      await fireEvent.click(screen.getByRole('button', { name: 'Month' }));
      await waitFor(() => expect(document.querySelector('[data-month-grid]')).toBeTruthy());
      vi.restoreAllMocks();
      layout('month');
      await drag(chip('review'), 100, 90);
      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
      expect(onChange.mock.calls[1]?.[0]).toMatchObject({ start: '2026-04-23T13:00:00.000Z' });
    })();
    cleanup();
    vi.restoreAllMocks();
    // treats a press without movement as a click, and never drags a locked event
    await (async () => {
      const onChange = vi.fn();
      const onOpen = vi.fn();
      render(Harness, { props: { initial: events, onChange, onOpen } });
      await ready();
      layout('week');
      await drag(chip('review'), 2, 1);
      await drag(chip('audit'), 100, 0);
      expect(onChange).not.toHaveBeenCalled();
      expect(onOpen).toHaveBeenCalledTimes(2);
    })();
    cleanup();
    vi.restoreAllMocks();
    // cancels a drag with Escape
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange } });
      await ready();
      layout('week');
      const base = { button: 0, isPrimary: true, pointerId: 1, clientX: 50, clientY: 50 };
      await fireEvent.pointerDown(chip('review'), base);
      await fireEvent.pointerMove(chip('review'), { ...base, clientX: 160 });
      expect(chip('review').hasAttribute('data-dragging')).toBe(true);
      await fireEvent.keyDown(chip('review'), { key: 'Escape' });
      expect(chip('review').hasAttribute('data-dragging')).toBe(false);
      await fireEvent.pointerUp(chip('review'), { ...base, clientX: 160 });
      expect(onChange).not.toHaveBeenCalled();
    })();
  });
});

describe('CalendarView rescheduling: Move menu and Alt+Arrow', () => {
  // The first open loads (and transforms) the lazy chunk, which can take a moment.
  const menuReady = () =>
    waitFor(() => expect(document.querySelector('[data-calendar-move-menu-ready]')).toBeTruthy(), {
      timeout: 5000,
    });
  it('moves with Alt+Arrow, the shortcut macOS leaves free, and lists it in aria-keyshortcuts, and 3 related cases', async () => {
    // moves with Alt+Arrow, the shortcut macOS leaves free, and lists it in aria-keyshortcuts
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange } });
      await ready();
      const shortcuts = chip('review').getAttribute('aria-keyshortcuts')?.split(' ') ?? [];
      expect(shortcuts).toEqual(
        expect.arrayContaining([
          'Alt+ArrowLeft',
          'Alt+ArrowDown',
          'Control+ArrowRight',
          'Shift+F10',
        ])
      );
      chip('review').focus();
      await fireEvent.keyDown(chip('review'), { key: 'ArrowRight', altKey: true });
      await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
      expect(onChange.mock.calls[0]?.[0]).toMatchObject({ start: '2026-04-16T13:00:00.000Z' });
      await waitFor(() => expect(document.activeElement).toBe(chip('review')));
      // Alt and Control together is not a move.
      await fireEvent.keyDown(chip('review'), { key: 'ArrowRight', altKey: true, ctrlKey: true });
      expect(onChange).toHaveBeenCalledOnce();
    })();
    cleanup();
    vi.restoreAllMocks();
    // opens a lazy Move menu with Shift+F10 and moves to the chosen destination
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange } });
      await ready();
      expect(document.querySelector('[data-calendar-move-menu-ready]')).toBeNull();
      chip('review').focus();
      await fireEvent.keyDown(chip('review'), { key: 'F10', shiftKey: true });
      await menuReady();
      const menu = await waitFor(() =>
        screen.getByRole('menu', { name: 'Move Design review to…' })
      );
      expect(
        [...menu.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent?.trim())
      ).toEqual([
        '15 minutes earlier',
        '15 minutes later',
        '1 hour earlier',
        '1 hour later',
        'Previous day',
        'Next day',
        'Previous week',
        'Next week',
      ]);
      await fireEvent.click(screen.getByRole('menuitem', { name: '1 hour later' }));
      await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
      expect(onChange.mock.calls[0]?.[0]).toMatchObject({
        id: 'review',
        start: '2026-04-15T14:00:00.000Z',
        end: '2026-04-15T15:00:00.000Z',
      });
      await waitFor(() =>
        expect(announcer()).toMatch(/^Design review moved to Wednesday, April 15, 2026, 2:00\sPM/)
      );
      await waitFor(() => expect(document.activeElement).toBe(chip('review')));
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    })();
    cleanup();
    vi.restoreAllMocks();
    // opens from a right click or the Menu key, disables destinations outside the dates, skips locked events
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange, max: '2026-04-15' } });
      await ready();
      const right = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      chip('review').dispatchEvent(right);
      expect(right.defaultPrevented).toBe(true);
      await menuReady();
      const next = await waitFor(() =>
        screen.getByRole('menuitem', { name: 'Next day, outside the allowed dates' })
      );
      expect(next.getAttribute('aria-disabled')).toBe('true');
      await fireEvent.click(next);
      expect(onChange).not.toHaveBeenCalled();
      await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

      // A locked event keeps the browser's own context menu, and the Menu key announces the lock.
      const locked = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      chip('audit').dispatchEvent(locked);
      expect(locked.defaultPrevented).toBe(false);
      await fireEvent.keyDown(chip('audit'), { key: 'ContextMenu' });
      await waitFor(() => expect(announcer()).toBe("Vendor audit can't be moved."));
      expect(screen.queryByRole('menu')).toBeNull();
    })();
    cleanup();
    vi.restoreAllMocks();
    // offers day and week destinations in the month view
    await (async () => {
      const onChange = vi.fn();
      render(Harness, { props: { initial: events, onChange, view: 'month' } });
      await waitFor(() => expect(chip('review')).toBeTruthy());
      await fireEvent.keyDown(chip('review'), { key: 'F10', shiftKey: true });
      await menuReady();
      await waitFor(() => expect(screen.getAllByRole('menuitem')).toHaveLength(4));
      await fireEvent.click(screen.getByRole('menuitem', { name: 'Next week' }));
      await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
      expect(onChange.mock.calls[0]?.[0]).toMatchObject({ start: '2026-04-22T13:00:00.000Z' });
    })();
  }, 20_000);
});
