import type {
  DismissOutsideEvent,
  DismissReason,
  IsOutsideOptions,
  PointerModality,
} from './types.ts';

/**
 * Pure containment and event-classification helpers for outside pointer and
 * outside focus. No listeners; no `window`/`document` at import time.
 */

export function pointerModalityOf(event: { pointerType?: string }): PointerModality {
  const type = (event.pointerType ?? '').toLowerCase();
  if (type === 'mouse' || type === 'touch' || type === 'pen') return type;
  if (type === '') return 'unknown';
  return 'unknown';
}

/** Best-effort event path, including shadow-crossing `composedPath`. */
export function eventPathOf(event: Event): EventTarget[] {
  if (typeof event.composedPath === 'function') {
    try {
      return event.composedPath();
    } catch {
      // Some synthetic events throw; fall through.
    }
  }
  const path: EventTarget[] = [];
  let node: EventTarget | null = event.target;
  while (node) {
    path.push(node);
    if (node instanceof Node) {
      node = node.parentNode;
      continue;
    }
    break;
  }
  return path;
}

function isInsideRoot(
  root: Element,
  target: EventTarget | null | undefined,
  composedPath?: readonly EventTarget[]
): boolean {
  if (composedPath && composedPath.length > 0) {
    return composedPath.includes(root);
  }
  if (!target || !(target instanceof Node)) return false;
  return root.contains(target);
}

/**
 * True when the event target is inside `container` or any branch.
 */
export function isTargetInside(
  container: Element,
  target: EventTarget | null | undefined,
  options?: IsOutsideOptions
): boolean {
  if (isInsideRoot(container, target, options?.composedPath)) return true;
  const branches = options?.branches ?? [];
  for (const branch of branches) {
    if (!branch) continue;
    if (isInsideRoot(branch, target, options?.composedPath)) return true;
  }
  return false;
}

/** True when the target is outside the container and every branch. */
export function isTargetOutside(
  container: Element,
  target: EventTarget | null | undefined,
  options?: IsOutsideOptions
): boolean {
  return !isTargetInside(container, target, options);
}

/**
 * Primary button / touch / pen only. Mouse button non-zero (e.g. right-click)
 * is not an outside-dismiss pointer for this texel.
 */
export function isDismissPointerButton(event: { button?: number; pointerType?: string }): boolean {
  const modality = pointerModalityOf(event);
  if (modality === 'touch' || modality === 'pen') return true;
  // Mouse and unknown: only the main button (0).
  return (event.button ?? 0) === 0;
}

export function isPointerOutside(
  container: Element,
  event: Pick<PointerEvent, 'target' | 'button' | 'pointerType'> & {
    composedPath?: () => EventTarget[];
  },
  options?: IsOutsideOptions
): boolean {
  if (!isDismissPointerButton(event)) return false;
  const path =
    options?.composedPath ??
    (typeof event.composedPath === 'function' ? event.composedPath() : undefined);
  return isTargetOutside(container, event.target, {
    composedPath: path,
    branches: options?.branches,
  });
}

/**
 * Focus moved to a node outside the container (and branches). Uses
 * `event.target` (the newly focused node) on `focusin`.
 */
export function isFocusOutside(
  container: Element,
  event: Pick<FocusEvent, 'target'> & { composedPath?: () => EventTarget[] },
  options?: IsOutsideOptions
): boolean {
  const path =
    options?.composedPath ??
    (typeof event.composedPath === 'function' ? event.composedPath() : undefined);
  return isTargetOutside(container, event.target, {
    composedPath: path,
    branches: options?.branches,
  });
}

/** Build a preventable outside event wrapper around a DOM event. */
export function createDismissOutsideEvent<E extends Event>(
  reason: DismissReason,
  originalEvent: E,
  pointerType: PointerModality | null
): DismissOutsideEvent<E> {
  const state = {
    defaultPrevented: false,
  };
  return {
    reason,
    originalEvent,
    pointerType,
    target: originalEvent.target,
    get defaultPrevented() {
      return state.defaultPrevented || originalEvent.defaultPrevented;
    },
    preventDefault() {
      state.defaultPrevented = true;
      if (typeof originalEvent.preventDefault === 'function') {
        originalEvent.preventDefault();
      }
    },
  };
}
