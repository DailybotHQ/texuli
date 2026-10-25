// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import {
  listAnnouncement,
  listFocusAfter,
  listKeyboard,
  listMoveKey,
} from '../../apps/website/src/components/builder/keyboard/list.ts';
import {
  isPaneKey,
  nextPane,
  paneCycle,
} from '../../apps/website/src/components/builder/keyboard/panes.ts';

/**
 * Builder keyboard navigation (Task 75): inspector item lists move with
 * Alt+Arrow, focus follows the item after a move or removal, and a status
 * says what happened.
 */

describe('list focus rules', () => {
  it.each([
    ['up', 2, 3, { index: 1, control: 'up' }],
    ['up', 0, 3, { index: 0, control: 'up' }],
    ['down', 0, 3, { index: 1, control: 'down' }],
    ['down', 2, 3, { index: 2, control: 'down' }],
    ['remove', 1, 2, { index: 1, control: 'remove' }],
    ['remove', 2, 2, { index: 1, control: 'remove' }],
    ['remove', 0, 0, { index: null, control: null }],
  ] as const)(
    'after %s on item %i with %i left, focus goes to %o',
    (control, index, count, target) => {
      expect(listFocusAfter(control, index, count)).toEqual(target);
    }
  );

  it('reads only plain Alt+ArrowUp and Alt+ArrowDown as moves', () => {
    const key = (key: string, mods: Partial<KeyboardEvent> = {}) =>
      listMoveKey({ key, altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });
    expect(key('ArrowUp')).toBe('up');
    expect(key('ArrowDown')).toBe('down');
    expect(key('ArrowUp', { altKey: false })).toBeNull();
    expect(key('ArrowUp', { shiftKey: true })).toBeNull();
    expect(key('ArrowUp', { metaKey: true })).toBeNull();
    expect(key('ArrowLeft')).toBeNull();
  });

  it('announces positions 1-based and the count left', () => {
    expect(listAnnouncement('image', 'up', 0, 3)).toBe('Image moved to position 1 of 3.');
    expect(listAnnouncement('item', 'remove', 0, 2)).toBe('Item removed. 2 left.');
    expect(listAnnouncement('item', 'remove', 0, 0)).toBe('Item removed. The list is empty.');
  });
});

/** A tiny editor like the inspector's: each button rewrites the list, keyed by index. */
function mountList(values: string[], options: { nested?: boolean } = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const list = document.createElement('fieldset');
  root.append(list);
  const action = listKeyboard(list, { label: 'item' });
  const render = () => {
    for (const old of [
      ...list.querySelectorAll(':scope > [data-list-item], :scope > [data-list-control="add"]'),
    ])
      old.remove();
    values.forEach((value, index) => {
      const item = document.createElement('div');
      item.setAttribute('data-list-item', '');
      const field = document.createElement('input');
      field.value = value;
      field.setAttribute('aria-label', `Item ${index + 1}`);
      const button = (control: string, text: string, disabled: boolean, run: () => void) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.textContent = text;
        element.disabled = disabled;
        element.setAttribute('data-list-control', control);
        element.addEventListener('click', () => {
          run();
          render();
        });
        return element;
      };
      const swap = (a: number, b: number) => {
        [values[a], values[b]] = [values[b] as string, values[a] as string];
      };
      item.append(
        field,
        button('up', `Move item ${index + 1} up`, index === 0, () => swap(index, index - 1)),
        button('down', `Move item ${index + 1} down`, index === values.length - 1, () =>
          swap(index, index + 1)
        ),
        button('remove', `Remove item ${index + 1}`, false, () => values.splice(index, 1))
      );
      if (options.nested && index === 0) {
        // A nested list inside an item handles its own keys and controls.
        const inner = document.createElement('div');
        listKeyboard(inner, { label: 'point' });
        const innerItem = document.createElement('div');
        innerItem.setAttribute('data-list-item', '');
        const innerField = document.createElement('input');
        innerField.setAttribute('aria-label', 'Point 1');
        innerItem.append(innerField);
        inner.append(innerItem);
        item.append(inner);
      }
      list.insertBefore(item, list.querySelector(':scope > [data-list-status]'));
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = 'Add item';
    add.setAttribute('data-list-control', 'add');
    list.insertBefore(add, list.querySelector(':scope > [data-list-status]'));
  };
  render();
  return { list, values, action, root };
}

const settle = () => new Promise((done) => setTimeout(done, 10));
const focusedText = () => (document.activeElement as HTMLElement | null)?.textContent ?? '';
const focusedLabel = () =>
  (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? '';
const status = (list: HTMLElement) =>
  list.querySelector(':scope > [data-list-status]')?.textContent;
const press = (target: Element, key: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  );

describe('listKeyboard action', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('keeps focus on the moved item after a Move button', async () => {
    const { list, values } = mountList(['a', 'b', 'c']);
    const up = [...list.querySelectorAll('button')].find(
      (b) => b.textContent === 'Move item 3 up'
    ) as HTMLButtonElement;
    up.focus();
    up.click();
    await settle();
    expect(values).toEqual(['a', 'c', 'b']);
    // The moved item ("c") is now item 2; focus is on its Move up control.
    expect(focusedText()).toBe('Move item 2 up');
    expect(status(list)).toBe('Item moved to position 2 of 3.');
  });

  it('falls back to another control when the followed one is disabled at the edge', async () => {
    const { list } = mountList(['a', 'b']);
    const up = [...list.querySelectorAll('button')].find(
      (b) => b.textContent === 'Move item 2 up'
    ) as HTMLButtonElement;
    up.focus();
    up.click();
    await settle();
    // Item 1's Move up is disabled: focus lands on a live control of the same item, not on the page.
    expect(document.activeElement).not.toBe(document.body);
    expect(focusedText()).toMatch(/item 1/);
  });

  it('moves the item with Alt+Arrow and keeps the same field focused', async () => {
    const { list, values } = mountList(['a', 'b', 'c']);
    const field = list.querySelectorAll('input')[0] as HTMLInputElement;
    field.focus();
    press(field, 'ArrowDown', { altKey: true });
    await settle();
    expect(values).toEqual(['b', 'a', 'c']);
    expect(focusedLabel()).toBe('Item 2');
    expect((document.activeElement as HTMLInputElement).value).toBe('a');
    // At the end of the list the key does nothing and nothing breaks.
    press(document.activeElement as Element, 'ArrowDown', { altKey: true });
    press(document.activeElement as Element, 'ArrowDown', { altKey: true });
    await settle();
    expect(values).toEqual(['b', 'c', 'a']);
    expect(focusedLabel()).toBe('Item 3');
  });

  it('after Remove, focuses the next item, then the previous one, then Add', async () => {
    const { list, values } = mountList(['a', 'b']);
    const remove = () =>
      [...list.querySelectorAll('button')].find((b) =>
        b.textContent?.startsWith('Remove')
      ) as HTMLButtonElement;
    const last = [...list.querySelectorAll('button')].find(
      (b) => b.textContent === 'Remove item 2'
    ) as HTMLButtonElement;
    last.focus();
    last.click();
    await settle();
    expect(values).toEqual(['a']);
    expect(focusedText()).toBe('Remove item 1');
    expect(status(list)).toBe('Item removed. 1 left.');
    remove().click();
    await settle();
    expect(values).toEqual([]);
    expect(focusedText()).toBe('Add item');
    expect(status(list)).toBe('Item removed. The list is empty.');
  });

  it('leaves keys inside a nested list to that list', async () => {
    const { list, values } = mountList(['a', 'b'], { nested: true });
    const innerField = list.querySelector('[aria-label="Point 1"]') as HTMLInputElement;
    innerField.focus();
    press(innerField, 'ArrowDown', { altKey: true });
    await settle();
    // The nested point list has no move controls, so nothing moved in the outer list.
    expect(values).toEqual(['a', 'b']);
  });

  it('ignores plain arrows, so text fields keep their caret keys', async () => {
    const { list, values } = mountList(['a', 'b']);
    const field = list.querySelectorAll('input')[0] as HTMLInputElement;
    field.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    field.dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBe(false);
    expect(values).toEqual(['a', 'b']);
  });
});

describe('F6 pane cycling', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('steps forward and back, wrapping, and enters from outside at either end', () => {
    expect(nextPane(0, 6, false)).toBe(1);
    expect(nextPane(5, 6, false)).toBe(0);
    expect(nextPane(0, 6, true)).toBe(5);
    expect(nextPane(-1, 6, false)).toBe(0);
    expect(nextPane(-1, 6, true)).toBe(5);
    expect(nextPane(-1, 0, false)).toBe(-1);
    expect(isPaneKey({ key: 'F6', altKey: false, ctrlKey: false, metaKey: false })).toBe(true);
    expect(isPaneKey({ key: 'F6', altKey: false, ctrlKey: true, metaKey: false })).toBe(false);
  });

  /** Three panes: two buttons, a nested pane with a field, and an empty pane. */
  function mountPanes() {
    const root = document.createElement('section');
    const pane = (name: string) => {
      const element = document.createElement('div');
      element.setAttribute('data-builder-pane', '');
      element.setAttribute('aria-label', name);
      return element;
    };
    const button = (text: string, disabled = false) => {
      const element = document.createElement('button');
      element.textContent = text;
      element.disabled = disabled;
      return element;
    };
    const first = pane('First');
    first.append(button('Off', true), button('One'), button('Two'));
    const second = pane('Second');
    const inner = pane('Inner');
    const field = document.createElement('input');
    field.setAttribute('aria-label', 'Field');
    inner.append(field);
    second.append(button('Three'), inner);
    const empty = pane('Empty');
    root.append(first, second, empty);
    document.body.append(root);
    paneCycle(root);
    return root;
  }
  const f6 = (shiftKey = false) =>
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F6', shiftKey, bubbles: true, cancelable: true })
    );
  const active = () => {
    const element = document.activeElement as HTMLElement;
    return element.getAttribute('aria-label') ?? element.textContent;
  };

  it('cycles panes in order, skips disabled controls, restores the last focus and focuses an empty pane', () => {
    const root = mountPanes();
    (root.querySelector('button:nth-of-type(3)') as HTMLButtonElement).focus(); // "Two"
    f6();
    expect(active()).toBe('Three');
    f6();
    expect(active()).toBe('Field'); // the nested pane
    f6();
    expect(active()).toBe('Empty'); // nothing focusable: the pane itself
    f6();
    expect(active()).toBe('Two'); // restored, not the first enabled button
    f6(true);
    expect(active()).toBe('Empty');
  });

  it('leaves F6 alone when an inner widget already handled it (the player frames)', () => {
    const root = mountPanes();
    const one = root.querySelector('button:nth-of-type(2)') as HTMLButtonElement;
    one.focus();
    one.addEventListener('keydown', (event) => event.preventDefault(), { once: true });
    f6();
    expect(active()).toBe('One');
  });
});
