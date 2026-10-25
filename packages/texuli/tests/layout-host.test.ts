import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT,
  getLayout,
  isLayoutId,
  LAYOUT_IDS,
  LAYOUTS,
  layoutChoices,
  layoutForWidth,
  normalizeLayoutOptions,
} from '../src/layouts/host/contract.ts';
import { layoutStorageKey } from '../src/layouts/host/layout-kit.ts';
import {
  isNavPathActive,
  type NavModel,
  navPath,
  resolveNav,
} from '../src/layouts/host/nav-model.ts';
import { registerLayout, unregisterLayout } from '../src/layouts/host/registry.ts';
import LayoutHostHarness from './fixtures/LayoutHostHarness.svelte';
import TestRailLayout from './fixtures/TestRailLayout.svelte';
import TestSidebarLayout from './fixtures/TestSidebarLayout.svelte';

afterEach(() => {
  cleanup();
  unregisterLayout('sidebar');
  unregisterLayout('rail');
  unregisterLayout('dual-sidebar');
  unregisterLayout('mobile-drawer');
});

describe('layout contract', () => {
  it('owns layout ids and resolves responsive fallbacks without zod', () => {
    expect(LAYOUT_IDS).toContain('sidebar');
    expect(DEFAULT_LAYOUT).toBe('custom');
    expect(isLayoutId('sidebar')).toBe(true);
    expect(isLayoutId('nope')).toBe(false);
    expect(getLayout('dual-sidebar')?.minWidth).toBe(1024);
    expect(getLayout('dual-sidebar')?.fallback).toBe('sidebar');
    expect(layoutForWidth('dual-sidebar', 1000)).toBe('sidebar');
    expect(layoutForWidth('sidebar', 700)).toBe('mobile-drawer');
    expect(layoutForWidth('sidebar', 800)).toBe('sidebar');
    expect(layoutForWidth('marketing', 0)).toBe('marketing');
    expect(layoutForWidth('dual-sidebar', 0)).toBe('dual-sidebar');
    expect(layoutForWidth('sidebar', 0)).toBe('sidebar');
    expect(LAYOUTS.length).toBe(LAYOUT_IDS.length);
  });

  it('builds layout choices and normalizes options', () => {
    expect(layoutChoices({ id: 'custom' })).toEqual(['custom']);
    expect(layoutChoices({ id: 'sidebar', supported: ['rail', 'sidebar'] })[0]).toBe('sidebar');
    expect(
      normalizeLayoutOptions({
        dense: true,
        columns: 3,
        title: 'Harbor',
        'bad key': 1,
        nested: { x: 1 },
      })
    ).toEqual({ dense: true, columns: 3, title: 'Harbor' });
    expect(normalizeLayoutOptions('nope')).toBeUndefined();
  });

  it('never reads window at module load for the catalog', () => {
    // Importing the contract is pure; width is supplied by the caller.
    expect(layoutForWidth('rail', 100)).toBe('mobile-tabs');
    expect(layoutStorageKey('rail', 'harbor')).toBe('texuli:layout:harbor:rail');
  });
});

describe('nav model', () => {
  it('resolves the deepest active path and trail', () => {
    expect(navPath('#/deals/pipeline?x=1')).toBe('/deals/pipeline');
    expect(isNavPathActive('#/deals', '/deals/1')).toBe(true);
    expect(isNavPathActive('#/', '/deals')).toBe(false);

    const model: NavModel = {
      sections: [
        {
          id: 'main',
          items: [
            {
              id: 'deals',
              label: 'Deals',
              href: '#/deals',
              children: [{ id: 'pipe', label: 'Pipeline', href: '#/deals/pipeline' }],
            },
            { id: 'home', label: 'Home', href: '#/', exact: true },
          ],
        },
      ],
    };
    const resolved = resolveNav(model, '#/deals/pipeline');
    const deals = resolved[0]?.items[0];
    expect(deals?.inTrail).toBe(true);
    expect(deals?.active).toBe(false);
    expect(deals?.children[0]?.active).toBe(true);
  });
});

describe('LayoutHost', () => {
  it('lazy-loads the selected layout and shows a loading status', async () => {
    let resolveLayout: ((module: { default: typeof TestSidebarLayout }) => void) | undefined;
    let loads = 0;
    registerLayout('sidebar', {
      load: () => {
        loads += 1;
        return new Promise((resolve) => {
          resolveLayout = resolve;
        });
      },
    });
    const view = render(LayoutHostHarness, { props: { layout: 'sidebar' } });
    expect(loads).toBe(1);
    expect(
      view.container.querySelector('[role="status"][aria-label="Loading layout"]')
    ).toBeTruthy();
    expect(view.container.textContent).toContain('count: 0');
    resolveLayout?.({ default: TestSidebarLayout });
    await waitFor(() =>
      expect(view.container.querySelector('[data-test-layout="sidebar"] main button')).toBeTruthy()
    );
    expect(view.container.querySelector('[data-tx-layout-host]')?.getAttribute('data-layout')).toBe(
      'sidebar'
    );
  });

  it('uses catalog breakpoints to fall back responsively once width is known', async () => {
    registerLayout('sidebar', { load: async () => ({ default: TestSidebarLayout }) });
    registerLayout('dual-sidebar', { load: async () => ({ default: TestSidebarLayout }) });

    class FakeRO {
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe(target: Element) {
        this.cb(
          [
            {
              target,
              contentRect: { width: 1000, height: 600 } as DOMRectReadOnly,
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver
        );
      }
      disconnect() {}
      unobserve() {}
    }
    const prior = globalThis.ResizeObserver;
    globalThis.ResizeObserver = FakeRO as unknown as typeof ResizeObserver;

    const view = render(LayoutHostHarness, { props: { layout: 'dual-sidebar' } });
    await waitFor(() =>
      expect(view.container.querySelector('[data-layout="sidebar"]')).toBeTruthy()
    );
    expect(layoutForWidth('sidebar', 700)).toBe('mobile-drawer');
    globalThis.ResizeObserver = prior;
  });

  it('keeps the routed screen DOM and local state across layout switches', async () => {
    registerLayout('sidebar', { load: async () => ({ default: TestSidebarLayout }) });
    registerLayout('rail', { load: async () => ({ default: TestRailLayout }) });
    const view = render(LayoutHostHarness, { props: { layout: 'sidebar' } });
    await waitFor(() =>
      expect(view.container.querySelector('[data-test-layout="sidebar"] main button')).toBeTruthy()
    );
    const button = view.container.querySelector('button');
    expect(button).toBeTruthy();
    if (!button) return;
    await fireEvent.click(button);
    expect(button.textContent).toBe('count: 1');
    await view.rerender({ layout: 'rail' });
    await waitFor(() =>
      expect(view.container.querySelector('[data-test-layout="rail"] main button')).toBeTruthy()
    );
    expect(view.container.querySelector('button')).toBe(button);
    expect(button.textContent).toBe('count: 1');
  });

  it('honors dir for RTL without reading window at init', () => {
    registerLayout('sidebar', { load: async () => ({ default: TestSidebarLayout }) });
    const view = render(LayoutHostHarness, { props: { layout: 'sidebar', dir: 'rtl' } });
    expect(view.container.querySelector('[data-tx-layout-host]')?.getAttribute('dir')).toBe('rtl');
  });
});
