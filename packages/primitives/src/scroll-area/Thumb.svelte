<script lang="ts">
import { composeChildProps } from '../internal/child.ts';
import { scrollAreaContext } from './context.ts';
import type { ScrollAreaOrientation, ScrollAreaThumbProps } from './types.ts';

let {
  forceMount = false,
  class: className,
  children,
  child,
  ...rest
}: ScrollAreaThumbProps & Record<string, unknown> = $props();

const context = scrollAreaContext.get();

// Orientation comes from the parent scrollbar via DOM; thumb sizes from metrics.
function sizes(orientation: ScrollAreaOrientation): {
  sizePct: number;
  offsetPct: number;
} {
  const m = context.metrics;
  if (orientation === 'vertical') {
    const track = m.clientHeight || 1;
    const content = m.scrollHeight || 1;
    const sizePct = Math.min(100, Math.max(8, (track / content) * 100));
    const maxScroll = Math.max(1, content - track);
    const offsetPct = (m.scrollTop / maxScroll) * (100 - sizePct);
    return { sizePct, offsetPct: Number.isFinite(offsetPct) ? offsetPct : 0 };
  }
  const track = m.clientWidth || 1;
  const content = m.scrollWidth || 1;
  const sizePct = Math.min(100, Math.max(8, (track / content) * 100));
  const maxScroll = Math.max(1, content - track);
  const offsetPct = (m.scrollLeft / maxScroll) * (100 - sizePct);
  return { sizePct, offsetPct: Number.isFinite(offsetPct) ? offsetPct : 0 };
}

let dragging = $state(false);
let dragStart = $state(0);
let scrollStart = $state(0);
let activeOrientation = $state<ScrollAreaOrientation>('vertical');

function onPointerDown(event: PointerEvent, orientation: ScrollAreaOrientation): void {
  if (event.button !== 0) return;
  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture?.(event.pointerId);
  dragging = true;
  activeOrientation = orientation;
  dragStart = orientation === 'vertical' ? event.clientY : event.clientX;
  const m = context.metrics;
  scrollStart = orientation === 'vertical' ? m.scrollTop : m.scrollLeft;
  event.preventDefault();
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging) return;
  const m = context.metrics;
  if (activeOrientation === 'vertical') {
    const track = m.clientHeight || 1;
    const content = m.scrollHeight || 1;
    const maxScroll = Math.max(1, content - track);
    const thumbPx = Math.max((track / content) * track, 16);
    const delta = event.clientY - dragStart;
    const next = scrollStart + (delta / Math.max(1, track - thumbPx)) * maxScroll;
    context.scrollTo({ top: Math.max(0, Math.min(maxScroll, next)) });
  } else {
    const track = m.clientWidth || 1;
    const content = m.scrollWidth || 1;
    const maxScroll = Math.max(1, content - track);
    const thumbPx = Math.max((track / content) * track, 16);
    const delta = event.clientX - dragStart;
    const rtl = context.dir === 'rtl' ? -1 : 1;
    const next = scrollStart + rtl * (delta / Math.max(1, track - thumbPx)) * maxScroll;
    context.scrollTo({ left: Math.max(0, Math.min(maxScroll, next)) });
  }
}

function onPointerUp(event: PointerEvent): void {
  if (!dragging) return;
  dragging = false;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
}

// Parent scrollbar sets data-orientation; read from closest if available via style vars.
// Derived from the live metrics: the thumb follows scrolling and size changes.
const vertical = $derived(sizes('vertical'));
const horizontal = $derived(sizes('horizontal'));

// Default assume vertical; scrollbar hosts one orientation of thumb.
// Consumers place Thumb inside a Scrollbar of known orientation — pass via CSS vars from parent.
const thumbStyle = $derived(
  // Both axes computed; host scrollbar CSS picks the axis via [data-orientation].
  `--tx-sa-thumb-size-y:${vertical.sizePct}%;--tx-sa-thumb-offset-y:${vertical.offsetPct}%;--tx-sa-thumb-size-x:${horizontal.sizePct}%;--tx-sa-thumb-offset-x:${horizontal.offsetPct}%;`
);

function bindHandlers(node: HTMLElement): () => void {
  const orientation = (node.closest('[data-orientation]')?.getAttribute('data-orientation') ??
    'vertical') as ScrollAreaOrientation;

  const down = (event: PointerEvent) => onPointerDown(event, orientation);
  const move = (event: PointerEvent) => onPointerMove(event);
  const up = (event: PointerEvent) => onPointerUp(event);
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  return () => {
    node.removeEventListener('pointerdown', down);
    node.removeEventListener('pointermove', move);
    node.removeEventListener('pointerup', up);
    node.removeEventListener('pointercancel', up);
  };
}

const thumbProps = $derived({
  ...rest,
  class: typeof className === 'string' ? className : undefined,
  'data-tx-scroll-area-thumb': '',
  'data-state': dragging ? 'dragging' : 'idle',
  'aria-hidden': 'true' as const,
  style: thumbStyle,
});
</script>

{#if child}
  {@render child({ props: composeChildProps({ ...thumbProps, attach: bindHandlers }, {}) })}
{:else}
  <div {...thumbProps} {@attach bindHandlers}>
    {@render children?.()}
  </div>
{/if}
