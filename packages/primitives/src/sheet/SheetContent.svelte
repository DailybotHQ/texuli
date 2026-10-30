<script lang="ts">
import { directionOf, type TextDirection } from '@texuli/core/dir-locale';
import { createFocusScope, type FocusRestoreEvent } from '@texuli/core/focus-scope';
import { getInertRegistry } from '@texuli/core/inert';
import { createOverlayCore, type OverlayDismissEvent } from '@texuli/core/overlay-core';
import { lockScroll } from '@texuli/core/scroll-lock';
import { getTabbableElements } from '@texuli/core/tabbable';
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { getDialogContext, getDialogPortalContext } from '../dialog/context.ts';
import { ensurePositioned } from '../internal/backdrop.ts';
import { createMotionHold, type OverlayMotionHooks } from '../internal/motion-hold.ts';
import { placeBeforeOpen } from '../internal/portal-scope.ts';
import type { RefProp } from '../internal/ref.ts';
import { drawerContext } from './context.ts';
import { dismissDirection, releaseTarget, resolveSheetSide, type SheetSide } from './model.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** The edge it is attached to; `center` is a centered dialog. Default `right`. */
  side?: SheetSide;
  /** `false`: a non-modal panel (no inert, focus trap or scroll lock). Read once. */
  modal?: boolean;
  /**
   * Non-modal only: close on a press or on focus outside the panel (the
   * trigger never counts as outside). Default `false`; a modal sheet always
   * dismisses on outside press. Read when the panel opens.
   */
  dismissOutside?: boolean;
  /**
   * Non-modal only: close on Escape anywhere on the page, not just while focus
   * is inside the panel (which always closes it). Default `false`; a modal
   * sheet always closes on Escape. Read when the panel opens.
   */
  closeOnEscape?: boolean;
  /** Drag toward the edge to dismiss or change snap point (a drawer). */
  drag?: boolean;
  /** Visible fractions (0 to 1) the drawer settles at, smallest first. Default `[1]`. */
  snapPoints?: number[];
  /** Bindable: the current snap point (default the first). */
  activeSnapPoint?: number;
  onSnapPointChange?: (snap: number) => void;
  /** Whether a drag past the last snap point closes it. Default `true`. */
  dismissible?: boolean;
  onCloseAutoFocus?: (event: FocusRestoreEvent) => void;
  /**
   * Enter and exit motion (texuli passes `texuli/motion` hooks): while the
   * exit plays, the closed sheet stays mounted, inert. Focus, inert and the
   * layer stack are released at close, as without motion.
   */
  motionHooks?: OverlayMotionHooks;
  children?: Snippet;
} & RefProp;

let {
  side = 'right',
  modal = true,
  dismissOutside = false,
  closeOnEscape = false,
  drag = false,
  snapPoints = [1],
  activeSnapPoint = $bindable(),
  onSnapPointChange,
  dismissible = true,
  onCloseAutoFocus,
  motionHooks,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const context = getDialogContext();
const portal = getDialogPortalContext();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'content',
  untrack(() => rest.id)
);
$effect(() => {
  context.claimId('content', rest.id);
  return () => context.claimId('content', undefined);
});
let isOpen = $state(context.open);
let held = $state(false);
// Open when it is created (first render, hydration): no enter animation.
let appeared = untrack(() => context.open);
let entered: HTMLElement | null = null;
const hold = createMotionHold(
  () => motionHooks,
  (next) => (held = next)
);
let node: HTMLDivElement | null = null;
$effect(() =>
  context.subscribeOpen((next) => {
    // Closing: start the exit before the content would unmount (a bound
    // `open` changes before the engine closes).
    if (!next && isOpen) {
      entered = null;
      hold.begin(node);
    }
    isOpen = next;
  })
);
$effect(() => () => hold.cancel());
let resolvedDirection = $state<TextDirection>(
  context.triggerElement ? directionOf(context.triggerElement) : 'ltr'
);
function directionFor(node: HTMLDivElement): TextDirection {
  const explicitDirection = rest.dir?.trim().toLowerCase();
  const directionSource =
    explicitDirection === 'ltr' || explicitDirection === 'rtl' || explicitDirection === 'auto'
      ? node
      : (context.triggerElement ?? node);
  return directionOf(directionSource);
}
const resolvedSide = $derived(resolveSheetSide(side, resolvedDirection));

const snap = $derived(activeSnapPoint ?? snapPoints[0] ?? 1);
function setSnapPoint(next: number) {
  activeSnapPoint = next;
  onSnapPointChange?.(next);
}
drawerContext.set({
  get snapPoints() {
    return snapPoints;
  },
  get activeSnapPoint() {
    return snap;
  },
  setSnapPoint,
});

function dismissEvent(originalEvent: Event): OverlayDismissEvent {
  let prevented = false;
  return {
    reason: 'escape',
    originalEvent,
    get defaultPrevented() {
      return prevented;
    },
    preventDefault() {
      prevented = true;
    },
  };
}

function attach(element: HTMLDivElement): () => void {
  node = element;
  // Inside a Portal, open only once it is placed (moving a focused node blurs
  // it). Re-registers if the mode or the container changes; the open state it
  // reads while registering must not re-run it (a close would hide it mid-exit).
  if (portal && !portal.placed) return () => {};
  void context.mode;
  void context.container;
  const release = untrack(() => attachContent(element));
  return () => {
    release();
    if (node === element) node = null;
  };
}

function attachContent(node: HTMLDivElement): () => void {
  // Inside a Portal, open only once it is placed: moving a focused node blurs it.
  if (portal && !portal.placed) return () => {};
  // Contained: positioned, so its z-index stacks it above the contained backdrop.
  const restorePosition = context.mode === 'contained' ? ensurePositioned(node) : () => {};
  const direction = directionFor(node);
  resolvedDirection = direction;
  context.registerContent(node);
  const controller = createOverlayCore(
    {
      element: node,
      mode: context.mode,
      container: context.container,
      ...(context.stack ? { stack: context.stack } : {}),
      modal,
      restoreFocusTarget: () => context.triggerElement ?? null,
      branches: () => [context.triggerElement],
      label: modal ? 'sheet' : 'panel',
      presence: { isMotionPending: hold.isMotionPending },
      ...(modal
        ? { cycleTabNavigation: true, initialFocus: context.initialFocus }
        : {
            dismiss: {
              escape: closeOnEscape,
              pointerOutside: dismissOutside,
              focusOutside: dismissOutside,
            },
          }),
      onOpenChange: (open) => {
        // Before the engine's presence reads `isMotionPending`.
        if (!open) {
          entered = null;
          hold.begin(node);
        }
        context.onOverlayOpenChange(open);
        if (!open) return;
        // Once per opening (the attachment may re-run while open).
        if (entered !== node) {
          entered = node;
          if (appeared) appeared = false;
          else hold.enter(node);
        }
        const view = node.ownerDocument.defaultView;
        if (!modal) {
          // A non-modal panel still takes focus when it opens (APG dialog).
          const initial = context.initialFocus;
          const target =
            (typeof initial === 'function' ? initial() : initial) ??
            getTabbableElements(node)[0] ??
            node;
          queueMicrotask(() => target.focus({ preventScroll: true }));
          return;
        }
        // Re-show after the backdrop so the panel paints above it in the top layer.
        view?.requestAnimationFrame(() => {
          const popover = node as HTMLDivElement & { hidePopover?(): void; showPopover?(): void };
          try {
            if (!controller.isOpen() || !popover.matches(':popover-open')) return;
            popover.hidePopover?.();
            popover.showPopover?.();
          } catch {
            // The browser can omit top-layer APIs despite their type declarations.
          }
        });
      },
      onDismissRequest: context.onDismissRequest,
      onBeforeRestoreFocus: (event) => {
        context.onBeforeRestoreFocus(event);
        onCloseAutoFocus?.(event);
      },
    },
    // Modal: focus scope, inert and scroll lock. A panel needs none of them
    // (inside a modal the core still exempts it), and nothing is anchored.
    modal ? { focusScope: createFocusScope, inert: getInertRegistry, scrollLock: lockScroll } : {}
  );
  context.registerController(placeBeforeOpen(controller, portal));
  return () => {
    controller.destroy();
    context.registerController(undefined);
    context.registerContent(undefined);
    restorePosition();
  };
}

function onkeydown(event: KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement }) {
  rest.onkeydown?.(event);
  // Modal sheets close on Escape through the overlay engine; a panel only
  // while focus is inside it, so Escape elsewhere on the page stays free.
  // With closeOnEscape the dismiss layer handles Escape everywhere, so skip it here.
  if (modal || closeOnEscape || event.key !== 'Escape' || event.defaultPrevented) return;
  const request = dismissEvent(event);
  context.onDismissRequest?.(request);
  event.preventDefault();
  if (!request.defaultPrevented) context.setOpen(false, event);
}

// Drawer drag: offset is px toward the attached edge (0 = fully open).
let pending: { id: number; x: number; y: number } | null = null;
let size = 0;
let base = 0;
let last = { at: 0, time: 0 };
let velocity = 0;
let suppressClick = false;
let offset = $state<number | null>(null);
const direction = $derived(dismissDirection(resolvedSide));

function along(event: PointerEvent): number {
  if (!pending) return 0;
  const delta = direction.axis === 'x' ? event.clientX - pending.x : event.clientY - pending.y;
  return delta * direction.sign;
}

function onpointerdown(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
  rest.onpointerdown?.(event);
  suppressClick = false;
  const target = event.target as Element;
  if (!drag || event.defaultPrevented || (event.pointerType === 'mouse' && event.button !== 0))
    return;
  if (target.closest('input,textarea,select,[contenteditable],[data-drawer-no-drag]')) return;
  pending = { id: event.pointerId, x: event.clientX, y: event.clientY };
}

function onpointermove(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
  rest.onpointermove?.(event);
  if (!pending || event.pointerId !== pending.id) return;
  const moved = along(event);
  if (offset === null) {
    const cross = direction.axis === 'x' ? event.clientY - pending.y : event.clientX - pending.x;
    if (Math.abs(moved) < 6 || Math.abs(moved) < Math.abs(cross)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    size = direction.axis === 'x' ? rect.width : rect.height;
    base = (1 - snap) * size;
    last = { at: base, time: event.timeStamp };
    velocity = 0;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  const top = (1 - Math.max(...snapPoints)) * size;
  const next = Math.max(top, base + moved);
  const elapsed = event.timeStamp - last.time;
  if (elapsed > 0) velocity = (next - last.at) / elapsed;
  last = { at: next, time: event.timeStamp };
  offset = next;
}

function release(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
  (event.type === 'pointerup' ? rest.onpointerup : rest.onpointercancel)?.(event);
  if (!pending || event.pointerId !== pending.id) return;
  pending = null;
  const settled = offset;
  offset = null;
  // A cancelled drag (the browser took the gesture) springs back.
  if (settled === null || event.type !== 'pointerup') return;
  // A pointer held still before lifting has no fling (browsers send no move for it).
  const speed = event.timeStamp - last.time > 80 ? 0 : velocity;
  const index = releaseTarget(settled, speed, size, snapPoints, dismissible);
  // Only the click this release produces (same task) is swallowed.
  suppressClick = true;
  setTimeout(() => (suppressClick = false));
  if (index < 0) context.setOpen(false, event);
  else if (snapPoints[index] !== snap) setSnapPoint(snapPoints[index] as number);
}

function onclickcapture(event: MouseEvent & { currentTarget: EventTarget & HTMLDivElement }) {
  rest.onclickcapture?.(event);
  // The click that ends a drag is not a press of whatever was under the finger.
  if (!suppressClick) return;
  suppressClick = false;
  event.preventDefault();
  event.stopPropagation();
}

const transform = $derived.by(() => {
  if (!drag || resolvedSide === 'center') return undefined;
  const axis = direction.axis === 'x' ? 'X' : 'Y';
  if (offset !== null) return `translate${axis}(${offset * direction.sign}px)`;
  const percent = (1 - snap) * 100 * direction.sign;
  return percent ? `translate${axis}(${percent}%)` : undefined;
});
</script>

{#if isOpen || held}
<div bind:this={ref}
  {...rest}
  id={context.contentId}
  role="dialog"
  aria-modal={modal ? 'true' : undefined}
  aria-labelledby={rest['aria-labelledby'] ?? context.titleId}
  aria-describedby={rest['aria-describedby'] ??
    (context.hasDescription ? context.descriptionId : undefined)}
  data-state={isOpen ? 'open' : 'closed'}
  inert={!isOpen || undefined}
  data-side={resolvedSide}
  dir={rest.dir === 'ltr' || rest.dir === 'rtl' ? rest.dir : resolvedDirection}
  data-dragging={offset === null ? undefined : ''}
  data-snap-point={drag ? snap : undefined}
  tabindex="-1"
  {onkeydown}
  {onpointerdown}
  {onpointermove}
  onpointerup={release}
  onpointercancel={release}
  {onclickcapture}
  style:transform
  style:touch-action={drag ? (direction.axis === 'x' ? 'pan-y' : 'pan-x') : undefined}
  {@attach attach}
>
  {@render children?.()}
</div>
{/if}
