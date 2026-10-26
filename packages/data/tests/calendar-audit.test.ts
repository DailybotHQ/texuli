// @vitest-environment happy-dom
// T-62 audit lane: failing-first tests for the calendar fix-now findings.
// CSS and markup contracts that happy-dom cannot lay out are asserted against
// the component source (the same source-contract pattern as grid-columns.test.ts).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CalendarView from '../src/calendar/CalendarView.svelte';
import { type CalendarSeries } from '../src/engines/calendar/index.ts';

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
  });
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
  it('keeps the pressed view mode visible under forced colors', () => {
    const css = sourceOf('../src/calendar/CalendarView.svelte');
    expect(css).toMatch(
      /@media \(forced-colors: active\) \{[^@]*aria-pressed="true"[^@]*Highlight[^@]*\}/
    );
  });

  it('draws the drag shadow from the shadow token, not hardcoded black', () => {
    const css = sourceOf('../src/calendar/EventButton.svelte');
    expect(css).not.toMatch(/rgb\(0 0 0/);
    expect(css).toMatch(/box-shadow:\s*var\(--tx-shadow-float/);
  });
});

describe('calendar audit: regression guard', () => {
  it('keeps the default view-mode group name stable', async () => {
    render(CalendarView, {
      props: { events, anchor: '2026-04-15', today: '2026-04-15' },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /Design review/ })).toBeTruthy());
    expect(screen.getByRole('group', { name: 'Calendar view' })).toBeTruthy();
    // The mode buttons still switch views.
    await fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    await waitFor(() => expect(screen.getByRole('grid', { name: /April 2026/ })).toBeTruthy());
  });
});
