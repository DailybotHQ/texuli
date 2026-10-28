import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CalendarSeries } from '../src/engines/calendar/index.ts';
import type { TimelineItem } from '../src/engines/timeline/schedule.ts';
import { ColumnGrid, columnDropCollision } from '../src/grid-columns/index.ts';
import type { ColumnGridProps } from '../src/grid-columns/props.ts';
import TimelineView from '../src/timeline/TimelineView.svelte';
import CalendarHarness from './fixtures/CalendarRescheduleHarness.svelte';

type Row = { id: string; name: string; owner: string };
const TypedColumnGrid = ColumnGrid as unknown as Component<ColumnGridProps<Row>>;

/*
 * T-migrate-grid-time: one parity test per surface that moved onto
 * @texuli/drag, each failing on the hand-rolled drag it replaced.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pointer = (id: number, x: number, y = 50) => ({
  pointerId: id,
  button: 0,
  isPrimary: true,
  clientX: x,
  clientY: y,
});

describe('grid columns on @texuli/drag', () => {
  it('keeps resizing when capture fails, hearing moves on the document', async () => {
    vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(() => {
      throw new DOMException('No active pointer', 'NotFoundError');
    });
    const { container } = render(TypedColumnGrid, {
      props: {
        rows: [{ id: 'r1', name: 'Fictional deal', owner: 'Ada Park' }],
        columns: [
          { key: 'name', header: 'Deal', type: 'text', width: 200 },
          { key: 'owner', header: 'Owner', type: 'text', width: 140 },
        ],
        getRowId: (row: Row) => row.id,
        caption: 'Deals',
      },
    });
    const widths = () =>
      [...container.querySelectorAll('col')].map((col) =>
        Number(/inline-size:\s*(\d+)px/.exec(col.getAttribute('style') ?? '')?.[1])
      );
    const handle = container.querySelector(
      'th[data-column-key="owner"] .tx-grid-columns__resize'
    ) as HTMLElement;
    await fireEvent.pointerDown(handle, pointer(1, 300));
    await fireEvent.pointerMove(document, pointer(1, 360));
    await fireEvent.pointerUp(document, pointer(1, 360));
    expect(widths()[1]).toBe(200);
    expect(screen.getByText('Owner is 200 pixels wide')).toBeTruthy();
  });

  it('reorders through a collision strategy that wraps dropTarget', () => {
    const droppables = ['a', 'b', 'c'].map((id, index) => ({
      id,
      rect: { x: index * 100, y: 0, width: 100, height: 40 },
    }));
    expect(columnDropCollision()({ pointer: { x: 120, y: 10 }, droppables })).toEqual({
      id: 'b',
      score: 0,
      side: 'before',
    });
    expect(columnDropCollision(true)({ pointer: { x: 120, y: 10 }, droppables })?.side).toBe(
      'after'
    );
    expect(columnDropCollision()({ pointer: { x: 900, y: 10 }, droppables })).toMatchObject({
      id: 'c',
      side: 'after',
    });
  });
});

describe('calendar on @texuli/drag', () => {
  const events: CalendarSeries<{ title: string }>[] = [
    {
      id: 'review',
      start: '2026-04-15T13:00:00Z',
      end: '2026-04-15T14:00:00Z',
      data: { title: 'Design review' },
    },
    {
      id: 'retro',
      start: '2026-04-14T09:00:00Z',
      end: '2026-04-14T10:00:00Z',
      data: { title: 'Sprint retro' },
    },
  ];
  const chip = (key: string) =>
    document.querySelector<HTMLElement>(`[data-calendar-event="${key}"]`) as HTMLElement;

  it('ignores a second pointer while one drag runs', async () => {
    render(CalendarHarness, { props: { initial: events } });
    await waitFor(() => expect(chip('review')).toBeTruthy());
    await fireEvent.pointerDown(chip('review'), pointer(1, 50));
    await fireEvent.pointerDown(chip('retro'), pointer(2, 50));
    await fireEvent.pointerMove(chip('review'), pointer(1, 90));
    expect(chip('review').hasAttribute('data-dragging')).toBe(true);
    expect(chip('retro').hasAttribute('data-dragging')).toBe(false);
    await fireEvent.pointerCancel(chip('review'), pointer(1, 90));
    expect(chip('review').hasAttribute('data-dragging')).toBe(false);
  });
});

describe('timeline on @texuli/drag', () => {
  type Task = TimelineItem & { title: string };
  const tasks: Task[] = [
    { id: 'design', title: 'Design brief', start: '2026-01-05', end: '2026-01-09' },
    { id: 'build', title: 'Build prototype', start: '2026-01-12', end: '2026-01-23' },
  ];

  it('moves the first pressed bar by whole days and ignores a second pointer', async () => {
    const onReschedule = vi.fn(async () => undefined);
    render(TimelineView, {
      props: { tasks, now: new Date('2026-01-15T12:00:00Z'), onReschedule },
    });
    const design = screen.getByRole('button', { name: /Design brief/ });
    const build = screen.getByRole('button', { name: /Build prototype/ });
    // Week zoom: 16 px per day, so 50 px snaps to 3 days.
    await fireEvent.pointerDown(design, pointer(1, 100));
    await fireEvent.pointerDown(build, pointer(2, 100));
    await fireEvent.pointerMove(design, pointer(1, 150));
    await fireEvent.pointerUp(design, pointer(1, 150));
    await waitFor(() => expect(onReschedule).toHaveBeenCalledTimes(1));
    const changes = onReschedule.mock.calls.at(0)?.at(0) as unknown as {
      id: string;
      start: string;
      end: string;
    }[];
    expect(changes.find((change) => change.id === 'design')).toMatchObject({
      start: '2026-01-08',
      end: '2026-01-12',
    });
  });
});
