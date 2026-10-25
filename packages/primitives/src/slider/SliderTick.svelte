<script lang="ts">
import { createAttachmentKey } from 'svelte/attachments';
import { positionAttachment, sliderContext } from './context.ts';
import { percentOf, snapToStep } from './math.ts';
import type { SliderTickProps } from './types.ts';

/** A mark at one step on the track (render one per root `tickItems` entry). Decorative. */
let { index, child, children, ref = $bindable(null), ...rest }: SliderTickProps = $props();

const slider = sliderContext.get();
const value = $derived(
  snapToStep(slider.min + index * slider.step, {
    min: slider.min,
    max: slider.max,
    step: slider.step,
  })
);
const values = $derived(slider.values);
const selected = $derived(
  values.length > 1
    ? value >= (values[0] as number) && value <= (values[values.length - 1] as number)
    : value <= (values[0] as number)
);
const positionKey = createAttachmentKey();
const position = positionAttachment(() => {
  const percent = `${percentOf(value, slider.min, slider.max)}%`;
  return slider.orientation === 'vertical'
    ? { 'inset-block-end': percent }
    : { 'inset-inline-start': percent };
});

const partProps = $derived({
  ...rest,
  'aria-hidden': 'true' as const,
  'data-tx-slider-tick': '',
  'data-value': value,
  'data-selected': selected ? '' : undefined,
  'data-orientation': slider.orientation,
  [positionKey]: position,
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <span bind:this={ref} {...partProps}>{@render children?.()}</span>
{/if}
