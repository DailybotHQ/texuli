import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRovingFocus,
  createTypeahead,
  indexOfSelected,
  isItemDisabled,
  setRovingTabIndex,
  stepRovingIndex,
  typeaheadLabel,
} from '../src/index.ts';

const key = (k: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key: k, cancelable: true, ...init });

afterEach(() => {
  document.body.replaceChildren();
});

/** A toolbar of buttons; `disabled` lists the indexes to disable. */
function toolbar(labels: string[], options: { disabled?: number[]; dir?: 'rtl' } = {}) {
  const root = document.createElement('div');
  if (options.dir) root.setAttribute('dir', options.dir);
  const items = labels.map((label, index) => {
    const button = document.createElement('button');
    button.textContent = label;
    if (options.disabled?.includes(index)) button.disabled = true;
    root.append(button);
    return button;
  });
  document.body.append(root);
  return { root, items };
}

describe('stepRovingIndex', () => {
  const enabledExcept =
    (...off: number[]) =>
    (index: number) =>
      !off.includes(index);

  it('moves next and previous, wrapping by default', () => {
    expect(stepRovingIndex(4, 0, 'next')).toBe(1);
    expect(stepRovingIndex(4, 3, 'next')).toBe(0);
    expect(stepRovingIndex(4, 0, 'previous')).toBe(3);
    expect(stepRovingIndex(4, 3, 'next', { wrap: false })).toBe(-1);
    expect(stepRovingIndex(4, 0, 'previous', { wrap: false })).toBe(-1);
  });

  it('starts from the ends when nothing is active', () => {
    expect(stepRovingIndex(4, -1, 'next')).toBe(0);
    expect(stepRovingIndex(4, -1, 'previous')).toBe(3);
  });

  it('skips disabled items, including at the ends and while wrapping', () => {
    const enabled = enabledExcept(0, 2);
    expect(stepRovingIndex(5, 1, 'next', { enabled })).toBe(3);
    expect(stepRovingIndex(5, 4, 'next', { enabled })).toBe(1);
    expect(stepRovingIndex(5, 3, 'first', { enabled })).toBe(1);
    expect(stepRovingIndex(5, 1, 'last', { enabled: enabledExcept(4) })).toBe(3);
    expect(stepRovingIndex(3, 0, 'next', { enabled: () => false })).toBe(-1);
    expect(stepRovingIndex(0, -1, 'first')).toBe(-1);
  });

  it('pages by pageSize, clamping at the ends and avoiding disabled targets', () => {
    expect(stepRovingIndex(30, 0, 'page-next')).toBe(10);
    expect(stepRovingIndex(30, 25, 'page-next')).toBe(29);
    expect(stepRovingIndex(30, 12, 'page-previous')).toBe(2);
    expect(stepRovingIndex(30, 3, 'page-previous', { pageSize: 5 })).toBe(0);
    // The target is disabled: the nearest enabled item before it.
    expect(stepRovingIndex(30, 0, 'page-next', { enabled: enabledExcept(10) })).toBe(9);
    // Everything between is disabled: the nearest enabled item past the target.
    const sparse = (index: number) => index === 0 || index === 15;
    expect(stepRovingIndex(30, 0, 'page-next', { enabled: sparse })).toBe(15);
    // Nothing enabled ahead: stay.
    expect(stepRovingIndex(5, 4, 'page-next', { enabled: enabledExcept(0, 1, 2, 3) })).toBe(4);
  });
});

describe('item helpers', () => {
  it('treats disabled, aria-disabled and hidden items as disabled', () => {
    const make = (attribute: string, value = '') => {
      const element = document.createElement('div');
      element.setAttribute(attribute, value);
      return element;
    };
    expect(isItemDisabled(make('disabled'))).toBe(true);
    expect(isItemDisabled(make('aria-disabled', 'true'))).toBe(true);
    expect(isItemDisabled(make('aria-disabled', 'false'))).toBe(false);
    expect(isItemDisabled(make('hidden'))).toBe(true);
    expect(isItemDisabled(document.createElement('div'))).toBe(false);
  });

  it('puts exactly one item in the tab order', () => {
    const { items } = toolbar(['A', 'B', 'C']);
    setRovingTabIndex(items, 1);
    expect(items.map((item) => item.tabIndex)).toEqual([-1, 0, -1]);
    setRovingTabIndex(items, -1);
    expect(items.map((item) => item.tabIndex)).toEqual([-1, -1, -1]);
  });

  it('labels items by data-typeahead, else their text', () => {
    const item = document.createElement('div');
    item.textContent = '  Apple  ';
    expect(typeaheadLabel(item)).toBe('Apple');
    item.setAttribute('data-typeahead', 'Banana');
    expect(typeaheadLabel(item)).toBe('Banana');
  });
});

describe('createRovingFocus', () => {
  it('syncs the tab order to the first enabled item and moves with arrows', () => {
    const { items } = toolbar(['Bold', 'Italic', 'Underline'], { disabled: [0] });
    const onActiveChange = vi.fn();
    const roving = createRovingFocus({
      items: () => items,
      orientation: 'horizontal',
      onActiveChange,
    });
    roving.sync();
    expect(roving.active).toBe(1);
    expect(items.map((item) => item.tabIndex)).toEqual([-1, 0, -1]);
    expect(document.activeElement).not.toBe(items[1]); // sync never steals focus

    const event = key('ArrowRight');
    expect(roving.handleKeydown(event)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items[2]);
    expect(items.map((item) => item.tabIndex)).toEqual([-1, -1, 0]);
    expect(onActiveChange).toHaveBeenLastCalledWith(2, items[2]);

    // Wraps past the end, skipping the disabled first item.
    roving.handleKeydown(key('ArrowRight'));
    expect(document.activeElement).toBe(items[1]);
  });

  it('flips arrows in RTL and ignores the other axis', () => {
    const { root, items } = toolbar(['One', 'Two', 'Three'], { dir: 'rtl' });
    const roving = createRovingFocus({
      items: () => items,
      orientation: 'horizontal',
      direction: root,
    });
    roving.setActive(0);
    expect(roving.handleKeydown(key('ArrowLeft'))).toBe(true);
    expect(document.activeElement).toBe(items[1]);
    const down = key('ArrowDown');
    expect(roving.handleKeydown(down)).toBe(false);
    expect(down.defaultPrevented).toBe(false);
    expect(roving.active).toBe(1);
  });

  it('honors wrap, Home and End, page keys and focusDisabled', () => {
    const labels = Array.from({ length: 15 }, (_, index) => `Item ${index}`);
    const { items } = toolbar(labels, { disabled: [14] });
    const roving = createRovingFocus({
      items: () => items,
      orientation: 'vertical',
      wrap: false,
      pageKeys: true,
      pageSize: 5,
    });
    roving.setActive(0);
    roving.handleKeydown(key('End'));
    expect(roving.active).toBe(13); // the last item is disabled
    expect(roving.handleKeydown(key('ArrowDown'))).toBe(false); // no wrap
    roving.handleKeydown(key('Home'));
    roving.handleKeydown(key('PageDown'));
    expect(roving.active).toBe(5);

    const reachable = createRovingFocus({
      items: () => items,
      orientation: 'vertical',
      focusDisabled: true,
    });
    reachable.setActive(13);
    reachable.handleKeydown(key('ArrowDown'));
    expect(reachable.active).toBe(14);
  });

  it('leaves platform chords and composition alone', () => {
    const { items } = toolbar(['A', 'B']);
    const roving = createRovingFocus({ items: () => items, orientation: 'horizontal' });
    roving.setActive(0);
    expect(roving.handleKeydown(key('ArrowRight', { metaKey: true }))).toBe(false);
    expect(roving.handleKeydown(key('ArrowRight', { isComposing: true }))).toBe(false);
    expect(roving.active).toBe(0);
  });

  it('follows focus from clicks or Tab, and keeps state across item changes', () => {
    const { root, items } = toolbar(['A', 'B', 'C']);
    const roving = createRovingFocus({
      items: () => [...root.querySelectorAll('button')],
      orientation: 'horizontal',
    });
    roving.sync();
    roving.handleFocusIn({ target: items[2] ?? null });
    expect(roving.active).toBe(2);
    expect(items[2]?.tabIndex).toBe(0);
    roving.handleFocusIn({ target: root });
    expect(roving.active).toBe(2);

    // The active item becomes disabled: sync moves the tab stop to the first enabled item.
    if (items[2]) items[2].disabled = true;
    roving.sync();
    expect(roving.active).toBe(0);
    expect(items.map((item) => item.tabIndex)).toEqual([0, -1, -1]);

    // Every item disabled: nothing is in the tab order.
    for (const item of items) item.disabled = true;
    roving.sync();
    expect(roving.active).toBe(-1);
    expect(items.map((item) => item.tabIndex)).toEqual([-1, -1, -1]);
  });

  it('moves to the typed item with typeahead', () => {
    let time = 0;
    const { items } = toolbar(['Apple', 'Banana', 'Blueberry', 'Cherry']);
    const roving = createRovingFocus({
      items: () => items,
      orientation: 'vertical',
      typeahead: { now: () => time },
    });
    roving.setActive(0);
    expect(roving.handleKeydown(key('c'))).toBe(true);
    expect(document.activeElement).toBe(items[3]);
    time += 600;
    roving.handleKeydown(key('b'));
    expect(roving.active).toBe(1);
    time += 100;
    roving.handleKeydown(key('l'));
    expect(roving.active).toBe(2);
    expect(roving.handleKeydown(key('Enter'))).toBe(false);
  });
});

describe('createRovingFocus with a selected item (FIX-roving-selected)', () => {
  const stops = (items: HTMLElement[]) => items.map((item) => item.tabIndex);

  it('sync makes the selected item the only tab stop, not the first', () => {
    const { items } = toolbar(['Free', 'Team', 'Business']);
    let selected = 1;
    const roving = createRovingFocus({
      items: () => items,
      orientation: 'horizontal',
      selected: () => selected,
    });
    roving.sync();
    expect(stops(items)).toEqual([-1, 0, -1]);
    expect(roving.active).toBe(1);
    selected = 2;
    roving.sync();
    expect(stops(items)).toEqual([-1, -1, 0]);
  });

  it('falls back to the first enabled item when nothing (or a disabled item) is selected', () => {
    const { items } = toolbar(['Free', 'Team', 'Business'], { disabled: [0, 2] });
    let selected = -1;
    const roving = createRovingFocus({
      items: () => items,
      orientation: 'horizontal',
      selected: () => selected,
    });
    roving.sync();
    expect(stops(items)).toEqual([-1, 0, -1]);
    selected = 2;
    roving.sync();
    expect(stops(items)).toEqual([-1, 0, -1]);
  });

  it('keeps a focused item as the tab stop while the user navigates', () => {
    const { items } = toolbar(['A', 'B', 'C']);
    const roving = createRovingFocus({
      items: () => items,
      orientation: 'horizontal',
      selected: () => 0,
    });
    roving.sync();
    items[2]?.focus();
    roving.sync();
    expect(stops(items)).toEqual([-1, -1, 0]);
    expect(roving.active).toBe(2);
  });

  it('indexOfSelected reads aria-checked, aria-selected or aria-pressed', () => {
    const { items } = toolbar(['A', 'B', 'C']);
    expect(indexOfSelected(items)).toBe(-1);
    items[1]?.setAttribute('aria-checked', 'true');
    expect(indexOfSelected(items)).toBe(1);
    items[1]?.setAttribute('aria-checked', 'false');
    items[2]?.setAttribute('aria-selected', 'true');
    expect(indexOfSelected(items)).toBe(2);
    items[2]?.removeAttribute('aria-selected');
    items[0]?.setAttribute('aria-pressed', 'true');
    expect(indexOfSelected(items)).toBe(0);
  });
});

describe('createTypeahead', () => {
  const labels = ['Apple', 'avocado', 'Banana', 'Blueberry', 'Blackberry', 'Cherry'];

  it('finds the first match after the current item, ignoring case', () => {
    const typeahead = createTypeahead({ now: () => 0 });
    expect(typeahead.match(key('b'), labels, 0)).toBe(2);
    expect(typeahead.buffer).toBe('b');
  });

  it('cycles through items starting with a repeated letter', () => {
    let time = 0;
    const typeahead = createTypeahead({ now: () => time });
    let current = typeahead.match(key('b'), labels, 0);
    expect(current).toBe(2);
    time += 100;
    current = typeahead.match(key('b'), labels, current);
    expect(current).toBe(3);
    time += 100;
    current = typeahead.match(key('b'), labels, current);
    expect(current).toBe(4);
    time += 100;
    expect(typeahead.match(key('b'), labels, current)).toBe(2); // wraps
  });

  it('refines with more letters, keeping the current item when it still matches', () => {
    let time = 0;
    const typeahead = createTypeahead({ now: () => time });
    const first = typeahead.match(key('b'), labels, 0);
    time += 100;
    expect(typeahead.match(key('l'), labels, first)).toBe(3);
    time += 100;
    expect(typeahead.match(key('a'), labels, 3)).toBe(4);
    expect(typeahead.buffer).toBe('bla');
  });

  it('starts over after the 500 ms timeout', () => {
    let time = 0;
    const typeahead = createTypeahead({ now: () => time });
    typeahead.match(key('b'), labels, 0);
    time += 499;
    typeahead.match(key('l'), labels, 2);
    expect(typeahead.buffer).toBe('bl');
    time += 501;
    expect(typeahead.match(key('c'), labels, 3)).toBe(5);
    expect(typeahead.buffer).toBe('c');
    const quick = createTypeahead({ timeout: 100, now: () => time });
    quick.match(key('a'), labels, -1);
    time += 150;
    quick.match(key('b'), labels, 0);
    expect(quick.buffer).toBe('b');
  });

  it('joins words with Space only once a search has started', () => {
    let time = 0;
    const typeahead = createTypeahead({ now: () => time });
    const words = ['New file', 'New folder', 'Open'];
    expect(typeahead.match(key(' '), words, 0)).toBe(-1);
    expect(typeahead.buffer).toBe('');
    typeahead.match(key('n'), words, -1);
    for (const char of 'ew f') {
      time += 50;
      typeahead.match(key(char), words, 0);
    }
    time += 50;
    expect(typeahead.match(key('o'), words, 0)).toBe(1);
  });

  it('ignores non-text keys, chords, composition and disabled items', () => {
    const typeahead = createTypeahead({ now: () => 0 });
    expect(typeahead.match(key('Enter'), labels, 0)).toBe(-1);
    expect(typeahead.match(key('b', { ctrlKey: true }), labels, 0)).toBe(-1);
    expect(typeahead.match(key('b', { isComposing: true }), labels, 0)).toBe(-1);
    expect(typeahead.buffer).toBe('');
    expect(typeahead.match(key('b'), labels, 0, (index) => index !== 2)).toBe(3);
    typeahead.reset();
    expect(typeahead.buffer).toBe('');
    expect(typeahead.match(key('z'), labels, 0)).toBe(-1);
  });
});
