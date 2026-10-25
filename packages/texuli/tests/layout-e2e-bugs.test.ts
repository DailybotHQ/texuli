// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { registerAppLayouts } from '../src/layouts/app/entry.ts';
import { appSidebarSections } from '../src/layouts/app/model.ts';
import type { NavModel } from '../src/layouts/host/nav-model.ts';
import { resolveNav } from '../src/layouts/host/nav-model.ts';
import { clearLayoutRegistry, unregisterLayout } from '../src/layouts/host/registry.ts';
import { registerMobileLayouts } from '../src/layouts/mobile/index.ts';
import AuthSettingsHarness from './fixtures/AuthSettingsHarness.svelte';
import LayoutsAppHarness from './fixtures/LayoutsAppHarness.svelte';

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
    await waitFor(() =>
      expect(container.querySelector('[data-tx-app-layout="sidebar"]')).toBeTruthy()
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
