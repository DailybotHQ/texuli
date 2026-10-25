// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dependency, TimelineItem } from '../src/engines/timeline/schedule.ts';
import {
  axisPixel,
  DAY_WIDTH,
  dateOffset,
  durationLabel,
  progressValue,
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
  it('exposes zoom day widths and pads the visible range', () => {
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
  });

  it('mirrors axis pixels in RTL', () => {
    expect(axisPixel(2, 10, 100, 'ltr')).toBe(20);
    expect(axisPixel(2, 10, 100, 'rtl')).toBe(80);
  });
});

describe('TimelineView', () => {
  it('renders tasks, zoom controls, today line and dependency canvas', () => {
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
  });

  it('filters milestones and supports RTL direction', async () => {
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
  });

  it('reschedules with the keyboard and cascades dependents', async () => {
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
  });

  it('lists undated rows in the unscheduled tray', () => {
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
  });

  it('announces task bars with full month names in the locale', () => {
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
  });
});
