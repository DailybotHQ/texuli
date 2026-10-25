/**
 * F6 and Shift+F6 cycle between the builder's panes (builder design §9):
 * toolbar, palette, structure, preview, inspector, payload. Each pane
 * restores the element that was last focused in it, else its first
 * focusable control, else the pane itself. Inside the preview, the player
 * uses F6 for its own frames; a key the player handled is left alone.
 * Panes are marked with `data-builder-pane`; the innermost one wins.
 */

/** The pane to go to from `current` (-1 when focus is in none). */
export function nextPane(current: number, count: number, backward: boolean): number {
  if (count === 0) return -1;
  if (current < 0) return backward ? count - 1 : 0;
  return (current + (backward ? count - 1 : 1)) % count;
}

/** Whether a key is the pane-cycling key (F6, optionally with Shift). */
export function isPaneKey(
  event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>
): boolean {
  return event.key === 'F6' && !event.altKey && !event.ctrlKey && !event.metaKey;
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Svelte action for the builder root. */
export function paneCycle(node: HTMLElement) {
  const last = new WeakMap<Element, HTMLElement>();
  const panes = () => [...node.querySelectorAll<HTMLElement>('[data-builder-pane]')];
  const paneOf = (element: Element | null) =>
    element?.closest<HTMLElement>('[data-builder-pane]') ?? null;
  const usable = (element: HTMLElement | undefined) =>
    element?.isConnected === true &&
    !element.matches(':disabled') &&
    element.closest('[inert]') === null;

  function onfocusin(event: FocusEvent) {
    const target = event.target as HTMLElement | null;
    const pane = paneOf(target);
    if (pane && target && target !== pane) last.set(pane, target);
  }

  function onkeydown(event: KeyboardEvent) {
    if (!isPaneKey(event) || event.defaultPrevented) return;
    const list = panes();
    const current = list.indexOf(paneOf(document.activeElement) as HTMLElement);
    const pane = list[nextPane(current, list.length, event.shiftKey)];
    if (!pane) return;
    event.preventDefault();
    const remembered = last.get(pane);
    const target =
      (usable(remembered) ? remembered : undefined) ??
      [...pane.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
        (element) => paneOf(element) === pane && usable(element)
      );
    if (target) {
      target.focus();
      return;
    }
    // A pane with nothing focusable yet (an empty inspector) takes focus itself.
    if (!pane.hasAttribute('tabindex')) pane.setAttribute('tabindex', '-1');
    pane.focus();
  }

  node.addEventListener('focusin', onfocusin);
  node.addEventListener('keydown', onkeydown);
  return {
    destroy() {
      node.removeEventListener('focusin', onfocusin);
      node.removeEventListener('keydown', onkeydown);
    },
  };
}
