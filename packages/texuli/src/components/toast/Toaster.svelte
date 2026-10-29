<script lang="ts">
import type { OverlayMode } from '@texuli/core/overlay';
import { Toast } from '@texuli/primitives/toast';
import { untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { chainHandlers } from '../../internal/handlers.ts';
import type { RefProp } from '../../internal/ref.ts';
import { getMotionSettings } from '../../motion/context.ts';
import { type MotionProp, resolveComponentMotion } from '../../motion/contract.ts';
import { createListMotion, createPresenceMotion, loadMotionRuntime } from '../../motion/seam.ts';
import { getToastStore, type ToastStore } from './toast-store.ts';
import type { ToastItem, ToastKind } from './types.ts';
import { type ToasterPosition, toasterClass, toastItemClass } from './variants.ts';
import './toast.css';

type OwnProps = {
  /** Accessible name for the notification region. */
  label?: string;
  /**
   * Where the stack sits: top or bottom, at the logical start, center or end
   * edge (start and end follow the reading direction). Default `bottom-end`.
   * Narrow screens center every position.
   */
  position?: ToasterPosition;
  /** Extra space from the edge, e.g. above a bottom nav (px or CSS length). */
  offset?: number | string;
  /** Inject a store (tests). Defaults to the shared app store. */
  store?: ToastStore;
  /** Override dismiss control label (localizable). */
  dismissLabel?: string;
  class?: ClassValue;
  /**
   * `'top-layer'` (default): the stack is a popover in the top layer, at the
   * viewport edge. `'contained'`: it stays out of the top layer and sits at
   * the edge of `container` (or of the nearest positioned ancestor of the
   * Toaster), for framed previews. Either way nothing is shown while there are
   * no toasts.
   */
  mode?: OverlayMode;
  /** The element a `'contained'` stack renders in; it becomes the containing block. */
  container?: Element | null;
  /**
   * Motion (`texuli/motion`): new toasts rise in from the stack's edge, a
   * dismissed one fades out (kept, inert, until it ends) and the stack
   * reflows (`layout`). `false` for none.
   */
  motion?: MotionProp;
};

/**
 * Extra attributes land on the wrapper element. Its pointer and focus
 * handlers (which pause the timers) run after the caller's, never instead.
 */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'children'>;

let {
  label: labelProp,
  position = 'bottom-end',
  offset,
  store: storeProp,
  dismissLabel: dismissLabelProp,
  class: className,
  mode = 'top-layer',
  container = null,
  onpointerenter,
  onpointerleave,
  onfocusin,
  onfocusout,
  motion,
  ref = $bindable(null),
  ...rest
}: Props & RefProp = $props();
const msg = useMessages();
const label = $derived(labelProp ?? msg('texuli.toaster.label', 'Notifications'));
const dismissLabel = $derived(
  dismissLabelProp ?? msg('texuli.toaster.dismiss-label', 'Dismiss notification')
);

const uid = $props.id();
const store = untrack(() => storeProp) ?? getToastStore();
/** This Toaster's pause hold on the store (hover or focus in the region). */
const holdKey = `toaster:${uid}`;
let hovered = false;
let focused = false;

function syncHold(): void {
  if (hovered || focused) store.pause(holdKey);
  else store.resume(holdKey);
}

function pointerEnter(): void {
  hovered = true;
  syncHold();
}

function pointerLeave(): void {
  hovered = false;
  syncHold();
}

function focusIn(): void {
  focused = true;
  syncHold();
}

function focusOut(event: FocusEvent): void {
  const node = event.currentTarget;
  const next = event.relatedTarget;
  if (node instanceof Node && next instanceof Node && node.contains(next)) return;
  focused = false;
  syncHold();
}

/** A rendered toast; `leaving` keeps a dismissed one mounted for its exit motion. */
type Rendered = { item: ToastItem; leaving: boolean };

/** A leaving toast goes after this even if its exit never reports (ms). */
const LEAVE_MAX_MS = 1_200;
const TOAST_MOTION = { enter: 'rise', exit: 'fade', layout: true, duration: 'base' } as const;

let rendered = $state<Rendered[]>(store.items().map((item) => ({ item, leaving: false })));
const leaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
let listElement = $state<HTMLElement | null>(null);
const motionSettings = getMotionSettings();
const presenceMotion = createPresenceMotion({ motion: () => motion, defaults: TOAST_MOTION });
const stackMotion = createListMotion({
  motion: () => motion,
  defaults: TOAST_MOTION,
  items: () =>
    Array.from(
      listElement?.querySelectorAll<HTMLElement>(':scope > [data-toast-id]') ?? [],
      (element) => [element.getAttribute('data-toast-id') ?? '', element] as const
    ),
  // New toasts come in from the stack's edge.
  enter: () =>
    resolveComponentMotion(motion, TOAST_MOTION).enter === false
      ? false
      : position.startsWith('top')
        ? 'block-start'
        : 'block-end',
});

function reducedMotion(): boolean {
  if (typeof motionSettings.reducedMotion === 'boolean') return motionSettings.reducedMotion;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Whether a dismissed toast plays an exit (else it leaves at once). */
function exits(): boolean {
  return (
    !reducedMotion() &&
    motionSettings.level !== 'none' &&
    resolveComponentMotion(motion, TOAST_MOTION).exit !== false
  );
}

function dropLeaving(id: string): void {
  const timer = leaveTimers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  leaveTimers.delete(id);
  rendered = rendered.filter((other) => !(other.leaving && other.item.id === id));
}

/** Play a leaving toast's exit through the runtime; it leaves when the exit ends. */
function playExit(id: string): void {
  void loadMotionRuntime().then(() => {
    if (!leaveTimers.has(id)) return;
    const element = listElement?.querySelector<HTMLElement>(
      `:scope > [data-toast-id="${CSS.escape(id)}"]`
    );
    const hold = element ? presenceMotion.exit(element) : null;
    if (!hold) {
      dropLeaving(id);
      return;
    }
    void hold.finished.then(() => {
      if (leaveTimers.has(id)) dropLeaving(id);
    });
  });
}

/**
 * Merge the store's list into what is on screen: current toasts in store
 * order, and toasts that just left kept (inert) at their place until their
 * exit motion ends. With reduced motion they leave at once.
 */
function sync(next: readonly ToastItem[]): void {
  const ids = new Set(next.map((item) => item.id));
  const result: Rendered[] = next.map((item) => ({ item, leaving: false }));
  const started: string[] = [];
  if (exits()) {
    rendered.forEach((entry, index) => {
      if (ids.has(entry.item.id)) return;
      result.splice(Math.min(index, result.length), 0, { item: entry.item, leaving: true });
      if (!leaveTimers.has(entry.item.id)) {
        const id = entry.item.id;
        leaveTimers.set(
          id,
          setTimeout(() => dropLeaving(id), LEAVE_MAX_MS)
        );
        started.push(id);
      }
    });
  }
  for (const entry of result) {
    if (entry.leaving) continue;
    const timer = leaveTimers.get(entry.item.id);
    if (timer !== undefined) {
      clearTimeout(timer);
      leaveTimers.delete(entry.item.id);
    }
  }
  rendered = result;
  for (const id of started) playExit(id);
  // The region leaves the page when it empties, so a pointer or focus inside
  // it never gets its leave event: drop the pause hold with it.
  if (result.length === 0 && (hovered || focused)) {
    hovered = false;
    focused = false;
    syncHold();
  }
}

$effect(() => {
  const unsubscribe = store.subscribe((next) => untrack(() => sync(next)));
  return () => {
    unsubscribe();
    store.resume(holdKey);
    for (const timer of leaveTimers.values()) clearTimeout(timer);
    leaveTimers.clear();
  };
});

// Layout: measure the stack before each change, play the reflow (and the
// entering toasts) after it. Nothing plays for the toasts of the first render.
$effect.pre(() => {
  void rendered;
  untrack(() => stackMotion.measure());
});
$effect(() => {
  void rendered;
  untrack(() => stackMotion.play());
});

const offsetValue = $derived(
  offset === undefined ? undefined : typeof offset === 'number' ? `${offset}px` : offset
);

const classes = $derived(cx(toasterClass(), className));

const KIND_MARK: Record<ToastKind, string> = {
  success: '✓',
  error: '!',
  info: 'i',
  warning: '!',
};

// The store runs the action: the toast dismisses after it and settles with
// 'action'. A rejection is rethrown on a microtask so it reaches the host's
// error reporting (window "error") without leaving the toast stuck; with
// `retryOnError` the toast stays with its error so the action can run again.
function runAction(item: ToastItem): void {
  void store.action(item.id);
}
</script>

<Toast.Provider manager={store.manager} {label}>
  <div bind:this={ref}
    {...rest}
    class={classes}
    data-tx-toaster=""
    style:--tx-toast-offset={offsetValue}
    onpointerenter={chainHandlers(onpointerenter, pointerEnter)}
    onpointerleave={chainHandlers(onpointerleave, pointerLeave)}
    onfocusin={chainHandlers(onfocusin, focusIn)}
    onfocusout={chainHandlers(onfocusout, focusOut)}
  >
    <!-- No top-layer region while empty: it would sit at the viewport corner (G77). -->
    <Toast.Viewport
      class="tx-toaster__viewport"
      data-position={position}
      {mode}
      {container}
      active={rendered.length > 0}
    >
      {#if rendered.length > 0}
        <ol class="tx-toaster__list" data-tx-toast-list bind:this={listElement}>
          {#each rendered as { item, leaving } (item.id)}
            <Toast.Root
              toast={{
                id: item.id,
                title: item.title,
                description: item.description ?? '',
                // The store owns the timers (pause, resume, settle reasons).
                duration: 0,
                priority: item.priority,
                tone: item.tone,
                createdAt: item.createdAt,
              }}
              class={toastItemClass({ kind: item.kind })}
              data-kind={item.kind}
              data-pending={item.pending ? 'true' : undefined}
              data-error={item.error ? 'true' : undefined}
              data-leaving={leaving ? 'true' : undefined}
              aria-hidden={leaving ? 'true' : undefined}
              inert={leaving}
            >
              <span class="tx-toast__icon" aria-hidden="true">{KIND_MARK[item.kind]}</span>
              <div class="tx-toast__body">
                <Toast.Title class="tx-toast__title" />
                {#if item.description}
                  <Toast.Description class="tx-toast__description" />
                {/if}
                {#if item.error}
                  <p class="tx-toast__error" role="alert">{item.error}</p>
                {/if}
                {#if item.action}
                  <Toast.Action
                    class="tx-toast__action"
                    onclick={(event) => {
                      // Keep the toast mounted while the action runs; the
                      // primitive would dismiss it before the promise settles.
                      event.preventDefault();
                      runAction(item);
                    }}
                  >
                    {item.action.label}
                  </Toast.Action>
                {/if}
              </div>
              <Toast.Close
                class="tx-toast__close"
                aria-label={`${dismissLabel}: ${item.title}`}
              >
                <span aria-hidden="true">×</span>
              </Toast.Close>
            </Toast.Root>
          {/each}
        </ol>
      {/if}
    </Toast.Viewport>
  </div>
</Toast.Provider>
