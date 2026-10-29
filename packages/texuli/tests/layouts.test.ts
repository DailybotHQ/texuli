/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAppLayouts } from '../src/layouts/app/entry.ts';
import { appSidebarSections } from '../src/layouts/app/model.ts';
import { unregisterAuthSettingsLayouts } from '../src/layouts/auth-settings/index.ts';
import BlogLayout from '../src/layouts/content/BlogLayout.svelte';
import DocsLayout from '../src/layouts/content/DocsLayout.svelte';
import EditorialLayout from '../src/layouts/content/EditorialLayout.svelte';
import { buildToc, headingSlug } from '../src/layouts/content/toc.ts';
import AnalyticsGrid from '../src/layouts/dashboard/AnalyticsGrid.svelte';
import {
  registerDashboardLayouts,
  unregisterDashboardLayouts,
} from '../src/layouts/dashboard/register.ts';
import { LAYOUTS, layoutForWidth } from '../src/layouts/host/contract.ts';
import { layoutStorageKey } from '../src/layouts/host/layout-kit.ts';
import {
  isNavPathActive,
  type NavModel,
  navPath,
  resolveNav,
} from '../src/layouts/host/nav-model.ts';
import {
  clearLayoutRegistry,
  LAYOUT_OWNERS,
  LAYOUT_REGISTRY,
  registerLayout,
  unregisterLayout,
} from '../src/layouts/host/registry.ts';
import { MarketingSectionHeader } from '../src/layouts/marketing/index.ts';
import LandingLayout from '../src/layouts/marketing/LandingLayout.svelte';
import MarketingLayout from '../src/layouts/marketing/MarketingLayout.svelte';
import {
  formatPriceCents,
  normalizeNavLinks,
  normalizePricingTiers,
} from '../src/layouts/marketing/model.ts';
import { unregisterMarketingLayouts } from '../src/layouts/marketing/register.ts';
import { MarketingSectionHeader as SectionHeaderFromSubpath } from '../src/layouts/marketing/section.ts';
import {
  MOBILE_LAYOUTS,
  MOBILE_TAB_LIMIT,
  navCurrent,
  registerMobileLayouts,
  splitTabs,
  stackHeader,
  topLevelItems,
} from '../src/layouts/mobile/index.ts';
import AuthSettingsHarness from './fixtures/AuthSettingsHarness.svelte';
import ContentLayoutHostHarness from './fixtures/ContentLayoutHostHarness.svelte';
import LayoutHostHarness from './fixtures/LayoutHostHarness.svelte';
import LayoutsAppHarness from './fixtures/LayoutsAppHarness.svelte';
import MobileLayoutHarness from './fixtures/MobileLayoutHarness.svelte';
import TestRailLayout from './fixtures/TestRailLayout.svelte';
import TestSidebarLayout from './fixtures/TestSidebarLayout.svelte';

// Layouts and the layout host: registration ownership, lazy loading,
// responsive fallback, state kept across switches, RTL, URL policy on nav.

describe('layout-e2e-bugs', () => {
  afterEach(() => {
    cleanup();
    clearLayoutRegistry();
    unregisterLayout('sidebar');
    unregisterLayout('dual-sidebar');
    unregisterLayout('rail');
    unregisterLayout('master-detail');
    unregisterLayout('mobile-drawer');
    unregisterLayout('mobile-tabs');
    unregisterLayout('top-nav');
  });

  const navWithIcons: NavModel = {
    brand: { label: 'Harbor', href: '#/' },
    sections: [
      {
        id: 'main',
        items: [
          { id: 'inbox', label: 'Inbox', href: '#/inbox', icon: 'inbox' },
          { id: 'notes', label: 'Notes', href: '#/notes', icon: 'file-text' },
        ],
      },
    ],
  };

  describe('app sidebar icons (FIX-layout-e2e-bugs)', () => {
    it('maps icon names through appSidebarSections', () => {
      const sections = appSidebarSections(resolveNav(navWithIcons, '/inbox'));
      expect(sections[0]?.items[0]?.icon).toBe('inbox');
      expect(sections[0]?.items[1]?.icon).toBe('file-text');
    });

    it('sidebar layout renders NavIcon glyphs instead of initials when icons are set', async () => {
      registerAppLayouts();
      registerMobileLayouts();
      const { container } = render(LayoutsAppHarness, {
        props: { layout: 'sidebar', path: '/inbox' },
      });
      // The first lazy layout load in this file pays the module transform.
      await waitFor(
        () => expect(container.querySelector('[data-tx-app-layout="sidebar"]')).toBeTruthy(),
        { timeout: 10_000 }
      );
      await waitFor(() =>
        expect(container.querySelectorAll('[data-tx-nav-icon]').length).toBeGreaterThan(0)
      );
      const icons = container.querySelectorAll('.tx-sidebar__icon');
      expect(icons.length).toBeGreaterThan(0);
      for (const el of icons) {
        if (el.querySelector('[data-tx-nav-icon]')) {
          expect((el.textContent ?? '').trim().length).toBeLessThan(2);
        }
      }
    });

    it('rail links expose accessible names when collapsed (tooltip is supplementary)', async () => {
      registerAppLayouts();
      const { container } = render(LayoutsAppHarness, {
        props: { layout: 'rail', path: '/inbox' },
      });
      await waitFor(() =>
        expect(container.querySelector('[data-tx-app-layout="rail"]')).toBeTruthy()
      );
      const inbox = container.querySelector('[data-tx-rail-item="inbox"]');
      expect(inbox?.getAttribute('aria-label')).toBe('Inbox');
      expect(screen.getByRole('link', { name: 'Inbox' })).toBeTruthy();
    });
  });

  describe('auth-split phone overflow (FIX-layout-e2e-bugs)', () => {
    it('CSS contracts the form for phone width and hides the brand panel below 64rem', () => {
      const cssPath = join(
        process.cwd(),
        'packages/texuli/src/layouts/auth-settings/auth-settings.css'
      );
      const css = readFileSync(cssPath, 'utf8');
      expect(css).toMatch(/\.tx-auth-split__form\s*\{[^}]*min-inline-size:\s*0/s);
      expect(css).toMatch(/\.tx-auth-split__form-inner\s*\{[^}]*min-inline-size:\s*0/s);
      expect(css).toMatch(/max-inline-size:\s*min\(28rem,\s*100%\)/);
      expect(css).toMatch(
        /\.tx-auth-split__form-inner[^{]*:is\(input[^)]*\)[^{]*\{[^}]*inline-size:\s*100%/s
      );
      expect(css).toMatch(/\.tx-auth-split__panel\s*\{[^}]*display:\s*none/s);
      expect(css).toMatch(/@media\s*\(min-width:\s*64rem\)[^{]*\{[^}]*\.tx-auth-split__panel/s);
      expect(css).toMatch(/--tx-app-height/);
      expect(css).toMatch(/--tx-safe-top/);

      const { container } = render(AuthSettingsHarness, { props: { view: 'auth' } });
      const root = container.querySelector('[data-tx-auth-split]') as HTMLElement;
      root.style.inlineSize = '390px';
      root.style.maxInlineSize = '390px';
      expect(screen.getByTestId('auth-email')).toBeTruthy();
      expect(container.querySelector('.tx-auth-split__form-inner')).toBeTruthy();
    });
  });
});

describe('layout-host-contract', () => {
  afterEach(() => {
    cleanup();
    clearLayoutRegistry();
    vi.restoreAllMocks();
  });

  describe('layout registration ownership', () => {
    it('app layouts never claim mobile ids and own rail + master-detail', () => {
      registerAppLayouts();
      expect(LAYOUT_REGISTRY['mobile-drawer']).toBeUndefined();
      expect(LAYOUT_REGISTRY['mobile-tabs']).toBeUndefined();
      expect(LAYOUT_OWNERS.sidebar).toBe('app');
      expect(LAYOUT_OWNERS.rail).toBe('app');
      expect(LAYOUT_OWNERS['master-detail']).toBe('app');
      expect(LAYOUT_REGISTRY.sidebar?.load).toBeTypeOf('function');
      expect(LAYOUT_REGISTRY.rail?.load).toBeTypeOf('function');
      expect(LAYOUT_REGISTRY['master-detail']?.load).toBeTypeOf('function');
    });

    it('any registration order yields the same owner map for app + mobile', () => {
      registerAppLayouts();
      registerMobileLayouts();
      const forward = {
        sidebar: LAYOUT_REGISTRY.sidebar?.load,
        'top-nav': LAYOUT_REGISTRY['top-nav']?.load,
        'dual-sidebar': LAYOUT_REGISTRY['dual-sidebar']?.load,
        rail: LAYOUT_REGISTRY.rail?.load,
        'master-detail': LAYOUT_REGISTRY['master-detail']?.load,
        'mobile-drawer': LAYOUT_REGISTRY['mobile-drawer']?.load,
        'mobile-tabs': LAYOUT_REGISTRY['mobile-tabs']?.load,
      };

      clearLayoutRegistry();
      registerMobileLayouts();
      registerAppLayouts();
      expect(LAYOUT_REGISTRY.sidebar?.load).toBe(forward.sidebar);
      expect(LAYOUT_REGISTRY['top-nav']?.load).toBe(forward['top-nav']);
      expect(LAYOUT_REGISTRY['dual-sidebar']?.load).toBe(forward['dual-sidebar']);
      expect(LAYOUT_REGISTRY.rail?.load).toBe(forward.rail);
      expect(LAYOUT_REGISTRY['master-detail']?.load).toBe(forward['master-detail']);
      expect(LAYOUT_REGISTRY['mobile-drawer']?.load).toBe(forward['mobile-drawer']);
      expect(LAYOUT_REGISTRY['mobile-tabs']?.load).toBe(forward['mobile-tabs']);
      expect(LAYOUT_OWNERS.sidebar).toBe('app');
      expect(LAYOUT_OWNERS.rail).toBe('app');
      expect(LAYOUT_OWNERS['master-detail']).toBe('app');
      expect(LAYOUT_OWNERS['mobile-drawer']).toBe('mobile');
      expect(LAYOUT_OWNERS['mobile-tabs']).toBe('mobile');
    });

    it('warns when a different owner re-registers an id with another loader', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      registerLayout('sidebar', {
        load: async () => ({ default: TestSidebarLayout }),
        owner: 'app',
      });
      registerLayout('sidebar', {
        load: async () => ({ default: TestSidebarLayout }),
        owner: 'other',
      });
      expect(warn).toHaveBeenCalled();
      expect(String(warn.mock.calls[0]?.[0])).toMatch(/re-registered by owner "other"/);
    });
  });

  describe('LayoutHost width seed (no narrow flash)', () => {
    it('uses a desktop-width seed so sidebar does not flash mobile-drawer before RO', async () => {
      // Viewport-wide seed before the host box is measured.
      Object.defineProperty(globalThis, 'innerWidth', {
        configurable: true,
        get: () => 1200,
      });
      registerLayout('sidebar', {
        load: async () => ({ default: TestSidebarLayout }),
        owner: 'test',
      });
      // mobile-drawer must exist for fallback path if width were narrow
      registerLayout('mobile-drawer', {
        load: async () => ({ default: TestSidebarLayout }),
        owner: 'mobile',
      });

      expect(layoutForWidth('sidebar', 1200)).toBe('sidebar');
      expect(layoutForWidth('sidebar', 0)).toBe('sidebar');

      const view = render(LayoutHostHarness, { props: { layout: 'sidebar' } });
      // First resolved layout must be sidebar (not mobile-drawer) at desktop seed.
      await waitFor(() =>
        expect(view.container.querySelector('[data-test-layout="sidebar"]')).toBeTruthy()
      );
      expect(view.container.querySelector('[data-layout="mobile-drawer"]')).toBeNull();
      unregisterLayout('sidebar');
      unregisterLayout('mobile-drawer');
    });
  });
});

describe('layout-host', () => {
  afterEach(() => {
    cleanup();
    unregisterLayout('sidebar');
    unregisterLayout('rail');
    unregisterLayout('dual-sidebar');
    unregisterLayout('mobile-drawer');
  });

  describe('layout contract', () => {
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
        expect(
          view.container.querySelector('[data-test-layout="sidebar"] main button')
        ).toBeTruthy()
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
      expect(view.container.querySelector('[data-tx-layout-host]')?.getAttribute('dir')).toBe(
        'rtl'
      );
    });
  });
});

describe('layouts-app', () => {
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
    it('mounts every app layout screen and keeps its navigation in the routed layout', async () => {
      for (const layout of [
        'sidebar',
        'mobile-drawer',
        'top-nav',
        'dual-sidebar',
        'rail',
        'master-detail',
      ] as const) {
        const { container, unmount } = render(LayoutsAppHarness, { props: { layout } });
        await expectLayoutReady(container, layout);
        unmount();
      }
    }, 30_000);

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
});

describe('layouts-auth-settings', () => {
  afterEach(() => {
    cleanup();
    unregisterAuthSettingsLayouts();
  });

  describe('AuthSplitLayout', () => {
    it('keeps brand copy optional with no product defaults', () => {
      render(AuthSettingsHarness, { props: { view: 'auth-bare' } });
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
      expect(screen.getByText('Sign in form')).toBeTruthy();
    });
  });

  describe('WizardLayout', () => {
    it('renders steps and advances with Next', async () => {
      render(AuthSettingsHarness, { props: { view: 'wizard' } });
      expect(screen.getByRole('main').getAttribute('data-tx-layout')).toBe('wizard');
      expect(screen.getByRole('heading', { name: 'Set up Harbor' })).toBeTruthy();
      expect(screen.getByText('Profile body')).toBeTruthy();
      await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      await waitFor(() => {
        expect(screen.getByText('Team body')).toBeTruthy();
      });
    });
  });

  describe('SettingsLayout', () => {
    it('switches sections and remounts detail content', async () => {
      render(AuthSettingsHarness, { props: { view: 'settings' } });
      expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeTruthy();
      expect(screen.getByText('Profile panel')).toBeTruthy();

      await fireEvent.click(screen.getByRole('button', { name: /Security/ }));
      await waitFor(() => {
        expect(screen.getByText('Security panel')).toBeTruthy();
      });
      expect(screen.queryByText('Profile panel')).toBeNull();
    });

    it('moves between list and detail on a phone-width mode', async () => {
      render(AuthSettingsHarness, { props: { view: 'settings', startWithList: true } });
      const root = document.querySelector('[data-tx-settings-layout]');
      expect(root?.getAttribute('data-mode')).toBe('list');

      await fireEvent.click(screen.getByRole('button', { name: /Profile/ }));
      await waitFor(() => {
        expect(root?.getAttribute('data-mode')).toBe('detail');
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      await waitFor(() => {
        expect(root?.getAttribute('data-mode')).toBe('list');
      });
    });
  });
});

describe('layouts-content', () => {
  let observedWidth = 360;
  const priorResizeObserver = globalThis.ResizeObserver;

  class FakeResizeObserver {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      this.callback(
        [
          {
            target,
            contentRect: { width: observedWidth, height: 900 } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver
      );
    }
    disconnect(): void {}
    unobserve(): void {}
  }

  afterEach(() => {
    cleanup();
    if (priorResizeObserver) globalThis.ResizeObserver = priorResizeObserver;
    else Reflect.deleteProperty(globalThis, 'ResizeObserver');
    unregisterLayout('docs');
    unregisterLayout('blog');
    unregisterLayout('editorial');
  });

  beforeEach(() => {
    registerLayout('docs', { load: async () => ({ default: DocsLayout }) });
    registerLayout('blog', { load: async () => ({ default: BlogLayout }) });
    registerLayout('editorial', { load: async () => ({ default: EditorialLayout }) });
  });

  describe('content layout contract and table of contents', () => {
    it('keeps content layouts responsive at narrow and wide host widths', () => {
      for (const id of ['docs', 'blog', 'editorial'] as const) {
        expect(LAYOUTS.find((layout) => layout.id === id)?.platforms).toContain('responsive');
        expect(layoutForWidth(id, 360)).toBe(id);
        expect(layoutForWidth(id, 1280)).toBe(id);
      }
    });

    it('creates stable readable ids and disambiguates duplicates', () => {
      expect(headingSlug('  Café & tea / notes  ')).toBe('cafe-tea-notes');
      expect(headingSlug('Ångström Ñu')).toBe('angstrom-nu');
      // The diacritic range stays an escape: literal combining marks hide in review.
      const source = readFileSync(
        join(import.meta.dirname, '../src/layouts/content/toc.ts'),
        'utf8'
      );
      expect(source).not.toMatch(/[\u0300-\u036f]/);
      expect(
        buildToc([
          { text: 'Getting started', level: 2 },
          { text: 'Getting started', level: 3 },
          { text: 'Custom section', level: 2 },
          { id: 'reserved-heading', text: 'Reserved heading', level: 2 },
          { id: 'custom-section', text: 'Custom section', level: 2 },
          { text: '   ', level: 3 },
        ])
      ).toEqual([
        { id: 'getting-started', label: 'Getting started', level: 2 },
        { id: 'getting-started-2', label: 'Getting started', level: 3 },
        { id: 'custom-section-2', label: 'Custom section', level: 2 },
        { id: 'reserved-heading', label: 'Reserved heading', level: 2 },
        { id: 'custom-section', label: 'Custom section', level: 2 },
      ]);
    });

    it('renders each content layout at phone and desktop width, LTR and RTL, with a usable table of contents', async () => {
      const cases = [
        ['docs', 'ltr', 360],
        ['docs', 'rtl', 1280],
        ['blog', 'rtl', 360],
        ['blog', 'ltr', 1280],
        ['editorial', 'ltr', 360],
        ['editorial', 'rtl', 1280],
      ] as const;
      for (const [layout, dir, width] of cases) {
        observedWidth = width;
        globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
        const view = render(ContentLayoutHostHarness, {
          props: {
            layout,
            dir,
            options: {
              title: 'A guide for thoughtful teams',
              author: 'Ari Sol',
              date: 'October 20, 2026',
              readingTime: '5 minute read',
            },
            nav: {
              brand: { label: 'Northstar', href: '#/' },
              sections: [
                {
                  id: 'main',
                  label: 'Guide',
                  items: [
                    { id: 'overview', label: 'Overview', href: '#/guide' },
                    { id: 'unsafe', label: 'Unsafe', href: 'javascript:alert(1)' },
                  ],
                },
              ],
            },
          },
        });

        await waitFor(() =>
          expect(
            view.container.querySelector(`[data-tx-content-layout="${layout}"]`),
            layout
          ).toBeTruthy()
        );
        expect(view.container.querySelector(`[dir="${dir}"]`)).toBeTruthy();
        expect(view.container.querySelector(`[data-layout="${layout}"]`)).toBeTruthy();
        expect(
          view.getByRole('heading', { level: 1, name: 'A guide for thoughtful teams' })
        ).toBeTruthy();
        expect(view.getByRole('heading', { level: 2, name: 'Reader first' }).id).toBe(
          'reader-first'
        );
        expect(view.getByRole('link', { name: 'Reader first' }).getAttribute('href')).toBe(
          '#reader-first'
        );
        expect(view.queryByRole('link', { name: 'Unsafe' })).toBeNull();
        expect(
          view
            .getAllByRole('link', { name: 'Overview' })
            .every((link) => link.getAttribute('href') === '#/guide')
        ).toBe(true);
        view.unmount();
      }
    });
  });
});

describe('layouts-dashboard', () => {
  afterEach(() => {
    cleanup();
    unregisterDashboardLayouts();
    unregisterLayout('dashboard-grid');
  });

  describe('DashboardGridLayout', () => {
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
    it('clamps columns and minItem to safe ranges', () => {
      const children = createRawSnippet(() => ({ render: () => `<div>x</div>` }));
      render(AnalyticsGrid, {
        props: { columns: 9 as 4, minItem: 10, children },
      });
      const grid = document.querySelector('[data-tx-analytics-grid]');
      expect(grid?.getAttribute('data-columns')).toBe('4');
    });
  });
});

describe('layouts-marketing', () => {
  afterEach(() => {
    cleanup();
    unregisterMarketingLayouts();
    unregisterLayout('marketing');
  });

  describe('marketing model', () => {
    it('formats cents and normalizes tiers and nav links', () => {
      expect(formatPriceCents(2900, 'USD', 'en-US')).toMatch(/\$29/);
      expect(formatPriceCents(Number.NaN)).toBe('');
      expect(
        normalizeNavLinks([
          { id: 'a', label: 'Features', href: '#/features' },
          { id: 'b', label: '  ', href: '#/x' },
          { id: 'c', label: 'Bad', href: '' },
        ])
      ).toEqual([{ id: 'a', label: 'Features', href: '#/features' }]);
      const tiers = normalizePricingTiers([
        {
          id: 'pro',
          name: 'Pro',
          priceCents: 4900,
          features: ['A', '', 'B'],
          highlighted: true,
          cta: { id: 'buy', label: 'Buy', href: '#/buy' },
        },
        { id: 'x', name: '', priceCents: 0 },
      ]);
      expect(tiers).toHaveLength(1);
      expect(tiers[0]?.features).toEqual(['A', 'B']);
      expect(tiers[0]?.highlighted).toBe(true);
    });
  });

  describe('MarketingLayout', () => {
    it('mounts the LayoutHost screen target when mountScreen is set', () => {
      const mountScreen = vi.fn();
      render(MarketingLayout, { props: { mountScreen } });
      expect(mountScreen).toHaveBeenCalled();
      const target = mountScreen.mock.calls[0]?.[0] as HTMLElement;
      expect(target.getAttribute('data-tx-layout-screen-target')).toBe('');
    });
  });

  describe('MarketingSectionHeader (G84)', () => {
    it('renders a heading-only header: no landmark, no label, any level, a heading id', () => {
      expect(SectionHeaderFromSubpath).toBe(MarketingSectionHeader);
      for (const level of [2, 3, 4] as const) {
        const { container } = render(MarketingSectionHeader, {
          props: {
            title: 'Why teams switch',
            level,
            headingId: `why-${level}`,
            eyebrow: 'Customers',
            description: 'Three reasons, in their words.',
            align: 'center',
            'data-testid': 'header',
          },
        });
        const root = container.querySelector('[data-tx-marketing-section-header]') as HTMLElement;
        expect(root.tagName).toBe('DIV');
        expect(root.dataset.testid).toBe('header');
        expect(root.dataset.align).toBe('center');
        // No landmark or labelled region of its own.
        expect(root.querySelector('section, header, [role], [aria-label]')).toBeNull();
        expect(root.hasAttribute('aria-label')).toBe(false);
        const heading = screen.getByRole('heading', { level, name: 'Why teams switch' });
        expect(heading.id).toBe(`why-${level}`);
        expect(root.contains(heading)).toBe(true);
        expect(root.textContent).toContain('Three reasons, in their words.');
        cleanup();
      }
      // No block padding: the header is not a section.
      const css = readFileSync(
        join(import.meta.dirname, '../src/layouts/marketing/marketing.css'),
        'utf8'
      );
      const rule = css.match(/\.tx-marketing-section-header \{[^}]*\}/u)?.[0] ?? '';
      expect(rule).not.toBe('');
      expect(rule).not.toMatch(/padding/u);
    });
  });

  describe('LandingLayout', () => {
    it('renders hero, CTAs and nav in LTR and RTL', () => {
      const view = render(LandingLayout, {
        props: {
          brandLabel: 'Harbor Notes',
          title: 'Ship calmer product reviews',
          lede: 'A fictional landing for the demo.',
          heroAlign: 'center',
          navLinks: [
            { id: 'features', label: 'Features', href: '#/features' },
            { id: 'pricing', label: 'Pricing', href: '#/pricing' },
          ],
          primaryCta: { id: 'start', label: 'Start free', href: '#/start' },
          secondaryCta: { id: 'tour', label: 'Tour', href: '#/tour', variant: 'outline' },
        },
      });
      expect(view.getByRole('heading', { name: 'Ship calmer product reviews' })).toBeTruthy();
      expect(view.getAllByRole('link', { name: 'Start free' }).length).toBeGreaterThanOrEqual(1);
      expect(view.getByRole('link', { name: 'Harbor Notes' })).toBeTruthy();
      expect(
        view.container.querySelector('[data-tx-landing-hero]')?.getAttribute('data-align')
      ).toBe('center');

      view.unmount();
      const rtl = document.createElement('div');
      rtl.dir = 'rtl';
      document.body.append(rtl);
      const rtlView = render(LandingLayout, {
        target: rtl,
        props: {
          brandLabel: 'Harbor',
          title: 'RTL landing',
          primaryCta: { id: 'go', label: 'Go', href: '#/go' },
        },
      });
      expect(rtlView.container.closest('[dir="rtl"]') || rtl.dir).toBeTruthy();
      expect(rtl.getAttribute('dir')).toBe('rtl');
      rtlView.unmount();
      rtl.remove();
    });
  });
});

describe('layouts-mobile', () => {
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

    it('closes the More sheet on in-app navigation', async () => {
      const view = await mount({ layout: 'mobile-tabs', path: '/' });
      await fireEvent.click(view.getByRole('button', { name: 'More' }));
      await screen.findByRole('dialog', { name: 'More' });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'More' })).toBeNull());
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

    it('keeps the screen’s state when the layout switches, and renders RTL', async () => {
      const view = await mount({ layout: 'mobile-tabs', path: '/', dir: 'rtl' });
      expect(view.container.querySelector('[data-tx-layout-host]')?.getAttribute('dir')).toBe(
        'rtl'
      );
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
  });
});
