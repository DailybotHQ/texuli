<script lang="ts">
import { untrack } from 'svelte';
import { type Attachment, createAttachmentKey } from 'svelte/attachments';
import { sliderContext } from './context.ts';
import {
  clamp,
  closestThumb,
  type SliderScale,
  sliderKeyAction,
  snapToStep,
  thumbBounds,
  valueFromPointer,
} from './math.ts';
import type { SliderRootProps, SliderThumbItem, SliderTickItem } from './types.ts';

/**
 * Slider root (APG Slider and multi-thumb Slider). It owns the values, turns
 * pointer and touch input on the track into values, and gives each thumb its
 * keyboard. Thumbs never cross; `minStepsBetweenThumbs` keeps a gap.
 */
let {
  type = 'single',
  value = $bindable(),
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  largeStep,
  minStepsBetweenThumbs = 0,
  orientation = 'horizontal',
  dir,
  disabled = false,
  getValueText,
  name,
  form,
  required = false,
  child,
  children,
  ref = $bindable(null),
  ...rest
}: SliderRootProps = $props();

const scale = $derived<SliderScale>({ min, max: Math.max(min, max), step: step > 0 ? step : 1 });
const values = $derived(
  type === 'multiple'
    ? Array.isArray(value) && value.length > 0
      ? value
      : [min]
    : [typeof value === 'number' ? value : min]
);
// What a form reset goes back to: the values when the slider was created.
const defaults = untrack(() => [...values]);

let active = $state(-1);
let root: HTMLElement | null = null;

function emit(next: number[], commit: boolean) {
  const out = type === 'multiple' ? next : (next[0] as number);
  const changed = next.some((entry, index) => entry !== values[index]);
  if (changed) {
    value = out as typeof value;
    (onValueChange as ((v: number | number[]) => void) | undefined)?.(out);
  }
  if (commit) (onValueCommit as ((v: number | number[]) => void) | undefined)?.(out);
}

/** Moves one thumb to `raw`, snapped and kept between its neighbors. */
function setThumb(index: number, raw: number, commit: boolean) {
  const [low, high] = thumbBounds(values, index, scale, minStepsBetweenThumbs);
  const next = [...values];
  next[index] = clamp(snapToStep(raw, scale), low, high);
  emit(next, commit);
}

function isRtl(node: Element): boolean {
  return (dir ?? node.ownerDocument.defaultView?.getComputedStyle(node).direction) === 'rtl';
}

function thumbElement(index: number): HTMLElement | null {
  return root?.querySelector<HTMLElement>(`[data-tx-slider-thumb][data-index="${index}"]`) ?? null;
}

function pointerValue(event: PointerEvent): number {
  const node = root as HTMLElement;
  return valueFromPointer(
    { x: event.clientX, y: event.clientY },
    node.getBoundingClientRect(),
    scale,
    orientation,
    isRtl(node)
  );
}

function onpointerdown(event: PointerEvent) {
  if (disabled || !root || (event.pointerType === 'mouse' && event.button !== 0)) return;
  const raw = pointerValue(event);
  active = closestThumb(values, raw);
  setThumb(active, raw, false);
  // Keep keyboard focus where the user is: on the thumb that moved.
  event.preventDefault();
  thumbElement(active)?.focus();
  root.setPointerCapture?.(event.pointerId);
}

function onpointermove(event: PointerEvent) {
  if (active < 0) return;
  setThumb(active, pointerValue(event), false);
}

function onpointerend(event: PointerEvent) {
  if (active < 0) return;
  active = -1;
  root?.releasePointerCapture?.(event.pointerId);
  emit([...values], true);
}

const attach: Attachment<HTMLElement> = (node) => {
  root = node;
  ref = node;
  // Touch drags move the thumb instead of scrolling the page.
  node.style.setProperty('touch-action', 'none');
  return () => {
    root = null;
  };
};
const attachKey = createAttachmentKey();

sliderContext.set({
  get values() {
    return values;
  },
  get min() {
    return scale.min;
  },
  get max() {
    return scale.max;
  },
  get step() {
    return scale.step;
  },
  get orientation() {
    return orientation;
  },
  get disabled() {
    return disabled;
  },
  get name() {
    return name;
  },
  get form() {
    return form;
  },
  get required() {
    return required;
  },
  get active() {
    return active;
  },
  defaults,
  bounds: (index) => thumbBounds(values, index, scale, minStepsBetweenThumbs),
  valueText: (index) => getValueText?.(values[index] as number, index),
  keydown(index, event) {
    if (disabled) return false;
    const action = sliderKeyAction(event, {
      step: scale.step,
      largeStep: largeStep ?? scale.step * 10,
      orientation,
      rtl: isRtl(event.currentTarget as Element),
    });
    if (!action) return false;
    const [low, high] = thumbBounds(values, index, scale, minStepsBetweenThumbs);
    const current = values[index] as number;
    setThumb(index, 'by' in action ? current + action.by : action.to === 'low' ? low : high, true);
    return true;
  },
  reset(index, next) {
    const out = [...values];
    out[index] = next;
    emit(out, false);
  },
});

const thumbItems = $derived<SliderThumbItem[]>(
  values.map((entry, index) => ({ index, value: entry }))
);
// One tick per step, for scales of at most 100 steps (denser ticks are noise).
const tickItems = $derived.by<SliderTickItem[]>(() => {
  const count = Math.round((scale.max - scale.min) / scale.step);
  if (count > 100) return [];
  return Array.from({ length: count + 1 }, (_, index) => ({
    index,
    value: snapToStep(scale.min + index * scale.step, scale),
  }));
});

const partProps = $derived({
  ...rest,
  'data-tx-slider-root': '',
  'data-orientation': orientation,
  'data-disabled': disabled ? '' : undefined,
  dir,
  onpointerdown,
  onpointermove,
  onpointerup: onpointerend,
  onpointercancel: onpointerend,
  [attachKey]: attach,
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <span {...partProps}>{@render children?.({ thumbItems, tickItems })}</span>
{/if}
