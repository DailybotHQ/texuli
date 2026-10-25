import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Fixture from './menu-child-trigger-fixture.svelte';

/*
 * A trigger rendered through a `child` snippet must register its element with
 * the menu, like the built-in one: the menu anchors to it and returns focus to
 * it when it closes (FIX-menu-trigger-child). Menu.Trigger backs Menu,
 * DropdownMenu and Menubar; ContextMenu.Trigger backs ContextMenu.
 */

afterEach(cleanup);

const actions = () => screen.getByRole('button', { name: 'Actions' });
const region = () => screen.getByRole('button', { name: 'Canvas' });
async function key(name: string, target: Element = document.activeElement ?? document.body) {
  await fireEvent.keyDown(target, { key: name });
  await tick();
}

describe('Menu.Trigger with a child snippet', () => {
  it('renders the custom element with the trigger props and links it to the menu', async () => {
    render(Fixture);
    expect(actions().classList.contains('custom-trigger')).toBe(true);
    expect(actions().getAttribute('aria-haspopup')).toBe('menu');
    actions().focus();
    await key('Enter', actions());
    const menu = await screen.findByRole('menu');
    expect(actions().getAttribute('aria-controls')).toBe(menu.id);
    expect(menu.getAttribute('aria-labelledby')).toBe(actions().id);
  });

  it('returns focus to the custom trigger on Escape', async () => {
    render(Fixture);
    actions().focus();
    await key('Enter', actions());
    await screen.findByRole('menu');
    expect(document.activeElement?.textContent?.trim()).toBe('Rename');
    await key('Escape');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(actions());
  });

  it('returns focus to the custom trigger after an item is selected', async () => {
    const log: string[] = [];
    render(Fixture, { props: { log } });
    actions().focus();
    await key('Enter', actions());
    await screen.findByRole('menu');
    await key('ArrowDown');
    await key('Enter');
    expect(log).toEqual(['delete']);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(actions());
  });
});

describe('ContextMenu.Trigger with a child snippet', () => {
  it('registers the custom element, so focus returns to it on Escape', async () => {
    render(Fixture);
    region().focus();
    await fireEvent.contextMenu(region());
    await screen.findByRole('menu');
    expect(document.activeElement?.textContent?.trim()).toBe('Paste');
    await key('Escape');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(region());
  });

  // The iOS long-press callout style it also sets is WebKit-only, which happy-dom
  // drops; it is checked in real WebKit instead (see FIX-menu-trigger-child).
  it('returns focus to it after a select', async () => {
    const log: string[] = [];
    render(Fixture, { props: { log } });
    region().focus();
    await fireEvent.contextMenu(region());
    await screen.findByRole('menu');
    await key('Enter');
    expect(log).toEqual(['paste']);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(region());
  });
});
