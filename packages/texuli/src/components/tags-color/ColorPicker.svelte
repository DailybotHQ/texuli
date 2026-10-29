<script lang="ts">
import {
  type ColorFormat,
  ColorPicker as ColorPickerPrimitive,
} from '@texuli/primitives/color-picker';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import type { ColorSwatch } from './types.ts';
import './tags-color.css';

type Props = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  format?: ColorFormat;
  disabled?: boolean;
  /** Accessible name for the color group. */
  label?: string;
  /** Preset swatches shown under the controls. */
  swatches?: readonly ColorSwatch[];
  class?: ClassValue;
  id?: string;
};

const DEFAULT_SWATCHES: readonly ColorSwatch[] = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#64748b', label: 'Slate' },
];

let {
  value = $bindable(),
  defaultValue = '#3b82f6',
  onValueChange,
  format = $bindable('hex' as ColorFormat),
  disabled = false,
  label = 'Choose color',
  swatches = DEFAULT_SWATCHES,
  class: className,
  id,
  ref = $bindable(null),
  ...rest
}: Props & RefProp = $props();

const preview = $derived(value ?? defaultValue);
</script>

<ColorPickerPrimitive.Root bind:ref
  bind:value
  bind:format
  {defaultValue}
  {onValueChange}
  {disabled}
  {label}
  {id}
  class={cx('tx-color-picker', className)}
  data-tx-color-picker=""
  data-disabled={disabled ? 'true' : undefined}
  style={`--tx-color-picker-value: ${preview}`}
  {...rest}
>
  <ColorPickerPrimitive.Area class="tx-color-picker__area" data-tx-color-area="" />
  <div class="tx-color-picker__sliders">
    <ColorPickerPrimitive.Hue class="tx-color-picker__slider tx-color-picker__slider--hue" />
    <ColorPickerPrimitive.Alpha class="tx-color-picker__slider" />
  </div>
  <div class="tx-color-picker__row">
    <span
      class="tx-color-picker__preview"
      style={`background-color: ${preview}`}
      aria-hidden="true"
      data-tx-color-preview=""
    ></span>
    <ColorPickerPrimitive.FormatInput class="tx-color-picker__format" data-tx-color-format="" />
  </div>
  {#if swatches.length > 0}
    <!--
      Named list of presets (APG list pattern). Each button sits in a listitem
      so aria-required-children is satisfied (list → listitem → button).
    -->
    <div class="tx-color-picker__swatches" role="list" aria-label="Color swatches">
      {#each swatches as swatch (swatch.value)}
        <div class="tx-color-picker__swatch-item" role="listitem">
          <ColorPickerPrimitive.Swatch
            value={swatch.value}
            label={swatch.label}
            class="tx-color-picker__swatch"
            style={`--tx-swatch-color: ${swatch.value}; background-color: ${swatch.value}`}
            data-tx-color-swatch=""
          />
        </div>
      {/each}
    </div>
  {/if}
</ColorPickerPrimitive.Root>
