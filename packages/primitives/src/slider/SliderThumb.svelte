<script lang="ts">
import { createFormBridge } from '@texuli/core/form-bridge';
import { untrack } from 'svelte';
import { type Attachment, createAttachmentKey } from 'svelte/attachments';
import { positionAttachment, sliderContext } from './context.ts';
import { percentOf } from './math.ts';
import type { SliderThumbProps } from './types.ts';

/**
 * One draggable value: `role="slider"` with its value, bounds (the
 * neighboring thumbs in a range) and orientation. Give it a name with
 * `aria-label` or `aria-labelledby`, for example "Minimum price".
 */
let {
  index = 0,
  child,
  children,
  ref = $bindable(null),
  onkeydown,
  ...rest
}: SliderThumbProps = $props();

const slider = sliderContext.get();
const current = $derived(slider.values[index] ?? slider.min);
const bounds = $derived(slider.bounds(index));

function handleKeydown(event: KeyboardEvent) {
  (onkeydown as ((e: KeyboardEvent) => void) | undefined)?.(event);
  if (event.defaultPrevented) return;
  if (slider.keydown(index, event)) event.preventDefault();
}

/**
 * A native input per thumb, so the value submits with its form and resets
 * with it. Created once (untracked); the inner effect keeps it in sync.
 */
const bridge: Attachment<HTMLElement> = (node) => {
  const name = untrack(() => slider.name);
  if (!name) return;
  const field = untrack(() =>
    createFormBridge(node.ownerDocument, {
      name,
      value: String(current),
      defaultValue: String(slider.defaults[index] ?? slider.min),
      required: slider.required,
      disabled: slider.disabled,
      ...(slider.form ? { form: slider.form } : {}),
      focusTarget: node,
      onReset: (restored) => slider.reset(index, Number(restored)),
    })
  );
  node.after(field.input);
  $effect(() => {
    field.setValue(String(current));
    field.input.disabled = slider.disabled;
  });
  return () => field.dispose();
};
const bridgeKey = createAttachmentKey();
const positionKey = createAttachmentKey();
const position = positionAttachment(() => {
  const percent = `${percentOf(current, slider.min, slider.max)}%`;
  return slider.orientation === 'vertical'
    ? { 'inset-block-end': percent }
    : { 'inset-inline-start': percent };
});

const partProps = $derived({
  ...rest,
  role: 'slider',
  tabindex: slider.disabled ? -1 : 0,
  'aria-valuenow': current,
  'aria-valuemin': bounds[0],
  'aria-valuemax': bounds[1],
  'aria-valuetext': slider.valueText(index),
  'aria-orientation': slider.orientation,
  'aria-disabled': slider.disabled ? ('true' as const) : undefined,
  'data-tx-slider-thumb': '',
  'data-index': index,
  'data-value': current,
  'data-state': slider.active === index ? 'active' : 'inactive',
  'data-orientation': slider.orientation,
  'data-disabled': slider.disabled ? '' : undefined,
  onkeydown: handleKeydown,
  [bridgeKey]: bridge,
  [positionKey]: position,
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <span bind:this={ref} {...partProps}>{@render children?.()}</span>
{/if}
