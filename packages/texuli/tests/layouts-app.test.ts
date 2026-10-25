import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { unregisterLayout } from '../src/layouts/host/registry.ts';
import LayoutsAppHarness from './fixtures/LayoutsAppHarness.svelte';

afterEach(() => {
  cleanup();
  unregisterLayout('sidebar');
  unregisterLayout('mobile-drawer');
  unregisterLayout('top-nav');
  unregisterLayout('dual-sidebar');
  unregisterLayout('rail');
  unregisterLayout('master-detail');
  unregisterLayout('mobile-tabs');
});

/** Real readiness: host finished loading and the routed screen is in the tree. */
async function expectLayoutReady(container: HTMLElement, layout: string): Promise<void> {
  await waitFor(
    () => {
      const host = container.querySelector('[data-tx-layout-host]');
      expect(host?.getAttribute('data-layout')).toBe(layout);
      expect(host?.getAttribute('data-loading')).toBe('false');
      expect(host?.getAttribute('data-ready')).toBe('true');
    },
    { timeout: 10_000 }
  );
  await waitFor(
    () => {
      expect(screen.getByText('Current routed screen.')).toBeTruthy();
    },
    { timeout: 10_000 }
  );
  // App chrome / rail: Main navigation. Master-detail: list region. Mobile drawer: closed drawer.
  if (layout === 'mobile-drawer') {
    expect(container.querySelector('[data-tx-mobile-layout="drawer"]')).toBeTruthy();
    expect(container.querySelector('[data-tx-layout-drawer-root]')).toBeTruthy();
  } else if (layout === 'master-detail') {
    expect(screen.getByRole('region', { name: /List/i })).toBeTruthy();
  } else {
    expect(screen.getByRole('navigation', { name: /Main|Main navigation/i })).toBeTruthy();
  }
}

describe('app layouts', () => {
  it.each([
    ['sidebar', 'sidebar'],
    ['mobile drawer fallback', 'mobile-drawer'],
    ['top navigation', 'top-nav'],
    ['three pane', 'dual-sidebar'],
    ['icon rail', 'rail'],
    ['master-detail', 'master-detail'],
  ] as const)(
    'mounts the %s screen and keeps its navigation in the routed layout',
    async (_, layout) => {
      const { container } = render(LayoutsAppHarness, { props: { layout } });
      await expectLayoutReady(container, layout);
    },
    15_000
  );

  it('renders the three-pane context aside and supports inherited RTL direction', async () => {
    const { container } = render(LayoutsAppHarness, {
      props: { layout: 'dual-sidebar', dir: 'rtl' },
    });

    await waitFor(
      () => expect(container.querySelector('[data-tx-app-layout="three-pane"]')).toBeTruthy(),
      { timeout: 10_000 }
    );
    expect(container.querySelector('[data-tx-layout-host]')?.getAttribute('dir')).toBe('rtl');
    expect(container.querySelector('[data-tx-app-layout="three-pane"]')?.getAttribute('dir')).toBe(
      null
    );
    expect(screen.getByRole('complementary', { name: 'Context panel' })).toBeTruthy();
    // One main landmark: the three-pane screen, not a second one from AppNav.
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(screen.getByTestId('context-copy').textContent).toContain('Related details');
  });

  it('provides an accessible split list and detail pane, switching the narrow active pane', () => {
    const { container, rerender } = render(LayoutsAppHarness, {
      props: { layout: 'sidebar', detailActive: false },
    });

    const split = container.querySelector('[data-tx-split-view]');
    expect(split?.getAttribute('data-has-detail')).toBe('true');
    expect(split?.getAttribute('data-detail-active')).toBe('false');
    expect(screen.getByRole('region', { name: 'Threads' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Selected thread' })).toBeTruthy();

    rerender({ layout: 'sidebar', detailActive: true });
    expect(split?.getAttribute('data-detail-active')).toBe('true');
    expect(screen.getByTestId('split-detail').textContent).toBe('Thread details');
  });

  it('renders the icon rail with active item and expands labels when requested', async () => {
    const { container } = render(LayoutsAppHarness, {
      props: { layout: 'rail', options: { expanded: true } },
    });
    await waitFor(
      () => expect(container.querySelector('[data-tx-app-layout="rail"]')).toBeTruthy(),
      { timeout: 10_000 }
    );
    const rail = container.querySelector('[data-tx-app-layout="rail"]');
    expect(rail?.getAttribute('data-expanded')).toBe('true');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(
      container.querySelector('[data-tx-rail-item="inbox"]')?.getAttribute('aria-current')
    ).toBe('page');
    expect(screen.getByText('Current routed screen.')).toBeTruthy();
  });

  it('master-detail shows list and detail with a Back link when a leaf is selected', async () => {
    const { container } = render(LayoutsAppHarness, {
      props: { layout: 'master-detail' },
    });
    await waitFor(
      () => expect(container.querySelector('[data-tx-app-layout="master-detail"]')).toBeTruthy(),
      { timeout: 10_000 }
    );
    const root = container.querySelector('[data-tx-app-layout="master-detail"]');
    expect(root?.getAttribute('data-detail-active')).toBe('true');
    expect(screen.getByRole('region', { name: 'List' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Detail' })).toBeTruthy();
    expect(container.querySelector('[data-tx-md-back]')).toBeTruthy();
    expect(container.querySelector('[data-tx-md-item="inbox"]')?.getAttribute('data-trail')).toBe(
      ''
    );
    expect(screen.getByText('Current routed screen.')).toBeTruthy();
  });

  it('master-detail stays list-only when no item is selected', async () => {
    const { container } = render(LayoutsAppHarness, {
      props: { layout: 'master-detail', path: '/' },
    });
    await waitFor(
      () => expect(container.querySelector('[data-tx-app-layout="master-detail"]')).toBeTruthy(),
      { timeout: 10_000 }
    );
    expect(
      container
        .querySelector('[data-tx-app-layout="master-detail"]')
        ?.getAttribute('data-detail-active')
    ).toBe('false');
    expect(container.querySelector('[data-tx-md-empty]')).toBeTruthy();
  });

  it('supports RTL on rail and master-detail without setting dir on the shell itself', async () => {
    for (const layout of ['rail', 'master-detail'] as const) {
      cleanup();
      const { container } = render(LayoutsAppHarness, { props: { layout, dir: 'rtl' } });
      await waitFor(
        () =>
          expect(
            container.querySelector(
              `[data-tx-app-layout="${layout === 'master-detail' ? 'master-detail' : 'rail'}"]`
            )
          ).toBeTruthy(),
        { timeout: 10_000 }
      );
      expect(container.querySelector('[data-tx-layout-host]')?.getAttribute('dir')).toBe('rtl');
    }
  });
});
