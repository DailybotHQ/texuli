<script lang="ts">
import { Slider as SliderPrimitive } from '@texuli/primitives/slider';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { splitRequiredControlProps } from '../../internal/control-props.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type SliderSize, sliderRootClass } from './variants.ts';
import './slider.css';

type Orientation = 'horizontal' | 'vertical';
type Mark = { value: number; label?: string };

type Props = {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  type?: 'single' | 'multiple';
  value?: number | number[];
  onValueChange?: (value: number | number[]) => void;
  onValueCommit?: (value: number | number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  minStepsBetweenThumbs?: number;
  orientation?: Orientation;
  dir?: 'ltr' | 'rtl';
  disabled?: boolean;
  size?: SliderSize;
  /** Show a tick for every step when the scale has ≤ 100 steps. */
  showTicks?: boolean;
  /** Labeled marks at specific values (aligned to the step grid). */
  marks?: readonly Mark[];
  label?: string;
  showValue?: boolean;
  getValueText?: (value: number, index: number) => string;
  formatValue?: (value: number) => string;
  name?: string;
  form?: string;
  required?: boolean;
  class?: ClassValue;
  id?: string;
  thumbLabel?: string | readonly string[];
  children?: Snippet;
} & Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'class' | 'children' | 'dir'>;

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
  size = 'md',
  showTicks = false,
  marks = [],
  label = '',
  showValue = false,
  getValueText,
  formatValue,
  name,
  form,
  required = false,
  class: className,
  id,
  thumbLabel: thumbLabelProp,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const thumbLabel = $derived(thumbLabelProp ?? msg('texuli.slider.thumb-label', 'Value'));

// aria-*, data-*, handlers and form attributes go to the thumbs (the focusable
// sliders); layout hooks (style, hidden…) stay on the field wrapper.
const split = $derived(splitRequiredControlProps(rest));
// `aria-required` (a Field's control props) is not allowed on a group or a
// slider thumb: it becomes native `required` on the segment or form inputs.
const isRequired = $derived(required || split.required);
const consumerLabel = $derived(split.control['aria-label'] as string | undefined);

const uid = $props.id();
const labelId = $derived(id ? `${id}-label` : `${uid}-label`);

const rootClass = $derived(
  sliderRootClass({
    size,
    orientation,
    class: className,
  })
);

function defaultFormat(v: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v);
}

const fmt = $derived(formatValue ?? defaultFormat);

function displayValue(current: number | number[] | undefined): string {
  if (current === undefined) return '';
  if (Array.isArray(current)) return current.map(fmt).join(' – ');
  return fmt(current);
}

function labelForThumb(index: number): string {
  if (typeof thumbLabel === 'string') {
    return type === 'multiple' ? `${thumbLabel} ${index + 1}` : thumbLabel;
  }
  return thumbLabel[index] ?? `Value ${index + 1}`;
}

/** Tick index for a mark value on the step grid. */
function markIndex(markValue: number): number {
  const safeStep = step > 0 ? step : 1;
  return Math.round((markValue - min) / safeStep);
}

const markByIndex = $derived.by(() => {
  const map = new Map<number, string>();
  for (const mark of marks) {
    if (mark.label) map.set(markIndex(mark.value), mark.label);
  }
  return map;
});
</script>

{#snippet trackBody(thumbItems: { index: number; value: number }[], tickItems: { index: number; value: number }[])}
  <span class="tx-slider__track" data-tx-slider-track=""></span>
  <SliderPrimitive.Range class="tx-slider__range" />
  {#if showTicks}
    {#each tickItems as tick (tick.index)}
      <SliderPrimitive.Tick index={tick.index} class="tx-slider__tick">
        {#if markByIndex.has(tick.index)}
          <span class="tx-slider__mark-label">{markByIndex.get(tick.index)}</span>
        {/if}
      </SliderPrimitive.Tick>
    {/each}
  {:else}
    {#each marks as mark (mark.value)}
      <SliderPrimitive.Tick index={markIndex(mark.value)} class="tx-slider__tick">
        {#if mark.label}
          <span class="tx-slider__mark-label">{mark.label}</span>
        {/if}
      </SliderPrimitive.Tick>
    {/each}
  {/if}
  {#each thumbItems as thumb (thumb.index)}
    <SliderPrimitive.Thumb
      {...split.control}
      id={thumb.index === 0 ? id : undefined}
      index={thumb.index}
      class="tx-slider__thumb"
      aria-label={consumerLabel
        ? thumbItems.length > 1
          ? `${consumerLabel} ${thumb.index + 1}`
          : consumerLabel
        : labelForThumb(thumb.index)}
    />
  {/each}
  {@render children?.()}
{/snippet}

<div
  bind:this={ref}
  class={cx('tx-slider-field')}
  data-tx-slider-field=""
  {...split.wrapper}
>
  {#if label || showValue}
    <div class="tx-slider-field__header">
      {#if label}
        <span class="tx-slider-field__label" id={labelId}>{label}</span>
      {/if}
      {#if showValue}
        <span class="tx-slider-field__value" data-tx-slider-value="">{displayValue(value)}</span>
      {/if}
    </div>
  {/if}

  <div class="tx-slider-field__control">
    {#if type === 'multiple'}
      <SliderPrimitive.Root
        type="multiple"
        bind:value={value as number[]}
        onValueChange={onValueChange as ((v: number[]) => void) | undefined}
        onValueCommit={onValueCommit as ((v: number[]) => void) | undefined}
        {min}
        {max}
        {step}
        {largeStep}
        {minStepsBetweenThumbs}
        {orientation}
        {dir}
        {disabled}
        {getValueText}
        {name}
        {form}
        required={isRequired}
        class={rootClass}
        aria-labelledby={label ? labelId : undefined}
      >
        {#snippet children({ thumbItems, tickItems })}
          {@render trackBody(thumbItems, tickItems)}
        {/snippet}
      </SliderPrimitive.Root>
    {:else}
      <SliderPrimitive.Root
        type="single"
        bind:value={value as number}
        onValueChange={onValueChange as ((v: number) => void) | undefined}
        onValueCommit={onValueCommit as ((v: number) => void) | undefined}
        {min}
        {max}
        {step}
        {largeStep}
        {orientation}
        {dir}
        {disabled}
        {getValueText}
        {name}
        {form}
        required={isRequired}
        class={rootClass}
        aria-labelledby={label ? labelId : undefined}
      >
        {#snippet children({ thumbItems, tickItems })}
          {@render trackBody(thumbItems, tickItems)}
        {/snippet}
      </SliderPrimitive.Root>
    {/if}
  </div>
</div>
