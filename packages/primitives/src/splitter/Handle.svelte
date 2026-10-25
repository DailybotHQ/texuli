<script lang="ts">
import { createAttachmentKey } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/index.ts';
import { splitterContext } from './context.ts';
import { layoutForKey, paneBounds, resizeLayout, toggleCollapse } from './model.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'> & {
  /** Accessible name, ideally naming the pane it resizes (e.g. "Resize navigation"). */
  label?: string;
  disabled?: boolean;
  ref?: HTMLElement | null;
  child?: ChildSnippet<Record<string, unknown>>;
};

let { label = 'Resize', disabled = false, ref = $bindable(null), child, ...rest }: Props = $props();

const context = splitterContext.get();
const index = $derived(ref && context.panes.length > 0 ? context.handleIndex(ref) : -1);
const constraints = $derived(context.panes.map((pane) => pane.constraints));
const size = $derived(context.layout[index] ?? 0);
const inactive = $derived(disabled || context.disabled || index < 0);

// The value range of the first pane (APG): collapsed or minimum, to the
// largest size the next pane's minimum allows.
const range = $derived.by(() => {
  const first = paneBounds(constraints[index]);
  const second = paneBounds(constraints[index + 1]);
  const pair = size + (context.layout[index + 1] ?? 0);
  return {
    min: first.collapsible ? first.collapsed : first.min,
    max: Math.min(first.max, pair - (second.collapsible ? second.collapsed : second.min)),
  };
});

let restoreSize: number | undefined;
let drag: { id: number; start: number; layout: number[] } | null = $state(null);

function onkeydown(event: KeyboardEvent): void {
  rest.onkeydown?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement });
  if (event.defaultPrevented || inactive) return;
  if (event.key === 'Enter') {
    const result = toggleCollapse(context.layout, index, constraints, restoreSize);
    restoreSize = result.restoreSize;
    context.setLayout(result.layout, true);
    event.preventDefault();
    return;
  }
  const next = layoutForKey(event.key, context.layout, index, constraints, {
    direction: context.direction,
    rtl: context.isRtl(),
    step: context.keyboardStep,
  });
  if (!next) return;
  event.preventDefault();
  restoreSize = undefined;
  context.setLayout(next, true);
}

const position = (event: PointerEvent) =>
  context.direction === 'horizontal' ? event.clientX : event.clientY;

function onpointerdown(event: PointerEvent): void {
  rest.onpointerdown?.(event as PointerEvent & { currentTarget: EventTarget & HTMLDivElement });
  if (event.defaultPrevented || inactive || (event.pointerType === 'mouse' && event.button !== 0))
    return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  (event.currentTarget as HTMLElement).focus({ preventScroll: true });
  drag = { id: event.pointerId, start: position(event), layout: [...context.layout] };
}

function onpointermove(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.id) return;
  const span = context.groupSize();
  if (span <= 0) return;
  const mirror = context.direction === 'horizontal' && context.isRtl() ? -1 : 1;
  const delta = ((position(event) - drag.start) / span) * 100 * mirror;
  context.setLayout(resizeLayout(drag.layout, index, delta, constraints), false);
}

function end(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.id) return;
  drag = null;
  restoreSize = undefined;
  context.setLayout([...context.layout], true);
}

const refKey = createAttachmentKey();
const attrs = $derived({
  ...rest,
  // A child snippet's element becomes `ref` too, so the group can measure it.
  [refKey]: (node: HTMLElement) => {
    ref = node;
  },
  role: 'separator' as const,
  tabindex: inactive ? undefined : 0,
  'aria-label': rest['aria-labelledby'] ? undefined : label,
  'aria-orientation': (context.direction === 'horizontal' ? 'vertical' : 'horizontal') as
    | 'vertical'
    | 'horizontal',
  'aria-valuenow': Math.round(size),
  'aria-valuemin': Math.round(range.min),
  'aria-valuemax': Math.round(range.max),
  'aria-controls': context.panes[index]?.id,
  'aria-disabled': inactive ? ('true' as const) : undefined,
  'data-splitter-handle': '',
  'data-state': drag ? 'active' : 'inactive',
  'data-disabled': inactive ? '' : undefined,
  onkeydown,
  onpointerdown,
  onpointermove,
  onpointerup: end,
  onpointercancel: end,
  onlostpointercapture: end,
});
</script>

{#if child}
  {@render child({ props: attrs })}
{:else}
  <div bind:this={ref} {...attrs} style:touch-action="none"></div>
{/if}
