<script lang="ts">
import { Toggle as TogglePrimitive } from '@texuli/primitives/toggle';
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import { type ToggleSize, type ToggleVariant, toggleClass } from './variants.ts';
import './toggle.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  disabled?: boolean;
  variant?: ToggleVariant;
  size?: ToggleSize;
  class?: ClassValue;
  children?: Snippet;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
} & Omit<
  HTMLButtonAttributes,
  'disabled' | 'class' | 'children' | 'id' | 'type' | 'aria-pressed' | 'value'
>;

let {
  pressed = $bindable(undefined),
  defaultPressed = false,
  onPressedChange,
  disabled = false,
  variant: variantProp,
  size: sizeProp,
  class: className,
  children,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  // Other aria-*, data-* and handlers go to the button (there is no wrapper).
  ref = $bindable(null),
  ...rest
}: Props & RefProp = $props();
const txDefaults = designDefaults('toggle');
const variant = $derived(withDefault(variantProp, txDefaults().variant, 'default'));
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));

const classes = $derived(
  toggleClass({
    variant,
    size,
    class: className,
  })
);
</script>

<TogglePrimitive.Root bind:ref
  {...rest}
  bind:pressed
  {defaultPressed}
  {onPressedChange}
  {disabled}
  {id}
  aria-label={ariaLabel}
  aria-labelledby={ariaLabelledby}
  aria-describedby={ariaDescribedby}
  class={classes}
>
  {@render children?.()}
</TogglePrimitive.Root>
