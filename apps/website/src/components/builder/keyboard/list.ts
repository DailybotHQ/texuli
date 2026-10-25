import { tick } from 'svelte';

/**
 * Keyboard support for the inspector's item lists (text list items, gallery
 * images, struct list items): Alt+ArrowUp / Alt+ArrowDown move the item the
 * focus is in, as the outline's rows move; after any move or removal, by key
 * or by button, focus follows the item instead of staying on a control that
 * now belongs to another one (or that is gone or disabled); and a polite
 * status says what happened.
 *
 * The editors keep their own edit logic. They mark the list container
 * (`use:listKeyboard`), each item (`data-list-item`), the item's controls
 * (`data-list-control="up" | "down" | "remove"`) and the add button
 * (`data-list-control="add"`). A key press clicks the item's own control, so
 * keys and buttons share one path. Nested lists (a struct list inside a
 * struct list item) handle their own items.
 */

export type ListControl = 'up' | 'down' | 'remove';

export interface ListFocusTarget {
  /** The item to focus in, or `null` for the list's add control. */
  index: number | null;
  /** The control to prefer inside the item; `null` keeps the same focus slot. */
  control: ListControl | null;
}

/**
 * Where focus goes after `control` acted on the item at `index`, with
 * `count` items left. A move follows the item; a removal stays at the same
 * position (the next item), else the previous one, else the add control.
 */
export function listFocusAfter(
  control: ListControl,
  index: number,
  count: number
): ListFocusTarget {
  if (control === 'up') return { index: Math.max(0, index - 1), control: 'up' };
  if (control === 'down') return { index: Math.min(count - 1, index + 1), control: 'down' };
  if (count === 0) return { index: null, control: null };
  return { index: Math.min(index, count - 1), control: 'remove' };
}

/** The move an Alt+Arrow key asks for, or `null` (other modifiers or keys do nothing). */
export function listMoveKey(
  event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>
): 'up' | 'down' | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (event.key === 'ArrowUp') return 'up';
  if (event.key === 'ArrowDown') return 'down';
  return null;
}

/** The status line after an action, 1-based for people. */
export function listAnnouncement(
  label: string,
  control: ListControl,
  index: number,
  count: number
): string {
  const name = label.charAt(0).toUpperCase() + label.slice(1);
  if (control === 'remove') {
    return count === 0 ? `${name} removed. The list is empty.` : `${name} removed. ${count} left.`;
  }
  return `${name} moved to position ${index + 1} of ${count}.`;
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export interface ListKeyboardOptions {
  /** What one item is called in announcements, such as "item" or "image". */
  label: string;
}

/** Svelte action for a list container. */
export function listKeyboard(node: HTMLElement, initial: ListKeyboardOptions) {
  let options = initial;
  node.setAttribute('data-list', '');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('data-list-status', '');
  // Visually hidden, through CSSOM so a strict style-src policy allows it.
  Object.assign(status.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: '0',
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
    border: '0',
  });
  node.append(status);

  const own = (element: Element | null, selector: string) =>
    element !== null &&
    element.closest(selector) !== null &&
    element.closest('[data-list]') === node;
  const items = () =>
    [...node.querySelectorAll<HTMLElement>('[data-list-item]')].filter(
      (item) => item.parentElement?.closest('[data-list]') === node
    );
  const itemOf = (element: Element | null): HTMLElement | null => {
    let item = element?.closest<HTMLElement>('[data-list-item]') ?? null;
    while (item && item.parentElement?.closest('[data-list]') !== node) {
      item = item.parentElement?.closest<HTMLElement>('[data-list-item]') ?? null;
    }
    return item;
  };
  const controlIn = (item: HTMLElement, control: string) =>
    [...item.querySelectorAll<HTMLButtonElement>(`[data-list-control="${control}"]`)].find(
      (button) => itemOf(button) === item
    );
  const focusables = (item: HTMLElement) =>
    [...item.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => itemOf(element) === item
    );

  /** After the editor re-renders, put focus where the action says and announce it. */
  function settle(control: ListControl, index: number, slot: number | null) {
    // A macrotask, then Svelte's flush: the editor's change has been painted.
    setTimeout(() => {
      void tick().then(() => {
        const list = items();
        const target = listFocusAfter(control, index, list.length);
        const item = target.index === null ? undefined : list[target.index];
        let next: HTMLElement | undefined;
        if (item) {
          const preferred =
            slot === null && target.control ? controlIn(item, target.control) : undefined;
          next =
            (preferred && !preferred.disabled ? preferred : undefined) ??
            (slot !== null ? focusables(item)[slot] : undefined) ??
            focusables(item).find((element) => element.hasAttribute('data-list-control')) ??
            focusables(item)[0];
        }
        next ??= [...node.querySelectorAll<HTMLButtonElement>('[data-list-control="add"]')].find(
          (button) => button.closest('[data-list]') === node && !button.disabled
        );
        next?.focus();
        status.textContent = listAnnouncement(
          options.label,
          control,
          target.index ?? 0,
          list.length
        );
      });
    }, 0);
  }

  function onclick(event: MouseEvent) {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      '[data-list-control]'
    );
    if (!button || !own(button, '[data-list-control]')) return;
    const control = button.getAttribute('data-list-control');
    if (control !== 'up' && control !== 'down' && control !== 'remove') return;
    const item = itemOf(button);
    if (!item) return;
    settle(control, items().indexOf(item), null);
  }

  function onkeydown(event: KeyboardEvent) {
    const move = listMoveKey(event);
    if (!move) return;
    const item = itemOf(event.target as Element | null);
    if (!item) return;
    const button = controlIn(item, move);
    event.preventDefault();
    event.stopPropagation();
    if (!button || button.disabled) return;
    // Keep the same field focused in the moved item (unless the focus is on a control).
    const active = document.activeElement as HTMLElement | null;
    const slot =
      active && !active.hasAttribute('data-list-control') ? focusables(item).indexOf(active) : -1;
    // Read the index before the click: the editor may re-render the item away.
    const index = items().indexOf(item);
    button.click();
    if (slot >= 0) {
      // The click already scheduled a settle; this one, later, wins with the field slot.
      settle(move, index, slot);
    }
  }

  // Capture: read the item's index before the editor's own handler re-renders the list.
  node.addEventListener('click', onclick, true);
  node.addEventListener('keydown', onkeydown);
  return {
    update(next: ListKeyboardOptions) {
      options = next;
    },
    destroy() {
      node.removeEventListener('click', onclick, true);
      node.removeEventListener('keydown', onkeydown);
      status.remove();
    },
  };
}
