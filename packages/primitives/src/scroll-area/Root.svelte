<script lang="ts">
import { untrack } from 'svelte';
import { composeChildProps } from '../internal/child.ts';
import {
  EMPTY_METRICS,
  overflowX,
  overflowY,
  type ScrollAreaContext,
  scrollAreaContext,
} from './context.ts';
import type { ScrollAreaDir, ScrollAreaRootProps, ScrollAreaType, ScrollMetrics } from './types.ts';

let {
  type = 'hover' as ScrollAreaType,
  dir = 'ltr' as ScrollAreaDir,
  scrollHideDelay = 600,
  class: className,
  children,
  child,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...rest
}: ScrollAreaRootProps & Record<string, unknown> = $props();

let viewport = $state<HTMLElement | undefined>(undefined);
let metrics = $state<ScrollMetrics>({ ...EMPTY_METRICS });
let hovering = $state(false);
let scrolling = $state(false);
// Initial visibility from type once; then driven by hover/scroll/auto.
let visible = $state(untrack(() => type === 'always' || type === 'auto'));

let hideTimer: ReturnType<typeof setTimeout> | undefined;
const delay = untrack(() => scrollHideDelay);

function clearHideTimer(): void {
  if (hideTimer !== undefined) clearTimeout(hideTimer);
  hideTimer = undefined;
}

function scheduleHide(): void {
  clearHideTimer();
  if (type === 'always') {
    visible = true;
    return;
  }
  if (type === 'auto') {
    visible = overflowX(metrics) || overflowY(metrics);
    return;
  }
  hideTimer = setTimeout(
    () => {
      hideTimer = undefined;
      if (!hovering) {
        scrolling = false;
        visible = false;
      }
    },
    Math.max(0, delay)
  );
}

function readMetrics(node: HTMLElement): ScrollMetrics {
  return {
    scrollTop: node.scrollTop,
    scrollLeft: node.scrollLeft,
    scrollWidth: node.scrollWidth,
    scrollHeight: node.scrollHeight,
    clientWidth: node.clientWidth,
    clientHeight: node.clientHeight,
  };
}

function refresh(): void {
  const node = viewport;
  if (!node) return;
  const next = readMetrics(node);
  metrics = next;
  if (type === 'always') visible = true;
  else if (type === 'auto') visible = overflowX(next) || overflowY(next);
}

function setViewport(node: HTMLElement | undefined): void {
  viewport = node;
  if (!node) {
    metrics = { ...EMPTY_METRICS };
    return;
  }
  // Defer measure so attach does not re-enter the same flush.
  queueMicrotask(() => refresh());
}

function setHovering(value: boolean): void {
  hovering = value;
  if (type === 'hover' || type === 'scroll') {
    if (value) {
      clearHideTimer();
      visible = true;
    } else if (!scrolling) {
      scheduleHide();
    }
  }
}

function notifyScroll(): void {
  const node = viewport;
  if (!node) return;
  const next = readMetrics(node);
  metrics = next;
  if (type === 'scroll' || type === 'hover') {
    scrolling = true;
    visible = true;
    scheduleHide();
  } else if (type === 'auto') {
    visible = overflowX(next) || overflowY(next);
  } else {
    visible = true;
  }
}

function scrollTo(options: { top?: number; left?: number }): void {
  const node = viewport;
  if (!node) return;
  node.scrollTo({
    top: options.top ?? node.scrollTop,
    left: options.left ?? node.scrollLeft,
    behavior: 'auto',
  });
  notifyScroll();
}

function scrollbarVisible(orientation: 'horizontal' | 'vertical'): boolean {
  const hasOverflow = orientation === 'vertical' ? overflowY(metrics) : overflowX(metrics);
  if (!hasOverflow) return false;
  if (type === 'always' || type === 'auto') return true;
  return visible;
}

const ctx: ScrollAreaContext = {
  get type() {
    return type;
  },
  get dir() {
    return dir;
  },
  get scrollHideDelay() {
    return delay;
  },
  get metrics() {
    return metrics;
  },
  get hovering() {
    return hovering;
  },
  get scrolling() {
    return scrolling;
  },
  get visible() {
    return visible;
  },
  getViewport: () => viewport,
  setViewport,
  setHovering,
  notifyScroll,
  scrollTo,
  scrollbarVisible,
};

scrollAreaContext.set(ctx);

const rootProps = $derived({
  ...rest,
  class: typeof className === 'string' ? className : undefined,
  dir,
  'data-tx-scroll-area': '',
  'data-type': type,
  'data-state': visible ? 'visible' : 'hidden',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  onpointerenter: () => setHovering(true),
  onpointerleave: () => setHovering(false),
});
</script>

{#if child}
  {@render child({ props: composeChildProps(rootProps, {}) })}
{:else}
  <div {...rootProps}>
    {@render children?.()}
  </div>
{/if}
