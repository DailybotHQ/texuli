import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NavModel } from '../src/layouts/host/nav-model.ts';
import { resolveNav } from '../src/layouts/host/nav-model.ts';
import { LAYOUT_REGISTRY, unregisterLayout } from '../src/layouts/host/registry.ts';
import {
  MOBILE_LAYOUTS,
  MOBILE_TAB_LIMIT,
  mobileLabels,
  navCurrent,
  registerMobileLayouts,
  splitTabs,
  stackHeader,
  topLevelItems,
} from '../src/layouts/mobile/index.ts';
import MobileLayoutHarness from './fixtures/MobileLayoutHarness.svelte';

const nav: NavModel = {
  brand: { label: 'Harbor', href: '#/' },
  sections: [
    {
      id: 'main',
      items: [
        { id: 'home', label: 'Home', href: '#/', icon: 'home' },
        {
          id: 'deals',
          label: 'Deals',
          href: '#/deals',
          badge: 3,
          children: [{ id: 'won', label: 'Won deals', href: '#/deals/won' }],
        },
        { id: 'inbox', label: 'Inbox', href: '#/inbox', icon: 'inbox' },
      ],
    },
    {
      id: 'more',
      label: 'Workspace',
      items: [
        { id: 'reports', label: 'Reports', href: '#/reports' },
        { id: 'team', label: 'Team', href: '#/team' },
        { id: 'settings', label: 'Settings', href: '#/settings', icon: 'settings' },
      ],
    },
  ],
  actions: [{ id: 'new', label: 'New deal', href: '#/deals/new', icon: 'plus' }],
  user: { name: 'Ada Park', detail: 'ada@harbor.example' },
};

afterEach(() => {
  cleanup();
  unregisterLayout('mobile-tabs');
  unregisterLayout('mobile-drawer');
});

describe('mobile layout model', () => {
  it('fits five tabs and moves the rest behind More', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    expect(MOBILE_TAB_LIMIT).toBe(5);
    expect(splitTabs(items.slice(0, 5))).toEqual({ tabs: [1, 2, 3, 4, 5], more: [] });
    expect(splitTabs(items)).toEqual({ tabs: [1, 2, 3, 4], more: [5, 6, 7] });
    expect(splitTabs(items, 3)).toEqual({ tabs: [1, 2], more: [3, 4, 5, 6, 7] });
    expect(splitTabs(items, Number.NaN).tabs).toHaveLength(4);
    expect(splitTabs(items, 0)).toEqual({ tabs: [1], more: [2, 3, 4, 5, 6, 7] });
  });

  it('builds the stacked header: root, nested item and detail screen', () => {
    const at = (path: string, title?: string) =>
      stackHeader(resolveNav(nav, path), path, 'Harbor', title);
    expect(at('/deals')).toEqual({ title: 'Deals', depth: 0 });
    expect(at('/deals/won')).toEqual({
      title: 'Won deals',
      depth: 1,
      back: { href: '#/deals', label: 'Deals' },
    });
    expect(at('/deals/42', 'Lumen Atlas pilot')).toEqual({
      title: 'Lumen Atlas pilot',
      depth: 1,
      back: { href: '#/deals', label: 'Deals' },
    });
    expect(at('/deals/won/7')).toMatchObject({ depth: 2, back: { href: '#/deals/won' } });
    expect(at('/deals/42').title).toBe('Deals');
    expect(at('/nowhere')).toEqual({ title: 'Harbor', depth: 0 });
    expect(at('/nowhere', 'Search')).toEqual({ title: 'Search', depth: 0 });
    expect(topLevelItems(resolveNav(nav, '/')).map((item) => item.id)).toEqual([
      'home',
      'deals',
      'inbox',
      'reports',
      'team',
      'settings',
    ]);
  });

  it('marks only the screen itself as the current page', () => {
    const deals = (path: string) =>
      topLevelItems(resolveNav(nav, path)).find((item) => item.id === 'deals') as never;
    expect(navCurrent(deals('/deals'), '/deals')).toBe('page');
    expect(navCurrent(deals('/deals/42'), '/deals/42')).toBe('true');
    expect(navCurrent(deals('/deals/won'), '/deals/won')).toBe('true');
    expect(navCurrent(deals('/inbox'), '/inbox')).toBeUndefined();
  });

  it('reads translated labels and the title from layout options', () => {
    expect(mobileLabels(undefined)).toMatchObject({ back: 'Back', more: 'More', title: undefined });
    expect(mobileLabels({ backLabel: 'Atrás', title: 'Pedido 7', moreLabel: ' ' })).toMatchObject({
      back: 'Atrás',
      title: 'Pedido 7',
      more: 'More',
    });
  });

  it('registers each layout as its own lazy entry', async () => {
    // The registry is module state; another file in the same worker may have filled it.
    unregisterLayout('mobile-tabs');
    unregisterLayout('mobile-drawer');
    expect(LAYOUT_REGISTRY['mobile-tabs']).toBeUndefined();
    registerMobileLayouts();
    expect(LAYOUT_REGISTRY['mobile-tabs']?.load).toBe(MOBILE_LAYOUTS['mobile-tabs'].load);
    expect(LAYOUT_REGISTRY['mobile-drawer']?.load).toBe(MOBILE_LAYOUTS['mobile-drawer'].load);
    expect(LAYOUT_REGISTRY['mobile-tabs']?.owner).toBe('mobile');
    expect(LAYOUT_REGISTRY['mobile-drawer']?.owner).toBe('mobile');
    const [tabs, drawer] = await Promise.all([
      MOBILE_LAYOUTS['mobile-tabs'].load(),
      MOBILE_LAYOUTS['mobile-drawer'].load(),
    ]);
    expect(typeof tabs.default).toBe('function');
    expect(tabs.default).not.toBe(drawer.default);
  });
});

describe('mobile layouts', () => {
  beforeAll(async () => {
    // Both chunks load once here, so test waits never meet a slow first transform.
    await Promise.all([
      MOBILE_LAYOUTS['mobile-tabs'].load(),
      MOBILE_LAYOUTS['mobile-drawer'].load(),
    ]);
  });

  async function mount(props: Record<string, unknown>) {
    registerMobileLayouts();
    const view = render(MobileLayoutHarness, { props: { nav, ...props } as never });
    await waitFor(
      () => {
        const host = view.container.querySelector('[data-tx-layout-host]');
        expect(host?.getAttribute('data-ready')).toBe('true');
        expect(host?.getAttribute('data-loading')).toBe('false');
        expect(view.container.querySelector('[data-tx-mobile-screen] button')).toBeTruthy();
      },
      { timeout: 10_000 }
    );
    return view;
  }

  it('renders a tab bar with the current tab, badges, the primary action and More', async () => {
    const view = await mount({ layout: 'mobile-tabs', path: '/deals' });
    const tabs = view.getByRole('navigation', { name: 'Primary' });
    const links = within(tabs).getAllByRole('link');
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Home',
      'Deals 3',
      'Inbox',
      'Reports',
      'New deal',
    ]);
    const deals = within(tabs).getByRole('link', { name: /Deals/ });
    expect(deals.getAttribute('aria-current')).toBe('page');
    expect(deals.getAttribute('href')).toBe('#/deals');
    expect(within(tabs).getByRole('link', { name: 'New deal' }).getAttribute('href')).toBe(
      '#/deals/new'
    );
    // The primary action moved to the bar, so the header has no copy of it.
    expect(view.container.querySelector('.tx-mobile-layout__actions')).toBeNull();
    expect(view.container.querySelector('[data-tx-mobile-title]')?.textContent).toBe('Deals');
    expect(view.container.querySelector('[data-tx-mobile-back]')).toBeNull();
    const more = within(tabs).getByRole('button', { name: 'More' });
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    // The screen sits inside <main>.
    expect(view.getByRole('main').textContent).toContain('count: 0');
  });

  it('opens More as a sheet with the remaining items and the user', async () => {
    const view = await mount({ layout: 'mobile-tabs', path: '/settings' });
    const more = view.getByRole('button', { name: /More/ });
    expect(more.textContent).toContain('(contains the current page)');
    expect(more.hasAttribute('data-in-trail')).toBe(true);
    await fireEvent.click(more);
    const sheet = await screen.findByRole('dialog', { name: 'More' });
    const links = within(sheet).getAllByRole('link');
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Team', 'Settings']);
    expect(within(sheet).getByRole('link', { name: 'Settings' }).getAttribute('aria-current')).toBe(
      'page'
    );
    expect(within(sheet).getByText('Ada Park')).toBeTruthy();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    await fireEvent.click(within(sheet).getByRole('link', { name: 'Team' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'More' })).toBeNull());
  });

  it('closes the More sheet on in-app navigation', async () => {
    const view = await mount({ layout: 'mobile-tabs', path: '/' });
    await fireEvent.click(view.getByRole('button', { name: 'More' }));
    await screen.findByRole('dialog', { name: 'More' });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'More' })).toBeNull());
  });

  it('shows Back and the screen title below a tab’s root (stacked navigation)', async () => {
    const view = await mount({
      layout: 'mobile-tabs',
      path: '/deals/42',
      options: { title: 'Lumen Atlas pilot', backLabel: 'Atrás' },
    });
    const back = view.container.querySelector('[data-tx-mobile-back]') as HTMLAnchorElement;
    expect(back.getAttribute('href')).toBe('#/deals');
    expect(within(view.container).getByRole('link', { name: 'Atrás: Deals' })).toBe(back);
    expect(view.container.querySelector('[data-tx-mobile-title]')?.textContent).toBe(
      'Lumen Atlas pilot'
    );
    expect(
      view.container.querySelector('[data-tx-mobile-layout]')?.getAttribute('data-depth')
    ).toBe('1');
    // The tab of the section stays current.
    expect(view.getByRole('link', { name: /^Deals/ }).getAttribute('aria-current')).toBe('true');
  });

  it('follows hash navigation when no path is given', async () => {
    window.location.hash = '#/inbox';
    const view = await mount({ layout: 'mobile-tabs' });
    expect(view.container.querySelector('[data-tx-mobile-title]')?.textContent).toBe('Inbox');
    window.location.hash = '#/deals/won';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() =>
      expect(view.container.querySelector('[data-tx-mobile-title]')?.textContent).toBe('Won deals')
    );
    expect(view.container.querySelector('[data-tx-mobile-back]')?.getAttribute('href')).toBe(
      '#/deals'
    );
    window.location.hash = '';
  });

  it('never renders an unsafe nav href', async () => {
    const view = await mount({
      layout: 'mobile-tabs',
      nav: {
        sections: [{ id: 's', items: [{ id: 'x', label: 'Bad', href: 'javascript:alert(1)' }] }],
      },
    });
    expect(view.container.innerHTML).not.toContain('javascript:');
    expect(view.getByText('Bad').closest('a')?.hasAttribute('href')).toBe(false);
  });

  it('opens the drawer with every section, nested items, actions and the user', async () => {
    const view = await mount({ layout: 'mobile-drawer', path: '/deals/won' });
    expect(view.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    expect(view.container.querySelector('[data-tx-mobile-back]')?.getAttribute('href')).toBe(
      '#/deals'
    );
    const menu = view.getByRole('button', { name: 'Open navigation' });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(menu);
    const drawer = await screen.findByRole('dialog', { name: 'Harbor' }, { timeout: 10_000 });
    const links = within(drawer).getByRole('navigation', { name: 'Harbor' });
    expect(
      within(links).getByRole('link', { name: 'Won deals' }).getAttribute('aria-current')
    ).toBe('page');
    expect(
      within(links)
        .getByRole('link', { name: /^Deals/ })
        .getAttribute('aria-current')
    ).toBe('true');
    expect(within(links).getByText('Workspace')).toBeTruthy();
    expect(within(drawer).getByText('Ada Park')).toBeTruthy();
    expect(within(drawer).getAllByRole('link', { name: 'New deal' }).length).toBeGreaterThan(0);
    await fireEvent.click(within(links).getByRole('link', { name: 'Inbox' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Harbor' })).toBeNull());
  });

  it('keeps the screen’s state when the layout switches, and renders RTL', async () => {
    const view = await mount({ layout: 'mobile-tabs', path: '/', dir: 'rtl' });
    expect(view.container.querySelector('[data-tx-layout-host]')?.getAttribute('dir')).toBe('rtl');
    await fireEvent.click(view.getByRole('button', { name: 'count: 0' }));
    await view.rerender({ layout: 'mobile-drawer', path: '/', dir: 'rtl' } as never);
    await waitFor(() =>
      expect(view.container.querySelector('[data-tx-layout="mobile-drawer"]')).toBeTruthy()
    );
    expect(view.getByRole('main').textContent).toContain('count: 1');
  });

  it('uses a div for the screen region inside a page that already has a main', async () => {
    registerMobileLayouts();
    const target = document.body.appendChild(document.createElement('main'));
    const view = render(MobileLayoutHarness, {
      target,
      props: { nav, layout: 'mobile-tabs', path: '/' } as never,
    });
    await waitFor(
      () => {
        expect(
          view.container.querySelector('[data-tx-layout-host]')?.getAttribute('data-ready')
        ).toBe('true');
        expect(view.container.querySelector('[data-tx-mobile-screen] button')?.textContent).toBe(
          'count: 0'
        );
      },
      { timeout: 10_000 }
    );
    expect(target.querySelectorAll('main')).toHaveLength(0);
    expect(view.container.querySelector('.tx-mobile-layout__main')?.tagName).toBe('DIV');
    target.remove();
  });

  it('degrades without a nav model', async () => {
    const onSelect = vi.fn();
    const view = await mount({
      layout: 'mobile-drawer',
      nav: undefined,
    });
    expect(view.queryByRole('button', { name: 'Open navigation' })).toBeNull();
    expect(view.container.querySelector('[data-tx-mobile-title]')?.textContent).toBe('Home');
    const tabsView = await mount({
      layout: 'mobile-tabs',
      nav: { sections: [], actions: [{ id: 'a', label: 'Compose', onSelect }] },
    });
    await fireEvent.click(
      within(tabsView.container).getAllByRole('button', { name: 'Compose' })[0] as HTMLElement
    );
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
