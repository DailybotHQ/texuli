import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppShellContext } from '../src/layouts/shells/index.ts';
import AppShellHarness from './fixtures/AppShellHarness.svelte';
import ShellHeaderProbe from './fixtures/ShellHeaderProbe.svelte';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SHELLS_DIR = join(import.meta.dirname, '../src/layouts/shells');

describe('AppShell: structure', () => {
  it('renders the frame with landmarks, the skip link and every slot', () => {
    render(AppShellHarness);
    const shell = document.querySelector('[data-tx-app-shell]') as HTMLElement;
    expect(shell.className).toBe('tx-app-shell consumer-shell');
    expect(screen.getByRole('complementary', { name: 'Navigation' })).toBeTruthy();
    const main = screen.getByRole('main');
    expect(main.id).toBe('main-content');
    expect(main.getAttribute('tabindex')).toBe('-1');
    expect(main.className).toContain('consumer-main');
    expect(main.hasAttribute('data-bottom-nav')).toBe(true);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    expect(
      screen
        .getByRole('searchbox', { name: 'Search everything' })
        .closest('[data-tx-app-shell-slot]')
        ?.getAttribute('data-tx-app-shell-slot')
    ).toBe('command-bar');
    expect(
      screen
        .getByRole('navigation', { name: 'Tabs' })
        .closest('[data-tx-app-shell-slot]')
        ?.getAttribute('data-tx-app-shell-slot')
    ).toBe('bottom-nav');
    const notes = screen.getByRole('region', { name: 'Notifications' });
    expect(notes.textContent).toContain('2 fictional alerts');
    expect(screen.getByRole('navigation', { name: 'Sections (column)' })).toBeTruthy();
  });

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

  it('renders only what is given', () => {
    render(AppShellHarness, { props: { withSidebar: false, withSlots: false } });
    expect(document.querySelectorAll('[data-tx-app-shell-slot]')).toHaveLength(1);
    expect(screen.getByRole('main').hasAttribute('data-bottom-nav')).toBe(false);
  });

  it('takes translated labels', () => {
    render(AppShellHarness, {
      props: {
        sidebarLabel: 'Navegación',
        skipLabel: 'Saltar al contenido',
        notificationsLabel: 'Avisos',
      },
    });
    expect(screen.getByRole('complementary', { name: 'Navegación' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Avisos' })).toBeTruthy();
  });
});

describe('AppShell: drawer and context', () => {
  it('lets a header toggle the drawer, which holds the drawer copy of the sidebar', async () => {
    const { container } = render(AppShellHarness, { props: { closeLabel: 'Cerrar navegación' } });
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(menu);
    await waitFor(
      () => {
        expect(
          container.querySelector('[data-tx-app-shell]')?.getAttribute('data-drawer-ready')
        ).toBe('true');
      },
      { timeout: 10_000 }
    );
    const drawer = await screen.findByRole('dialog', { name: 'Navigation' }, { timeout: 10_000 });
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    expect(drawer.querySelector('[data-testid="sidebar-drawer"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar navegación' })).toBeTruthy();
  });

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

  it('closes on in-app navigation', async () => {
    render(AppShellHarness, { props: { sidebarOpen: true } });
    await screen.findByRole('dialog', { name: 'Navigation' }, { timeout: 10_000 });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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

  it('gives the header open, close and toggle through the shell context', async () => {
    let shell: AppShellContext | undefined;
    render(AppShellHarness, {
      props: { onShell: (value: AppShellContext | undefined) => (shell = value) },
    });
    expect(shell?.sidebarOpen).toBe(false);
    shell?.toggleSidebar();
    await screen.findByRole('dialog', { name: 'Navigation' }, { timeout: 10_000 });
    expect(shell?.sidebarOpen).toBe(true);
    shell?.toggleSidebar();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    shell?.openSidebar();
    await screen.findByRole('dialog', { name: 'Navigation' }, { timeout: 10_000 });
    shell?.closeSidebar();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(shell?.sidebarOpen).toBe(false);
  });

  it('has no shell context outside an AppShell', () => {
    render(ShellHeaderProbe);
    expect(screen.getByText('No shell')).toBeTruthy();
  });
});

describe('shells: no prototype pieces', () => {
  it('imports nothing from Protoyard or Lucide and names its context for Texuli', () => {
    const files = readdirSync(SHELLS_DIR).filter((file) => /\.(ts|svelte|css)$/.test(file));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(SHELLS_DIR, file), 'utf8');
      expect(source, file).not.toMatch(/@protoyard|lucide/);
      expect(source, file).not.toMatch(/Symbol\('protoyard/);
    }
    expect(readFileSync(join(SHELLS_DIR, 'context.ts'), 'utf8')).toContain(
      "Symbol('texuli.app-shell')"
    );
  });

  it('uses logical properties only in its CSS', () => {
    const css = readFileSync(join(SHELLS_DIR, 'shells.css'), 'utf8');
    expect(css).not.toMatch(/(?<![-\w])(left|right|top|bottom)\s*:/);
    expect(css).not.toMatch(/(margin|padding|border)-(left|right|top|bottom)/);
  });
});
