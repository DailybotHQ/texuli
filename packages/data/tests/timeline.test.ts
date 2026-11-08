// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dependency, TimelineItem } from '../src/engines/timeline/schedule.ts';
import {
  axisPixel,
  DAY_WIDTH,
  dateOffset,
  durationLabel,
  formatTimelineTick,
  progressValue,
  timelineAnchor,
  timelineRange,
  ZOOMS,
} from '../src/timeline/model.ts';
import TimelineView from '../src/timeline/TimelineView.svelte';

type DemoTask = TimelineItem & { title: string; progress?: number };

const tasks: DemoTask[] = [
  {
    id: 'design',
    title: 'Design brief',
    start: '2026-01-05',
    end: '2026-01-09',
    progress: 100,
  },
  {
    id: 'build',
    title: 'Build prototype',
    start: '2026-01-12',
    end: '2026-01-23',
    progress: 40,
  },
  {
    id: 'ship',
    title: 'Ship milestone',
    start: '2026-01-26',
    end: '2026-01-26',
    milestone: true,
  },
];

const dependencies: Dependency[] = [
  { from: 'design', to: 'build', type: 'FS' },
  { from: 'build', to: 'ship', type: 'FS' },
];

afterEach(() => {
  cleanup();
});

describe('timeline model helpers', () => {
  it('exposes zoom day widths and pads the visible range; mirrors axis pixels in RTL', () => {
    {
      // exposes zoom day widths and pads the visible range
      expect(ZOOMS).toEqual(['day', 'week', 'month', 'quarter']);
      expect(DAY_WIDTH.week).toBe(16);
      const range = timelineRange(
        [
          { id: 'a', start: '2026-01-10', end: '2026-01-12' },
          { id: 'b', start: '2026-01-20', end: '2026-01-22' },
        ],
        '2026-01-15'
      );
      expect(range.start < '2026-01-10').toBe(true);
      expect(range.end > '2026-01-22').toBe(true);
      expect(dateOffset('2026-01-11', '2026-01-10')).toBe(1);
      expect(durationLabel({ id: 'a', start: '2026-01-10', end: '2026-01-10' })).toBe('1 day');
      expect(
        durationLabel({ id: 'm', start: '2026-01-10', end: '2026-01-10', milestone: true })
      ).toBe('Milestone');
      expect(progressValue(150)).toBe(100);
      expect(progressValue(undefined)).toBe(0);
    }
    cleanup();
    // mirrors axis pixels in RTL
    expect(axisPixel(2, 10, 100, 'ltr')).toBe(20);
    expect(axisPixel(2, 10, 100, 'rtl')).toBe(80);
  });
});

describe('TimelineView', () => {
  it('renders tasks, zoom controls, today line and dependency canvas, and 4 related cases', async () => {
    // renders tasks, zoom controls, today line and dependency canvas
    render(TimelineView, {
      props: {
        tasks,
        dependencies,
        now: new Date('2026-01-15T12:00:00Z'),
        label: 'Launch plan',
      },
    });
    expect(screen.getByRole('heading', { name: 'Launch plan' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Timeline zoom' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Design brief/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Build prototype/i })).toBeTruthy();
    expect(document.querySelector('[data-today-line]')).toBeTruthy();
    expect(document.querySelector('svg.dependencies')).toBeTruthy();
    expect(document.querySelectorAll('.task-bar').length).toBe(3);
    cleanup();
    // filters milestones and supports RTL direction
    await (async () => {
      render(TimelineView, {
        props: {
          tasks,
          dependencies,
          now: new Date('2026-01-15T12:00:00Z'),
          direction: 'rtl',
        },
      });
      const root = document.querySelector('[data-timeline]');
      expect(root?.getAttribute('dir')).toBe('rtl');
      expect(root?.getAttribute('data-direction')).toBe('rtl');

      await fireEvent.click(screen.getByRole('button', { name: 'Milestones only' }));
      expect(screen.getByRole('status').textContent).toMatch(/milestone/i);
      expect(document.querySelectorAll('.task-bar.milestone').length).toBe(1);
    })();
    cleanup();
    // reschedules with the keyboard and cascades dependents
    await (async () => {
      const onReschedule = vi.fn(async () => undefined);
      render(TimelineView, {
        props: {
          tasks,
          dependencies,
          now: new Date('2026-01-15T12:00:00Z'),
          onReschedule,
        },
      });
      const design = screen.getByRole('button', {
        name: /Design brief/i,
      });
      design.focus();
      await fireEvent.keyDown(design, { key: ' ' });
      await fireEvent.keyDown(design, { key: 'ArrowRight' });
      await fireEvent.keyDown(design, { key: 'Enter' });
      await waitFor(() => expect(onReschedule).toHaveBeenCalled());
      const payload = onReschedule.mock.calls.at(0)?.at(0);
      expect(Array.isArray(payload)).toBe(true);
      const changes = payload as unknown as { id: string; start: string; end: string }[];
      expect(changes.some((c) => c.id === 'design')).toBe(true);
      // FS cascade should push the successor when the predecessor moves later.
      expect(changes.some((c) => c.id === 'build')).toBe(true);
    })();
    cleanup();
    {
      // lists undated rows in the unscheduled tray
      const withBacklog: DemoTask[] = [...tasks, { id: 'later', title: 'Backlog idea' }];
      render(TimelineView, {
        props: {
          tasks: withBacklog,
          dependencies,
          now: new Date('2026-01-15T12:00:00Z'),
        },
      });
      expect(screen.getByLabelText('Unscheduled tasks')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Backlog idea' })).toBeTruthy();
    }
    cleanup();
    {
      // announces task bars with full month names in the locale
      const june: DemoTask[] = [
        {
          id: 'dock',
          title: 'Dock renewal',
          start: '2026-06-02',
          end: '2026-06-02',
          milestone: true,
        },
      ];
      render(TimelineView, {
        props: {
          tasks: june,
          now: new Date('2026-06-01T12:00:00Z'),
          zoom: 'month',
          locale: 'en',
        },
      });
      const bar = screen.getByRole('button', {
        name: /Dock renewal, June 2, 2026 to June 2, 2026, milestone/,
      });
      expect(bar.getAttribute('aria-label')).toMatch(/June 2, 2026/);
      expect(bar.getAttribute('aria-label')).not.toMatch(/\bJun\b/);

      cleanup();
      render(TimelineView, {
        props: {
          tasks: june,
          now: new Date('2026-06-01T12:00:00Z'),
          zoom: 'month',
          locale: 'es',
        },
      });
      const esBar = screen.getByRole('button', { name: /Dock renewal/ });
      // Spanish long month for June is "junio".
      expect(esBar.getAttribute('aria-label')?.toLowerCase()).toMatch(/junio/);
    }
  });
});

describe('TimelineView product features (D-G-033)', () => {
  type GroupedTask = DemoTask & { team: string };
  const grouped: GroupedTask[] = [
    { ...(tasks[0] as DemoTask), team: 'Discovery' },
    { ...(tasks[1] as DemoTask), team: 'Delivery' },
    { ...(tasks[2] as DemoTask), team: 'Delivery' },
  ];
  // `render` cannot infer the view's generic, so the accessor takes the base item.
  const getGroup = (task: TimelineItem) =>
    (task as GroupedTask).team === 'Delivery'
      ? {
          id: 'delivery',
          label: 'Delivery',
          band: {
            start: '2026-01-12',
            end: '2026-01-26',
            label: 'Pilot phase',
            tone: 'info' as const,
          },
        }
      : { id: 'discovery', label: 'Discovery' };
  const base = {
    tasks: grouped,
    dependencies,
    now: new Date('2026-01-15T12:00:00Z'),
    label: 'Launch plan',
    getGroup,
  };

  it('draws a group band on its header row with token tones and screen-reader dates', () => {
    render(TimelineView, { props: base });
    const band = document.querySelector('[data-band="delivery"]') as HTMLElement;
    expect(band).toBeTruthy();
    expect(band.getAttribute('data-tone')).toBe('info');
    // week zoom: 16 px a day; the range starts 7 days before the first task (2026-01-05).
    expect(band.style.getPropertyValue('inset-inline-start')).toBe(`${14 * 16}px`);
    expect(band.style.getPropertyValue('inline-size')).toBe(`${15 * 16}px`);
    expect(band.textContent).toContain('Pilot phase: January 12, 2026 to January 26, 2026');
    expect(document.querySelector('[data-band="discovery"]')).toBeNull();
  });

  it('collapses groups through a disclosure button, controlled or not, and offers an add action', async () => {
    const onCollapsedChange = vi.fn();
    const onGroupAdd = vi.fn();
    render(TimelineView, {
      props: {
        ...base,
        onCollapsedChange,
        onGroupAdd,
        labels: { addToGroup: (g: string) => `New task in ${g}` },
      },
    });
    const toggle = screen.getByRole('button', { name: /^Delivery/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const controls = toggle.getAttribute('aria-controls')?.split(' ') ?? [];
    expect(controls.length).toBe(2);
    for (const id of controls)
      expect(document.getElementById(id)?.getAttribute('role')).toBe('row');
    expect(document.querySelectorAll('[data-task-row]').length).toBe(3);

    await fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBeNull();
    expect(onCollapsedChange).toHaveBeenLastCalledWith(['delivery']);
    expect(document.querySelectorAll('[data-task-row]').length).toBe(1);
    expect(document.querySelectorAll('.task-bar').length).toBe(1);
    // The band stays on the collapsed header row.
    expect(document.querySelector('[data-band="delivery"]')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'New task in Discovery' }));
    expect(onGroupAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'discovery', label: 'Discovery' })
    );
    cleanup();

    // Controlled: a collapsed prop starts the group closed; without onGroupAdd there is no add action.
    render(TimelineView, { props: { ...base, collapsed: ['discovery'] } });
    expect(screen.getByRole('button', { name: /^Discovery/ }).getAttribute('aria-expanded')).toBe(
      'false'
    );
    expect(screen.queryByRole('button', { name: /^Add to/ })).toBeNull();
    expect(document.querySelector('[data-task-row="design"]')).toBeNull();
  });

  it('selects a row from the task list or the bar, highlights it and marks it current', async () => {
    const onRowSelect = vi.fn();
    render(TimelineView, { props: { ...base, selectedRow: 'design', onRowSelect } });
    const current = () => [...document.querySelectorAll('[aria-current="true"]')];
    expect(document.querySelector('[data-task-row="design"]')?.getAttribute('aria-current')).toBe(
      'true'
    );
    expect(document.querySelector('[data-bar-row="design"]')?.hasAttribute('data-selected')).toBe(
      true
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Build prototype' }));
    expect(onRowSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'build' }));
    expect(document.querySelector('[data-task-row="design"]')?.hasAttribute('aria-current')).toBe(
      false
    );
    // The row, its select button and its bar all report the selection.
    expect(current().length).toBe(3);
    expect(
      current().every((node) => node.closest('[data-task-row="build"], [data-bar-row="build"]'))
    ).toBe(true);

    await fireEvent.click(screen.getByRole('button', { name: /^Ship milestone, / }));
    expect(onRowSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'ship' }));
    cleanup();

    // Display only: without onRowSelect titles stay text, yet the selection still shows.
    render(TimelineView, { props: { ...base, selectedRow: 'build' } });
    expect(screen.queryByRole('button', { name: 'Build prototype' })).toBeNull();
    expect(document.querySelector('[data-task-row="build"]')?.getAttribute('aria-current')).toBe(
      'true'
    );
  });

  it('draws markers at a date or an instant with accessible text and decorative lines', () => {
    render(TimelineView, {
      props: {
        tasks,
        now: new Date('2026-01-15T12:00:00Z'),
        markers: [
          { at: '2026-01-23', label: 'Review window ends', tone: 'warning' as const },
          { at: new Date('2026-01-20T12:00:00Z'), label: 'Freeze' },
          // Beyond the task range: the axis grows to include it.
          { at: '2026-03-02', label: 'Retro' },
        ],
      },
    });
    const markers = [...document.querySelectorAll<HTMLElement>('[data-timeline-marker]')];
    expect(markers.length).toBe(3);
    const [review, freeze] = markers as [HTMLElement, HTMLElement];
    expect(review.getAttribute('data-tone')).toBe('warning');
    // Range starts 2025-12-29: 25 days to the 23rd, 22.5 to midday on the 20th.
    expect(review.style.getPropertyValue('inset-inline-start')).toBe(`${25 * 16}px`);
    expect(freeze.style.getPropertyValue('inset-inline-start')).toBe(`${22.5 * 16}px`);
    // The line is a CSS border; the visible chip is hidden in favor of the full text.
    expect(review.children.length).toBe(2);
    expect(review.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(review.textContent).toContain('Review window ends, January 23, 2026');
    expect(
      document.querySelector('[data-timeline-marker] ~ [data-today-line], [data-today-line]')
    ).toBeTruthy();
    expect(document.querySelector('.canvas')?.getAttribute('style')).toMatch(
      /inline-size: (\d+)px/
    );
    const width = Number(
      /inline-size: (\d+)px/.exec(
        document.querySelector('.canvas')?.getAttribute('style') ?? ''
      )?.[1]
    );
    expect(width).toBeGreaterThan(63 * 16);
  });
});

describe('TimelineView axis labels and opening date (G-056)', () => {
  it('formats compact day ticks, full wider ticks, and honors formatTick', () => {
    const tick = (zoom: (typeof ZOOMS)[number], monthStart: boolean, locale = 'en') =>
      formatTimelineTick('2026-03-01', { zoom, locale, monthStart });
    expect(tick('day', true)).toBe('Mar 1');
    expect(tick('day', false)).toBe('1');
    expect(tick('week', false)).toBe('March 1, 2026');
    expect(tick('day', true, 'de')).toBe('1. März');
    render(TimelineView, {
      props: { tasks, zoom: 'day' as const, now: new Date('2026-01-15T12:00:00Z') },
    });
    // Range starts 2025-12-29: the month shows on the first tick and on January 1.
    const labels = [...document.querySelectorAll('.date-head span')].map((span) =>
      span.textContent?.trim()
    );
    expect(labels.slice(0, 5)).toEqual(['Dec 29', '30', '31', 'Jan 1', '2']);
    cleanup();
    const formatTick = vi.fn((date: string, { zoom }: { zoom: string }) => `${zoom}:${date}`);
    render(TimelineView, {
      props: { tasks, formatTick, now: new Date('2026-01-15T12:00:00Z') },
    });
    expect(document.querySelector('.date-head span')?.textContent?.trim()).toBe('week:2025-12-29');
    expect(formatTick).toHaveBeenCalledWith('2025-12-29', {
      zoom: 'week',
      locale: 'en',
      monthStart: true,
    });
  });

  it('opens at initialDate, else today within the tasks, else the start; mirrors in RTL', () => {
    const span = [
      { id: 'a', start: '2026-01-05', end: '2026-01-09' },
      { id: 'b', start: '2026-01-20', end: '2026-01-26' },
    ];
    expect(timelineAnchor(span, '2026-01-15')).toBe('2026-01-15');
    expect(timelineAnchor(span, '2026-03-15')).toBeUndefined();
    expect(timelineAnchor(span, '2026-03-15', '2026-01-20')).toBe('2026-01-20');
    expect(timelineAnchor(span, '2026-03-15', new Date('2026-01-21T23:00:00Z'))).toBe('2026-01-21');
    expect(timelineAnchor(span, '2026-01-15', 'not-a-date' as never)).toBe('2026-01-15');

    const scrolls: ScrollToOptions[] = [];
    const native = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function scrollTo(this: Element, options?: unknown) {
      if (this.matches('.canvas-scroll')) scrolls.push(options as ScrollToOptions);
    } as Element['scrollTo'];
    try {
      const open = (props: Record<string, unknown>) => {
        render(TimelineView, { props: { tasks, ...props } });
        const date = document.querySelector('.canvas-scroll')?.getAttribute('data-open-date');
        cleanup();
        return date;
      };
      // Range starts 2025-12-29 at 16 px a day; happy-dom has no viewport width.
      expect(open({ now: new Date('2026-01-15T12:00:00Z') })).toBe('2026-01-15');
      expect(open({ now: new Date('2026-06-01T12:00:00Z') })).toBeNull();
      expect(open({ now: new Date('2026-01-15T12:00:00Z'), initialDate: '2026-01-26' })).toBe(
        '2026-01-26'
      );
      expect(
        open({ now: new Date('2026-01-15T12:00:00Z'), initialDate: '2026-01-26', direction: 'rtl' })
      ).toBe('2026-01-26');
      expect(scrolls).toEqual([
        { left: 17 * 16, behavior: 'instant' },
        { left: 28 * 16, behavior: 'instant' },
        { left: -28 * 16, behavior: 'instant' },
      ]);
    } finally {
      Element.prototype.scrollTo = native;
    }
  });

  it('keeps the opening day as rows arrive and zoom changes, until the reader scrolls; scrollToDate moves it', async () => {
    const scrolls: number[] = [];
    const native = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function scrollTo(this: Element, options?: unknown) {
      if (this.matches('.canvas-scroll')) scrolls.push((options as ScrollToOptions).left ?? 0);
    } as Element['scrollTo'];
    try {
      const now = new Date('2026-03-01T12:00:00Z');
      const late = [{ id: 'late', title: 'Late', start: '2026-01-20', end: '2026-01-26' }];
      const view = render(TimelineView, {
        props: { tasks: late, now, initialDate: '2026-01-22', zoom: 'day' },
      });
      // Rows load later and widen the axis back to 2025-12-29: 2026-01-22 stays in view.
      await view.rerender({ tasks: [...late, ...tasks] });
      // Week zoom (16 px a day) keeps the same day.
      await view.rerender({ zoom: 'week' });
      expect(scrolls).toEqual([
        dateOffset('2026-01-22', timelineRange(late, '2026-03-01').start) * DAY_WIDTH.day,
        24 * DAY_WIDTH.day,
        24 * DAY_WIDTH.week,
      ]);

      // The reader scrolls 160 px (day 10, 2026-01-08): later changes keep that day.
      const scroller = document.querySelector('.canvas-scroll') as HTMLElement;
      scroller.scrollLeft = 160;
      await fireEvent.scroll(scroller);
      await view.rerender({ zoom: 'day' });
      expect(scrolls.at(-1)).toBe(10 * DAY_WIDTH.day);

      view.component.scrollToDate('2026-01-15');
      expect(scrolls.at(-1)).toBe(17 * DAY_WIDTH.day);
      view.component.scrollToDate('not-a-date' as never);
      expect(scrolls).toHaveLength(5);
    } finally {
      Element.prototype.scrollTo = native;
    }
  });
});
