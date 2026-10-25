// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarSeries } from '../src/engines/calendar/index.ts';
import Harness from './fixtures/CalendarRescheduleHarness.svelte';

/*
 * FIX-calendar-initial-scroll: the week and day time grids open just above
 * the "now" line when today is in range, else at `scrollToHour` (default 8).
 * happy-dom has no layout, so the 24-hour grid is given a 2880 px height
 * (2 px a minute) and the scroll call is recorded.
 */

const events: CalendarSeries<{ title: string }>[] = [
  {
    id: 'review',
    start: '2026-04-15T13:00:00Z',
    end: '2026-04-15T14:00:00Z',
    data: { title: 'Design review' },
  },
];

let scrolls: { top?: number; behavior?: string }[] = [];
const nativeScrollTo = Element.prototype.scrollTo;

beforeEach(() => {
  scrolls = [];
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(2880);
  Element.prototype.scrollTo = function scrollTo(this: Element, options?: unknown) {
    if (this.matches('[data-time-scroller]')) scrolls.push(options as (typeof scrolls)[number]);
  } as Element['scrollTo'];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Element.prototype.scrollTo = nativeScrollTo;
});

const scroller = () => document.querySelector<HTMLElement>('[data-time-scroller]');

async function ready(): Promise<void> {
  await waitFor(() => expect(scroller()).toBeTruthy());
}

describe('CalendarView initial scroll', () => {
  it('opens the week an hour above the now line, instantly and without focusing', async () => {
    render(Harness, {
      props: { initial: events, now: '2026-04-15T13:30:00Z', anchor: '2026-04-15' },
    });
    await ready();
    expect(scroller()?.getAttribute('data-open-minute')).toBe(String(12 * 60 + 30));
    expect(scrolls).toEqual([{ top: (12 * 60 + 30) * 2, behavior: 'instant' }]);
    expect(document.activeElement).toBe(document.body);
  });

  it('opens at 8 AM when the now line is out of range or there is no clock', async () => {
    render(Harness, {
      props: { initial: events, now: '2026-05-20T10:00:00Z', anchor: '2026-04-15' },
    });
    await ready();
    expect(document.querySelector('[data-now-line]')).toBeNull();
    expect(scrolls).toEqual([{ top: 8 * 60 * 2, behavior: 'instant' }]);
    cleanup();
    scrolls = [];
    render(Harness, { props: { initial: events, view: 'day' } });
    await ready();
    expect(scrolls).toEqual([{ top: 8 * 60 * 2, behavior: 'instant' }]);
  });

  it('honors scrollToHour, clamped to the day', async () => {
    render(Harness, { props: { initial: events, scrollToHour: 6 } });
    await ready();
    expect(scrolls).toEqual([{ top: 6 * 60 * 2, behavior: 'instant' }]);
    cleanup();
    scrolls = [];
    render(Harness, { props: { initial: events, scrollToHour: 30 } });
    await ready();
    expect(scrolls).toEqual([{ top: 23 * 60 * 2, behavior: 'instant' }]);
  });

  it('opens at the now line in the day view, near midnight clamped to the top', async () => {
    render(Harness, {
      props: { initial: events, view: 'day', now: '2026-04-15T00:20:00Z', anchor: '2026-04-15' },
    });
    await ready();
    expect(scrolls).toEqual([{ top: 0, behavior: 'instant' }]);
  });

  it('scrolls only when the grid opens, not when the user moves through weeks', async () => {
    render(Harness, {
      props: { initial: events, now: '2026-04-15T13:30:00Z', anchor: '2026-04-15' },
    });
    await ready();
    await fireEvent.click(screen.getByRole('button', { name: 'Next period' }));
    await waitFor(() => expect(document.querySelector('[data-now-line]')).toBeNull());
    expect(scroller()?.getAttribute('data-open-minute')).toBe(String(8 * 60));
    expect(scrolls).toHaveLength(1);
  });
});
