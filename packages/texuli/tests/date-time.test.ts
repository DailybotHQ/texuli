import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { createRawSnippet, tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Calendar, DatePicker, DateRangePicker, TimeField } from '../src/components/date/index.ts';
import DateFieldHarness from './fixtures/DateFieldHarness.svelte';

// G12 (today, weekStartsOn, range highlight, maxDays, onInvalid) and G13
// (the styled TimeField).

const settle = async () => {
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
};

/**
 * Makes reading the clock throw: `Date.now()` and `new Date()` with no
 * arguments. Dates built from a value (date arithmetic, formatting) still work.
 */
function stubClock(): void {
  const RealDate = Date;
  class NoClock extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) throw new Error('read the clock: new Date()');
      super(...(args as [string]));
    }
    static override now(): number {
      throw new Error('read the clock: Date.now()');
    }
  }
  vi.stubGlobal('Date', NoClock);
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

/** Renders each date component and returns the element holding its grid (opening pickers). */
const surfaces: [string, (props: Record<string, unknown>) => Promise<HTMLElement>][] = [
  [
    'Calendar',
    async (props) => {
      render(Calendar, { props: { label: 'Day', ...props } });
      return screen.getByRole('group', { name: 'Day' });
    },
  ],
  [
    'DatePicker',
    async (props) => {
      render(DatePicker, { props: { label: 'Due', ...props } });
      await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
      await settle();
      return screen.getByRole('dialog');
    },
  ],
  [
    'DateRangePicker',
    async (props) => {
      render(DateRangePicker, { props: { label: 'Period', presets: true, ...props } });
      await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
      await settle();
      return screen.getByRole('dialog');
    },
  ],
];

describe('date', () => {
  describe('today and weekStartsOn (G12)', () => {
    it('marks the given today and starts there without reading the clock', async () => {
      for (const [name, mount] of surfaces) {
        stubClock();
        const host = await mount({ today: '2026-03-18' });
        const today = within(host).getByRole('button', { name: 'Wednesday, March 18, 2026' });
        expect(today.getAttribute('aria-current'), name).toBe('date');
        expect(today.getAttribute('tabindex'), name).toBe('0');
        vi.unstubAllGlobals();
        cleanup();
      }
    });

    it('starts weeks on weekStartsOn, else on the locale week start', async () => {
      for (const [name, mount] of surfaces) {
        const host = await mount({ today: '2026-03-18', weekStartsOn: 3 });
        expect(within(host).getAllByRole('columnheader')[0]?.textContent, name).toBe('Wed');
        cleanup();
        const british = await mount({ today: '2026-03-18', locale: 'en-GB' });
        expect(within(british).getAllByRole('columnheader')[0]?.textContent, name).toBe('Mon');
        cleanup();
      }
    });
  });

  describe('Calendar focused month without a selection (G64)', () => {
    it('opens on defaultFocusedValue and follows a bound focusedValue', async () => {
      const opened = render(Calendar, {
        props: {
          label: 'Day',
          today: '2026-10-28',
          value: null,
          defaultFocusedValue: '2026-03-05',
        },
      });
      expect(opened.container.textContent).toContain('March 2026');
      const day = (iso: string) =>
        opened.container.querySelector(`[data-calendar-date="${iso}"]`) as HTMLElement | null;
      expect(day('2026-03-05')?.getAttribute('tabindex')).toBe('0');
      cleanup();

      const onFocusedValueChange = vi.fn();
      const view = render(Calendar, {
        props: {
          label: 'Day',
          today: '2026-10-28',
          focusedValue: '2026-05-10',
          onFocusedValueChange,
        },
      });
      const at = (iso: string) =>
        view.container.querySelector(`[data-calendar-date="${iso}"]`) as HTMLElement | null;
      expect(at('2026-05-10')?.getAttribute('tabindex')).toBe('0');
      at('2026-05-10')?.focus();
      await fireEvent.keyDown(at('2026-05-10') as HTMLElement, { key: 'ArrowRight' });
      await settle();
      expect(onFocusedValueChange).toHaveBeenLastCalledWith('2026-05-11');
      expect(at('2026-05-11')?.getAttribute('tabindex')).toBe('0');
      // The host moves the calendar to another month.
      await view.rerender({
        label: 'Day',
        today: '2026-10-28',
        focusedValue: '2027-01-15',
        onFocusedValueChange,
      });
      await settle();
      expect(at('2027-01-15')?.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('Calendar range mode (G12)', () => {
    it('highlights the range with start, end and in-range states and aria-selected', () => {
      const view = render(Calendar, {
        props: {
          label: 'Stay',
          today: '2026-03-01',
          range: { start: '2026-03-10', end: '2026-03-12' },
        },
      });
      const grid = screen.getByRole('grid');
      expect(grid.getAttribute('aria-multiselectable')).toBe('true');
      const selected = [
        ...grid.querySelectorAll('[aria-selected="true"] [data-calendar-date]'),
      ].map((day) => day.getAttribute('data-calendar-date'));
      expect(selected).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
      const day = (iso: string) =>
        view.container.querySelector(`[data-calendar-date="${iso}"]`) as HTMLElement;
      expect(day('2026-03-10').hasAttribute('data-range-start')).toBe(true);
      expect(day('2026-03-12').hasAttribute('data-range-end')).toBe(true);
      expect(day('2026-03-11').hasAttribute('data-in-range')).toBe(true);
      expect(day('2026-03-13').hasAttribute('data-in-range')).toBe(false);
      // The range start is the focus start.
      expect(day('2026-03-10').getAttribute('tabindex')).toBe('0');
    });

    it('picks a range in two steps, refusing and announcing one longer than maxDays', async () => {
      const onRangeChange = vi.fn();
      const onInvalid = vi.fn();
      render(Calendar, {
        props: {
          label: 'Stay',
          today: '2026-03-01',
          range: { start: null, end: null },
          maxDays: 5,
          onRangeChange,
          onInvalid,
        },
      });
      const pick = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
      await pick('Monday, March 2, 2026');
      await pick('Monday, March 16, 2026');
      await settle();
      expect(onInvalid).toHaveBeenCalledWith('2026-03-02/2026-03-16', 'too-long', { side: 'end' });
      expect(screen.getByRole('status').textContent).toBe('Choose a range of 5 days or fewer.');
      await pick('Friday, March 6, 2026');
      expect(onRangeChange).toHaveBeenLastCalledWith({ start: '2026-03-02', end: '2026-03-06' });
      expect(screen.getByRole('status').textContent).toBe('');
    });
  });

  describe('maxDays and onInvalid on the pickers (G12)', () => {
    it('DatePicker reports typed text that is not a date or is out of bounds', async () => {
      const onInvalid = vi.fn();
      render(DatePicker, {
        props: { label: 'Due', value: '2026-02-10', maxValue: '2026-06-30', onInvalid },
      });
      const field = screen.getByRole('group', { name: 'Due' });
      await fireEvent.input(within(field).getByRole('spinbutton', { name: 'Day' }), {
        target: { value: '31' },
      });
      await fireEvent.input(within(field).getByRole('spinbutton', { name: 'Month' }), {
        target: { value: '7' },
      });
      expect(onInvalid.mock.calls).toEqual([
        ['2/31/2026', 'invalid'],
        ['7/31/2026', 'out-of-range'],
      ]);
    });

    it('DateRangePicker refuses a typed range longer than maxDays and hides longer presets', async () => {
      const onInvalid = vi.fn();
      const onValueChange = vi.fn();
      render(DateRangePicker, {
        props: {
          label: 'Period',
          value: { start: '2026-03-10', end: '2026-03-12' },
          today: '2026-03-15',
          presets: true,
          maxDays: 7,
          onInvalid,
          onValueChange,
        },
      });
      const end = screen.getByRole('group', { name: 'End date' });
      await fireEvent.input(within(end).getByRole('spinbutton', { name: 'Day' }), {
        target: { value: '25' },
      });
      await settle();
      expect(onInvalid).toHaveBeenCalledWith('2026-03-10/2026-03-25', 'too-long', { side: 'end' });
      expect(onValueChange).not.toHaveBeenCalled();
      await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
      await settle();
      const presets = within(screen.getByRole('group', { name: 'Quick ranges' }))
        .getAllByRole('button')
        .map((button) => button.textContent?.trim());
      expect(presets).toEqual(['Today', 'Yesterday', 'Last 7 days']);
    });
  });
});

describe('DateRangePicker required (G66)', () => {
  it('marks every segment required and the visible label with an asterisk', () => {
    const view = render(DateRangePicker, { props: { label: 'Period', required: true } });
    const segments = within(screen.getByRole('group', { name: 'Period' })).getAllByRole(
      'spinbutton'
    );
    expect(segments).toHaveLength(6);
    for (const segment of segments) expect(segment.hasAttribute('required')).toBe(true);
    expect(view.container.querySelector('.tx-date__required')?.textContent?.trim()).toBe('*');
  });
});

describe('DateRangePicker half range and dialog content (G109)', () => {
  const open = async (props: Record<string, unknown> = {}) => {
    render(DateRangePicker, { props: { label: 'Stay', today: '2026-03-01', ...props } });
    await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
    await settle();
    return screen.getByRole('dialog');
  };

  it('announces politely that the end date is still needed after the first pick', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{}, 'Start date Monday, March 2, 2026. Now choose the end date.'],
      [
        { labels: { pickEnd: (start: string) => `Desde ${start}. Elige el final.` } },
        'Desde Monday, March 2, 2026. Elige el final.',
      ],
    ];
    for (const [props, said] of cases) {
      const dialog = await open(props);
      const status = within(dialog).getByRole('status');
      expect(status.textContent).toBe('');
      await fireEvent.click(within(dialog).getByRole('button', { name: 'Monday, March 2, 2026' }));
      await settle();
      expect(status.textContent).toBe(said);
      // A half range closed with Escape leaves no stale announcement behind.
      await fireEvent.keyDown(dialog, { key: 'Escape' });
      await settle();
      await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
      await settle();
      const again = screen.getByRole('dialog');
      expect(within(again).getByRole('status').textContent).toBe('');
      await fireEvent.click(within(again).getByRole('button', { name: 'Monday, March 2, 2026' }));
      await settle();
      expect(within(again).getByRole('status').textContent).toBe(said);
      // The second pick completes the range and closes the dialog.
      await fireEvent.click(within(again).getByRole('button', { name: 'Friday, March 6, 2026' }));
      await settle();
      expect(screen.queryByRole('dialog')).toBeNull();
      cleanup();
    }
  });

  it('renders the panel and footer snippets inside the modal dialog, with close()', async () => {
    const panel = createRawSnippet(() => ({
      render: () => '<p data-testid="panel">Check-in is after 3 pm.</p>',
    }));
    let close: () => void = () => {};
    let seen: unknown;
    const footer = createRawSnippet((context: () => { value: unknown; close: () => void }) => ({
      render: () => '<p data-testid="footer">Up to 14 nights.</p>',
      setup: () => {
        close = context().close;
        seen = context().value;
      },
    }));
    const dialog = await open({ panel, footer, value: { start: '2026-03-02', end: null } });
    expect(within(dialog).getByTestId('panel').textContent).toBe('Check-in is after 3 pm.');
    expect(within(dialog).getByTestId('footer').textContent).toBe('Up to 14 nights.');
    expect(seen).toEqual({ start: '2026-03-02', end: null });
    close();
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    // Focus goes back to the calendar button, never to the body.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Choose date/ }));
  });
});

describe('date and time controls in a Field (G89, G90)', () => {
  afterEach(cleanup);
  const kinds = ['date', 'range', 'time'] as const;

  it('puts controlClass on the bordered .tx-date__control, not the wrapper', () => {
    for (const kind of ['date', 'range'] as const) {
      const view = render(DateFieldHarness, { props: { kind, controlClass: 'host-control' } });
      const control = view.container.querySelector('.tx-date__control');
      expect(control?.classList.contains('host-control'), kind).toBe(true);
      expect(view.container.querySelector('.tx-date')?.classList.contains('host-control')).toBe(
        false
      );
      cleanup();
    }
  });

  it('shows the invalid state when aria-invalid comes from the Field error', () => {
    for (const kind of kinds) {
      const valid = render(DateFieldHarness, { props: { kind } });
      expect(valid.container.querySelector('.tx-date')?.hasAttribute('data-invalid')).toBe(false);
      cleanup();
      const view = render(DateFieldHarness, { props: { kind, error: 'Pick a date.' } });
      const wrapper = view.container.querySelector('.tx-date');
      expect(wrapper?.getAttribute('data-invalid'), kind).toBe('true');
      for (const segment of view.container.querySelectorAll('[role="spinbutton"]')) {
        expect(segment.getAttribute('aria-invalid')).toBe('true');
      }
      cleanup();
    }
  });
});

describe('time', () => {
  describe('TimeField (G13)', () => {
    it('shows AM/PM only in the 12-hour cycle and keeps a 24-hour HH:mm value', async () => {
      const onValueChange = vi.fn();
      render(TimeField, {
        props: { label: 'Starts', value: '14:05', hourCycle: 12, name: 'starts', onValueChange },
      });
      const group = screen.getByRole('group', { name: 'Starts' });
      expect(
        (within(group).getByRole('spinbutton', { name: 'Hour' }) as HTMLInputElement).value
      ).toBe('2');
      expect(
        (within(group).getByRole('combobox', { name: 'AM or PM' }) as HTMLSelectElement).value
      ).toBe('PM');
      await fireEvent.change(within(group).getByRole('combobox', { name: 'AM or PM' }), {
        target: { value: 'AM' },
      });
      expect(onValueChange).toHaveBeenLastCalledWith('02:05');
      expect((group.querySelector('input[name="starts"]') as HTMLInputElement).value).toBe('02:05');
      cleanup();
      render(TimeField, { props: { label: 'Starts', value: '14:05', hourCycle: 24 } });
      expect(screen.queryByRole('combobox')).toBeNull();
      expect((screen.getByRole('spinbutton', { name: 'Hour' }) as HTMLInputElement).value).toBe(
        '14'
      );
    });

    it('spins the minute by minuteStep with the arrow keys, wrapping', async () => {
      const onValueChange = vi.fn();
      render(TimeField, {
        props: { label: 'Starts', value: '09:40', hourCycle: 24, minuteStep: 15, onValueChange },
      });
      const minute = screen.getByRole('spinbutton', { name: 'Minute' });
      for (const [key, expected] of [
        ['ArrowUp', '09:45'],
        ['ArrowUp', '09:00'],
        ['ArrowDown', '09:45'],
      ] as const) {
        await fireEvent.keyDown(minute, { key });
        expect(onValueChange.mock.calls.at(-1)?.[0], `${key} → ${expected}`).toBe(expected);
      }
    });

    it('describes the field with its help and error text and marks it invalid', () => {
      render(TimeField, {
        props: {
          label: 'Starts',
          description: 'Local time.',
          error: 'Pick a time.',
          labels: { hour: 'Hora', minute: 'Minuto' },
        },
      });
      const group = screen.getByRole('group', { name: 'Starts' });
      expect(group.getAttribute('aria-invalid')).toBe('true');
      const describedBy = group.getAttribute('aria-describedby')?.split(' ') ?? [];
      expect(describedBy.map((id) => document.getElementById(id)?.textContent)).toEqual([
        'Local time.',
        'Pick a time.',
      ]);
      expect(within(group).getByRole('spinbutton', { name: 'Hora' })).toBeTruthy();
      expect(within(group).getByRole('spinbutton', { name: 'Minuto' })).toBeTruthy();
    });
  });
});
