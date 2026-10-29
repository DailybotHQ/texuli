<script lang="ts">
import { Toast } from '@texuli/primitives/toast';
import { untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { chainHandlers } from '../../internal/handlers.ts';
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
};

/**
 * Extra attributes land on the wrapper element. Its pointer and focus
 * handlers (which pause the timers) run after the caller's, never instead.
 */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'children'>;

let {
  label = 'Notifications',
  position = 'bottom-end',
  offset,
  store: storeProp,
  dismissLabel = 'Dismiss notification',
  class: className,
  onpointerenter,
  onpointerleave,
  onfocusin,
  onfocusout,
  ...rest
}: Props = $props();

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

/** Exit motion length; matches `tx-toast-out` in toast.css. */
const LEAVE_MS = 160;

let rendered = $state<Rendered[]>(store.items().map((item) => ({ item, leaving: false })));
const leaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Merge the store's list into what is on screen: current toasts in store
 * order, and toasts that just left kept (inert) at their place until their
 * exit motion ends. With reduced motion they leave at once.
 */
function sync(next: readonly ToastItem[]): void {
  const ids = new Set(next.map((item) => item.id));
  const result: Rendered[] = next.map((item) => ({ item, leaving: false }));
  if (!reducedMotion()) {
    rendered.forEach((entry, index) => {
      if (ids.has(entry.item.id)) return;
      result.splice(Math.min(index, result.length), 0, { item: entry.item, leaving: true });
      if (!leaveTimers.has(entry.item.id)) {
        const id = entry.item.id;
        leaveTimers.set(
          id,
          setTimeout(() => {
            leaveTimers.delete(id);
            rendered = rendered.filter((other) => !(other.leaving && other.item.id === id));
          }, LEAVE_MS)
        );
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

// The store runs the action: the toast always dismisses after it and settles
// with 'action'. A rejection is rethrown on a microtask so it reaches the
// host's error reporting (window "error") without leaving the toast stuck.
function runAction(item: ToastItem): void {
  void store.action(item.id);
}
</script>

<Toast.Provider manager={store.manager} {label}>
  <div
    {...rest}
    class={classes}
    data-tx-toaster=""
    style:--tx-toast-offset={offsetValue}
    onpointerenter={chainHandlers(onpointerenter, pointerEnter)}
    onpointerleave={chainHandlers(onpointerleave, pointerLeave)}
    onfocusin={chainHandlers(onfocusin, focusIn)}
    onfocusout={chainHandlers(onfocusout, focusOut)}
  >
    <Toast.Viewport class="tx-toaster__viewport" data-position={position}>
      {#if rendered.length > 0}
        <ol class="tx-toaster__list" data-tx-toast-list>
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
