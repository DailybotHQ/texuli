import { getInertRegistry } from '@texuli/core/inert';
import { OVERLAY_Z_BASE } from '@texuli/core/overlay-core';

/**
 * Give an element a containing block / stacking position: `position:
 * relative` when it is statically positioned. Returns the undo.
 */
export function ensurePositioned(element: Element | null | undefined): () => void {
  if (!element || !('style' in element)) return () => {};
  const html = element as HTMLElement;
  const view = html.ownerDocument.defaultView;
  if (view?.getComputedStyle(html).position !== 'static') return () => {};
  const previous = html.style.position;
  html.style.position = 'relative';
  return () => {
    html.style.position = previous;
  };
}

export interface BackdropOptions {
  /** Contained mode: the backdrop fills the container instead of the viewport. */
  contained: boolean;
  container: Element | null;
  /** Inert-registry label (debugging). */
  label: string;
  subscribeOpen(listener: (open: boolean) => void): () => void;
}

/**
 * A dialog backdrop. Top layer: shown as a manual popover while the dialog is
 * open, under the content (which re-shows itself above it). Contained: it never
 * enters the top layer (it would cover the content kept in the container); it
 * stays in the container, fills it (`data-contained`, the container becomes a
 * containing block) and stacks just below contained content.
 */
export function registerBackdrop(node: HTMLElement, options: BackdropOptions): () => void {
  // `raise: false`: the backdrop sits under its dialog, and under every overlay
  // opened from the dialog (a Select, a menu, a date picker). Re-raising it
  // when one of them opens would cover them and the dialog (G75).
  const exemption = getInertRegistry().exempt({
    element: node,
    label: options.label,
    raise: false,
  });
  if (options.contained) {
    node.setAttribute('data-contained', '');
    const previousZIndex = node.style.zIndex;
    node.style.zIndex = String(OVERLAY_Z_BASE - 1);
    const restoreContainer = ensurePositioned(options.container);
    return () => {
      node.removeAttribute('data-contained');
      node.style.zIndex = previousZIndex;
      restoreContainer();
      exemption.release();
    };
  }
  const popover = node as HTMLElement & { showPopover?: () => void; hidePopover?: () => void };
  const previousPopover = node.getAttribute('popover');
  node.setAttribute('popover', 'manual');
  let shown = false;
  const unsubscribe = options.subscribeOpen((open) => {
    if (open && !shown) {
      try {
        popover.showPopover?.();
        shown = true;
      } catch {
        // The browser may reject showing an already active top-layer element.
      }
    } else if (!open && shown) {
      popover.hidePopover?.();
      shown = false;
    }
  });
  return () => {
    unsubscribe();
    if (shown) popover.hidePopover?.();
    if (previousPopover === null) node.removeAttribute('popover');
    else node.setAttribute('popover', previousPopover);
    exemption.release();
  };
}
