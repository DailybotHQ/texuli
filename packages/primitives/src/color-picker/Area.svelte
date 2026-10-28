<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { chainHandlers, composeHandlers } from '../internal/handlers.ts';
import { withArea } from './color.ts';
import { getColorPickerContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'> & {
  label?: string;
  step?: number;
};

let { label = 'Color area', step = 0.01, ...rest }: Props = $props();
const context = getColorPickerContext();
let dragging = $state(false);

function updateFromPointer(event: PointerEvent): void {
  const box = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return;
  const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
  const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
  context.setColor(withArea(context.color, 1 - y, x * 0.4));
}

function onpointerdown(event: PointerEvent): void {
  if (context.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault();
  dragging = true;
  updateFromPointer(event);
  try {
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
  } catch {
    // Keep pointer input usable in DOMs that do not support pointer capture.
  }
}

function onpointermove(event: PointerEvent): void {
  if (dragging) updateFromPointer(event);
}

function end(): void {
  dragging = false;
}

function onkeydown(event: KeyboardEvent): void {
  rest.onkeydown?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement });
  if (event.defaultPrevented || context.disabled) return;
  const delta = event.shiftKey ? step * 10 : step;
  const { l, c } = context.color;
  const next =
    event.key === 'ArrowRight'
      ? withArea(context.color, l, c + delta)
      : event.key === 'ArrowLeft'
        ? withArea(context.color, l, c - delta)
        : event.key === 'ArrowUp'
          ? withArea(context.color, l + delta, c)
          : event.key === 'ArrowDown'
            ? withArea(context.color, l - delta, c)
            : event.key === 'Home'
              ? withArea(context.color, 0, 0)
              : event.key === 'End'
                ? withArea(context.color, 1, 0.4)
                : null;
  if (!next) return;
  event.preventDefault();
  context.setColor(next);
}

const attrs = $derived({
  ...rest,
  role: 'slider' as const,
  'aria-label': label,
  'aria-valuemin': 0,
  'aria-valuemax': 100,
  'aria-valuenow': Math.round(context.color.l * 100),
  'aria-valuetext': `Lightness ${Math.round(context.color.l * 100)}%, chroma ${context.color.c.toFixed(2)}`,
  'aria-disabled': context.disabled ? true : undefined,
  tabindex: context.disabled ? undefined : 0,
  'data-state': dragging ? 'active' : 'inactive',
  onpointerdown: composeHandlers(rest.onpointerdown, onpointerdown),
  onpointermove: composeHandlers(rest.onpointermove, onpointermove),
  onpointerup: chainHandlers(rest.onpointerup, end),
  onpointercancel: chainHandlers(rest.onpointercancel, end),
  onlostpointercapture: chainHandlers(rest.onlostpointercapture, end),
  onkeydown: composeHandlers(rest.onkeydown, onkeydown),
});
</script>

<div {...attrs} style:touch-action="none"></div>
