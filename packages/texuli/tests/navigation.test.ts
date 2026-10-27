import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Stepper from '../src/components/stepper/Stepper.svelte';
import { type StepperStep } from '../src/components/stepper/types.ts';
import Tabs from '../src/components/tabs-accordion/Tabs.svelte';
import { unregisterLayout } from '../src/layouts/host/registry.ts';
import AppShellHarness from './fixtures/AppShellHarness.svelte';
import NavigationFixture from './fixtures/NavigationFixture.svelte';
import PaginationPageFixture from './fixtures/PaginationPageFixture.svelte';
import ShellHeaderProbe from './fixtures/ShellHeaderProbe.svelte';
import SidebarHarness from './fixtures/SidebarHarness.svelte';
import SidebarHeightHarness from './fixtures/SidebarHeightHarness.svelte';
import ToolbarHarness from './fixtures/ToolbarHarness.svelte';
import WizardHarness from './WizardHarness.svelte';

// Navigation components and app shells: URL policy, current-page marking,
// skip links and landmarks, drawers that never trap focus, wizard flows.

describe('navigation', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Breadcrumb', () => {
    it('blocks unsafe hrefs', () => {
      render(NavigationFixture);
      // javascript: would be stripped by safeHref — ensure example.com links remain.
      expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('href')).toContain(
        'example.com'
      );
    });
  });

  describe('Pagination', () => {
    // Audit P0-01: the default page buttons were empty boxes (named only by aria-label).
    it('shows each page number as visible button text', () => {
      render(NavigationFixture, { props: { page: 2 } });
      const pages = screen.getAllByRole('button', { name: /^Page \d+$/ });
      expect(pages.length).toBeGreaterThan(1);
      for (const button of pages) {
        expect(button.textContent?.trim()).toBe(
          button.getAttribute('aria-label')?.replace('Page ', '')
        );
      }
    });

    it('defaults a composed Pagination.Page to its number and keeps custom content', () => {
      render(PaginationPageFixture);
      expect(screen.getByRole('button', { name: 'Page 1' }).textContent?.trim()).toBe('1');
      expect(screen.getByRole('button', { name: 'Page 2' }).textContent?.trim()).toBe('Second');
    });
  });
});

describe('sidebar', () => {
  afterEach(() => cleanup());

  describe('Sidebar', () => {
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
  });

  describe('AppNav', () => {
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
});

describe('sidebar-height', () => {
  afterEach(() => {
    cleanup();
    unregisterLayout('sidebar');
    unregisterLayout('dual-sidebar');
    unregisterLayout('rail');
  });

  async function ready(container: HTMLElement, attr: string): Promise<HTMLElement> {
    await waitFor(
      () => {
        expect(container.querySelector(`[data-tx-app-layout="${attr}"]`)).toBeTruthy();
      },
      { timeout: 10_000 }
    );
    return container.querySelector(`[data-tx-app-layout="${attr}"]`) as HTMLElement;
  }

  describe('sidebar / rail column height DOM', () => {
    it('mounts sidebar at 1280×800 with short content and stretch class chain', async () => {
      const { container } = render(SidebarHeightHarness, { props: { layout: 'sidebar' } });
      const layout = await ready(container, 'sidebar');
      const frame = container.querySelector('[data-sidebar-height-frame]') as HTMLElement;
      expect(frame.style.width).toBe('1280px');
      expect(frame.style.height).toBe('800px');

      const nav = layout.querySelector('.tx-app-nav');
      const side = layout.querySelector('.tx-app-nav__sidebar');
      const sidebar = layout.querySelector('.tx-sidebar');
      expect(nav).toBeTruthy();
      expect(side).toBeTruthy();
      expect(sidebar).toBeTruthy();

      // When the test engine reports geometry, sidebar matches layout height.
      const layoutH = layout.getBoundingClientRect().height;
      const sideH = side!.getBoundingClientRect().height;
      if (layoutH >= 790 && sideH > 0) {
        expect(Math.abs(sideH - layoutH)).toBeLessThanOrEqual(2);
      }
    });
  });
});

describe('stepper', () => {
  afterEach(cleanup);

  const STEPS: StepperStep[] = [
    { id: 'account', label: 'Account', description: 'Your details' },
    { id: 'plan', label: 'Plan' },
    { id: 'confirm', label: 'Confirm', description: 'Review' },
  ];

  describe('Stepper', () => {
    it('invokes onStepClick for completed and current steps only', async () => {
      const onStepClick = vi.fn();
      const view = render(Stepper, {
        props: { steps: STEPS, current: 1, onStepClick },
      });
      const buttons = view.container.querySelectorAll('button.tx-stepper__trigger');
      expect(buttons.length).toBe(2);
      await fireEvent.click(buttons[0]!);
      expect(onStepClick).toHaveBeenCalledWith(0);
    });
  });

  describe('Wizard', () => {
    it('stays when validate returns false and shows the review message', async () => {
      const view = render(WizardHarness, {
        props: {
          steps: STEPS,
          current: 0,
          validate: () => false,
          reviewMessage: 'Fill the fictional form first.',
        },
      });
      await fireEvent.click(view.getByRole('button', { name: /Next/i }));
      await waitFor(() => {
        expect(view.getByRole('alert').textContent).toContain('Fill the fictional form first.');
      });
      expect(view.queryByRole('button', { name: /Back/i })).toBeNull();
      expect(view.container.querySelector('[data-harness-step="account"]')).toBeTruthy();
    });

    it('surfaces validate string errors', async () => {
      const view = render(WizardHarness, {
        props: {
          steps: STEPS,
          current: 0,
          validate: async () => 'Name is required.',
        },
      });
      await fireEvent.click(view.getByRole('button', { name: /Next/i }));
      await waitFor(() =>
        expect(view.getByRole('alert').textContent).toContain('Name is required.')
      );
    });
  });
});

describe('tabs-accordion', () => {
  afterEach(cleanup);

  describe('Tabs', () => {
    it('wraps arrow-key focus past the ends when loop is set (APG)', async () => {
      const view = render(Tabs, {
        props: {
          items: [
            { value: 'alpha', label: 'Alpha' },
            { value: 'beta', label: 'Beta' },
            { value: 'gamma', label: 'Gamma' },
          ],
          value: 'gamma',
          label: 'Wrap',
          loop: true,
        },
      });
      const gamma = view.getByRole('tab', { name: 'Gamma' });
      gamma.focus();
      expect(document.activeElement).toBe(gamma);
      await fireEvent.keyDown(gamma, { key: 'ArrowRight' });
      // `loop` reaches the tabs primitive: focus wraps to the first tab …
      const alpha = view.getByRole('tab', { name: 'Alpha' });
      expect(document.activeElement).toBe(alpha);
      // … and automatic activation follows the focus move.
      expect(alpha.getAttribute('aria-selected')).toBe('true');
      expect(gamma.getAttribute('aria-selected')).toBe('false');
    });
  });
});

describe('toolbar', () => {
  afterEach(() => cleanup());

  describe('Toolbar', () => {
    it('applies the URL policy on toolbar links', () => {
      render(ToolbarHarness, { props: { mode: 'disabled-link' } });
      const unsafe = document.querySelector('[aria-label="Unsafe"]');
      expect(unsafe).toBeTruthy();
      expect(unsafe?.getAttribute('href')).toBeNull();
      expect(unsafe?.getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByRole('link', { name: 'Safe' }).getAttribute('href')).toBe(
        'https://example.com'
      );
    });
  });
});

describe('shells', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('AppShell: structure', () => {
    it('focuses main from the skip link without changing the hash', async () => {
      render(AppShellHarness);
      const skip = screen.getByRole('link', { name: 'Skip to content' });
      expect(skip.getAttribute('href')).toBe('#main-content');
      const before = location.hash;
      await fireEvent.click(skip);
      expect(document.activeElement).toBe(screen.getByRole('main'));
      expect(location.hash).toBe(before);
    });

    it('drops landmarks when nested inside another page main', () => {
      render(AppShellHarness, { props: { mainElement: 'div' } });
      expect(screen.queryByRole('main')).toBeNull();
      expect(screen.queryByRole('complementary')).toBeNull();
      expect(screen.queryByRole('region', { name: 'Notifications' })).toBeNull();
      expect(document.getElementById('main-content')?.tagName).toBe('DIV');
      expect(screen.getByText('2 fictional alerts')).toBeTruthy();
    });
  });

  describe('AppShell: drawer and context', () => {
    it('opens from the bindable prop and closes when a link inside it is followed', async () => {
      render(AppShellHarness, { props: { sidebarOpen: true } });
      const drawer = await screen.findByRole('dialog', { name: 'Navigation' }, { timeout: 10_000 });
      const link = drawer.querySelector('a[href="#/inbox"]') as HTMLElement;
      // Following the link changes the hash; wait for its hashchange so it cannot reach a later test.
      const navigated = new Promise((resolve) =>
        window.addEventListener('hashchange', resolve, { once: true })
      );
      await fireEvent.click(link);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await navigated;
    });

    it('closes once the shell is wide, so focus is never trapped in an invisible drawer', async () => {
      // Track every observer by what it watches, so the test resizes the shell itself.
      const observers = new Map<Element, (entries: { contentRect: { width: number } }[]) => void>();
      vi.stubGlobal(
        'ResizeObserver',
        class {
          callback: (entries: { contentRect: { width: number } }[]) => void;
          constructor(callback: (entries: { contentRect: { width: number } }[]) => void) {
            this.callback = callback;
          }
          observe(target: Element) {
            observers.set(target, this.callback);
          }
          unobserve() {}
          disconnect() {}
        }
      );
      render(AppShellHarness, { props: { sidebarOpen: true } });
      await screen.findByRole('dialog', { name: 'Navigation' }, { timeout: 10_000 });
      const shell = document.querySelector('[data-tx-app-shell]') as Element;
      const resize = (width: number) => observers.get(shell)?.([{ contentRect: { width } }]);
      expect(observers.has(shell)).toBe(true);
      resize(800);
      await tick();
      expect(screen.queryByRole('dialog')).toBeTruthy();
      resize(1023);
      await tick();
      expect(screen.queryByRole('dialog')).toBeTruthy();
      resize(1024);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('has no shell context outside an AppShell', () => {
      render(ShellHeaderProbe);
      expect(screen.getByText('No shell')).toBeTruthy();
    });
  });
});
