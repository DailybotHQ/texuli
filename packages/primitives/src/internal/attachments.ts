import { type BindDismissLayerOptions, bindDismissLayer } from '@texuli/core/dismiss';
import { createFocusScope, type FocusScopeOptions } from '@texuli/core/focus-scope';
import type { OverlayOptions } from '@texuli/core/overlay';
import { createOverlay } from '@texuli/core/overlay';
import {
  type PositionFloatingOptions,
  type PositionReference,
  positionFloating,
} from '@texuli/core/position-dom';
import { createRovingFocus, type RovingFocusOptions } from '@texuli/core/roving';
import type { Attachment } from 'svelte/attachments';

/** Activate a focus scope when its node mounts and deactivate it on teardown. */
export function attachFocusScope(options: FocusScopeOptions = {}): Attachment<HTMLElement> {
  return (node) => {
    const scope = createFocusScope(node, options);
    scope.activate();
    return () => scope.deactivate();
  };
}

/** Bind outside-pointer and outside-focus listeners to a node's owner document. */
export function attachDismissLayer(
  options: Omit<BindDismissLayerOptions, 'element' | 'document'>
): Attachment<HTMLElement> {
  return (node) => {
    const binding = bindDismissLayer({ ...options, element: node, document: node.ownerDocument });
    return () => binding.disconnect();
  };
}

export interface RovingAttachmentOptions extends Omit<RovingFocusOptions, 'items' | 'selected'> {
  /** Resolve the current items each time the binding synchronizes. */
  items?: (root: HTMLElement) => readonly HTMLElement[];
  /**
   * The selected item's index among the items, or -1: it becomes the tab stop
   * (e.g. `indexOfSelected` for single selection). Selection attribute
   * changes (`aria-checked`, `aria-selected`, `aria-pressed`) re-sync.
   */
  selected?: (items: readonly HTMLElement[]) => number;
  /** Observe subtree and disabled-state changes. Defaults to `true`. */
  observe?: boolean;
}

/**
 * Bind roving focus to a container. By default, items are descendants marked
 * with `[data-roving-item]`; keyboard and focus listeners are removed on teardown.
 */
export function attachRovingFocus(options: RovingAttachmentOptions): Attachment<HTMLElement> {
  return (root) => {
    const getItems = () =>
      options.items?.(root) ?? Array.from(root.querySelectorAll<HTMLElement>('[data-roving-item]'));
    const originalTabIndex = new Map<HTMLElement, string | null>();
    const rememberItems = () => {
      for (const item of getItems()) {
        if (!originalTabIndex.has(item)) originalTabIndex.set(item, item.getAttribute('tabindex'));
      }
    };
    rememberItems();
    const { selected } = options;
    const roving = createRovingFocus({
      ...options,
      items: getItems,
      selected: selected && (() => selected(getItems())),
    });
    roving.sync();

    const onKeydown = (event: KeyboardEvent) => roving.handleKeydown(event);
    const onFocusin = (event: FocusEvent) => roving.handleFocusIn(event);
    root.addEventListener('keydown', onKeydown);
    root.addEventListener('focusin', onFocusin);

    const MutationObserverCtor = root.ownerDocument.defaultView?.MutationObserver;
    const observer =
      options.observe === false || !MutationObserverCtor
        ? undefined
        : new MutationObserverCtor(() => {
            rememberItems();
            roving.sync();
          });
    observer?.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'disabled',
        'aria-disabled',
        'hidden',
        'aria-checked',
        'aria-selected',
        'aria-pressed',
      ],
    });

    return () => {
      observer?.disconnect();
      root.removeEventListener('keydown', onKeydown);
      root.removeEventListener('focusin', onFocusin);
      rememberItems();
      for (const [item, previous] of originalTabIndex) {
        if (previous === null) item.removeAttribute('tabindex');
        else item.setAttribute('tabindex', previous);
      }
    };
  };
}

/** Position an attached floating node against a DOM or virtual reference. */
export function attachPosition(
  reference: PositionReference,
  options: PositionFloatingOptions
): Attachment<HTMLElement> {
  return (node) => {
    const position = positionFloating(reference, node, options);
    return () => position.destroy();
  };
}

/** Create the shared overlay controller on mount and destroy it on teardown. */
export function attachOverlay(
  options: Omit<OverlayOptions, 'element'>,
  onController?: (controller: ReturnType<typeof createOverlay> | undefined) => void
): Attachment<HTMLElement> {
  return (node) => {
    const controller = createOverlay({ ...options, element: node });
    onController?.(controller);
    return () => {
      controller.destroy();
      onController?.(undefined);
    };
  };
}
