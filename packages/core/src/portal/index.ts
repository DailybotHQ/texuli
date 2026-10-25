/** A DOM element that can receive a portal, or `null` to use the document body. */
export type PortalTarget = Element | null | undefined;

/** Initial target for a portal. Omitting it sends the source to `body`. */
export type PortalOptions = {
  target?: PortalTarget;
};

/** Controls the target of one portaled element and restores its original place. */
export type PortalController = {
  /** Move to a new target. Returns false for invalid or cross-document targets. */
  setTarget(target?: PortalTarget): boolean;
  /** Restore the source to its original sibling position; safe to call repeatedly. */
  destroy(): void;
  /** Current element parent, or null when the parent is not an element. */
  readonly currentTarget: Element | null;
  /** Whether the source currently has a parent different from its original parent. */
  readonly isPortaled: boolean;
};

/**
 * Move an existing element to `target` or its owner document's body. The same
 * element is moved, rather than cloned, so its listeners, framework state and
 * descendants retain their identity. A private origin comment preserves its
 * exact sibling order for retargeting and teardown.
 *
 * The owner document is read from the explicit source element; no ambient DOM
 * globals are accessed. If the source or body is unavailable (for example,
 * during SSR), the source remains untouched and the controller is inert until
 * there is a usable target.
 */
export function createPortal(
  source: Element | null | undefined,
  options: PortalOptions = {}
): PortalController {
  const ownerDocument = source?.ownerDocument ?? null;
  const originalParent = source?.parentNode ?? null;
  let originMarker: Comment | null = null;
  let disposed = false;

  const getCurrentTarget = (): Element | null => {
    const parent = source?.parentNode;
    return parent?.nodeType === 1 ? (parent as Element) : null;
  };

  const restoreToOrigin = (): void => {
    if (!source) return;
    const markerParent = originMarker?.parentNode;
    if (originMarker && markerParent) {
      markerParent.insertBefore(source, originMarker);
      markerParent.removeChild(originMarker);
    } else if (source.parentNode !== originalParent) {
      source.parentNode?.removeChild(source);
    }
    originMarker = null;
  };

  const controller: PortalController = {
    setTarget(target) {
      if (disposed || !source || !ownerDocument) return false;
      const destination = target ?? ownerDocument.body;
      if (!destination) {
        restoreToOrigin();
        return true;
      }
      if (
        destination.ownerDocument !== ownerDocument ||
        destination === source ||
        source.contains(destination)
      ) {
        return false;
      }

      if (originMarker?.parentNode === destination && originalParent === destination) {
        restoreToOrigin();
        return true;
      }
      if (source.parentNode === destination) return true;

      const createdMarker = originMarker === null && originalParent !== null;
      if (createdMarker && originalParent) {
        originMarker = ownerDocument.createComment('texuli-portal-origin');
        originalParent.insertBefore(originMarker, source);
      }

      try {
        destination.append(source);
      } catch {
        if (createdMarker && originMarker?.parentNode) {
          originMarker.parentNode.removeChild(originMarker);
          originMarker = null;
        }
        return false;
      }
      return true;
    },

    destroy() {
      if (disposed) return;
      disposed = true;
      restoreToOrigin();
    },

    get currentTarget() {
      return getCurrentTarget();
    },

    get isPortaled() {
      return source !== null && source !== undefined && source.parentNode !== originalParent;
    },
  };

  if (source) controller.setTarget(options.target);
  return controller;
}
