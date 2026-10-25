import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MENU_SIZES,
  MENU_VARIANTS,
  menuContentClass,
  menuItemClass,
  menuTriggerClass,
} from '../src/components/menus/index.ts';
import MenusHarness from './fixtures/MenusHarness.svelte';

afterEach(() => cleanup());

describe('menu variants', () => {
  it('exposes sizes and variants', () => {
    expect(MENU_SIZES).toEqual(['sm', 'md', 'lg']);
    expect(MENU_VARIANTS).toEqual(['default', 'soft']);
    expect(menuTriggerClass({ variant: 'soft', size: 'sm' })).toContain('tx-menu-trigger--soft');
    expect(menuContentClass({ size: 'lg' })).toContain('tx-menu-content--lg');
    expect(menuItemClass({ disabled: true })).toContain('tx-menu-item--disabled');
  });
});

describe('DropdownMenu', () => {
  it('opens from the trigger and lists styled items with a shortcut', async () => {
    render(MenusHarness, { props: { mode: 'dropdown' } });
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger.className).toContain('tx-menu-trigger');
    await fireEvent.click(trigger);
    const menu = await screen.findByRole('menu');
    expect(menu.className).toContain('tx-menu-content');
    expect(screen.getByRole('menuitem', { name: /New file/i })).toBeTruthy();
    expect(screen.getByText('⌘N')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Disabled' }).getAttribute('aria-disabled')).toBe(
      'true'
    );
  });

  it('runs an item and closes', async () => {
    render(MenusHarness, { props: { mode: 'dropdown', open: true } });
    await screen.findByRole('menu');
    await fireEvent.click(screen.getByRole('menuitem', { name: /New file/i }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(screen.getByLabelText('Log').textContent).toContain('new');
  });

  it('toggles a checkbox item', async () => {
    render(MenusHarness, { props: { mode: 'dropdown', open: true, grid: false } });
    const item = await screen.findByRole('menuitemcheckbox', { name: /Show grid/i });
    expect(item.getAttribute('aria-checked')).toBe('false');
    await fireEvent.click(item);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    const again = await screen.findByRole('menuitemcheckbox', { name: /Show grid/i });
    expect(again.getAttribute('aria-checked')).toBe('true');
  });
});

describe('ContextMenu', () => {
  it('opens from a contextmenu event on the trigger region', async () => {
    const { container } = render(MenusHarness, { props: { mode: 'context' } });
    const region = container.querySelector('[data-tx-context-menu-trigger]') as HTMLElement;
    expect(region).toBeTruthy();
    await fireEvent.contextMenu(region);
    const menu = await screen.findByRole('menu');
    expect(menu.className).toContain('tx-menu-content');
    expect(screen.getByRole('menuitem', { name: 'Cut' })).toBeTruthy();
  });
});

describe('Menubar', () => {
  it('renders top-level triggers and opens a menu', async () => {
    render(MenusHarness, { props: { mode: 'menubar' } });
    const bar = screen.getByRole('menubar', { name: 'Application' });
    expect(bar.className).toContain('tx-menubar');
    const file = screen.getByRole('menuitem', { name: 'File' });
    await fireEvent.click(file);
    const menu = await screen.findByRole('menu');
    expect(menu.className).toContain('tx-menu-content');
    expect(screen.getByRole('menuitem', { name: 'New' })).toBeTruthy();
  });
});
