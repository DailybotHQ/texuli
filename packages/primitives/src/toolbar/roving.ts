import { directionOf } from '@texuli/core/dir-locale';
import { getNavigationIntent } from '@texuli/core/keyboard';
import type { Attachment } from 'svelte/attachments';

const ITEM = '[data-toolbar-item]';

/** Roving focus for toolbars; all items, including disabled items, stay reachable. */
export function attachToolbarRovingFocus(
  orientation: 'horizontal' | 'vertical',
  loop: boolean
): Attachment<HTMLElement> {
  return (root) => {
    let items: HTMLElement[] = [];
    let active = -1;
    const original = new Map<HTMLElement, string | null>();
    const readItems = () => Array.from(root.querySelectorAll<HTMLElement>(ITEM));
    const setTabStop = (next: number, focus = false) => {
      items.forEach((item, index) => {
        item.tabIndex = index === next ? 0 : -1;
      });
      active = next;
      if (focus) items[next]?.focus();
    };
    const sync = () => {
      items = readItems();
      for (const item of items) {
        if (!original.has(item)) original.set(item, item.getAttribute('tabindex'));
      }
      const focused = items.indexOf(root.ownerDocument.activeElement as HTMLElement);
      const next = focused >= 0 ? focused : active >= 0 && active < items.length ? active : 0;
      setTabStop(next);
    };
    const onFocusIn = (event: FocusEvent) => {
      const index = items.indexOf(event.target as HTMLElement);
      if (index >= 0 && index !== active) setTabStop(index);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const intent = getNavigationIntent(event, { orientation, direction: directionOf(root) });
      if (!intent || items.length === 0) return;
      let next = active;
      if (intent === 'first') next = 0;
      else if (intent === 'last') next = items.length - 1;
      else if (intent === 'next') {
        next = active + 1;
        if (next === items.length) {
          if (!loop) return;
          next = 0;
        }
      } else {
        next = active - 1;
        if (next < 0) {
          if (!loop) return;
          next = items.length - 1;
        }
      }
      event.preventDefault();
      setTabStop(next, true);
    };

    sync();
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('keydown', onKeyDown);
    const Observer = root.ownerDocument.defaultView?.MutationObserver;
    const observer = Observer ? new Observer(sync) : undefined;
    observer?.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-toolbar-item'],
    });

    return () => {
      observer?.disconnect();
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('keydown', onKeyDown);
      for (const [item, tabindex] of original) {
        if (tabindex === null) item.removeAttribute('tabindex');
        else item.setAttribute('tabindex', tabindex);
      }
    };
  };
}
