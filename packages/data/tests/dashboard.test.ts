import { createRequire } from 'node:module';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { loadMotionRuntime } from 'texuli/motion';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAnimation } from '../../core/tests/motion-fakes.ts';
import type { DashboardLayout } from '../src/dashboard/index.ts';
import DashboardHarness from './fixtures/DashboardHarness.svelte';

// The Dashboard view (PLAN_010 T-dashboard): widgets paint in reading order,
// move and resize by keyboard (handles, arrows, announced positions), by
// pointer drag through @texuli/drag and by a toolbar (the non-drag
// alternative), follow breakpoints, write the layout back, and glide only
// when motion is allowed.

const widgets = [
  { id: 'b', title: 'Bravo', x: 6, y: 0, w: 6, h: 2 },
  { id: 'a', title: 'Alpha', x: 0, y: 0, w: 6, h: 2 },
  { id: 'c', title: 'Charlie', x: 0, y: 2, w: 6, h: 2 },
];

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await tick();
    await Promise.resolve();
  }
}

const order = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('[data-dashboard-widget]')].map(
    (element) => element.dataset.widgetId
  );
const handle = (root: ParentNode, id: string, kind: 'move' | 'resize' = 'move') =>
  root.querySelector<HTMLButtonElement>(
    `[data-widget-id="${id}"] [data-dashboard-handle="${kind}"]`
  ) as HTMLButtonElement;
const status = (root: ParentNode) => root.querySelector('[role="status"]')?.textContent ?? '';
const place = (layout: DashboardLayout | undefined) =>
  Object.fromEntries((layout ?? []).map((item) => [item.id, [item.x, item.y, item.w, item.h]]));

let started: Element[] = [];
const originalAnimate = HTMLElement.prototype.animate;
beforeAll(async () => {
  expect(await loadMotionRuntime()).not.toBeNull();
});
beforeEach(() => {
  started = [];
  HTMLElement.prototype.animate = function animate(
    this: HTMLElement,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions
  ) {
    started.push(this);
    return new FakeAnimation(
      this,
      (keyframes ?? []) as Keyframe[],
      (typeof options === 'number'
        ? { duration: options }
        : (options ?? {})) as KeyframeAnimationOptions
    ) as unknown as Animation;
  };
});
afterEach(() => {
  cleanup();
  HTMLElement.prototype.animate = originalAnimate;
  vi.restoreAllMocks();
});

describe('Dashboard layout', () => {
  it('paints widgets in reading order with their grid cells, whatever order they were written in', async () => {
    const { container } = render(DashboardHarness, { props: { widgets } });
    await settle();
    expect(order(container)).toEqual(['a', 'b', 'c']);
    const alpha = container.querySelector<HTMLElement>('[data-widget-id="a"]');
    expect(alpha?.style.gridColumn).toBe('1 / span 6');
    expect(alpha?.style.gridRow).toBe('1 / span 2');
    expect(container.querySelector('h3')?.textContent).toBe('Alpha');
    expect(container.querySelector('[data-content="c"]')?.textContent).toBe('Charlie body');
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('Operations');
  });

  it('shows no handles when read-only or locked', async () => {
    const view = render(DashboardHarness, { props: { widgets, editable: false } });
    await settle();
    expect(view.container.querySelectorAll('[data-dashboard-handle]')).toHaveLength(0);
    view.unmount();
    const locked = render(DashboardHarness, {
      props: { widgets: widgets.map((w) => (w.id === 'b' ? { ...w, locked: true } : w)) },
    });
    await settle();
    expect(handle(locked.container, 'b')).toBeNull();
    expect(handle(locked.container, 'a')).not.toBeNull();
  });

  it('reflows onto the breakpoint’s columns (one stacked column on small screens)', async () => {
    const { container } = render(DashboardHarness, { props: { widgets, breakpoint: 'sm' } });
    await settle();
    expect(container.querySelector('section')?.dataset.breakpoint).toBe('sm');
    expect(order(container)).toEqual(['a', 'b', 'c']);
    const rows = [...container.querySelectorAll<HTMLElement>('[data-dashboard-widget]')].map(
      (element) => [element.style.gridColumn, element.style.gridRow]
    );
    expect(rows).toEqual([
      ['1 / span 1', '1 / span 2'],
      ['1 / span 1', '3 / span 2'],
      ['1 / span 1', '5 / span 2'],
    ]);
  });
});

describe('Dashboard keyboard', () => {
  it('picks up, moves with announced positions, and drops into the bound layout', async () => {
    const onLayoutChange = vi.fn();
    const { container } = render(DashboardHarness, {
      props: { widgets, onLayoutChange },
    });
    await settle();
    const alpha = handle(container, 'a');
    expect(alpha.getAttribute('aria-describedby')).toBeTruthy();
    alpha.focus();
    await fireEvent.keyDown(alpha, { key: 'Enter' });
    await settle();
    expect(alpha.getAttribute('aria-pressed')).toBe('true');
    expect(status(container)).toBe('Alpha picked up. Column 1, row 1.');
    await fireEvent.keyDown(alpha, { key: 'ArrowDown' });
    await settle();
    expect(status(container)).toBe('Alpha moved to column 1, row 3.');
    expect(order(container)).toEqual(['c', 'b', 'a']);
    // Focus stays on the handle after the widget's element moved.
    expect(document.activeElement).toBe(handle(container, 'a'));
    await fireEvent.keyDown(handle(container, 'a'), { key: ' ' });
    await settle();
    expect(status(container)).toBe('Alpha dropped at column 1, row 3.');
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    const [layout, detail] = onLayoutChange.mock.calls[0] ?? [];
    expect(detail).toMatchObject({ breakpoint: 'lg', widget: 'a' });
    expect(place(layout)).toEqual({ c: [0, 0, 6, 2], b: [6, 0, 6, 2], a: [0, 2, 6, 2] });
    // Bindable: the dashboard wrote the new design back.
    const bound = container.querySelector('[data-bound-layout]')?.textContent ?? '[]';
    expect(place(JSON.parse(bound))).toEqual(place(layout));
  });

  it('moves a widget down past a wider one below it in one announced step (G122)', async () => {
    const onLayoutChange = vi.fn();
    const report = [
      { id: 'revenue', title: 'Revenue', x: 0, y: 0, w: 8, h: 3 },
      { id: 'signups', title: 'Signups', x: 8, y: 0, w: 4, h: 3 },
      { id: 'funnel', title: 'Funnel', x: 0, y: 3, w: 12, h: 4 },
    ];
    const { container } = render(DashboardHarness, { props: { widgets: report, onLayoutChange } });
    await settle();
    const revenue = handle(container, 'revenue');
    revenue.focus();
    await fireEvent.keyDown(revenue, { key: 'Enter' });
    await fireEvent.keyDown(revenue, { key: 'ArrowDown' });
    await settle();
    expect(status(container)).toBe('Revenue moved to column 1, row 8.');
    await fireEvent.keyDown(handle(container, 'revenue'), { key: 'ArrowDown' });
    await settle();
    expect(status(container)).toBe('Cannot change Revenue: it is already at the edge.');
    await fireEvent.keyDown(handle(container, 'revenue'), { key: 'Enter' });
    await settle();
    const [layout] = onLayoutChange.mock.calls[0] ?? [];
    expect(place(layout)).toEqual({
      signups: [8, 0, 4, 3],
      funnel: [0, 3, 12, 4],
      revenue: [0, 7, 8, 3],
    });
  });

  it('cancels with Escape and restores the widget', async () => {
    const onLayoutChange = vi.fn();
    const { container } = render(DashboardHarness, { props: { widgets, onLayoutChange } });
    await settle();
    const charlie = handle(container, 'c');
    await fireEvent.keyDown(charlie, { key: 'Enter' });
    await fireEvent.keyDown(charlie, { key: 'ArrowRight' });
    await settle();
    expect(status(container)).toBe('Charlie moved to column 2, row 3.');
    await fireEvent.keyDown(handle(container, 'c'), { key: 'Escape' });
    await settle();
    expect(status(container)).toBe(
      'Change cancelled. Charlie is back at column 1, row 3, 6 columns by 2 rows.'
    );
    expect(container.querySelector<HTMLElement>('[data-widget-id="c"]')?.style.gridColumn).toBe(
      '1 / span 6'
    );
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it('flips left and right in right-to-left text and announces refusals at the edge', async () => {
    const { container } = render(DashboardHarness, { props: { widgets, dir: 'rtl' } });
    await settle();
    const bravo = handle(container, 'b');
    await fireEvent.keyDown(bravo, { key: 'Enter' });
    // In RTL, ArrowLeft goes toward the inline end: Bravo already touches it.
    await fireEvent.keyDown(bravo, { key: 'ArrowLeft' });
    await settle();
    expect(status(container)).toBe('Cannot change Bravo: it is already at the edge.');
    await fireEvent.keyDown(handle(container, 'b'), { key: 'ArrowRight' });
    await settle();
    expect(status(container)).toBe('Bravo moved to column 6, row 1.');
  });

  it('resizes from the resize handle with arrows', async () => {
    const onLayoutChange = vi.fn();
    const { container } = render(DashboardHarness, { props: { widgets, onLayoutChange } });
    await settle();
    const resize = handle(container, 'a', 'resize');
    await fireEvent.keyDown(resize, { key: 'Enter' });
    await settle();
    expect(status(container)).toBe('Resizing Alpha: 6 columns by 2 rows.');
    await fireEvent.keyDown(handle(container, 'a', 'resize'), { key: 'ArrowDown' });
    await settle();
    expect(status(container)).toBe('Alpha resized to 6 columns by 3 rows.');
    await fireEvent.keyDown(handle(container, 'a', 'resize'), { key: 'Enter' });
    await settle();
    expect(place(onLayoutChange.mock.calls[0]?.[0])).toEqual({
      a: [0, 0, 6, 3],
      b: [6, 0, 6, 2],
      c: [0, 3, 6, 2],
    });
  });
});

describe('Dashboard pointer', () => {
  function measure(container: HTMLElement): void {
    const grid = container.querySelector('ul') as HTMLElement;
    // happy-dom has no layout: a 1,200 px grid of 12 columns, no gap (100 px per column).
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
      width: 1200,
      height: 400,
      left: 0,
      top: 0,
      right: 1200,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  }

  it('drags a widget by its handle through the drag engine and commits on release', async () => {
    const onLayoutChange = vi.fn();
    const { container } = render(DashboardHarness, { props: { widgets, onLayoutChange } });
    await settle();
    measure(container);
    const root = container.querySelector('section') as HTMLElement;
    await fireEvent.pointerDown(handle(container, 'c'), {
      pointerId: 3,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    await fireEvent.pointerMove(root, { pointerId: 3, clientX: 620, clientY: 10 });
    await settle();
    expect(status(container)).toBe('Charlie picked up. Column 1, row 3.');
    await fireEvent.pointerUp(root, { pointerId: 3, clientX: 620, clientY: 10 });
    await settle();
    expect(place(onLayoutChange.mock.calls[0]?.[0])).toEqual({
      a: [0, 0, 6, 2],
      b: [6, 0, 6, 2],
      c: [6, 2, 6, 2],
    });
    expect(status(container)).toBe('Charlie dropped at column 7, row 3.');
  });

  it('resizes by dragging the corner and cancels with pointercancel', async () => {
    const onLayoutChange = vi.fn();
    const { container } = render(DashboardHarness, { props: { widgets, onLayoutChange } });
    await settle();
    measure(container);
    const root = container.querySelector('section') as HTMLElement;
    await fireEvent.pointerDown(handle(container, 'c', 'resize'), {
      pointerId: 4,
      clientX: 0,
      clientY: 0,
    });
    await fireEvent.pointerMove(root, { pointerId: 4, clientX: 0, clientY: 170 });
    await fireEvent.pointerUp(root, { pointerId: 4, clientX: 0, clientY: 170 });
    await settle();
    // 80 px rows, no gap: 170 px is two more rows.
    expect(place(onLayoutChange.mock.calls[0]?.[0]).c).toEqual([0, 2, 6, 4]);
    await fireEvent.pointerDown(handle(container, 'a'), { pointerId: 5, clientX: 0, clientY: 0 });
    await fireEvent.pointerMove(root, { pointerId: 5, clientX: 700, clientY: 0 });
    await fireEvent.pointerCancel(root, { pointerId: 5 });
    await settle();
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    expect(container.querySelector<HTMLElement>('[data-widget-id="a"]')?.style.gridColumn).toBe(
      '1 / span 6'
    );
  });

  it('a click on the handle opens the arrange toolbar: moving without dragging (WCAG 2.5.7)', async () => {
    const onLayoutChange = vi.fn();
    const { container, getByRole } = render(DashboardHarness, {
      props: { widgets, onLayoutChange },
    });
    await settle();
    const root = container.querySelector('section') as HTMLElement;
    await fireEvent.pointerDown(handle(container, 'c'), { pointerId: 6, clientX: 1, clientY: 1 });
    await fireEvent.pointerUp(root, { pointerId: 6, clientX: 1, clientY: 1 });
    await settle();
    const toolbar = getByRole('group', { name: 'Arrange Charlie' });
    const right = [...toolbar.querySelectorAll('button')].find(
      (b) => b.textContent === 'Move right'
    );
    await fireEvent.click(right as HTMLButtonElement);
    await settle();
    await fireEvent.click(container.querySelector('[data-dashboard-done]') as HTMLButtonElement);
    await settle();
    expect(place(onLayoutChange.mock.calls[0]?.[0]).c).toEqual([1, 2, 6, 2]);
    expect(container.querySelector('[role="group"]')).toBeNull();
  });
});

describe('Dashboard motion', () => {
  /** happy-dom has no layout: a widget's box from its grid cell (100 px columns, 80 px rows). */
  function cellBox(this: HTMLElement): DOMRect {
    const column = Number.parseInt(this.style.gridColumn, 10) || 1;
    const row = Number.parseInt(this.style.gridRow, 10) || 1;
    const left = (column - 1) * 100;
    const top = (row - 1) * 80;
    return {
      left,
      top,
      width: 100,
      height: 80,
      right: left + 100,
      bottom: top + 80,
      x: left,
      y: top,
    } as DOMRect;
  }

  it('glides widgets after a change and is instant under reduced motion and level none', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(cellBox);
    for (const props of [{}, { reducedMotion: true }, { level: 'none' as const }]) {
      started = [];
      const view = render(DashboardHarness, { props: { widgets, ...props } });
      await settle();
      expect(started, 'nothing plays on mount').toHaveLength(0);
      await fireEvent.keyDown(handle(view.container, 'a'), { key: 'Enter' });
      await fireEvent.keyDown(handle(view.container, 'a'), { key: 'ArrowDown' });
      await settle();
      if (Object.keys(props).length === 0) expect(started.length).toBeGreaterThan(0);
      else expect(started, JSON.stringify(props)).toHaveLength(0);
      view.unmount();
    }
  });
});

// axe-core comes with the root's @axe-core/playwright; resolve it from there.
const req = createRequire(import.meta.url);
type AxeResult = { violations: { id: string; nodes: { target: string[] }[] }[] };
const axe = req(createRequire(req.resolve('@axe-core/playwright')).resolve('axe-core')) as {
  run(context: Element, options: unknown): Promise<AxeResult>;
};

describe('Dashboard widget scroll region (axe scrollable-region-focusable)', () => {
  /** Content boxes of 100px; the widget whose id is in `tall` holds 400px of content. */
  function sizeContent(tall: Set<string>): void {
    const own = (node: HTMLElement) =>
      node.classList.contains('tx-dashboard__content') ? node : null;
    const id = (node: HTMLElement) =>
      node.closest<HTMLElement>('[data-dashboard-widget]')?.dataset.widgetId ?? '';
    for (const key of ['clientHeight', 'clientWidth', 'scrollWidth'] as const) {
      const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)?.get;
      vi.spyOn(HTMLElement.prototype, key, 'get').mockImplementation(function (this: Element) {
        return own(this as HTMLElement) ? 100 : (original?.call(this) ?? 0);
      });
    }
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')?.get;
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
      this: Element
    ) {
      const node = own(this as HTMLElement);
      if (!node) return original?.call(this) ?? 0;
      return tall.has(id(node)) ? 400 : 100;
    });
    // Boxes for axe: a content box is 100px square; text in a tall widget sits below it.
    const box = (top: number, height: number) =>
      ({
        top,
        bottom: top + height,
        left: 0,
        right: 100,
        width: 100,
        height,
        x: 0,
        y: top,
      }) as DOMRect;
    const originalBox = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      return own(this) ? box(0, 100) : originalBox.call(this);
    });
    vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
      const start = this.startContainer as Node;
      const element = start instanceof HTMLElement ? start : start.parentElement;
      const below = element ? tall.has(id(element)) : false;
      return [box(below ? 300 : 10, 20)] as unknown as DOMRectList;
    });
  }

  it('makes only an overflowing widget content a named tab stop, and passes axe', async () => {
    sizeContent(new Set(['b']));
    const { container } = render(DashboardHarness, { props: { widgets, editable: false } });
    await settle();
    const content = (id: string) =>
      container.querySelector<HTMLElement>(
        `[data-widget-id="${id}"] .tx-dashboard__content`
      ) as HTMLElement;
    // Inline overflow so axe sees a scroll container whatever the injected CSS.
    for (const id of ['a', 'b', 'c']) {
      content(id).style.overflowX = 'auto';
      content(id).style.overflowY = 'auto';
    }
    const tall = content('b');
    expect(tall.getAttribute('tabindex')).toBe('0');
    expect(tall.getAttribute('role')).toBe('group');
    const titleId = tall.getAttribute('aria-labelledby') as string;
    expect(container.querySelector(`[id="${titleId}"]`)?.textContent).toBe('Bravo');
    for (const id of ['a', 'c']) {
      expect(content(id).hasAttribute('tabindex'), id).toBe(false);
      expect(content(id).hasAttribute('role'), id).toBe(false);
    }
    const result = await axe.run(container, {
      runOnly: {
        type: 'rule',
        values: ['scrollable-region-focusable', 'aria-allowed-attr', 'aria-prohibited-attr'],
      },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
