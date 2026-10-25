import type { LayerStack } from '../layer-stack/index.ts';
import { createOpenGestureGuard } from './open-gesture.ts';
import {
  createDismissOutsideEvent,
  eventPathOf,
  isFocusOutside,
  isPointerOutside,
  isTargetOutside,
  pointerModalityOf,
} from './outside.ts';
import type { BindDismissLayerOptions, DismissLayerBinding } from './types.ts';

function resolveBranches(
  branches: BindDismissLayerOptions['branches']
): readonly (Element | null | undefined)[] {
  if (!branches) return [];
  return typeof branches === 'function' ? branches() : branches;
}

function isTopLayer(stack: LayerStack | undefined, layerId: string | undefined): boolean {
  if (!stack || layerId === undefined) return true;
  return stack.isTop(layerId);
}

/**
 * Listen for outside pointer and outside focus on a layer root.
 *
 * - **Pointer-outside** and **focus-outside** are separate callbacks.
 * - Handlers receive a preventable {@link DismissOutsideEvent}; calling
 *   `preventDefault()` is the per-layer veto.
 * - Touch and pen use the same path as mouse; non-primary mouse buttons are
 *   ignored.
 * - {@link DismissLayerBinding.noteOpenGesture} suppresses the opening
 *   pointer/click so it does not dismiss immediately.
 * - When `stack` + `layerId` are set, only the topmost layer is notified.
 *
 * The document is passed in explicitly (SSR-safe; no import-time DOM).
 */
export function bindDismissLayer(options: BindDismissLayerOptions): DismissLayerBinding {
  const {
    element,
    document: documentRef,
    pointerOutside = true,
    focusOutside = true,
    pointerPhase = 'pointerdown',
    stack,
    layerId,
    capture = true,
  } = options;

  if (typeof Element !== 'undefined' && !(element instanceof Element)) {
    throw new TypeError('bindDismissLayer: element must be a DOM Element');
  }
  if (!documentRef || typeof documentRef.addEventListener !== 'function') {
    throw new TypeError('bindDismissLayer: document must be a Document');
  }

  const guard = createOpenGestureGuard();
  const cleanups: Array<() => void> = [];
  let disconnected = false;

  const branchesNow = () => resolveBranches(options.branches);

  if (pointerOutside) {
    if (pointerPhase === 'pointerdown') {
      const onPointerDown = (event: Event) => {
        if (!(event instanceof PointerEvent)) return;
        if (!isTopLayer(stack, layerId)) return;
        if (guard.shouldIgnore(event)) return;
        if (
          !isPointerOutside(element, event, {
            composedPath: eventPathOf(event),
            branches: branchesNow(),
          })
        ) {
          return;
        }
        const dismissEvent = createDismissOutsideEvent(
          'pointer-outside',
          event,
          pointerModalityOf(event)
        );
        options.onPointerOutside?.(dismissEvent);
      };
      documentRef.addEventListener('pointerdown', onPointerDown, capture);
      cleanups.push(() => documentRef.removeEventListener('pointerdown', onPointerDown, capture));
    } else {
      let pendingOutside = false;
      const onPointerDown = (event: Event) => {
        if (!(event instanceof PointerEvent)) return;
        if (!isTopLayer(stack, layerId)) {
          pendingOutside = false;
          return;
        }
        if (guard.shouldIgnore(event)) {
          pendingOutside = false;
          return;
        }
        pendingOutside = isPointerOutside(element, event, {
          composedPath: eventPathOf(event),
          branches: branchesNow(),
        });
      };
      const onClick = (event: Event) => {
        if (!(event instanceof MouseEvent)) return;
        if (!pendingOutside) return;
        pendingOutside = false;
        if (!isTopLayer(stack, layerId)) return;
        if (guard.shouldIgnore(event)) return;
        if (
          !isTargetOutside(element, event.target, {
            composedPath: eventPathOf(event),
            branches: branchesNow(),
          })
        ) {
          return;
        }
        const pointerType =
          typeof PointerEvent !== 'undefined' && event instanceof PointerEvent
            ? pointerModalityOf(event)
            : null;
        const dismissEvent = createDismissOutsideEvent('pointer-outside', event, pointerType);
        options.onPointerOutside?.(dismissEvent);
      };
      documentRef.addEventListener('pointerdown', onPointerDown, capture);
      documentRef.addEventListener('click', onClick, capture);
      cleanups.push(() => {
        documentRef.removeEventListener('pointerdown', onPointerDown, capture);
        documentRef.removeEventListener('click', onClick, capture);
      });
    }
  }

  if (focusOutside) {
    const onFocusIn = (event: Event) => {
      if (!(event instanceof FocusEvent)) return;
      if (!isTopLayer(stack, layerId)) return;
      if (
        !isFocusOutside(element, event, {
          composedPath: eventPathOf(event),
          branches: branchesNow(),
        })
      ) {
        return;
      }
      const dismissEvent = createDismissOutsideEvent('focus-outside', event, null);
      options.onFocusOutside?.(dismissEvent);
    };
    documentRef.addEventListener('focusin', onFocusIn, capture);
    cleanups.push(() => documentRef.removeEventListener('focusin', onFocusIn, capture));
  }

  return {
    disconnect() {
      if (disconnected) return;
      disconnected = true;
      for (const stop of cleanups.splice(0)) stop();
      guard.reset();
    },
    noteOpenGesture(event) {
      guard.noteOpen(event);
    },
  };
}
