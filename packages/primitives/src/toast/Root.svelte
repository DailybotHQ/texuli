<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { chainHandlers, composeHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { stateAttributes } from '../internal/state.ts';
import { getToastProviderContext, setToastItemContext } from './context.ts';
import type { ToastRecord } from './types.ts';

type Props = HTMLAttributes<HTMLLIElement> & {
  toast: ToastRecord;
  children?: Snippet;
} & RefProp;

let {
  toast,
  class: className,
  children,
  ref = $bindable(null),
  onpointerdown,
  onpointermove,
  onpointerup,
  onpointercancel,
  ...rest
}: Props = $props();

const provider = getToastProviderContext();
let itemEl: HTMLLIElement | null = $state(null);
// `ref` follows the element the part binds for its own behavior.
$effect(() => {
  ref = itemEl ?? null;
});
let remaining = $state(0);
let durationReady = $state(false);
let running = $state(false);

$effect.pre(() => {
  if (!durationReady) {
    remaining = toast.duration;
    durationReady = true;
  }
});

let startedAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let swipeStartX = 0;
let swiping = false;
let offsetX = $state(0);

function clearTimer(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

function dismiss(): void {
  clearTimer();
  provider.manager.dismiss(toast.id);
}

setToastItemContext({
  get toast() {
    return toast;
  },
  dismiss,
});

function armTimer(): void {
  clearTimer();
  if (remaining <= 0 || !Number.isFinite(remaining)) return;
  if (provider.isPaused()) return;
  running = true;
  startedAt = Date.now();
  timer = setTimeout(() => {
    timer = undefined;
    running = false;
    dismiss();
  }, remaining);
}

function pauseTimer(): void {
  if (!running) return;
  clearTimer();
  remaining = Math.max(0, remaining - (Date.now() - startedAt));
  running = false;
}

$effect(() => {
  const release = provider.registerPauser((paused) => {
    if (paused) pauseTimer();
    else armTimer();
  });
  armTimer();
  return () => {
    release();
    clearTimer();
  };
});

function onPointerDown(event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  // Do not start a swipe from action/close controls (would steal the click).
  const target = event.target;
  if (target instanceof Element && target.closest('button, a, input, textarea, select')) return;
  swiping = true;
  swipeStartX = event.clientX;
  offsetX = 0;
  itemEl?.setPointerCapture?.(event.pointerId);
  pauseTimer();
}

function onPointerMove(event: PointerEvent): void {
  if (!swiping) return;
  offsetX = event.clientX - swipeStartX;
  if (itemEl) itemEl.style.setProperty('translate', `${offsetX}px 0`);
}

function onPointerUp(event: PointerEvent): void {
  if (!swiping) return;
  swiping = false;
  itemEl?.releasePointerCapture?.(event.pointerId);
  if (Math.abs(offsetX) > 64) {
    dismiss();
    return;
  }
  offsetX = 0;
  if (itemEl) itemEl.style.removeProperty('translate');
  if (!provider.isPaused()) armTimer();
}
</script>

<li
  bind:this={itemEl}
  {...rest}
  class={typeof className === 'string' ? className : undefined}
  data-tx-toast-root
  data-toast-id={toast.id}
  data-priority={toast.priority}
  data-tone={toast.tone}
  {...stateAttributes('open')}
  onpointerdown={composeHandlers(onpointerdown, onPointerDown)}
  onpointermove={chainHandlers(onpointermove, onPointerMove)}
  onpointerup={chainHandlers(onpointerup, onPointerUp)}
  onpointercancel={chainHandlers(onpointercancel, onPointerUp)}
>
  {@render children?.()}
</li>
