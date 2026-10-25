import type { MenuLevel } from './context.ts';

/** The event `onSelect` receives; `preventDefault()` keeps the menu open. */
export type MenuSelectEvent = CustomEvent<{ originalEvent: Event }>;

/**
 * Runs an item: dispatches a cancelable `menuitemselect` event on it, calls
 * `onSelect`, then closes the whole menu (focus back to the trigger) unless
 * the event was prevented or `closeOnSelect` is false.
 */
export function selectItem(
  node: HTMLElement,
  level: MenuLevel,
  originalEvent: Event,
  options: { onSelect?: ((event: MenuSelectEvent) => void) | undefined; closeOnSelect: boolean }
): boolean {
  const event: MenuSelectEvent = new CustomEvent('menuitemselect', {
    bubbles: true,
    cancelable: true,
    detail: { originalEvent },
  });
  node.dispatchEvent(event);
  options.onSelect?.(event);
  if (!event.defaultPrevented && options.closeOnSelect) level.closeAll(true);
  return !event.defaultPrevented;
}

/** Enter and Space run the focused item; the click handler does the work. */
export function activationKey(event: KeyboardEvent): boolean {
  return (event.key === 'Enter' || event.key === ' ') && !event.repeat;
}
