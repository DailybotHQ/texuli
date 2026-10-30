import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import type { SortableContainer, SortableEvent } from '@texuli/drag/sortable';
import { sortableIntent } from '@texuli/primitives/sortable';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Fixture from './sortable-fixture.svelte';

const list = (
  id: string,
  n: number,
  extra: Partial<SortableContainer> = {}
): SortableContainer => ({
  id,
  items: Array.from({ length: n }, (_, i) => `${id}${i + 1}`),
  ...extra,
});

function setup(props: Partial<{ containers: SortableContainer[] } & Record<string, unknown>> = {}) {
  const announcements: string[] = [];
  const events: SortableEvent[] = [];
  const onMove = vi.fn();
  const result = render(Fixture, {
    props: {
      containers: props.containers ?? [list('a', 3)],
      announce: (message: string) => announcements.push(message),
      onEvent: (event: SortableEvent) => events.push(event),
      onMove,
      ...props,
    },
  });
  return { ...result, announcements, events, onMove };
}

const handle = (name: string) => screen.getByRole('button', { name });
const order = (listName: string) =>
  within(screen.getByRole('list', { name: listName }))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));

async function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  await fireEvent.keyDown(target, { key, ...init });
  await tick();
}

afterEach(() => cleanup());

describe('sortable key mapping', () => {
  it('maps keys through @texuli/core/keyboard, flipping inline arrows in RTL', () => {
    expect(sortableIntent({ key: ' ' }, { dragging: false })).toBe('pickUp');
    expect(sortableIntent({ key: 'Enter' }, { dragging: true })).toBe('drop');
    expect(sortableIntent({ key: 'Esc' }, { dragging: true })).toBe('cancel');
    expect(sortableIntent({ key: 'Tab' }, { dragging: true })).toBe('cancel');
    expect(sortableIntent({ key: 'ArrowDown' }, { dragging: false })).toBeNull();
    expect(sortableIntent({ key: 'ArrowDown' }, { dragging: true })).toBe('moveNext');
    expect(sortableIntent({ key: 'ArrowUp', altKey: true }, { dragging: true })).toBeNull();
    expect(sortableIntent({ key: 'Enter', isComposing: true }, { dragging: false })).toBeNull();
    expect(sortableIntent({ key: 'ArrowRight' }, { dragging: true, nested: true })).toBe(
      'moveInto'
    );
    expect(
      sortableIntent({ key: 'ArrowLeft' }, { dragging: true, nested: true, direction: 'rtl' })
    ).toBe('moveInto');
    const row = { dragging: true, orientation: 'horizontal' as const };
    expect(sortableIntent({ key: 'ArrowLeft' }, { ...row, direction: 'rtl' })).toBe('moveNext');
    expect(sortableIntent({ key: 'ArrowRight' }, row)).toBe('moveNext');
    expect(sortableIntent({ key: 'ArrowDown' }, { ...row, nested: true })).toBe('moveInto');
    expect(sortableIntent({ key: 'ArrowDown' }, { dragging: true, orientation: 'grid' })).toBe(
      'moveNext'
    );
  });
});

describe('Sortable binding', () => {
  it('renders handles as described buttons with a role description, never aria-grabbed', () => {
    const { container } = setup();
    const button = handle('Card a1');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-roledescription')).toBe('draggable item');
    const described = button.getAttribute('aria-describedby') ?? '';
    expect(container.ownerDocument.getElementById(described)?.textContent).toMatch(
      /Space or Enter to pick up/
    );
    expect(container.querySelector('[aria-grabbed],[aria-dropeffect]')).toBeNull();
    expect(screen.getByRole('list', { name: 'List A' })).toBeTruthy();
  });

  it('picks up, moves in place, drops and keeps focus on the handle', async () => {
    const { announcements, onMove, events } = setup();
    const button = handle('Card a1');
    button.focus();
    await press(button, ' ');
    expect(announcements.at(-1)).toBe('Card a1 picked up. Position 1 of 3 in List A.');
    await press(button, 'ArrowDown');
    expect(order('List A')).toEqual(['Card a2', 'Card a1', 'Card a3']);
    expect(handle('Card a1').hasAttribute('data-dragging')).toBe(true);
    await press(handle('Card a1'), 'Enter');
    await tick();
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(order('List A')).toEqual(['Card a2', 'Card a1', 'Card a3']);
    expect(announcements.at(-1)).toBe('Card a1 dropped at position 2 of 3 in List A.');
    expect(document.activeElement).toBe(handle('Card a1'));
    expect(events.map((e) => e.type)).toEqual(['start', 'over', 'over', 'drop', 'update']);
  });

  it('Escape restores the position and keeps focus', async () => {
    const { announcements, onMove } = setup();
    const button = handle('Card a2');
    button.focus();
    await press(button, 'Enter');
    await press(handle('Card a2'), 'ArrowDown');
    await press(handle('Card a2'), 'Escape');
    await tick();
    expect(order('List A')).toEqual(['Card a1', 'Card a2', 'Card a3']);
    expect(onMove).not.toHaveBeenCalled();
    expect(announcements.at(-1)).toBe(
      'Move cancelled. Card a2 returned to position 2 of 3 in List A.'
    );
    expect(document.activeElement).toBe(handle('Card a2'));
  });

  it('Tab cancels without blocking focus movement', async () => {
    setup();
    const button = handle('Card a1');
    await press(button, ' ');
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    handle('Card a1').dispatchEvent(tab);
    await tick();
    expect(tab.defaultPrevented).toBe(false);
    expect(handle('Card a1').hasAttribute('data-dragging')).toBe(false);
  });

  it('announces refusals for locked items and marks their handles', async () => {
    const { announcements } = setup({ containers: [list('a', 2, { locked: ['a1'] })] });
    expect(handle('Card a1').getAttribute('aria-disabled')).toBe('true');
    await press(handle('Card a1'), ' ');
    expect(announcements.at(-1)).toBe('Cannot move Card a1 there: it is locked.');
    expect(handle('Card a1').hasAttribute('data-dragging')).toBe(false);
  });

  it('moves between lists with crossContainers and updates the bound containers', async () => {
    const { announcements } = setup({
      containers: [list('a', 2, { group: 'g' }), list('b', 1, { group: 'g' })],
      crossContainers: true,
    });
    await press(handle('Card a2'), ' ');
    await press(handle('Card a2'), 'ArrowDown');
    expect(announcements.at(-1)).toBe('Card a2 moved to List B, position 1 of 2.');
    await press(handle('Card a2'), ' ');
    expect(order('List A')).toEqual(['Card a1']);
    expect(order('List B')).toEqual(['Card a2', 'Card b1']);
  });

  it('nests and un-nests in a tree with the cross-axis arrows (RTL flipped)', async () => {
    const containers = [
      { id: 'root', items: ['n1', 'n2'], group: 't' },
      { id: 'n1-kids', items: [], group: 't', parentId: 'n1' },
    ];
    setup({ containers, dir: 'rtl' });
    await press(handle('Card n2'), ' ');
    await press(handle('Card n2'), 'ArrowLeft');
    await press(handle('Card n2'), ' ');
    expect(order('List N1-KIDS')).toEqual(['Card n2']);
  });

  it('drags a multi-selection as one block', async () => {
    const { announcements } = setup({ containers: [list('a', 4)], selection: ['a1', 'a2'] });
    await press(handle('Card a1'), ' ');
    expect(announcements.at(-1)).toBe('2 items picked up. Position 1 of 4 in List A.');
    await press(handle('Card a1'), 'ArrowDown');
    await press(handle('Card a1'), ' ');
    expect(order('List A')).toEqual(['Card a3', 'Card a1', 'Card a2', 'Card a4']);
  });

  it('lets onMove veto a move and uses localized messages', async () => {
    const { announcements } = setup({
      onMove: () => false,
      messages: { pickedUp: '{item} levantado ({position}/{total}).' },
    });
    await press(handle('Card a1'), ' ');
    expect(announcements.at(-1)).toBe('Card a1 levantado (1/3).');
    await press(handle('Card a1'), 'ArrowDown');
    await press(handle('Card a1'), ' ');
    expect(order('List A')).toEqual(['Card a1', 'Card a2', 'Card a3']);
  });

  it('shows drop indicators instead of reordering in overlay mode', async () => {
    const { container } = setup({ preview: 'overlay' });
    await press(handle('Card a1'), ' ');
    await press(handle('Card a1'), 'ArrowDown');
    expect(order('List A')).toEqual(['Card a1', 'Card a2', 'Card a3']);
    expect(
      container.querySelector('[data-drop-indicator="before"]')?.getAttribute('data-sortable-item')
    ).toBe('a3');
    expect(container.querySelector('[data-drop-target]')?.getAttribute('data-sortable-list')).toBe(
      'a'
    );
  });

  it('swaps in swap mode', async () => {
    setup({ mode: 'swap' });
    await press(handle('Card a1'), ' ');
    await press(handle('Card a1'), 'ArrowDown');
    await press(handle('Card a1'), 'ArrowDown');
    await press(handle('Card a1'), ' ');
    expect(order('List A')).toEqual(['Card a3', 'Card a2', 'Card a1']);
  });

  it('drags with the pointer past the 4 px threshold and cancels on pointercancel', async () => {
    const { events } = setup();
    const button = handle('Card a1');
    await fireEvent.pointerDown(button, {
      pointerId: 1,
      clientX: 5,
      clientY: 5,
      button: 0,
      isPrimary: true,
    });
    await fireEvent.pointerMove(button, { pointerId: 1, clientX: 6, clientY: 6 });
    expect(events).toHaveLength(0);
    await fireEvent.pointerMove(button, { pointerId: 1, clientX: 5, clientY: 30 });
    expect(events[0]?.type).toBe('start');
    await fireEvent.pointerCancel(button, { pointerId: 1 });
    expect(events.at(-1)?.type).toBe('cancel');
  });
});

describe('sortable handle target', () => {
  it('reads the system target size token with its 24px fallback', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(join(__dirname, '../src/sortable/SortableHandle.svelte'), 'utf8');
    for (const property of ['min-inline-size', 'min-block-size']) {
      expect(source).toContain(`${property}: var(--tx-size-target-min, 24px);`);
    }
  });
});
