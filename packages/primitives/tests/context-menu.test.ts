import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS } from '../src/context-menu/index.ts';
import Fixture from './context-menu-fixture.svelte';

afterEach(() => vi.useRealTimers());

const region = () => screen.getByTestId('region');
const focusedText = () => (document.activeElement as HTMLElement | null)?.textContent?.trim();

async function rightClick(target: Element, x = 40, y = 30) {
  await fireEvent.pointerDown(target, { button: 2, pointerType: 'mouse', clientX: x, clientY: y });
  return fireEvent.contextMenu(target, { button: 2, clientX: x, clientY: y });
}

describe('ContextMenu', () => {
  it('opens at a right click instead of the browser menu, with focus on the menu', async () => {
    render(Fixture);
    expect(region().getAttribute('data-state')).toBe('closed');
    const allowed = await rightClick(region());
    expect(allowed).toBe(false);
    const menu = await screen.findByRole('menu');
    expect(document.activeElement).toBe(menu);
    expect(region().getAttribute('data-state')).toBe('open');
    expect(menu.getAttribute('aria-labelledby')).toBe(region().id);
    await fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(focusedText()).toBe('Cut');
    // From the menu itself, ArrowUp enters on the last item.
    menu.focus();
    await fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(focusedText()).toBe('Share');
  });

  it('opens from the keyboard (Menu key, Shift+F10) on the first item and restores focus', async () => {
    render(Fixture);
    const shape = screen.getByRole('button', { name: 'Selected shape' });
    shape.focus();
    await fireEvent.contextMenu(shape);
    await screen.findByRole('menu');
    expect(focusedText()).toBe('Cut');
    await fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(shape);
  });

  it('shares the menu machinery: arrows, typeahead, submenus, checkbox items, select closes', async () => {
    const log: string[] = [];
    render(Fixture, { props: { log } });
    screen.getByRole('button', { name: 'Selected shape' }).focus();
    await fireEvent.contextMenu(screen.getByRole('button', { name: 'Selected shape' }));
    await screen.findByRole('menu');
    await fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
    expect(focusedText()).toBe('Share');
    await fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(2));
    await waitFor(() => expect(focusedText()).toBe('Copy link'));
    await fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(1));
    const snap = screen.getByRole('menuitemcheckbox', { name: 'Snap to grid' });
    expect(snap.getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(log).toEqual(['copy']);
    expect(focusedText()).toBe('Selected shape');
  });

  it('moves to a new right click while open, and a plain press on the region closes it', async () => {
    render(Fixture);
    await rightClick(region(), 10, 10);
    const menu = await screen.findByRole('menu');
    await rightClick(region(), 120, 80);
    expect(screen.getByRole('menu')).toBe(menu);
    await fireEvent.pointerDown(region(), { button: 0, pointerType: 'mouse' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('closes on an outside press, on Escape and on Tab', async () => {
    render(Fixture);
    await rightClick(region());
    await screen.findByRole('menu');
    await fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await rightClick(region());
    await fireEvent.keyDown(await screen.findByRole('menu'), { key: 'Tab' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('leaves the browser menu alone when disabled', async () => {
    render(Fixture, { props: { disabled: true } });
    expect(await rightClick(region())).toBe(true);
    await tick();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(region().hasAttribute('data-disabled')).toBe(true);
  });

  it('opens on a touch long press, and the lift is not a click', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const clicks = vi.fn();
    render(Fixture);
    region().addEventListener('click', clicks);
    const touch = { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: 50, clientY: 40 };
    await fireEvent.pointerDown(region(), touch);
    vi.advanceTimersByTime(LONG_PRESS_MS - 50);
    await tick();
    expect(screen.queryByRole('menu')).toBeNull();
    vi.advanceTimersByTime(60);
    await tick();
    expect(screen.getByRole('menu')).toBeTruthy();
    // Some browsers also fire contextmenu for the long press: no second open.
    expect(await fireEvent.contextMenu(region(), { clientX: 50, clientY: 40 })).toBe(false);
    await fireEvent.pointerUp(region(), touch);
    await fireEvent.click(region());
    expect(clicks).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('does not open when a long press moves (a scroll) or lifts early', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(Fixture);
    const touch = { pointerId: 4, pointerType: 'touch', isPrimary: true, clientX: 50, clientY: 40 };
    await fireEvent.pointerDown(region(), touch);
    await fireEvent.pointerMove(region(), { ...touch, clientY: 70 });
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    await tick();
    expect(screen.queryByRole('menu')).toBeNull();
    await fireEvent.pointerDown(region(), touch);
    await fireEvent.pointerUp(region(), touch);
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    await tick();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
