import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  appNavClass,
  SIDEBAR_VARIANTS,
  Sidebar,
  sidebarClass,
  sidebarItemClass,
} from '../src/components/sidebar/index.ts';
import SidebarHarness from './fixtures/SidebarHarness.svelte';

afterEach(() => cleanup());

describe('sidebar variants', () => {
  it('exposes default and inset variants', () => {
    expect(SIDEBAR_VARIANTS).toEqual(['default', 'inset']);
    expect(sidebarClass({ variant: 'inset' })).toContain('tx-sidebar--inset');
    expect(sidebarItemClass({ active: true })).toContain('tx-sidebar__item--active');
    expect(appNavClass()).toContain('tx-app-nav');
  });
});

describe('Sidebar', () => {
  it('renders sections, active page and badge', () => {
    const { container } = render(SidebarHarness);
    const nav = container.querySelector('[data-tx-sidebar]');
    expect(nav?.getAttribute('aria-label')).toBe('Main');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByText('Workspace')).toBeTruthy();
    const inbox = screen.getByRole('link', { name: /Inbox/i });
    expect(inbox.getAttribute('aria-current')).toBe('page');
    expect(inbox.getAttribute('href')).toBe('https://example.com/inbox');
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('supports docs navigation: text-only items, section state and labelled groups', () => {
    render(Sidebar, {
      props: {
        label: 'Docs',
        collapsible: false,
        showIcons: false,
        sections: [
          {
            label: 'Components',
            items: [
              { label: 'Components', href: '/components/', current: 'section' },
              { label: 'Button', href: '/components/button/', current: 'page' },
              { label: 'Charts', href: '/charts/' },
            ],
          },
        ],
      },
    });
    const nav = screen.getByRole('navigation', { name: 'Docs' });
    // No icon boxes or initials in text-only mode.
    expect(nav.querySelector('.tx-sidebar__icon')).toBeNull();
    expect(screen.getByRole('link', { name: 'Components' }).getAttribute('aria-current')).toBe(
      'true'
    );
    expect(screen.getByRole('link', { name: 'Button' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Charts' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'Components' }).hasAttribute('data-active')).toBe(true);
    // The group label names its list.
    expect(screen.getByRole('list', { name: 'Components' })).toBeTruthy();
  });

  it('collapses to icon rail and expands again', async () => {
    const { container } = render(SidebarHarness, { props: { collapsed: false } });
    const toggle = container.querySelector('[data-tx-sidebar-toggle]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await fireEvent.click(toggle);
    const nav = container.querySelector('[data-tx-sidebar]');
    expect(nav?.hasAttribute('data-collapsed')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(toggle);
    expect(nav?.hasAttribute('data-collapsed')).toBe(false);
  });

  it('strips unsafe hrefs via the URL policy', () => {
    render(SidebarHarness);
    const blocked = screen.getByText('Blocked').closest('[data-tx-sidebar-item]');
    expect(blocked?.getAttribute('href')).toBeNull();
    expect(blocked?.getAttribute('aria-disabled')).toBe('true');
  });

  it('renders inset variant and drawer mode without toggle', () => {
    const { container, rerender } = render(SidebarHarness, {
      props: { variant: 'inset', collapsible: false },
    });
    expect(container.querySelector('[data-variant="inset"]')).toBeTruthy();
    expect(container.querySelector('[data-tx-sidebar-toggle]')).toBeNull();
    rerender({ variant: 'default', drawer: true, collapsible: true });
    expect(container.querySelector('[data-drawer]')).toBeTruthy();
    expect(container.querySelector('[data-tx-sidebar-toggle]')).toBeNull();
  });

  it('renders one nested level under a parent item', () => {
    const { container } = render(Sidebar, {
      props: {
        label: 'Docs',
        collapsible: false,
        showIcons: false,
        sections: [
          {
            label: 'Components',
            items: [
              {
                label: 'Charts',
                href: '/charts/',
                children: [
                  { label: 'Area chart', href: '/charts/area/', current: 'page' },
                  { label: 'Bar chart', href: '/charts/bar/' },
                ],
              },
            ],
          },
        ],
      },
    });
    const nested = container.querySelector('ul.tx-sidebar__list--nested');
    expect(nested).toBeTruthy();
    // The nested list sits inside the parent item's row.
    expect(nested?.closest('li')?.contains(screen.getByRole('link', { name: 'Charts' }))).toBe(
      true
    );
    expect(screen.getByRole('link', { name: 'Area chart' }).getAttribute('aria-current')).toBe(
      'page'
    );
    expect(screen.getByRole('link', { name: 'Bar chart' }).getAttribute('href')).toBe(
      '/charts/bar/'
    );
  });
});

describe('AppNav', () => {
  it('renders the shell with desktop sidebar and main', () => {
    const { container } = render(SidebarHarness, { props: { mode: 'appnav' } });
    expect(container.querySelector('[data-tx-app-nav]')).toBeTruthy();
    expect(container.querySelector('[data-tx-app-nav-sidebar]')).toBeTruthy();
    expect(container.querySelector('[data-tx-app-nav-main]')?.textContent).toMatch(/Main content/);
    expect(screen.getByRole('button', { name: /Open navigation/i })).toBeTruthy();
  });

  it('can omit its main landmark when nested in a page main', () => {
    const { container } = render(SidebarHarness, {
      props: { mode: 'appnav', mainLandmark: false },
    });
    expect(container.querySelector('main[data-tx-app-nav-main]')).toBeNull();
    expect(container.querySelector('div[data-tx-app-nav-main]')?.textContent).toMatch(
      /Main content/
    );
  });

  it('loads the mobile Sheet only after opening and restores focus to its trigger', async () => {
    const { container } = render(SidebarHarness, { props: { mode: 'appnav' } });
    const trigger = screen.getByRole('button', { name: /Open navigation/i });

    expect(document.querySelector('[data-tx-app-nav-sheet]')).toBeNull();
    await fireEvent.click(trigger);
    await waitFor(
      () => {
        expect(
          container.querySelector('[data-tx-app-nav]')?.getAttribute('data-drawer-ready')
        ).toBe('true');
        expect(document.querySelector('[data-tx-app-nav-sheet]')).toBeTruthy();
      },
      { timeout: 10_000 }
    );
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
    expect(document.activeElement).toBe(trigger);
    expect(container.querySelector('[data-tx-app-nav-menu]')).toBe(trigger);
  });
});
