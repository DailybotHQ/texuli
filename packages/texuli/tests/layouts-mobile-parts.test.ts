import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BottomNavItem } from '../src/layouts/mobile/index.ts';
import Harness from './fixtures/MobilePartsHarness.svelte';

// G15: standalone BottomNav, MobileHeader and MobileAppFrame.
// G31: AppShell documents and reads --tx-app-height.

const items: BottomNavItem[] = [
  { href: '#/home', label: 'Home', icon: 'home', current: true },
  { href: '#/inbox', label: 'Inbox', icon: 'inbox', badge: 3 },
  { href: 'javascript:alert(1)', label: 'Hostile' },
];

describe('mobile parts (G15)', () => {
  afterEach(cleanup);

  it('renders a frame with banner, main and a named nav landmark, safe hrefs and the current tab', () => {
    render(Harness, { props: { items, backHref: '#/deals' } });
    const nav = screen.getByRole('navigation', { name: 'Tabs' });
    const home = screen.getByRole('link', { name: 'Home' });
    expect(nav.contains(home)).toBe(true);
    expect(home.getAttribute('aria-current')).toBe('page');
    // The badge is part of the link's name.
    expect(screen.getByRole('link', { name: 'Inbox 3' }).hasAttribute('aria-current')).toBe(false);
    // URL policy: a script URL never reaches the DOM.
    const hostile = screen.getByText('Hostile').closest('a');
    expect(hostile?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);

    const banner = screen.getByRole('banner');
    expect(within(banner, 'heading', 'Deal 42')).toBe(true);
    expect(banner.textContent).toContain('Orbit Labs');
    const back = screen.getByRole('link', { name: 'Back: Deals' });
    expect(back.getAttribute('href')).toBe('#/deals');

    const main = screen.getByRole('main');
    expect(main.id).toBe('screen');
    expect(main.textContent).toContain('Screen content');
    // Skip link: first stop, focuses main without changing the hash.
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    const frame = skip.parentElement as HTMLElement;
    expect(frame.firstElementChild).toBe(skip);
    skip.click();
    expect(document.activeElement).toBe(main);
    // Order: header, main, sticky footer, bottom nav.
    const order = Array.from(frame.children).map(
      (child) =>
        child.tagName.toLowerCase() +
        (child.hasAttribute('data-tx-mobile-frame-footer') ? '.footer' : '')
    );
    expect(order).toEqual(['a', 'header', 'main', 'div.footer', 'nav']);
  });

  it('uses a Back button with onBack and no nested main landmark inside a page main', async () => {
    const onBack = vi.fn();
    render(Harness, { props: { items, onBack, nested: true } });
    await fireEvent.click(screen.getByRole('button', { name: 'Back: Deals' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(document.getElementById('screen')?.tagName).toBe('DIV');
  });
});

function within(root: HTMLElement, role: 'heading', name: string): boolean {
  return Array.from(root.querySelectorAll('h1,h2,h3')).some(
    (node) => node.textContent?.trim() === name && role === 'heading'
  );
}

describe('AppShell --tx-app-height (G31)', () => {
  it('reads the variable in its CSS and documents it', () => {
    const root = join(process.cwd(), 'packages/texuli');
    const css = readFileSync(join(root, 'src/layouts/shells/shells.css'), 'utf8');
    const docs = readFileSync(join(root, 'docs/layouts-shells.md'), 'utf8');
    expect(css).toMatch(/var\(--tx-app-height, 100dvh\)/);
    expect(docs).toMatch(/`--tx-app-height`/);
    expect(docs).toMatch(/100dvh/);
  });
});
