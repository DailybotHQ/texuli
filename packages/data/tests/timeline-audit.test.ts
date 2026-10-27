// @vitest-environment happy-dom
// T-62 audit lane: failing-first tests for the timeline fix-now findings.
// Contracts that happy-dom cannot lay out (CSS) are asserted against the
// component source, the same pattern as grid-columns.test.ts.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dependency, TimelineItem } from '../src/engines/timeline/schedule.ts';
import TimelineView from '../src/timeline/TimelineView.svelte';

afterEach(cleanup);

const here = dirname(fileURLToPath(import.meta.url));
// Read the shipped source for CSS contracts (Vite would rewrite a static
// `new URL(..., import.meta.url)` into a dev-server URL, so join paths).
const source = (): string =>
  readFileSync(join(here, '../src/timeline/TimelineView.svelte'), 'utf8');

type DemoTask = TimelineItem & { title: string; progress?: number };

const tasks: DemoTask[] = [
  { id: 'design', title: 'Design brief', start: '2026-01-05', end: '2026-01-09', progress: 100 },
  { id: 'build', title: 'Build prototype', start: '2026-01-12', end: '2026-01-23', progress: 40 },
];

const dependencies: Dependency[] = [{ from: 'design', to: 'build', type: 'FS' }];

const props = {
  props: {
    tasks,
    dependencies,
    now: new Date('2026-01-15T12:00:00Z'),
    label: 'Launch plan',
  },
};

describe('timeline audit: labels contract', () => {
  it('renders toolbar, columns and saving announcements through labels', async () => {
    // A reschedule that stays pending, so the saving announcement is observable.
    let settle: (() => void) | undefined;
    const onReschedule = vi.fn(() => new Promise<void>((resolve) => (settle = resolve)));
    render(TimelineView, {
      props: {
        ...props.props,
        onReschedule,
        labels: {
          milestonesOnly: 'Nur Meilensteine',
          zoomGroup: 'Zeitachse',
          saving: 'Speichern…',
          columns: { task: 'Aufgabe', start: 'Von', end: 'Bis', duration: 'Dauer' },
        },
      },
    });
    expect(screen.getByRole('button', { name: 'Nur Meilensteine' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Zeitachse' })).toBeTruthy();
    expect(screen.getByText('Aufgabe')).toBeTruthy();
    // The saving announcement goes through the same contract.
    const bar = screen.getByRole('button', { name: /Design brief/ });
    bar.focus();
    await fireEvent.keyDown(bar, { key: ' ' });
    await fireEvent.keyDown(bar, { key: 'ArrowRight' });
    await fireEvent.keyDown(bar, { key: 'Enter' });
    const note = document.querySelector('p[aria-live="polite"]');
    await vi.waitFor(() => expect(note?.textContent).toBe('Speichern…'));
    settle?.();
  });

  it('keeps the default English strings byte-stable', () => {
    render(TimelineView, props);
    expect(screen.getByRole('button', { name: 'Milestones only' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Timeline zoom' })).toBeTruthy();
    expect(screen.getByText('Task')).toBeTruthy();
  });
});

describe('timeline audit: localized announcements', () => {
  it('announces keyboard previews with localized dates, not ISO strings', async () => {
    render(TimelineView, { props: { ...props.props, onReschedule: async () => undefined } });
    const bar = screen.getByRole('button', { name: /Design brief/ });
    bar.focus();
    await fireEvent.keyDown(bar, { key: ' ' });
    await fireEvent.keyDown(bar, { key: 'ArrowRight' });
    const note = document.querySelector('p[aria-live="polite"]');
    expect(note?.textContent).toContain('January 6, 2026');
    expect(note?.textContent).not.toContain('2026-01-06');
  });
});

describe('timeline audit: RTL placement contract', () => {
  it('places bars and ticks on logical insets that mirror with the SVG', () => {
    render(TimelineView, { props: { ...props.props, direction: 'rtl' as const } });
    // range.start is 2025-12-29 (7 days before the first task); the week zoom
    // is 16 px per day, so the first task starts 112 logical px in and the
    // canvas spans 40 days = 640 px.
    const bar = screen.getByRole('button', { name: /Design brief/ }) as HTMLElement;
    expect(bar.style.getPropertyValue('inset-inline-start')).toBe('112px');
    expect(bar.style.getPropertyValue('inset-inline-end')).toBe('');
    // The first date tick sits at the inline start (mirrored to the right edge).
    const tick = document.querySelector('.date-head span') as HTMLElement;
    expect(tick.style.getPropertyValue('inset-inline-start')).toBe('0px');
    // The dependency arrow keeps the physical mirror: design ends 11 days in,
    // so its anchor is 640 - 176 - 8 = 456 px from the left, on the bar.
    const path = document.querySelector('svg.dependencies path[marker-end]');
    expect(path?.getAttribute('d')).toMatch(/^M 456 /);
  });
});

describe('timeline audit: honest table semantics', () => {
  it('presents the task list as a table, not a treegrid', () => {
    render(TimelineView, props);
    const table = document.querySelector('[role="table"][aria-label="Launch plan tasks"]');
    expect(table).toBeTruthy();
    expect(document.querySelector('[role="treegrid"]')).toBeNull();
    expect(table?.querySelector('[role="columnheader"]')?.textContent).toBe('Task');
    expect(table?.querySelector('[role="row"] [role="cell"]')).toBeTruthy();
  });
});

describe('timeline audit: token contract', () => {
  it('has no hardcoded hex colors in its styles', () => {
    expect(source()).not.toMatch(/#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{8}\b/);
  });

  it('keeps pressed zoom and toolbar buttons visible under forced colors', () => {
    expect(source()).toMatch(
      /@media \(forced-colors: active\) \{[^@]*aria-pressed='true'[^@]*Highlight[^@]*\}/
    );
  });
});

describe('timeline audit: responsive date columns', () => {
  it('lets the date columns shrink instead of clipping at 360px', () => {
    // The row rule of the task table (not the body pane's column grid).
    const rule = source().match(/\.table-head,\s*\n\s*\.table-row \{([^}]*)\}/)?.[1] ?? '';
    const declaration = rule.match(/grid-template-columns:\s*([^;]+);/)?.[1] ?? '';
    const tracks = declaration.trim().replace(/,\s+/g, ',').split(/\s+/);
    expect(tracks.length).toBe(4);
    const mins = tracks.map((track) => {
      const bounded = track.match(/^minmax\(([\d.]+)rem,(?:([\d.]+)rem|1fr)\)$/);
      return bounded ? Number(bounded[1]) : Number.NaN;
    });
    // Every track shrinks (no fixed rem tracks) and the floor fits 360px.
    expect(mins.every((min) => Number.isFinite(min))).toBe(true);
    expect(mins.reduce((sum, min) => sum + min, 0)).toBeLessThanOrEqual(19);
  });
});
