import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarDate } from '../src/calendar/index.ts';
import CalendarFixture from './calendar-fixture.svelte';

afterEach(() => cleanup());

const grid = () => screen.getByRole('grid', { name: 'February 2024' });
const dateButton = (day: number) =>
  within(grid()).getByRole('button', { name: new RegExp(`February ${day}, 2024`) });

describe('Calendar', () => {
  it('uses the APG grid roles, localized weekday headers, selected state, and a single tab stop', () => {
    render(CalendarFixture);
    expect(grid()).toBeTruthy();
    expect(within(grid()).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(grid()).getByRole('gridcell', { selected: true }).contains(dateButton(15))).toBe(
      true
    );
    const tabbableDays = within(grid())
      .getAllByRole('button')
      .filter((button) => button.getAttribute('tabindex') === '0');
    expect(tabbableDays).toEqual([dateButton(15)]);
  });

  it('moves by day, skips unavailable dates, moves by week, and supports Home and End', async () => {
    render(CalendarFixture);
    dateButton(15).focus();
    await fireEvent.keyDown(dateButton(15), { key: 'ArrowRight' });
    expect(dateButton(17).getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(dateButton(17));
    await fireEvent.keyDown(dateButton(17), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(dateButton(24));
    await fireEvent.keyDown(dateButton(24), { key: 'Home' });
    expect(document.activeElement).toBe(dateButton(18));
    await fireEvent.keyDown(dateButton(18), { key: 'End' });
    expect(document.activeElement).toBe(dateButton(24));
  });

  it('selects by pointer and emits the chosen CalendarDate', async () => {
    const onValueChange = vi.fn();
    render(CalendarFixture, { props: { onValueChange } });
    await fireEvent.click(dateButton(18));
    expect(screen.getByRole('gridcell', { selected: true }).contains(dateButton(18))).toBe(true);
    expect(onValueChange).toHaveBeenCalledWith(new CalendarDate(2024, 2, 18));
  });

  it('enforces min, max, unavailable dates, and month navigation bounds', async () => {
    render(CalendarFixture);
    expect(dateButton(9).hasAttribute('disabled')).toBe(true);
    expect(dateButton(16).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Previous month' }).hasAttribute('disabled')).toBe(
      true
    );
    await fireEvent.click(dateButton(16));
    expect(screen.getByRole('gridcell', { selected: true }).contains(dateButton(15))).toBe(true);
  });

  it('disables dates above the maximum and prevents navigation beyond the bounded month', () => {
    render(CalendarFixture, { props: { maxValue: new CalendarDate(2024, 2, 20) } });
    expect(dateButton(21).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Next month' }).hasAttribute('disabled')).toBe(true);
  });

  it('uses the requested calendar and locale in the heading and date labels', () => {
    render(CalendarFixture, {
      props: {
        calendar: 'buddhist',
        locale: 'th-TH',
        defaultFocusedValue: new CalendarDate(2024, 2, 15),
      },
    });
    expect(screen.getByRole('grid').getAttribute('aria-label')).toMatch(/2567/);
    expect(
      within(screen.getByRole('grid'))
        .getByRole('button', { name: /15/ })
        .getAttribute('aria-label')
    ).toContain('15');
  });

  it('allows an explicit week start to override the locale', () => {
    render(CalendarFixture, { props: { weekStartsOn: 1 } });
    expect(within(grid()).getAllByRole('columnheader')[0]?.textContent).toBe('Mon');
  });

  it('reverses horizontal arrow navigation in RTL', async () => {
    render(CalendarFixture, { props: { dir: 'rtl' } });
    dateButton(15).focus();
    await fireEvent.keyDown(dateButton(15), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(dateButton(17));
  });
});
