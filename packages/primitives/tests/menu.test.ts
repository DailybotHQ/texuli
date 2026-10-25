import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import { graceArea, pointInPolygon } from '../src/menu/index.ts';
import MenuHarness from './fixtures/MenuHarness.svelte';

const trigger = () => screen.getByRole('button', { name: 'Actions' });
const focused = () => {
  const active = document.activeElement as HTMLElement | null;
  return active?.textContent?.trim() ?? '';
};
const key = async (key: string, target: Element = document.activeElement ?? document.body) => {
  await fireEvent.keyDown(target, { key });
  await tick();
};

async function openWith(keyName = 'Enter', props: Record<string, unknown> = {}) {
  const log: string[] = [];
  const view = render(MenuHarness, { props: { log, ...props } });
  trigger().focus();
  await key(keyName, trigger());
  await screen.findByRole('menu');
  return { ...view, log };
}

describe('Menu trigger', () => {
  it('names the popup, reports collapsed and expanded, and controls the menu', async () => {
    render(MenuHarness);
    const button = trigger();
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('data-state')).toBe('closed');
    expect(button.hasAttribute('aria-controls')).toBe(false);
    await fireEvent.click(button);
    const menu = await screen.findByRole('menu');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(menu.id);
    expect(menu.getAttribute('aria-labelledby')).toBe(button.id);
    expect(menu.getAttribute('data-state')).toBe('open');
  });

  it.each([
    ['Enter', 'Rename'],
    [' ', 'Rename'],
    ['ArrowDown', 'Rename'],
    ['ArrowUp', 'Delete'],
  ])('%j opens the menu on %s', async (keyName, expected) => {
    await openWith(keyName);
    expect(focused()).toBe(expected);
  });

  it('opens from a pointer with focus on the menu itself', async () => {
    render(MenuHarness);
    await fireEvent.click(trigger(), { detail: 1 });
    const menu = await screen.findByRole('menu');
    expect(document.activeElement).toBe(menu);
  });

  it('opens and closes from bind:open', async () => {
    const view = render(MenuHarness, { props: { open: true } });
    expect(await screen.findByRole('menu')).toBeTruthy();
    await view.rerender({ open: false });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });
});

describe('Menu keyboard (APG menu)', () => {
  it('moves with arrows, skips disabled items and wraps by default', async () => {
    await openWith();
    const stops: string[] = [];
    for (let i = 0; i < 9; i += 1) {
      await key('ArrowDown');
      stops.push(focused());
    }
    expect(stops).toEqual([
      'Duplicate',
      'Share',
      'Grid off',
      'Mixed',
      'Compact',
      'Comfortable',
      'Delete',
      'Rename',
      'Duplicate',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Archive' }).getAttribute('aria-disabled')).toBe(
      'true'
    );
  });

  it('stops at the ends when loop is false', async () => {
    await openWith('ArrowUp', { loop: false });
    await key('ArrowDown');
    expect(focused()).toBe('Delete');
    await key('Home');
    expect(focused()).toBe('Rename');
    await key('ArrowUp');
    expect(focused()).toBe('Rename');
    await key('End');
    expect(focused()).toBe('Delete');
  });

  it('moves to the item whose text (or textValue) starts with what is typed', async () => {
    await openWith();
    await key('d');
    expect(focused()).toBe('Duplicate');
    await key('d');
    expect(focused()).toBe('Delete');
  });

  it('marks the focused item highlighted', async () => {
    await openWith();
    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    expect(rename.hasAttribute('data-highlighted')).toBe(true);
    await key('ArrowDown');
    expect(rename.hasAttribute('data-highlighted')).toBe(false);
  });

  it('runs an item with Enter, closes the menu and returns focus to the trigger', async () => {
    const { log } = await openWith();
    await key('ArrowDown');
    await key('Enter');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(log).toContain('duplicate');
    expect(document.activeElement).toBe(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the menu open when onSelect prevents the default', async () => {
    const { log } = await openWith('Enter', { keepOpenOnRename: true });
    await key('Enter');
    expect(log).toContain('rename');
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('never runs a disabled item', async () => {
    const { log } = await openWith();
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(log).not.toContain('archive');
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('closes on Escape and on Tab, returning focus to the trigger', async () => {
    await openWith();
    await key('Escape');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger());
    await key('Enter', trigger());
    await screen.findByRole('menu');
    await key('Tab');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on a pointer press outside without moving focus back', async () => {
    const { log } = await openWith();
    const after = screen.getByRole('button', { name: 'After' });
    await fireEvent.pointerDown(after, { button: 0 });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(log).toContain('open:false');
  });
});

describe('Menu checkbox and radio items', () => {
  it('toggles a checkbox item and passes the state to its children', async () => {
    const { log } = await openWith();
    const grid = screen.getByRole('menuitemcheckbox', { name: 'Grid off' });
    expect(grid.getAttribute('aria-checked')).toBe('false');
    expect(grid.getAttribute('data-state')).toBe('unchecked');
    await fireEvent.click(grid);
    await tick();
    expect(grid.getAttribute('aria-checked')).toBe('true');
    expect(grid.textContent?.trim()).toBe('Grid on');
    expect(log).toContain('grid:true');
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('reports mixed, and checks a mixed item on the next choice', async () => {
    await openWith();
    const mixed = screen.getByRole('menuitemcheckbox', { name: 'Mixed' });
    expect(mixed.getAttribute('aria-checked')).toBe('mixed');
    expect(mixed.getAttribute('data-state')).toBe('indeterminate');
    await fireEvent.click(mixed);
    await tick();
    expect(mixed.getAttribute('aria-checked')).toBe('true');
  });

  it('checks one radio item in a group named by its heading', async () => {
    const { log } = await openWith();
    const group = screen.getByRole('group', { name: 'Density' });
    expect(group).toBeTruthy();
    const compact = screen.getByRole('menuitemradio', { name: 'Compact' });
    expect(compact.getAttribute('aria-checked')).toBe('false');
    expect(
      screen.getByRole('menuitemradio', { name: 'Comfortable' }).getAttribute('aria-checked')
    ).toBe('true');
    await fireEvent.click(compact);
    await waitFor(() => expect(screen.getByTestId('state').textContent).toContain('compact'));
    expect(log).toContain('density:compact');
    // A radio item closes the menu by default.
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('names groups by their heading and separates sections', async () => {
    await openWith();
    expect(screen.getByRole('group', { name: 'Danger zone' })).toBeTruthy();
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('horizontal');
  });
});

describe('Menu submenus', () => {
  async function toShare() {
    const opened = await openWith();
    await key('s');
    expect(focused()).toBe('Share');
    return opened;
  }

  it('opens with ArrowRight on its first item and closes with ArrowLeft', async () => {
    await toShare();
    const share = screen.getByRole('menuitem', { name: 'Share' });
    expect(share.getAttribute('aria-haspopup')).toBe('menu');
    expect(share.getAttribute('aria-expanded')).toBe('false');
    await key('ArrowRight');
    await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(2));
    expect(focused()).toBe('Email');
    expect(share.getAttribute('aria-expanded')).toBe('true');
    expect(share.getAttribute('data-state')).toBe('open');
    await key('ArrowLeft');
    await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(1));
    expect(focused()).toBe('Share');
  });

  it('keeps arrows and typeahead inside the open submenu', async () => {
    await toShare();
    await key('Enter');
    await waitFor(() => expect(focused()).toBe('Email'));
    await key('ArrowDown');
    expect(focused()).toBe('Copy link');
    await key('ArrowDown');
    expect(focused()).toBe('Email');
  });

  it('closes only the submenu on Escape', async () => {
    await toShare();
    await key('ArrowRight');
    await waitFor(() => expect(focused()).toBe('Email'));
    await key('Escape');
    await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(1));
    expect(focused()).toBe('Share');
  });

  it('closes every level when a submenu item runs', async () => {
    const { log } = await toShare();
    await key('ArrowRight');
    await waitFor(() => expect(focused()).toBe('Email'));
    await key('ArrowDown');
    await key('Enter');
    await waitFor(() => expect(screen.queryAllByRole('menu')).toHaveLength(0));
    expect(log).toContain('link');
    expect(document.activeElement).toBe(trigger());
  });

  it('closes an open submenu when the highlight moves to another item', async () => {
    await toShare();
    await key('ArrowRight');
    await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(2));
    await key('ArrowLeft');
    await key('ArrowDown');
    expect(focused()).toBe('Grid off');
    expect(screen.getAllByRole('menu')).toHaveLength(1);
  });
});

describe('grace area', () => {
  const sub = { left: 200, top: 100, right: 320, bottom: 220 };

  it('covers the path from the exit point to the submenu', () => {
    const polygon = graceArea({ x: 190, y: 120 }, sub, 'right');
    expect(pointInPolygon({ x: 195, y: 130 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 199, y: 210 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 250, y: 160 }, polygon)).toBe(true);
    // Away from the submenu, or behind the exit point.
    expect(pointInPolygon({ x: 150, y: 160 }, polygon)).toBe(false);
    expect(pointInPolygon({ x: 195, y: 260 }, polygon)).toBe(false);
  });

  it('mirrors for a submenu on the left (RTL)', () => {
    const left = { left: 0, top: 100, right: 120, bottom: 220 };
    const polygon = graceArea({ x: 130, y: 120 }, left, 'left');
    expect(pointInPolygon({ x: 125, y: 150 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 160, y: 150 }, polygon)).toBe(false);
  });

  it('treats a degenerate polygon as empty', () => {
    expect(pointInPolygon({ x: 0, y: 0 }, [])).toBe(false);
  });
});
