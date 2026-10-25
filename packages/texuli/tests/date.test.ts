import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { CalendarDate } from '@texuli/primitives/calendar';
import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import {
  Calendar,
  DatePicker,
  DateRangePicker,
  dateCalendarClass,
  dateFieldClass,
  dateRangePresets,
  localToday,
  matchingPreset,
} from '../src/components/date/index.ts';

const settle = async () => {
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
};

describe('date presets', () => {
  it('builds the common ranges relative to today', () => {
    const presets = dateRangePresets('2026-03-15');
    expect(presets.map((preset) => [preset.id, preset.start, preset.end])).toEqual([
      ['today', '2026-03-15', '2026-03-15'],
      ['yesterday', '2026-03-14', '2026-03-14'],
      ['last7', '2026-03-09', '2026-03-15'],
      ['last30', '2026-02-14', '2026-03-15'],
      ['thisMonth', '2026-03-01', '2026-03-15'],
      ['lastMonth', '2026-02-01', '2026-02-28'],
    ]);
    expect(presets.map((preset) => preset.label)).toEqual([
      'Today',
      'Yesterday',
      'Last 7 days',
      'Last 30 days',
      'This month',
      'Last month',
    ]);
  });

  it('crosses year and leap boundaries', () => {
    const january = dateRangePresets('2028-01-03');
    expect(january.find((preset) => preset.id === 'lastMonth')).toMatchObject({
      start: '2027-12-01',
      end: '2027-12-31',
    });
    expect(january.find((preset) => preset.id === 'last7')?.start).toBe('2027-12-28');
    const leap = dateRangePresets('2028-03-10');
    expect(leap.find((preset) => preset.id === 'lastMonth')?.end).toBe('2028-02-29');
  });

  it('translates labels, rejects an invalid today and finds the matching preset', () => {
    const presets = dateRangePresets('2026-03-15', { last7: 'Últimos 7 días' });
    expect(presets[2]?.label).toBe('Últimos 7 días');
    expect(dateRangePresets('2026-02-30')).toEqual([]);
    expect(dateRangePresets('soon')).toEqual([]);
    expect(matchingPreset(presets, '2026-03-09', '2026-03-15')?.id).toBe('last7');
    expect(matchingPreset(presets, '2026-03-09', null)).toBeUndefined();
  });

  it('reports the local day as YYYY-MM-DD', () => {
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('date classes', () => {
  it('maps sizes to classes', () => {
    expect(dateFieldClass()).toBe('tx-date');
    expect(dateFieldClass({ size: 'sm' })).toBe('tx-date tx-date--sm');
    expect(dateCalendarClass({ size: 'sm', class: 'mine' })).toBe(
      'tx-date-calendar tx-date-calendar--sm mine'
    );
  });
});

describe('Calendar', () => {
  it('renders a named, styled calendar and selects a day', async () => {
    const view = render(Calendar, {
      props: { value: '2026-03-12', label: 'Delivery day', size: 'sm' },
    });
    const group = screen.getByRole('group', { name: 'Delivery day' });
    expect(group.className).toContain('tx-date-calendar--sm');
    expect(within(group).getByRole('heading', { name: 'March 2026' })).toBeTruthy();
    const selected = within(group).getByRole('button', { name: 'Thursday, March 12, 2026' });
    expect(selected.hasAttribute('data-selected')).toBe(true);
    await fireEvent.click(within(group).getByRole('button', { name: 'Friday, March 13, 2026' }));
    await settle();
    expect(
      within(group)
        .getByRole('button', { name: 'Friday, March 13, 2026' })
        .hasAttribute('data-selected')
    ).toBe(true);
    view.unmount();
  });

  it('disables days outside the bounds and unavailable days', () => {
    render(Calendar, {
      props: {
        value: '2026-03-12',
        minValue: '2026-03-02',
        maxValue: '2026-03-27',
        isDateUnavailable: (date: CalendarDate) =>
          date.compare(new CalendarDate(2026, 3, 18)) === 0,
      },
    });
    const disabled = (name: string) =>
      (screen.getByRole('button', { name }) as HTMLButtonElement).disabled;
    expect(disabled('Sunday, March 1, 2026')).toBe(true);
    expect(disabled('Wednesday, March 18, 2026')).toBe(true);
    expect(disabled('Saturday, March 28, 2026')).toBe(true);
    expect(disabled('Monday, March 2, 2026')).toBe(false);
  });

  it('shows day numbers in the locale digits, matching the day names', () => {
    render(Calendar, { props: { value: '2026-03-12', locale: 'ar-EG' } });
    const day = screen
      .getAllByRole('button')
      .find((button) => button.hasAttribute('data-selected'));
    expect(day?.textContent?.trim()).toBe('١٢');
    expect(day?.getAttribute('aria-label')).toContain('١٢');
  });
});

describe('DatePicker', () => {
  it('labels the field, describes it and opens the calendar dialog', async () => {
    render(DatePicker, {
      props: { label: 'Due date', value: '2026-03-20', description: 'Shown on the invoice.' },
    });
    const group = screen.getByRole('group', { name: 'Due date' });
    const help = screen.getByText('Shown on the invoice.');
    expect(group.getAttribute('aria-describedby')).toBe(help.id);
    const trigger = screen.getByRole('button', {
      name: 'Choose date, selected date is Friday, March 20, 2026',
    });
    await fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Choose date' });
    expect(dialog.className).toContain('tx-date__panel');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Monday, March 23, 2026' }));
    await settle();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: /Monday, March 23, 2026/ })).toBeTruthy();
  });

  it('marks invalid and disabled states', () => {
    const invalid = render(DatePicker, {
      props: { label: 'Renewal', error: 'Choose a real date.' },
    });
    const root = invalid.container.querySelector('[data-tx-date]') as HTMLElement;
    expect(root.getAttribute('data-invalid')).toBe('true');
    const group = screen.getByRole('group', { name: 'Renewal' });
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(group.getAttribute('aria-describedby')).toBe(screen.getByText('Choose a real date.').id);
    invalid.unmount();
    render(DatePicker, { props: { label: 'Signed on', value: '2026-01-08', disabled: true } });
    expect(
      (screen.getByRole('button', { name: /^Choose date/ }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('marks required fields visibly', () => {
    const view = render(DatePicker, { props: { label: 'Start date', required: true } });
    expect(view.container.querySelector('.tx-date__required')?.textContent).toContain('*');
  });
});

describe('DateRangePicker', () => {
  it('offers presets, marks the matching one and applies a preset', async () => {
    render(DateRangePicker, {
      props: {
        label: 'Report period',
        value: { start: '2026-03-09', end: '2026-03-15' },
        presets: true,
        today: '2026-03-15',
      },
    });
    await fireEvent.click(
      screen.getByRole('button', { name: /^Choose date, selected date is Monday, March 9/ })
    );
    const dialog = await screen.findByRole('dialog');
    const group = within(dialog).getByRole('group', { name: 'Quick ranges' });
    expect(
      within(group).getByRole('button', { name: 'Last 7 days' }).getAttribute('aria-pressed')
    ).toBe('true');
    expect(within(group).getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe(
      'false'
    );
    await fireEvent.click(within(group).getByRole('button', { name: 'Last month' }));
    await settle();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      screen.getByRole('button', {
        name: 'Choose date, selected date is Sunday, February 1, 2026 – Saturday, February 28, 2026',
      })
    ).toBeTruthy();
  });

  it('takes custom presets and translated preset labels', async () => {
    const view = render(DateRangePicker, {
      props: {
        label: 'Trip',
        presets: [{ id: 'spring', label: 'Spring break', start: '2026-03-23', end: '2026-03-27' }],
        labels: { presets: 'Atajos' },
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('group', { name: 'Atajos' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Spring break' })).toBeTruthy();
    view.unmount();
  });

  it('shows no presets unless asked', async () => {
    render(DateRangePicker, { props: { label: 'Stay' } });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('group', { name: 'Quick ranges' })).toBeNull();
  });
});

describe('styled pickers focus the start day on open', () => {
  it('DatePicker focuses the selected day', async () => {
    render(DatePicker, { props: { label: 'Due date', value: '2026-03-20' } });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose date, selected date is/ }));
    await screen.findByRole('dialog', { name: 'Choose date' });
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Friday, March 20, 2026')
    );
  });

  it('DateRangePicker focuses the range start, not the presets before it', async () => {
    render(DateRangePicker, {
      props: {
        label: 'Report period',
        value: { start: '2026-03-09', end: '2026-03-15' },
        presets: true,
        today: '2026-03-15',
      },
    });
    await fireEvent.click(
      screen.getByRole('button', { name: /^Choose date, selected date is Monday, March 9/ })
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('group', { name: 'Quick ranges' })).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Monday, March 9, 2026')
    );
  });
});
