import {
  bindDismissLayer,
  type DismissLayerBinding,
  type DismissOutsideEvent,
} from '../dismiss/index.ts';
import { listen } from '../env/index.ts';
import type { FocusScope } from '../focus-scope/index.ts';
import type { InertRegistry, InertScope } from '../inert/index.ts';
import { getLayerStack, type LayerRegistration } from '../layer-stack/index.ts';
import type { PortalController } from '../portal/index.ts';
import type { FloatingPosition, PositionReference } from '../position-dom/index.ts';
import { createPresence, type PresenceController } from '../presence/presence.ts';
import type {
  OverlayController,
  OverlayDismissEvent,
  OverlayDismissReason,
  OverlayFeatures,
  OverlayOptions,
  OverlayPhase,
} from './types.ts';

/** Base z-index for contained overlays (and top-layer fallback); the stack order adds to it. */
export const OVERLAY_Z_BASE = 1000;
/** Attribute naming the mode on an open overlay element. */
export const OVERLAY_MODE_ATTR = 'data-tx-overlay';

type PopoverElement = HTMLElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
};

function supportsPopover(element: HTMLElement): boolean {
  return typeof (element as PopoverElement).showPopover === 'function';
}

function createDismissEvent(
  reason: OverlayDismissReason,
  originalEvent: Event
): OverlayDismissEvent {
  let prevented = false;
  return {
    reason,
    originalEvent,
    get defaultPrevented() {
      return prevented;
    },
    preventDefault() {
      prevented = true;
    },
  };
}

/** Where `getInertRegistry` keeps the page-wide registry (see the inert texel). */
const INERT_GLOBAL_KEY = '__TEXULI_INERT_REGISTRY_V1__';

/**
 * Whether `element` is a DOM element still in its document. A deferred open
 * (an effect flushed during unmount, or after a test environment's teardown,
 * when `Element` itself is gone) must not touch the layer stack or the inert
 * registry for a node that is no longer there.
 */
function isLive(element: unknown): element is Element {
  return (
    typeof Element !== 'undefined' && element instanceof Element && (element as Element).isConnected
  );
}

function missing(feature: keyof OverlayFeatures, need: string): TypeError {
  return new TypeError(
    `createOverlayCore: ${need} needs the "${feature}" feature; pass it in the features argument.`
  );
}

/**
 * The overlay engine with opt-in features. It always composes layer
 * registration, Escape and outside dismissal (topmost only) and presence;
 * positioning, focus scope, inert, scroll lock and portal come only from
 * `features`, so a primitive bundles just the texels it uses (a tooltip:
 * positioning; a dialog: focus scope, inert, scroll lock). Options that need
 * a feature that was not passed throw a `TypeError` at creation.
 *
 * Without the `inert` feature, an overlay opened while a modal has made the
 * page inert still exempts itself, through the page-wide registry the modal
 * created, so a tooltip or menu inside a dialog stays live.
 *
 * Framework-free; nothing touches the DOM until `open()`.
 */
export function createOverlayCore(
  options: OverlayOptions,
  features: OverlayFeatures = {}
): OverlayController {
  const { element } = options;
  const ownerDocument = element.ownerDocument;
  const mode = options.mode ?? 'top-layer';
  const contained = mode === 'contained';
  const modal = options.modal ?? false;
  const stack = options.stack ?? getLayerStack();
  const wantsTrap = options.trapFocus ?? modal;
  const wantsInert = options.inertOutside ?? modal;
  const wantsScrollLock = options.lockScroll ?? (modal && !contained);
  const dismiss = options.dismiss ?? {};
  if (wantsTrap && !features.focusScope) throw missing('focusScope', 'trapping focus');
  if (wantsInert && !features.inert && !options.inertRegistry)
    throw missing('inert', 'inert outside');
  if (wantsScrollLock && !features.scrollLock) throw missing('scrollLock', 'scroll lock');
  if (options.anchor && !features.position) throw missing('position', 'an anchor');
  if (options.portal !== undefined && !features.portal) throw missing('portal', 'a portal target');
  if (options.cycleTabNavigation && !features.focusScope) {
    throw missing('focusScope', 'cycling Tab navigation');
  }
  /** The registry to use: passed, from the feature, or the page's (only if a modal made one). */
  const inertRegistry = (): InertRegistry | null =>
    options.inertRegistry ??
    features.inert?.() ??
    ((globalThis as Record<string, unknown>)[INERT_GLOBAL_KEY] as InertRegistry | undefined) ??
    null;

  let container = options.container ?? null;
  let portalOption = options.portal;
  let anchor: PositionReference | null = options.anchor ?? null;
  let phase: OverlayPhase = 'closed';
  let destroyed = false;

  // Effects of the open state, released when closing starts.
  let layer: LayerRegistration | null = null;
  let focusScope: FocusScope | null = null;
  let inertScope: InertScope | null = null;
  let liveExemption: { release: () => void } | null = null;
  let dismissBinding: DismissLayerBinding | null = null;
  let stopEscape: (() => void) | null = null;
  // Effects of the visible state, released when exit motion ends.
  let portal: PortalController | null = null;
  let position: FloatingPosition | null = null;
  let unlockScroll: (() => void) | null = null;
  /** The control that opened the overlay, from the opening event (a fallback restore target). */
  let opener: HTMLElement | null = null;
  let shownAsPopover = false;
  /** A restore the consumer prevented: the focus rescue must not undo it. */
  let restoreFocusPrevented = false;
  let previousPopover: string | null = null;
  let previousZIndex = '';

  const presence: PresenceController = createPresence({
    present: false,
    ...options.presence,
    onExitComplete: () => {
      if (phase !== 'closing') return;
      hide();
      phase = 'closed';
      options.onExitComplete?.();
    },
  });

  /** Inert exemptions (the toast region, the announcer) count as inside. */
  const exemptElements = () =>
    (inertRegistry()?.exemptions() ?? [])
      .map((entry) => entry.element)
      .filter((region) => region !== element && !element.contains(region));
  const insideExemption = (target: EventTarget | null) =>
    target instanceof Node && exemptElements().some((region) => region.contains(target));

  function requestDismiss(reason: OverlayDismissReason, originalEvent: Event): boolean {
    const request = createDismissEvent(reason, originalEvent);
    options.onDismissRequest?.(request);
    if (request.defaultPrevented) return false;
    close();
    return true;
  }

  function portalTarget(): Element | null | undefined {
    return contained ? container : portalOption;
  }

  function applyPortal() {
    const target = portalTarget();
    if (contained ? !target : target === undefined) return;
    if (portal) portal.setTarget(target);
    // Contained mode without the portal feature keeps the element where it is
    // rendered (already inside its container).
    else if (features.portal) portal = features.portal(element, { target });
  }

  function applyStacking() {
    if (contained || !supportsPopover(element)) {
      element.style.zIndex = String(OVERLAY_Z_BASE + (layer?.order() ?? stack.size()));
    }
  }

  function startPosition() {
    position?.destroy();
    position = null;
    if (!anchor) return;
    if (!features.position) throw missing('position', 'an anchor');
    position = features.position(anchor, element, {
      placement: 'bottom',
      ...options.position,
      ...(contained && container ? { contain: container } : {}),
    });
  }

  /**
   * R16: an exempt region shown in the top layer (the toast region as a
   * `popover`) must keep painting above the overlay that just joined it.
   * The top layer orders by show time, so re-show it. Exemptions registered
   * with `raise: false` (a dialog backdrop, a menu or listbox opened inside a
   * modal) stay where they are: re-showing them would cover this overlay.
   */
  function raiseExemptPopovers() {
    const regions = (inertRegistry()?.exemptions() ?? [])
      .filter((entry) => entry.raise !== false)
      .map((entry) => entry.element)
      .filter((region) => region !== element && !element.contains(region));
    for (const region of regions) {
      const popover = region as PopoverElement;
      try {
        if (!popover.matches(':popover-open')) continue;
        popover.hidePopover?.();
        popover.showPopover?.();
      } catch {
        // No popover support, or the region is not a popover.
      }
    }
  }

  /** Make the element visible: portal, top layer or z-index, positioning, scroll lock. */
  function show() {
    applyPortal();
    element.setAttribute(OVERLAY_MODE_ATTR, mode);
    previousZIndex = element.style.zIndex;
    if (!contained && supportsPopover(element)) {
      previousPopover = element.getAttribute('popover');
      element.setAttribute('popover', 'manual');
      try {
        (element as PopoverElement).showPopover?.();
        shownAsPopover = true;
        raiseExemptPopovers();
      } catch {
        shownAsPopover = false;
      }
    }
    if (wantsScrollLock && features.scrollLock) unlockScroll = features.scrollLock(ownerDocument);
  }

  /** Undo `show()` after exit motion. */
  function hide() {
    position?.destroy();
    position = null;
    if (shownAsPopover) {
      try {
        (element as PopoverElement).hidePopover?.();
      } catch {
        // Already hidden by the browser.
      }
      shownAsPopover = false;
    }
    if (previousPopover === null) element.removeAttribute('popover');
    else element.setAttribute('popover', previousPopover);
    previousPopover = null;
    element.style.zIndex = previousZIndex;
    element.removeAttribute(OVERLAY_MODE_ATTR);
    unlockScroll?.();
    unlockScroll = null;
    portal?.destroy();
    portal = null;
  }

  /** Interaction while open: layer, inert, focus, dismissal. */
  function engage(openEvent?: Event) {
    layer = stack.register({ element, ...(options.label ? { label: options.label } : {}) });
    applyStacking();
    startPosition();
    const inert = inertRegistry();
    if (wantsInert && inert && isLive(element)) {
      inertScope = inert.inertOutside(element, {
        ...(contained && container ? { root: container } : {}),
        ariaHidden: options.ariaHidden ?? false,
        observe: true,
        ...(options.label ? { label: options.label } : {}),
      });
    } else if (inert && inert.size() > 0 && isLive(element)) {
      // A menu or popover opened from inside a modal: keep it live while open,
      // even when it sits outside the modal (portaled to the body).
      // `raise: false`: an overlay opened later from this one must stay above it.
      liveExemption = inert.exempt({
        element,
        label: options.label ?? 'overlay',
        raise: false,
      });
    }
    if (wantsTrap && features.focusScope) {
      focusScope = features.focusScope(element, {
        ...(options.initialFocus ? { initialFocus: options.initialFocus } : {}),
        ...(options.cycleTabNavigation ? { cycleTabNavigation: true } : {}),
        // Focus-exempt regions (the toast region) keep their own Tab order.
        exemptRegions: exemptElements,
        onBeforeRestoreFocus: (event) => {
          if (options.restoreFocus === false) event.preventDefault();
          options.onBeforeRestoreFocus?.(event);
          restoreFocusPrevented = event.defaultPrevented;
        },
      });
      focusScope.activate();
    }
    const id = layer.id;
    if (dismiss.escape !== false) {
      stopEscape = listen(ownerDocument, 'keydown', (event) => {
        const key = event as KeyboardEvent;
        if (key.key !== 'Escape' || key.defaultPrevented || key.isComposing) return;
        if (!stack.isTop(id) || insideExemption(key.target)) return;
        key.preventDefault();
        requestDismiss('escape', key);
      });
    }
    const pointerOutside = dismiss.pointerOutside !== false;
    const focusOutside = dismiss.focusOutside ?? !modal;
    if (pointerOutside || focusOutside) {
      const onOutside = (event: DismissOutsideEvent) => {
        if (insideExemption(event.target)) return;
        const reason = event.reason === 'focus-outside' ? 'focus-outside' : 'pointer-outside';
        if (!requestDismiss(reason, event.originalEvent)) event.preventDefault();
      };
      dismissBinding = bindDismissLayer({
        element,
        document: ownerDocument,
        stack,
        layerId: id,
        pointerOutside,
        focusOutside,
        pointerPhase: dismiss.pointerPhase ?? 'pointerdown',
        branches: () => [...(options.branches?.() ?? []), ...exemptElements()],
        onPointerOutside: onOutside,
        onFocusOutside: onOutside,
      });
      // Only a real opening gesture is guarded: after a keyboard or
      // programmatic open the first outside pointer must still dismiss.
      if (openEvent) dismissBinding.noteOpenGesture(openEvent);
    }
  }

  /**
   * WebKit does not focus a clicked button, so the focus scope may have no
   * opener to return to. When focus is lost (on `body`) or stranded inside
   * the closed overlay, move it to the control from the opening event; never
   * leave it inside a closed overlay.
   */
  function rescueFocus() {
    // With `restoreFocus: false` the consumer moves focus itself.
    if (options.restoreFocus === false || restoreFocusPrevented) return;
    const active = ownerDocument.activeElement;
    const lost = !active || active === ownerDocument.body;
    const stranded = active instanceof HTMLElement && element.contains(active);
    if (!lost && !stranded) return;
    const restoreTarget = options.restoreFocusTarget?.() ?? opener;
    if (restoreTarget?.isConnected && !element.contains(restoreTarget)) {
      restoreTarget.focus({ preventScroll: true });
    }
    if (stranded && element.contains(ownerDocument.activeElement)) (active as HTMLElement).blur();
  }

  /** Release interaction immediately (inert first, so focus can return). */
  function disengage() {
    stopEscape?.();
    stopEscape = null;
    dismissBinding?.disconnect();
    dismissBinding = null;
    inertScope?.release();
    inertScope = null;
    liveExemption?.release();
    liveExemption = null;
    focusScope?.deactivate();
    focusScope = null;
    rescueFocus();
    layer?.unregister();
    layer = null;
  }

  function open(event?: Event) {
    if (destroyed || phase === 'open') return;
    // Unmounted (or torn down) before the open ran: nothing to show, nothing to register.
    if (!isLive(element)) return;
    const source = event?.currentTarget ?? event?.target;
    if (source instanceof HTMLElement && !element.contains(source)) opener = source;
    const reopening = phase === 'closing';
    restoreFocusPrevented = false;
    if (!reopening) show();
    phase = 'open';
    presence.setNode(element);
    presence.setPresent(true);
    engage(event);
    options.onOpenChange?.(true);
  }

  function close() {
    if (destroyed || phase !== 'open') return;
    phase = 'closing';
    disengage();
    options.onOpenChange?.(false);
    presence.setPresent(false);
  }

  return {
    open,
    close,
    toggle(event) {
      if (phase === 'open') close();
      else open(event);
    },
    phase: () => phase,
    isOpen: () => phase === 'open',
    isTop: () => (layer ? stack.isTop(layer.id) : false),
    update() {
      position?.update();
    },
    setContainer(next) {
      if (contained) container = next ?? null;
      else portalOption = next;
      if (phase === 'closed' || destroyed) return;
      applyPortal();
      if (phase !== 'open') return;
      startPosition();
      const inert = inertRegistry();
      if (inertScope && inert) {
        inertScope.release();
        inertScope = inert.inertOutside(element, {
          ...(contained && container ? { root: container } : {}),
          ariaHidden: options.ariaHidden ?? false,
          observe: true,
        });
      }
    },
    setAnchor(next) {
      if (next && !features.position) throw missing('position', 'an anchor');
      anchor = next ?? null;
      if (phase === 'open') startPosition();
    },
    destroy() {
      if (destroyed) return;
      const wasShown = phase !== 'closed';
      disengage();
      if (wasShown) hide();
      presence.dispose();
      phase = 'closed';
      destroyed = true;
    },
  };
}
