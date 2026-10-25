<script lang="ts">
import { ToggleGroup as ToggleGroupPrimitive } from '@texuli/primitives/toggle';
import type { Snippet } from 'svelte';
import { setContext } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { TOGGLE_GROUP_STYLE } from './style-context.ts';
import { type ToggleSize, type ToggleVariant, toggleGroupClass } from './variants.ts';
import './toggle.css';

type Orientation = 'horizontal' | 'vertical';
type GroupType = 'single' | 'multiple';

type Props = {
  type?: GroupType;
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  disabled?: boolean;
  loop?: boolean;
  orientation?: Orientation;
  rovingFocus?: boolean;
  /**
   * Let horizontal items wrap onto more lines when the row is too wide (long
   * filter lists). Outline items then show as separate bordered chips.
   */
  wrap?: boolean;
  variant?: ToggleVariant;
  size?: ToggleSize;
  class?: ClassValue;
  children?: Snippet;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

let {
  type = 'single',
  value = $bindable(undefined),
  defaultValue,
  onValueChange,
  disabled = false,
  loop = true,
  orientation = 'horizontal',
  rovingFocus = true,
  wrap = false,
  variant = 'default',
  size = 'md',
  class: className,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: Props = $props();

setContext(TOGGLE_GROUP_STYLE, {
  get variant() {
    return variant;
  },
  get size() {
    return size;
  },
});

const classes = $derived(
  toggleGroupClass({
    orientation,
    variant,
    class: [wrap ? 'tx-toggle-group--wrap' : '', className].filter(Boolean).join(' ') || undefined,
  })
);
</script>

<ToggleGroupPrimitive.Root
  {type}
  bind:value
  {defaultValue}
  {onValueChange}
  {disabled}
  {loop}
  {orientation}
  {rovingFocus}
  class={classes}
  aria-label={ariaLabel}
  aria-labelledby={ariaLabelledby}
>
  {@render children?.()}
</ToggleGroupPrimitive.Root>
