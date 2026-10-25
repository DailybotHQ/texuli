import type { createFocusScope, FocusRestoreEvent, FocusTarget } from '../focus-scope/index.ts';
import type { getInertRegistry, InertRegistry } from '../inert/index.ts';
import type { LayerStack } from '../layer-stack/index.ts';
import type { createPortal, PortalTarget } from '../portal/index.ts';
import type {
  PositionFloatingOptions,
  PositionReference,
  positionFloating,
} from '../position-dom/index.ts';
import type { lockScroll } from '../scroll-lock/scroll-lock.ts';

/**
 * - `top-layer`: the element joins the browser top layer through
 *   `popover="manual"` (never `showModal()`), so it paints above everything
 *   while the engine owns inert, the focus trap and scroll lock. Exempt
 *   regions such as the toast region stay reachable (R16).
 * - `contained`: the element is portaled into a container (a device frame,
 *   an embedded preview) and every effect stays inside it.
 */
export type OverlayMode = 'top-layer' | 'contained';

/** Why the engine asks to close. */
export type OverlayDismissReason = 'escape' | 'pointer-outside' | 'focus-outside';

/** Preventable close request; `preventDefault()` keeps the overlay open. */
export interface OverlayDismissEvent {
  readonly reason: OverlayDismissReason;
  readonly originalEvent: Event;
  readonly defaultPrevented: boolean;
  preventDefault(): void;
}

/** Engine life cycle. `closing` lasts while exit motion plays. */
export type OverlayPhase = 'closed' | 'open' | 'closing';

export interface OverlayOptions {
  /** The floating element (dialog panel, popover content, menu). */
  element: HTMLElement;
  /** Default `top-layer`. */
  mode?: OverlayMode;
  /** Contained mode: the frame that receives the element and bounds every effect. */
  container?: Element | null;
  /**
   * Top-layer mode only: move the element here while open (`null` = the
   * document body). Omitted: the element stays where it is, since the top
   * layer already escapes clipping and transforms.
   */
  portal?: PortalTarget;
  /** Modal: inert outside, focus trap and (top layer) scroll lock. Default `false`. */
  modal?: boolean;
  /** Overrides of the modal defaults. */
  trapFocus?: boolean;
  inertOutside?: boolean;
  lockScroll?: boolean;
  /** Also set `aria-hidden` on inert content, for older assistive tech. Default `false`. */
  ariaHidden?: boolean;
  /** Which interactions request a close. */
  dismiss?: {
    escape?: boolean;
    pointerOutside?: boolean;
    /** Default: on for non-modal overlays, off for modal ones (focus is trapped). */
    focusOutside?: boolean;
    /** `pointerdown` (default) or `click` (lets a touch drag start outside). */
    pointerPhase?: 'pointerdown' | 'click';
  };
  /** Elements that count as inside for outside interaction (the trigger). */
  branches?: () => readonly (Element | null | undefined)[];
  /** Anchor to position against. Omit for centered dialogs styled by CSS. */
  anchor?: PositionReference | null;
  /** Placement options passed to `positionFloating` (placement defaults to `bottom`). */
  position?: Partial<Omit<PositionFloatingOptions, 'contain'>>;
  /**
   * Move focus on every Tab to the next (or previous) tabbable in the scope
   * instead of trusting native order (top-layer and portaled content can break
   * it). Needs the `focusScope` feature.
   */
  cycleTabNavigation?: boolean;
  initialFocus?: FocusTarget | (() => FocusTarget | null);
  /** Return focus to the opener on close. Default `true`. */
  restoreFocus?: boolean;
  /**
   * Where focus returns on close when the opener is unknown or unusable (for
   * example WebKit, which does not focus a clicked button).
   */
  restoreFocusTarget?: () => HTMLElement | null;
  onBeforeRestoreFocus?: (event: FocusRestoreEvent) => void;
  /** Called before an engine-initiated close; prevent it to stay open. */
  onDismissRequest?: (event: OverlayDismissEvent) => void;
  /** Called on every open/close intent change (binds a controlled `open`). */
  onOpenChange?: (open: boolean) => void;
  /** Called when exit motion finished and the overlay is fully hidden. */
  onExitComplete?: () => void;
  /** Presence tuning (tests, reduced motion overrides). */
  presence?: {
    skipExitAnimation?: boolean;
    reducedMotion?: boolean;
    isMotionPending?: (element: Element) => boolean;
  };
  /** Debug label for the layer stack and inert registry. */
  label?: string;
  /** Injection seams (tests, isolated roots). Defaults: the page-wide instances. */
  stack?: LayerStack;
  inertRegistry?: InertRegistry;
}

export interface OverlayController {
  /** Open (or re-open during exit). Pass the opening pointer or click event when there is one. */
  open(event?: Event): void;
  /** Start closing: interaction effects end now; the element hides after exit motion. */
  close(): void;
  /** Toggle between open and closed. */
  toggle(event?: Event): void;
  phase(): OverlayPhase;
  isOpen(): boolean;
  /** Whether this overlay is the topmost layer. */
  isTop(): boolean;
  /** Reposition now (anchored overlays). */
  update(): void;
  /** Contained mode: a new frame; top-layer mode: a new portal target. Reactive. */
  setContainer(container: Element | null | undefined): void;
  /** Change the anchor while open. */
  setAnchor(anchor: PositionReference | null | undefined): void;
  /** Tear everything down immediately (unmount). Idempotent. */
  destroy(): void;
}

/**
 * The texels an overlay may compose, passed as values so a primitive bundles
 * only what it uses. Each is the texel's own function.
 */
export interface OverlayFeatures {
  /** `positionFloating` from `@texuli/core/position-dom`: needed for an `anchor`. */
  position?: typeof positionFloating;
  /** `createFocusScope` from `@texuli/core/focus-scope`: needed to trap focus (modal). */
  focusScope?: typeof createFocusScope;
  /** `getInertRegistry` from `@texuli/core/inert`: needed for inert outside (modal). */
  inert?: typeof getInertRegistry;
  /** `lockScroll` from `@texuli/core/scroll-lock`: needed for scroll lock (modal). */
  scrollLock?: typeof lockScroll;
  /** `createPortal` from `@texuli/core/portal`: needed for a portal or a container. */
  portal?: typeof createPortal;
}
