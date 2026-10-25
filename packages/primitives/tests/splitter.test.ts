import { cleanup, fireEvent, render, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  initialLayout,
  isCollapsed,
  layoutForKey,
  loadLayout,
  normalizeLayout,
  type PaneConstraints,
  resizeLayout,
  type SplitterStorage,
  saveLayout,
  toggleCollapse,
} from '../src/splitter/index.ts';
import Fixture from './splitter-fixture.svelte';

afterEach(cleanup);

const nav: PaneConstraints = { defaultSize: 30, minSize: 20, maxSize: 60, collapsible: true };
const main: PaneConstraints = { minSize: 30 };
const panes = [nav, main];

describe('layout model', () => {
  it('starts from defaults, shares the rest, and honours a saved layout of the right length', () => {
    expect(initialLayout(panes)).toEqual([30, 70]);
    const thirds = initialLayout([{}, {}, {}]);
    for (const size of thirds) expect(size).toBeCloseTo(100 / 3, 6);
    expect(thirds.reduce((sum, size) => sum + size, 0)).toBeCloseTo(100, 9);
    expect(initialLayout(panes, [40, 60])).toEqual([40, 60]);
    expect(initialLayout(panes, [40])).toEqual([30, 70]);
    expect(initialLayout(panes, [Number.NaN, 50])).toEqual([30, 70]);
  });

  it('normalizes any layout into the constraints, summing to 100', () => {
    expect(normalizeLayout([90, 10], panes)).toEqual([60, 40]);
    expect(normalizeLayout([5, 5], panes)).toEqual([20, 80]);
    // A collapsed collapsible pane stays collapsed.
    expect(normalizeLayout([0, 100], panes)).toEqual([0, 100]);
  });

  it('moves a handle within both panes’ minimum and maximum', () => {
    expect(resizeLayout([30, 70], 0, 10, panes)).toEqual([40, 60]);
    expect(resizeLayout([30, 70], 0, 50, panes)).toEqual([60, 40]);
    expect(resizeLayout([30, 70], 0, -5, panes)).toEqual([25, 75]);
    // The second pane's minimum stops growth of the first.
    expect(resizeLayout([30, 70], 0, 45, [{ maxSize: 90 }, { minSize: 30 }])).toEqual([70, 30]);
    expect(resizeLayout([30, 70], 1, 10, panes)).toEqual([30, 70]);
    expect(resizeLayout([30, 70], 0, Number.NaN, panes)).toEqual([30, 70]);
  });

  it('collapses past halfway below the minimum, stops at it before, and reopens to at least it', () => {
    expect(resizeLayout([30, 70], 0, -15, panes)).toEqual([20, 80]);
    expect(resizeLayout([30, 70], 0, -25, panes)).toEqual([0, 100]);
    expect(isCollapsed(0, nav)).toBe(true);
    expect(isCollapsed(20, nav)).toBe(false);
    expect(resizeLayout([0, 100], 0, 5, panes)).toEqual([20, 80]);
    expect(resizeLayout([0, 100], 0, 35, panes)).toEqual([35, 65]);
    // Not collapsible: stops at the minimum however far it is pushed.
    expect(resizeLayout([30, 70], 0, -29, [{ minSize: 20 }, {}])).toEqual([20, 80]);
  });

  it('maps keys to moves (APG): arrows along the axis, mirrored in right to left, Home and End', () => {
    const horizontal = { direction: 'horizontal' as const };
    expect(layoutForKey('ArrowRight', [30, 70], 0, panes, horizontal)).toEqual([40, 60]);
    expect(layoutForKey('ArrowLeft', [30, 70], 0, panes, horizontal)).toEqual([20, 80]);
    expect(layoutForKey('ArrowLeft', [30, 70], 0, panes, { ...horizontal, rtl: true })).toEqual([
      40, 60,
    ]);
    expect(layoutForKey('ArrowDown', [30, 70], 0, panes, horizontal)).toBeNull();
    const vertical = { direction: 'vertical' as const, step: 5 };
    expect(layoutForKey('ArrowDown', [30, 70], 0, panes, vertical)).toEqual([35, 65]);
    expect(layoutForKey('ArrowUp', [30, 70], 0, panes, vertical)).toEqual([25, 75]);
    expect(layoutForKey('Home', [40, 60], 0, panes, horizontal)).toEqual([20, 80]);
    expect(layoutForKey('End', [40, 60], 0, panes, horizontal)).toEqual([60, 40]);
    expect(layoutForKey('Tab', [40, 60], 0, panes, horizontal)).toBeNull();
  });

  it('collapses with Enter and restores the previous size', () => {
    const collapsed = toggleCollapse([45, 55], 0, panes);
    expect(collapsed).toEqual({ layout: [0, 100], restoreSize: 45 });
    expect(toggleCollapse(collapsed.layout, 0, panes, collapsed.restoreSize)).toEqual({
      layout: [45, 55],
      restoreSize: undefined,
    });
    // Restoring without a remembered size opens to the minimum.
    expect(toggleCollapse([0, 100], 0, panes).layout).toEqual([20, 80]);
    // A pane that is not collapsible never changes.
    expect(toggleCollapse([30, 70], 1, panes).layout).toEqual([30, 70]);
  });
});

describe('persistence', () => {
  const memory = (): SplitterStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
    };
  };

  it('saves and loads a layout under its id, ignoring bad or missing data', () => {
    const store = memory();
    saveLayout(store, 'mail', [25, 75]);
    expect(store.data.get('texuli-splitter:mail')).toBe('[25,75]');
    expect(loadLayout(store, 'mail')).toEqual([25, 75]);
    store.data.set('texuli-splitter:bad', '{"x":1}');
    expect(loadLayout(store, 'bad')).toBeNull();
    store.data.set('texuli-splitter:broken', 'not json');
    expect(loadLayout(store, 'broken')).toBeNull();
    expect(loadLayout(undefined, 'mail')).toBeNull();
    expect(loadLayout(store, undefined)).toBeNull();
  });

  it('never throws when storage refuses to write', () => {
    const throwing: SplitterStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => saveLayout(throwing, 'mail', [50, 50])).not.toThrow();
  });
});

describe('Splitter components', () => {
  const handleOf = (view: { container: HTMLElement }) =>
    within(view.container).getByRole('separator', { name: 'Resize navigation' });
  const flexOf = (view: { container: HTMLElement }, id: string) =>
    (view.container.querySelector(`#${id}`) as HTMLElement).style.flexGrow;

  it('renders an APG window splitter: a focusable separator with a value range controlling the first pane', async () => {
    const view = render(Fixture);
    await tick();
    const handle = handleOf(view);
    expect(handle.getAttribute('tabindex')).toBe('0');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-valuenow')).toBe('30');
    expect(handle.getAttribute('aria-valuemin')).toBe('0');
    expect(handle.getAttribute('aria-valuemax')).toBe('60');
    expect(handle.getAttribute('aria-controls')).toBe('nav');
    expect(handle.dataset.state).toBe('inactive');
    expect(flexOf(view, 'nav')).toBe('30');
    expect(flexOf(view, 'main')).toBe('70');
    const group = view.getByTestId('group');
    expect(group.style.display).toBe('flex');
    expect(group.style.flexDirection).toBe('row');
  });

  it('is a horizontal separator in a vertical group', async () => {
    const view = render(Fixture, { props: { direction: 'vertical' } });
    await tick();
    expect(handleOf(view).getAttribute('aria-orientation')).toBe('horizontal');
    expect(view.getByTestId('group').style.flexDirection).toBe('column');
  });

  it('resizes with the keyboard and reports each layout', async () => {
    const onLayoutChange = vi.fn();
    const view = render(Fixture, { props: { onLayoutChange } });
    await tick();
    const handle = handleOf(view);
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle.getAttribute('aria-valuenow')).toBe('40');
    expect(flexOf(view, 'nav')).toBe('40');
    await fireEvent.keyDown(handle, { key: 'End' });
    expect(handle.getAttribute('aria-valuenow')).toBe('60');
    await fireEvent.keyDown(handle, { key: 'Home' });
    expect(handle.getAttribute('aria-valuenow')).toBe('20');
    expect(onLayoutChange.mock.calls.at(-1)?.[0]).toEqual([20, 80]);
  });

  it('collapses with Enter (the pane goes inert), restores with Enter, and reports both', async () => {
    const onCollapse = vi.fn();
    const onExpand = vi.fn();
    const view = render(Fixture, { props: { onCollapse, onExpand } });
    await tick();
    const handle = handleOf(view);
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });
    await fireEvent.keyDown(handle, { key: 'Enter' });
    await tick();
    const pane = view.container.querySelector('#nav') as HTMLElement;
    expect(handle.getAttribute('aria-valuenow')).toBe('0');
    expect(pane.dataset.state).toBe('collapsed');
    expect(pane.hasAttribute('inert')).toBe(true);
    expect(onCollapse).toHaveBeenCalledOnce();
    await fireEvent.keyDown(handle, { key: 'Enter' });
    await tick();
    expect(handle.getAttribute('aria-valuenow')).toBe('40');
    expect(pane.dataset.state).toBe('expanded');
    expect(pane.hasAttribute('inert')).toBe(false);
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it('mirrors the arrows in right to left', async () => {
    const view = render(Fixture, { props: { dir: 'rtl' } });
    await tick();
    const handle = handleOf(view);
    // In right to left the first pane is on the right: ArrowLeft moves the handle left, growing it.
    expect(getComputedStyle(view.getByTestId('group')).direction).toBe('rtl');
    await fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(handle.getAttribute('aria-valuenow')).toBe('40');
  });

  it('drags with a pointer, measured against the group, and saves the layout when it ends', async () => {
    const data = new Map<string, string>();
    const storage: SplitterStorage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
    };
    const view = render(Fixture, { props: { storage, autoSaveId: 'mail' } });
    await tick();
    const group = view.getByTestId('group');
    group.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 1000,
        height: 400,
        top: 0,
        left: 0,
        right: 1000,
        bottom: 400,
        toJSON: () => ({}),
      }) as DOMRect;
    const handle = handleOf(view);
    await fireEvent.pointerDown(handle, {
      pointerId: 1,
      clientX: 300,
      button: 0,
      pointerType: 'touch',
    });
    expect(handle.dataset.state).toBe('active');
    await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 450 });
    expect(handle.getAttribute('aria-valuenow')).toBe('45');
    expect(data.has('texuli-splitter:mail')).toBe(false);
    // A move from another pointer is ignored.
    await fireEvent.pointerMove(handle, { pointerId: 2, clientX: 900 });
    expect(handle.getAttribute('aria-valuenow')).toBe('45');
    await fireEvent.pointerUp(handle, { pointerId: 1, clientX: 450 });
    expect(handle.dataset.state).toBe('inactive');
    expect(data.get('texuli-splitter:mail')).toBe('[45,55]');
  });

  it('restores a saved layout on mount', async () => {
    const storage: SplitterStorage = { getItem: () => '[50,50]', setItem: () => {} };
    const view = render(Fixture, { props: { storage, autoSaveId: 'mail' } });
    await tick();
    expect(handleOf(view).getAttribute('aria-valuenow')).toBe('50');
  });

  it('renders a child snippet as the handle, fully wired', async () => {
    const view = render(Fixture, { props: { useChild: true } });
    await tick();
    const custom = view.getByTestId('custom-handle');
    expect(custom.tagName).toBe('BUTTON');
    expect(custom.getAttribute('role')).toBe('separator');
    expect(custom.getAttribute('aria-controls')).toBe('nav');
    await fireEvent.keyDown(custom, { key: 'ArrowRight' });
    expect(custom.getAttribute('aria-valuenow')).toBe('40');
  });
});
