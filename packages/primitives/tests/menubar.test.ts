import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Fixture from './menubar-fixture.svelte';

afterEach(cleanup);

const trigger = (name: string) => screen.getByRole('menuitem', { name }) as HTMLElement;
const focused = () => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? '';
const openMenus = () => screen.queryAllByRole('menu');
async function key(name: string, target: Element = document.activeElement ?? document.body) {
  await fireEvent.keyDown(target, { key: name });
  await tick();
}

describe('Menubar: structure (APG)', () => {
  it('is a horizontal menubar of menuitems that open menus, with one Tab stop', () => {
    render(Fixture);
    const bar = screen.getByRole('menubar', { name: 'Application' });
    expect(bar.getAttribute('aria-orientation')).toBe('horizontal');
    expect(bar.dataset.state).toBe('closed');
    const file = trigger('File');
    expect(file.getAttribute('aria-haspopup')).toBe('menu');
    expect(file.getAttribute('aria-expanded')).toBe('false');
    expect(file.getAttribute('tabindex')).toBe('0');
    expect(trigger('Edit').getAttribute('tabindex')).toBe('-1');
    expect(trigger('View').getAttribute('tabindex')).toBe('-1');
    expect((trigger('Help') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Menubar: keyboard between triggers', () => {
  it('moves with ArrowRight and ArrowLeft, skipping the disabled trigger, wrapping, and moving the Tab stop', async () => {
    render(Fixture);
    trigger('File').focus();
    await key('ArrowRight');
    expect(focused()).toBe('Edit');
    expect(trigger('Edit').getAttribute('tabindex')).toBe('0');
    expect(trigger('File').getAttribute('tabindex')).toBe('-1');
    await key('ArrowRight');
    expect(focused()).toBe('View');
    await key('ArrowRight');
    expect(focused()).toBe('File');
    await key('ArrowLeft');
    expect(focused()).toBe('View');
    expect(openMenus()).toHaveLength(0);
  });

  it('jumps with Home and End', async () => {
    render(Fixture);
    trigger('Edit').focus();
    await key('End');
    expect(focused()).toBe('View');
    await key('Home');
    expect(focused()).toBe('File');
  });

  it('stops at the ends when loop is off', async () => {
    render(Fixture, { props: { loop: false } });
    trigger('View').focus();
    await key('ArrowRight');
    expect(focused()).toBe('View');
  });

  it('swaps the arrows in RTL', async () => {
    render(Fixture, { props: { dir: 'rtl' } });
    trigger('File').focus();
    await key('ArrowLeft');
    expect(focused()).toBe('Edit');
  });

  it('ignores arrows held with a modifier', async () => {
    render(Fixture);
    trigger('File').focus();
    await fireEvent.keyDown(trigger('File'), { key: 'ArrowRight', ctrlKey: true });
    expect(focused()).toBe('File');
  });
});

describe('Menubar: opening and moving between menus', () => {
  it('opens a menu on its first item with Enter or ArrowDown, and its last with ArrowUp', async () => {
    const { unmount } = render(Fixture);
    trigger('File').focus();
    await key('ArrowDown');
    await screen.findByRole('menu');
    expect(focused()).toBe('New');
    expect(trigger('File').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menubar').dataset.state).toBe('open');
    unmount();
    render(Fixture);
    trigger('Edit').focus();
    await key('ArrowUp');
    await screen.findByRole('menu');
    expect(focused()).toBe('Redo');
  });

  it('carries the open menu along with ArrowRight and ArrowLeft from inside it', async () => {
    const onValueChange = vi.fn();
    render(Fixture, { props: { onValueChange } });
    trigger('File').focus();
    await key('Enter');
    await screen.findByRole('menu');
    await key('ArrowRight');
    expect(focused()).toBe('Undo');
    expect(trigger('File').getAttribute('aria-expanded')).toBe('false');
    expect(trigger('Edit').getAttribute('aria-expanded')).toBe('true');
    expect(openMenus()).toHaveLength(1);
    await key('ArrowRight');
    expect(focused()).toBe('Zoom in');
    await key('ArrowLeft');
    expect(focused()).toBe('Undo');
    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([
      'file',
      'edit',
      'view',
      'edit',
    ]);
  });

  it('carries the open menu along when the arrows move between triggers', async () => {
    render(Fixture);
    await fireEvent.click(trigger('File'));
    await screen.findByRole('menu');
    trigger('File').focus();
    await key('ArrowRight');
    expect(trigger('Edit').getAttribute('aria-expanded')).toBe('true');
    expect(focused()).toBe('Undo');
  });

  it('opens a submenu with ArrowRight on its trigger, closes it with ArrowLeft, and moves on from a plain item', async () => {
    render(Fixture);
    trigger('File').focus();
    await key('Enter');
    await screen.findByRole('menu');
    await key('End');
    expect(focused()).toBe('Share');
    await key('ArrowRight');
    await screen.findByRole('menuitem', { name: 'Email' });
    expect(focused()).toBe('Email');
    await key('ArrowLeft');
    expect(focused()).toBe('Share');
    expect(trigger('File').getAttribute('aria-expanded')).toBe('true');
    await key('ArrowRight');
    await screen.findByRole('menuitem', { name: 'Email' });
    await key('ArrowRight');
    expect(focused()).toBe('Undo');
    expect(trigger('File').getAttribute('aria-expanded')).toBe('false');
  });

  it('closes with Escape and returns focus to the trigger', async () => {
    render(Fixture);
    trigger('Edit').focus();
    await key('Enter');
    await screen.findByRole('menu');
    await key('Escape');
    expect(openMenus()).toHaveLength(0);
    expect(focused()).toBe('Edit');
    expect(screen.getByRole('menubar').dataset.state).toBe('closed');
  });

  it('runs an item and closes the bar', async () => {
    const log: string[] = [];
    render(Fixture, { props: { log } });
    trigger('File').focus();
    await key('Enter');
    await screen.findByRole('menu');
    await key('Enter');
    expect(log).toEqual(['new']);
    expect(openMenus()).toHaveLength(0);
  });
});

describe('Menubar: pointer', () => {
  it('toggles a menu with a click and switches menus by clicking another trigger', async () => {
    render(Fixture);
    await fireEvent.click(trigger('File'), { detail: 1 });
    await screen.findByRole('menu');
    await fireEvent.click(trigger('View'), { detail: 1 });
    await tick();
    expect(trigger('File').getAttribute('aria-expanded')).toBe('false');
    expect(trigger('View').getAttribute('aria-expanded')).toBe('true');
    await fireEvent.click(trigger('View'), { detail: 1 });
    await tick();
    expect(openMenus()).toHaveLength(0);
  });

  it('opens on hover only after the first open', async () => {
    render(Fixture);
    await fireEvent.pointerEnter(trigger('Edit'), { pointerType: 'mouse' });
    await tick();
    expect(openMenus()).toHaveLength(0);
    await fireEvent.click(trigger('File'), { detail: 1 });
    await screen.findByRole('menu');
    await fireEvent.pointerEnter(trigger('Edit'), { pointerType: 'mouse' });
    await tick();
    expect(trigger('Edit').getAttribute('aria-expanded')).toBe('true');
    expect(trigger('File').getAttribute('aria-expanded')).toBe('false');
    // Touch has no hover: a touch "enter" does not switch menus.
    await fireEvent.pointerEnter(trigger('View'), { pointerType: 'touch' });
    await tick();
    expect(trigger('Edit').getAttribute('aria-expanded')).toBe('true');
  });

  it('does not open a disabled trigger', async () => {
    render(Fixture);
    await fireEvent.click(trigger('Help'));
    await tick();
    expect(openMenus()).toHaveLength(0);
  });
});

describe('Menubar: controlled value', () => {
  it('opens the menu named by value', async () => {
    render(Fixture, { props: { value: 'view' } });
    await screen.findByRole('menu');
    expect(trigger('View').getAttribute('aria-expanded')).toBe('true');
  });
});
