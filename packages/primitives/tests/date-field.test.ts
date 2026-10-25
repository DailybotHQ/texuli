import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
  DateField,
  dateSegmentOrder,
  dateSegmentSeparator,
  formatDate,
  formatTime,
  parseDate,
  parseTime,
  TimeField,
} from '@texuli/primitives/date-field';
import { afterEach, describe, expect, it } from 'vitest';
import DateFieldHarness from './fixtures/DateFieldHarness.svelte';

afterEach(cleanup);

describe('date field models', () => {
  it('parses canonical dates and rejects impossible calendar dates', () => {
    expect(parseDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseDate('2023-02-29')).toBeNull();
    expect(parseDate('2024-13-01')).toBeNull();
    expect(formatDate({ year: 2000, month: 2, day: 29 })).toBe('2000-02-29');
  });

  it('orders date segments using the requested locale', () => {
    expect(dateSegmentOrder('en-US')).toEqual(['month', 'day', 'year']);
    expect(dateSegmentOrder('en-GB')).toEqual(['day', 'month', 'year']);
    expect(dateSegmentSeparator('de-DE', 'day')).toBe('.');
  });

  it('parses and formats bounded 24-hour time values', () => {
    expect(parseTime('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(parseTime('24:00')).toBeNull();
    expect(formatTime({ hour: 0, minute: 5 })).toBe('00:05');
  });
});

describe('DateField.Root and TimeField.Root', () => {
  it('renders localized named spinbutton segments in a labelled group', () => {
    render(DateField.Root, {
      props: { value: '2024-02-29', locale: 'en-GB', label: 'Start date' },
    });
    expect(screen.getByRole('group', { name: 'Start date' })).toBeTruthy();
    expect(
      screen.getAllByRole('spinbutton').map((input) => input.getAttribute('aria-label'))
    ).toEqual(['Day', 'Month', 'Year']);
  });

  it('updates the bound date when a valid segment changes and rejects invalid dates', async () => {
    render(DateFieldHarness);
    const month = screen.getByRole('spinbutton', { name: 'Month' });
    await fireEvent.input(month, { target: { value: '3' } });
    expect(screen.getByLabelText('Selected date').textContent).toBe('2024-03-29');
    await fireEvent.input(screen.getByRole('spinbutton', { name: 'Day' }), {
      target: { value: '31' },
    });
    await fireEvent.input(month, { target: { value: '4' } });
    expect(screen.getByLabelText('Selected date').textContent).toBe('');
  });

  it('submits canonical date and time values through named hidden controls', async () => {
    render(DateFieldHarness);
    const form = document.createElement('form');
    form.append(...screen.getAllByRole('group'));
    const values = new FormData(form);
    expect(values.get('date')).toBe('2024-02-29');
    expect(values.get('time')).toBe('17:05');
  });

  it('updates a 12-hour time segment and period while retaining canonical 24-hour value', async () => {
    render(DateFieldHarness);
    const hour = screen.getByRole('spinbutton', { name: 'Hour' });
    await fireEvent.input(hour, { target: { value: '6' } });
    expect(screen.getByLabelText('Selected time').textContent).toBe('18:05');
    await fireEvent.change(screen.getByRole('combobox', { name: 'AM or PM' }), {
      target: { value: 'AM' },
    });
    expect(screen.getByLabelText('Selected time').textContent).toBe('06:05');
  });

  it('exposes the compound public API', () => {
    expect(DateField.Root).toBeTruthy();
    expect(TimeField.Root).toBeTruthy();
  });
});
