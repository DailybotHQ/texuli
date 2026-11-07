import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BottomNavItem } from '../src/layouts/mobile/index.ts';
import { BottomNav } from '../src/layouts/mobile/index.ts';
import HeaderHarness from './fixtures/MobileHeaderHarness.svelte';
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

  it('reads badgeLabel in the tab name while the badge stays visible', () => {
    const labelled = items.map((item) =>
      item.badge === undefined ? item : { ...item, badgeLabel: '3 unread' }
    );
    render(Harness, { props: { items: labelled, backHref: '#/deals' } });
    const inbox = screen.getByRole('link', { name: 'Inbox (3 unread)' });
    expect(inbox.querySelector('.tx-mobile-tabs__badge')?.textContent).toBe('3');
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

describe('MobileAppFrame empty sticky footer (G68)', () => {
  afterEach(cleanup);

  it('hides the padded, bordered footer strip while the snippet renders nothing', async () => {
    const view = render(Harness, { props: { items, footer: false } });
    await tick();
    const strip = () =>
      document.querySelector<HTMLElement>('[data-tx-mobile-frame-footer]') as HTMLElement;
    expect(strip().hidden).toBe(true);
    expect(strip().hasAttribute('data-empty')).toBe(true);
    await view.rerender({ items, footer: true });
    await tick();
    expect(strip().hidden).toBe(false);
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    await view.rerender({ items, footer: false });
    await tick();
    expect(strip().hidden).toBe(true);
    const css = readFileSync(
      join(process.cwd(), 'packages/texuli/src/layouts/mobile/mobile.css'),
      'utf8'
    );
    expect(css).toMatch(/\.tx-mobile-frame__footer\[data-empty\][^{]*\{[^}]*display:\s*none/);
  });
});

describe('MobileAppFrame unstyled sticky footer (G95)', () => {
  afterEach(cleanup);

  it('keeps the footer slot but drops its strip styling with stickyFooterUnstyled', async () => {
    for (const unstyled of [false, true]) {
      render(Harness, { props: { items, footerUnstyled: unstyled } });
      await tick();
      const strip = document.querySelector<HTMLElement>('[data-tx-mobile-frame-footer]');
      expect(strip?.classList.contains('tx-mobile-frame__footer'), `unstyled=${unstyled}`).toBe(
        true
      );
      expect(strip?.hasAttribute('data-unstyled'), `unstyled=${unstyled}`).toBe(unstyled);
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
      cleanup();
    }
    const css = readFileSync(
      join(process.cwd(), 'packages/texuli/src/layouts/mobile/mobile.css'),
      'utf8'
    );
    const rule = /\.tx-mobile-frame__footer\[data-unstyled\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    for (const declaration of [/padding:\s*0/, /border:\s*0/, /background:\s*none/]) {
      expect(rule).toMatch(declaration);
    }
  });
});

describe('BottomNav action item (UG-22)', () => {
  afterEach(cleanup);

  it("marks the emphasis 'action' item, which stays a named link in the list and calls onSelect", async () => {
    const onSelect = vi.fn((_item: BottomNavItem, event: MouseEvent) => event.preventDefault());
    const withAction: BottomNavItem[] = [
      ...items.slice(0, 2),
      { href: '#/new', label: 'Create', icon: 'plus', emphasis: 'action' },
    ];
    render(BottomNav, { props: { items: withAction, label: 'Tabs', onSelect } });
    const nav = screen.getByRole('navigation', { name: 'Tabs' });
    const create = screen.getByRole('link', { name: 'Create' });
    expect(create.closest('li')?.parentElement?.closest('nav')).toBe(nav);
    expect(create.getAttribute('data-emphasis')).toBe('action');
    expect(create.getAttribute('href')).toBe('#/new');
    expect(nav.querySelectorAll('[data-emphasis]')).toHaveLength(1);
    await fireEvent.click(create);
    expect(onSelect).toHaveBeenCalledWith(withAction[2], expect.any(MouseEvent));
    const css = readFileSync(
      join(process.cwd(), 'packages/texuli/src/layouts/mobile/mobile.css'),
      'utf8'
    );
    expect(css).toMatch(
      /\[data-emphasis="action"\] \.tx-layout-nav-icon \{[^}]*background: var\(--tx-primary/
    );
  });
});

describe('MobileHeader eyebrow, leading and Close (UG-24)', () => {
  afterEach(cleanup);

  it('shows the eyebrow above the title and lets leading replace Back', () => {
    render(HeaderHarness, {
      props: { title: 'Deal 42', eyebrow: 'Pipeline', backHref: '#/deals', withLeading: true },
    });
    const banner = screen.getByRole('banner');
    const eyebrow = screen.getByText('Pipeline');
    const heading = screen.getByRole('heading', { name: 'Deal 42' });
    expect(eyebrow.tagName).toBe('P');
    expect(
      eyebrow.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(banner.firstElementChild).toBe(screen.getByRole('button', { name: 'Account' }));
    expect(screen.queryByRole('link', { name: /Back/ })).toBeNull();
  });

  it('ends with a Close button or a safe Close link, named from the label dictionary', async () => {
    const onClose = vi.fn();
    const view = render(HeaderHarness, {
      props: { title: 'New deal', onClose, withActions: true },
    });
    const close = screen.getByRole('button', { name: 'Close' });
    const banner = screen.getByRole('banner');
    // After the actions, as the header's last control.
    expect(banner.querySelector('.tx-mobile-layout__actions')?.lastElementChild).toBe(close);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(close.getAttribute('type')).toBe('button');
    await fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);

    // rerender merges props: pass every one that changes.
    await view.rerender({
      onClose: undefined,
      withActions: false,
      closeHref: '#/deals',
      closeLabel: 'Discard',
    });
    const link = screen.getByRole('link', { name: 'Discard' });
    expect(link.getAttribute('href')).toBe('#/deals');
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();

    await view.rerender({ closeHref: 'javascript:alert(1)', closeLabel: undefined, onClose });
    expect(screen.getByRole('button', { name: 'Close' }).hasAttribute('href')).toBe(false);
    expect(document.querySelector('a[href^="javascript"]')).toBeNull();

    await view.rerender({ closeHref: undefined, onClose: undefined });
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
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
