import { directionOf, type TextDirection } from '../dir-locale/dir-locale.ts';
import {
  getNavigationIntent,
  type KeyboardEventLike,
  type NavigationIntent,
} from '../keyboard/keys.ts';
import { createTypeahead, type Typeahead } from './typeahead.ts';

/**
 * True when a roving item cannot be chosen: `disabled`, `aria-disabled="true"`
 * or `hidden`. Disabled items are skipped by arrows, Home/End and typeahead.
 */
export function isItemDisabled(item: Element): boolean {
  return (
    item.hasAttribute('disabled') ||
    item.getAttribute('aria-disabled') === 'true' ||
    item.hasAttribute('hidden')
  );
}

export interface RovingStepOptions {
  /** Past the last item, go to the first (and back). Defaults to `true`. */
  wrap?: boolean;
  /** Items PageUp and PageDown move. Defaults to 10. */
  pageSize?: number;
  /** Whether an item can take focus; every item by default. */
  enabled?: (index: number) => boolean;
}

/**
 * The index a navigation intent moves to among `count` items, skipping items
 * that are not `enabled`, or -1 when no item is enabled. From -1 (nothing
 * active), `next` starts at the first item and `previous` at the last. Pages
 * clamp at the ends instead of wrapping.
 */
export function stepRovingIndex(
  count: number,
  from: number,
  intent: NavigationIntent,
  options: RovingStepOptions = {}
): number {
  const { wrap = true, pageSize = 10, enabled = () => true } = options;
  const scan = (start: number, step: 1 | -1, loop: boolean): number => {
    for (let i = 0, at = start; i < count; i++, at += step) {
      if (at < 0 || at >= count) {
        if (!loop) break;
        at = (at + count) % count;
      }
      if (enabled(at)) return at;
    }
    return -1;
  };
  switch (intent) {
    case 'first':
      return scan(0, 1, false);
    case 'last':
      return scan(count - 1, -1, false);
    case 'next':
      return from < 0 ? scan(0, 1, false) : scan(from + 1, 1, wrap);
    case 'previous':
      return from < 0 ? scan(count - 1, -1, false) : scan(from - 1, -1, wrap);
    default: {
      // A page: the nearest enabled item at or before the target (still moving
      // away from `from`), else the nearest one past it, else stay.
      const step = intent === 'page-next' ? 1 : -1;
      const base = from < 0 ? (step > 0 ? -1 : count) : from;
      const target = Math.max(0, Math.min(count - 1, base + step * pageSize));
      const back = scan(target, step > 0 ? -1 : 1, false);
      if (back !== -1 && (step > 0 ? back > from : from < 0 || back < from)) return back;
      const ahead = scan(target, step, false);
      return ahead === -1 ? from : ahead;
    }
  }
}

/** Gives the item at `active` `tabindex="0"` and every other item `-1`. */
export function setRovingTabIndex(items: readonly HTMLElement[], active: number): void {
  items.forEach((item, index) => {
    item.tabIndex = index === active ? 0 : -1;
  });
}

/**
 * The index of the first selected item: `aria-checked`, `aria-selected` or
 * `aria-pressed` equal to `"true"`, or -1. For single-selection widgets
 * (radio group, tabs, single toggle group) as the `selected` option.
 */
export function indexOfSelected(items: readonly Element[]): number {
  return items.findIndex(
    (item) =>
      item.getAttribute('aria-checked') === 'true' ||
      item.getAttribute('aria-selected') === 'true' ||
      item.getAttribute('aria-pressed') === 'true'
  );
}

/** The text typeahead matches for an item: `data-typeahead`, else its text. */
export function typeaheadLabel(item: Element): string {
  return (item.getAttribute('data-typeahead') ?? item.textContent ?? '').trim();
}

export interface RovingFocusOptions {
  /** The current items, in visual order (read on every key, so it may change). */
  items: () => readonly HTMLElement[];
  /** Which arrows move. */
  orientation: 'horizontal' | 'vertical' | 'both';
  /** Text direction, or an element to read it from with `directionOf`. Defaults to `ltr`. */
  direction?: TextDirection | Element;
  wrap?: boolean;
  homeEnd?: boolean;
  pageKeys?: boolean;
  pageSize?: number;
  /** Let disabled items take focus (some menus do, so users find them). Defaults to `false`. */
  focusDisabled?: boolean;
  /** Turn on typeahead: typed characters move to the matching item. */
  typeahead?: boolean | { timeout?: number; now?: () => number };
  /** Called after the active item changes. */
  onActiveChange?: (index: number, item: HTMLElement) => void;
  /**
   * The index of the selected item (the checked radio, the selected tab), or
   * -1. When set, `sync()` makes it the tab stop unless focus is already on
   * an item, so the widget is entered on its selection (WAI-ARIA APG); with
   * nothing selected, the first enabled item. Call `sync()` after the
   * selection changes.
   */
  selected?: () => number;
}

export interface RovingFocus {
  /** The active index, or -1. */
  readonly active: number;
  /** Makes `index` active, updates tabindex and (by default) focuses it. */
  setActive(index: number, options?: { focus?: boolean }): void;
  /** Handles a keydown; returns `true` (and prevents the default) when it moved focus. */
  handleKeydown(event: KeyboardEventLike & { preventDefault?: () => void }): boolean;
  /** Makes a focused item active (attach to `focusin`, so clicks and Tab keep tabindex right). */
  handleFocusIn(event: { target: EventTarget | null }): void;
  /**
   * Re-applies tabindex after items or the selection change. The tab stop is,
   * in order: the focused item, the selected item, the active item, the first
   * enabled item.
   */
  sync(): void;
}

/**
 * Roving tabindex for a composite widget (toolbar, tabs, listbox, menu,
 * radio group). One item is in the tab order; arrows, Home/End, PageUp/Down
 * and typeahead move focus among the rest. It attaches no listeners: wire
 * `handleKeydown` and `handleFocusIn` to the container, and call `sync()`
 * when items change.
 */
export function createRovingFocus(options: RovingFocusOptions): RovingFocus {
  let active = -1;
  const typeahead: Typeahead | null = options.typeahead
    ? createTypeahead(options.typeahead === true ? {} : options.typeahead)
    : null;
  const enabledIn =
    (items: readonly HTMLElement[]) =>
    (index: number): boolean => {
      const item = items[index];
      return !!item && (options.focusDisabled === true || !isItemDisabled(item));
    };

  const roving: RovingFocus = {
    get active() {
      return active;
    },
    setActive(index, { focus = true } = {}) {
      const items = options.items();
      const item = items[index];
      if (!item) return;
      const changed = index !== active;
      active = index;
      setRovingTabIndex(items, index);
      if (focus) item.focus();
      if (changed) options.onActiveChange?.(index, item);
    },
    handleKeydown(event) {
      const items = options.items();
      const enabled = enabledIn(items);
      const { direction } = options;
      const intent = getNavigationIntent(event, {
        orientation: options.orientation,
        direction: typeof direction === 'object' ? directionOf(direction) : direction,
        ...(options.homeEnd === undefined ? {} : { homeEnd: options.homeEnd }),
        ...(options.pageKeys === undefined ? {} : { pageKeys: options.pageKeys }),
      });
      const target = intent
        ? stepRovingIndex(items.length, active, intent, {
            enabled,
            ...(options.wrap === undefined ? {} : { wrap: options.wrap }),
            ...(options.pageSize === undefined ? {} : { pageSize: options.pageSize }),
          })
        : (typeahead?.match(event, items.map(typeaheadLabel), active, enabled) ?? -1);
      if (target < 0) return false;
      event.preventDefault?.();
      roving.setActive(target);
      return true;
    },
    handleFocusIn(event) {
      const index = options.items().indexOf(event.target as HTMLElement);
      if (index >= 0 && index !== active) roving.setActive(index, { focus: false });
    },
    sync() {
      const items = options.items();
      const enabled = enabledIn(items);
      const focusedElement = items[0]?.ownerDocument.activeElement;
      const focused = focusedElement ? items.indexOf(focusedElement as HTMLElement) : -1;
      const selected = options.selected?.() ?? -1;
      let keep = stepRovingIndex(items.length, -1, 'first', { enabled });
      if (enabled(focused)) keep = focused;
      else if (enabled(selected)) keep = selected;
      else if (enabled(active)) keep = active;
      active = -1;
      if (keep >= 0) roving.setActive(keep, { focus: false });
      else setRovingTabIndex(items, -1);
    },
  };
  return roving;
}
