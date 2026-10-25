// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AnalyticsGrid from '../src/layouts/dashboard/AnalyticsGrid.svelte';
import DashboardGridLayout from '../src/layouts/dashboard/DashboardGridLayout.svelte';
import {
  registerDashboardLayouts,
  unregisterDashboardLayouts,
} from '../src/layouts/dashboard/register.ts';
import { layoutForWidth } from '../src/layouts/host/contract.ts';
import type { NavModel } from '../src/layouts/host/nav-model.ts';
import { LAYOUT_REGISTRY, unregisterLayout } from '../src/layouts/host/registry.ts';
import LayoutHostHarness from './fixtures/LayoutHostHarness.svelte';

afterEach(() => {
  cleanup();
  unregisterDashboardLayouts();
  unregisterLayout('dashboard-grid');
});

const nav: NavModel = {
  brand: { label: 'Harbor Analytics', href: '#/' },
  sections: [
    {
      id: 'main',
      items: [
        { id: 'overview', label: 'Overview', href: '#/' },
        { id: 'revenue', label: 'Revenue', href: '#/revenue', badge: 3 },
      ],
    },
  ],
  actions: [{ id: 'export', label: 'Export', href: '#/export' }],
  user: { name: 'Ada Example', href: '#/account' },
};

describe('dashboard-grid registration', () => {
  it('registers dashboard-grid as a lazy layout entry', async () => {
    registerDashboardLayouts();
    const entry = LAYOUT_REGISTRY['dashboard-grid'];
    expect(entry).toBeDefined();
    const mod = await entry!.load();
    expect(mod.default).toBe(DashboardGridLayout);
    expect(layoutForWidth('dashboard-grid', 1000)).toBe('dashboard-grid');
    expect(layoutForWidth('dashboard-grid', 700)).toBe('mobile-drawer');
  });
});

describe('DashboardGridLayout', () => {
  it('renders chrome, main grid and mounts the screen target (LTR)', async () => {
    let mounted: HTMLElement | undefined;
    render(DashboardGridLayout, {
      props: {
        nav,
        path: '#/',
        options: { title: 'Overview', dense: false },
        mountScreen: (target: HTMLElement) => {
          mounted = target;
          target.textContent = 'Screen body';
        },
      },
    });
    expect(document.querySelector('[data-tx-layout="dashboard-grid"]')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe(
      'page'
    );
    expect(screen.getByRole('link', { name: /Revenue/ }).textContent).toMatch(/3/);
    await waitFor(() => expect(mounted?.getAttribute('data-tx-dashboard-grid')).toBe(''));
    expect(mounted?.textContent).toContain('Screen body');
    expect(screen.getByRole('main')).toBeTruthy();
  });

  it('honors dense option and RTL direction on the host', async () => {
    render(DashboardGridLayout, {
      props: {
        nav,
        path: '#/revenue',
        options: { dense: true, gap: '0.5rem' },
        mountScreen: () => {},
      },
    });
    const root = document.querySelector('[data-tx-layout="dashboard-grid"]');
    expect(root?.getAttribute('data-dense')).toBe('true');
    expect(root?.className).toMatch(/tx-layout-dashboard--dense/);
    expect(screen.getByRole('link', { name: /Revenue/ }).getAttribute('aria-current')).toBe('page');
  });

  it('loads through LayoutHost with the registered layout id', async () => {
    registerDashboardLayouts();
    render(LayoutHostHarness, {
      props: { layout: 'dashboard-grid', dir: 'rtl' },
    });
    await waitFor(() =>
      expect(document.querySelector('[data-tx-layout="dashboard-grid"]')).toBeTruthy()
    );
    const host = document.querySelector('[data-tx-layout-host], .tx-layout-host');
    expect(host || document.querySelector('[data-tx-layout="dashboard-grid"]')).toBeTruthy();
  });
});

describe('AnalyticsGrid', () => {
  it('renders a labelled auto-fit grid with column knobs', () => {
    const children = createRawSnippet(() => ({
      render: () =>
        `<div data-kpi-wrap><article data-kpi="a">A</article><article data-kpi="b">B</article><article data-kpi="c">C</article></div>`,
    }));
    render(AnalyticsGrid, {
      props: {
        label: 'Key metrics',
        columns: 4,
        minItem: 200,
        dense: true,
        children,
      },
    });
    const grid = document.querySelector('[data-tx-analytics-grid]');
    expect(grid?.getAttribute('data-columns')).toBe('4');
    expect(grid?.getAttribute('data-dense')).toBe('true');
    expect(grid?.getAttribute('role')).toBe('region');
    expect(grid?.getAttribute('aria-label')).toBe('Key metrics');
    expect(grid?.querySelectorAll('[data-kpi]').length).toBe(3);
  });

  it('clamps columns and minItem to safe ranges', () => {
    const children = createRawSnippet(() => ({ render: () => `<div>x</div>` }));
    render(AnalyticsGrid, {
      props: { columns: 9 as 4, minItem: 10, children },
    });
    const grid = document.querySelector('[data-tx-analytics-grid]');
    expect(grid?.getAttribute('data-columns')).toBe('4');
  });
});
