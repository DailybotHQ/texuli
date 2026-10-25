<script lang="ts">
import { createAttachmentKey } from 'svelte/attachments';
import { positionAttachment, sliderContext } from './context.ts';
import { percentOf } from './math.ts';
import type { SliderRangeProps } from './types.ts';

/** The filled part of the track: from `min` (one thumb) or between the outer thumbs. */
let { child, children, ref = $bindable(null), ...rest }: SliderRangeProps = $props();

const slider = sliderContext.get();
const positionKey = createAttachmentKey();
const position = positionAttachment(() => {
  const values = slider.values;
  const start = values.length > 1 ? percentOf(values[0] as number, slider.min, slider.max) : 0;
  const end = 100 - percentOf(values[values.length - 1] as number, slider.min, slider.max);
  return slider.orientation === 'vertical'
    ? { 'inset-block-end': `${start}%`, 'inset-block-start': `${end}%` }
    : { 'inset-inline-start': `${start}%`, 'inset-inline-end': `${end}%` };
});

const partProps = $derived({
  ...rest,
  'data-tx-slider-range': '',
  'data-orientation': slider.orientation,
  'data-disabled': slider.disabled ? '' : undefined,
  [positionKey]: position,
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <span bind:this={ref} {...partProps}>{@render children?.()}</span>
{/if}
