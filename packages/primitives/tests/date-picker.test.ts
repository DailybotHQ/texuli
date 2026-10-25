import { CalendarDate } from '@internationalized/date';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DATE_PICKER_LABELS,
  inRange,
  orderedRange,
  resolveDatePickerLabels,
  toCalendarDate,
} from '../src/date-picker/index.ts';
import DatePickerHarness from './fixtures/DatePickerHarness.svelte';

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');
const settle = async () => {
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
};
const press = async (key: string, init: KeyboardEventInit = {}) => {
  await fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init });
  await settle();
};

describe('date-picker helpers', () => {
  it('parses canonical dates only', () => {
    expect(toCalendarDate('2026-03-15')?.toString()).toBe('2026-03-15');
    for (const bad of [null, undefined, '', '2026-3-15', '2026-02-30', 'tomorrow', '2026-13-01']) {
      expect(toCalendarDate(bad)).toBeNull();
    }
  });

  it('orders ranges and tests membership inclusively', () => {
    expect(orderedRange('2026-03-12', '2026-03-10')).toEqual({
      start: '2026-03-10',
      end: '2026-03-12',
    });
    expect(orderedRange('2026-03-10', null)).toEqual({ start: '2026-03-10', end: null });
    expect(inRange('2026-03-10', '2026-03-10', '2026-03-12')).toBe(true);
    expect(inRange('2026-03-12', '2026-03-10', '2026-03-12')).toBe(true);
    expect(inRange('2026-03-13', '2026-03-10', '2026-03-12')).toBe(false);
    expect(inRange('2026-03-10', '2026-03-10', null)).toBe(false);
  });

  it('merges string label overrides only', () => {
    const labels = resolveDatePickerLabels({ trigger: 'Elegir fecha', dialog: 3 as never });
    expect(labels.trigger).toBe('Elegir fecha');
    expect(labels.dialog).toBe(DEFAULT_DATE_PICKER_LABELS.dialog);
  });
});

describe('DatePicker (APG date picker dialog)', () => {
  it('names the button with the selected date and opens a named dialog on the selected day', async () => {
    render(DatePickerHarness);
    const trigger = screen.getByRole('button', {
      name: 'Choose date, selected date is Sunday, March 15, 2026',
    });
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Choose date' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const grid = within(dialog).getByRole('grid', { name: 'March 2026' });
    const selectedDay = within(grid).getByRole('button', { name: 'Sunday, March 15, 2026' });
    expect(selectedDay.closest('td')?.getAttribute('aria-selected')).toBe('true');
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Sunday, March 15, 2026')
    );
    expect(within(dialog).getByRole('heading', { name: 'March 2026' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Previous month' })).toBeTruthy();
  });

  it('moves by day with arrows, chooses with Enter, closes and returns focus', async () => {
    render(DatePickerHarness);
    const trigger = screen.getByRole('button', { name: /^Choose date/ });
    await fireEvent.click(trigger);
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Sunday, March 15, 2026')
    );
    await press('ArrowRight');
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Monday, March 16, 2026')
    );
    await fireEvent.click(document.activeElement as HTMLElement);
    await settle();
    expect(state().value).toBe('2026-03-16');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Choose date/ }))
    );
    expect(
      screen.getByRole('button', { name: 'Choose date, selected date is Monday, March 16, 2026' })
    ).toBeTruthy();
  });

  it('keeps the dialog open when closeOnSelect is false', async () => {
    render(DatePickerHarness, { props: { closeOnSelect: false } });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
    const dialog = await screen.findByRole('dialog');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Friday, March 20, 2026' }));
    await settle();
    expect(state().value).toBe('2026-03-20');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closes on Escape without choosing and returns focus to the button', async () => {
    render(DatePickerHarness);
    const trigger = screen.getByRole('button', { name: /^Choose date/ });
    await fireEvent.click(trigger);
    await screen.findByRole('dialog');
    await fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(state().value).toBe('2026-03-15');
    expect(document.activeElement).toBe(trigger);
  });

  it('shows the value in the date field and updates the calendar from it', async () => {
    render(DatePickerHarness);
    const group = screen.getByRole('group', { name: 'Due date' });
    const daySegment = within(group).getByRole('spinbutton', { name: 'Day' }) as HTMLInputElement;
    expect(daySegment.value).toBe('15');
    // Native number inputs step on ArrowUp in browsers (the parity rows cover it); jsdom needs the value.
    await fireEvent.input(daySegment, { target: { value: '16' } });
    await settle();
    expect(state().value).toBe('2026-03-16');
  });

  it('honors bounds and unavailable dates in the calendar', async () => {
    render(DatePickerHarness, {
      props: {
        minValue: '2026-03-10',
        maxValue: '2026-03-25',
        isDateUnavailable: (date: CalendarDate) =>
          date.compare(new CalendarDate(2026, 3, 18)) === 0,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
    const dialog = await screen.findByRole('dialog');
    expect(
      (within(dialog).getByRole('button', { name: 'Monday, March 9, 2026' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (
        within(dialog).getByRole('button', {
          name: 'Wednesday, March 18, 2026',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      (
        within(dialog).getByRole('button', {
          name: 'Thursday, March 26, 2026',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('uses translated labels', async () => {
    render(DatePickerHarness, {
      props: {
        value: null,
        labels: { trigger: 'Elegir fecha', dialog: 'Calendario', previousMonth: 'Mes anterior' },
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Elegir fecha' }));
    const dialog = await screen.findByRole('dialog', { name: 'Calendario' });
    expect(within(dialog).getByRole('button', { name: 'Mes anterior' })).toBeTruthy();
  });
});

describe('DateRangePicker', () => {
  it('picks a start then an end, selects the days between and closes', async () => {
    render(DatePickerHarness, { props: { range: { start: '2026-03-02', end: null } } });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose stay, Monday, March 2/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose stay dates' });
    const grid = within(dialog).getByRole('grid', { name: 'March 2026' });
    expect(grid.getAttribute('aria-multiselectable')).toBe('true');
    await fireEvent.click(within(grid).getByRole('button', { name: 'Tuesday, March 10, 2026' }));
    await settle();
    expect(state().range).toEqual({ start: '2026-03-10', end: null });
    expect(state().rangeOpen).toBe(true);
    // While the end is pending, the range previews to the hovered day.
    await fireEvent.pointerEnter(
      within(grid).getByRole('button', { name: 'Thursday, March 12, 2026' })
    );
    await settle();
    expect(
      within(grid)
        .getByRole('button', { name: 'Wednesday, March 11, 2026' })
        .hasAttribute('data-preview')
    ).toBe(true);
    await fireEvent.click(within(grid).getByRole('button', { name: 'Thursday, March 12, 2026' }));
    await settle();
    expect(state().range).toEqual({ start: '2026-03-10', end: '2026-03-12' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('orders an end picked before the start', async () => {
    render(DatePickerHarness, { props: { range: { start: '2026-03-20', end: null } } });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose stay, Friday, March 20/ }));
    const dialog = await screen.findByRole('dialog');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Friday, March 20, 2026' }));
    await settle();
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Sunday, March 15, 2026' }));
    await settle();
    expect(state().range).toEqual({ start: '2026-03-15', end: '2026-03-20' });
  });

  it('marks every day of a chosen range selected and names the button with it', async () => {
    render(DatePickerHarness, {
      props: { range: { start: '2026-03-10', end: '2026-03-12' }, rangeOpen: true },
    });
    const dialog = await screen.findByRole('dialog');
    const selected = within(dialog)
      .getAllByRole('gridcell')
      .filter((cell) => cell.getAttribute('aria-selected') === 'true')
      .map((cell) => cell.textContent?.trim());
    expect(selected).toEqual(['10', '11', '12']);
    expect(
      within(dialog)
        .getByRole('button', { name: 'Tuesday, March 10, 2026' })
        .hasAttribute('data-range-start')
    ).toBe(true);
    expect(
      within(dialog)
        .getByRole('button', { name: 'Thursday, March 12, 2026' })
        .hasAttribute('data-range-end')
    ).toBe(true);
    expect(
      screen.getByRole('button', {
        name: 'Choose stay, Tuesday, March 10, 2026 – Thursday, March 12, 2026',
      })
    ).toBeTruthy();
  });

  it('edits the ends through start and end date fields in a named group', async () => {
    render(DatePickerHarness, { props: { range: { start: '2026-03-10', end: '2026-03-12' } } });
    const group = screen.getByRole('group', { name: 'Stay' });
    const start = within(group).getByRole('group', { name: 'Start date' });
    const end = within(group).getByRole('group', { name: 'End date' });
    expect((within(start).getByRole('spinbutton', { name: 'Day' }) as HTMLInputElement).value).toBe(
      '10'
    );
    await fireEvent.input(within(end).getByRole('spinbutton', { name: 'Day' }), {
      target: { value: '13' },
    });
    await settle();
    expect(state().range).toEqual({ start: '2026-03-10', end: '2026-03-13' });
  });
});

describe('opening focus (APG date picker dialog)', () => {
  afterEach(() => vi.useRealTimers());
  /** A fixed "today": only Date is faked, timers stay real. */
  const today = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${iso}T12:00:00`));
  };
  const focusedDay = () => document.activeElement?.getAttribute('aria-label');

  it('focuses the selected day', async () => {
    today('2026-04-08');
    render(DatePickerHarness, { props: { value: '2026-03-15' } });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
    await screen.findByRole('dialog', { name: 'Choose date' });
    await waitFor(() => expect(focusedDay()).toBe('Sunday, March 15, 2026'));
  });

  it('focuses today when nothing is selected', async () => {
    today('2026-04-08');
    render(DatePickerHarness, { props: { value: null } });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
    await screen.findByRole('dialog', { name: 'Choose date' });
    await waitFor(() => expect(focusedDay()).toBe('Wednesday, April 8, 2026'));
  });

  it('focuses the first enabled day of the month when today is unavailable', async () => {
    today('2026-04-08');
    render(DatePickerHarness, {
      props: {
        value: null,
        // Today and the first days of April are unavailable.
        isDateUnavailable: (date: CalendarDate) =>
          date.year === 2026 && date.month === 4 && date.day <= 8,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose date' });
    await waitFor(() => expect(focusedDay()).toBe('Thursday, April 9, 2026'));
    // The grid keeps one tab stop, on that day.
    expect(dialog.querySelectorAll('[data-calendar-date][tabindex="0"]')).toHaveLength(1);
  });

  it('focuses the first enabled day after a minimum that excludes today', async () => {
    today('2026-04-08');
    render(DatePickerHarness, { props: { value: null, minValue: '2026-04-20' } });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
    await screen.findByRole('dialog', { name: 'Choose date' });
    await waitFor(() => expect(focusedDay()).toBe('Monday, April 20, 2026'));
  });

  it('focuses the range start, else today', async () => {
    today('2026-04-08');
    render(DatePickerHarness, { props: { range: { start: '2026-03-02', end: '2026-03-06' } } });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose stay, / }));
    await screen.findByRole('dialog', { name: 'Choose stay dates' });
    await waitFor(() => expect(focusedDay()).toBe('Monday, March 2, 2026'));
    cleanup();
    render(DatePickerHarness);
    await fireEvent.click(screen.getByRole('button', { name: 'Choose stay' }));
    await screen.findByRole('dialog', { name: 'Choose stay dates' });
    await waitFor(() => expect(focusedDay()).toBe('Wednesday, April 8, 2026'));
  });
});
