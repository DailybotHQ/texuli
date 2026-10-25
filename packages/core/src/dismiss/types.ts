import type { LayerId, LayerStack } from '../layer-stack/index.ts';

/** Why an outside interaction was reported. */
export type DismissReason = 'pointer-outside' | 'focus-outside';

/** Normalized pointer modality from a PointerEvent. */
export type PointerModality = 'mouse' | 'touch' | 'pen' | 'unknown';

/**
 * Preventable outside-interaction notice. Call `preventDefault()` so the layer
 * does not treat the interaction as a dismiss (per-layer veto).
 */
export interface DismissOutsideEvent<E extends Event = Event> {
  readonly reason: DismissReason;
  readonly originalEvent: E;
  /** Set for pointer reasons; `null` for focus-outside. */
  readonly pointerType: PointerModality | null;
  readonly target: EventTarget | null;
  defaultPrevented: boolean;
  preventDefault(): void;
}

export interface IsOutsideOptions {
  /**
   * `event.composedPath()` when the event crosses shadow roots. When omitted,
   * `container.contains(target)` is used.
   */
  composedPath?: readonly EventTarget[];
  /**
   * Extra roots treated as "inside" (the control that opened the layer, a
   * twin portal root, …).
   */
  branches?: readonly (Element | null | undefined)[];
}

export interface BindDismissLayerOptions {
  /** Layer root used for containment. */
  element: Element;
  /** Document that receives the listeners (required; no import-time DOM). */
  document: Document;
  /**
   * Extra inside roots, or a getter re-read on each event (for lazy triggers).
   */
  branches?:
    | readonly (Element | null | undefined)[]
    | (() => readonly (Element | null | undefined)[]);
  /** Listen for pointer-outside (default true). */
  pointerOutside?: boolean;
  /** Listen for focus-outside via capture `focusin` (default true). */
  focusOutside?: boolean;
  /**
   * When to emit pointer-outside.
   * - `pointerdown` (default): immediate; good for mouse.
   * - `click`: after a full click; better when a touch drag should not dismiss.
   */
  pointerPhase?: 'pointerdown' | 'click';
  /**
   * Optional stack + id: outside events are offered only while this layer is
   * topmost (nested dialogs / menus).
   */
  stack?: LayerStack;
  layerId?: LayerId;
  /** Capture phase (default true). */
  capture?: boolean;
  onPointerOutside?: (event: DismissOutsideEvent<PointerEvent | MouseEvent>) => void;
  onFocusOutside?: (event: DismissOutsideEvent<FocusEvent>) => void;
}

export interface DismissLayerBinding {
  /** Remove listeners. Idempotent. */
  disconnect: () => void;
  /**
   * Record the gesture that opened the layer so the same pointer/click does
   * not immediately dismiss it. Pass the opening `pointerdown` / `click` when
   * available; without an event, the next outside pointer sequence is ignored
   * once.
   */
  noteOpenGesture: (event?: Event) => void;
}
