<script lang="ts">
import { RadioGroup as RadioGroupPrimitive } from '@texuli/primitives/radio-group';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import Radio from './Radio.svelte';
import type { RadioOption } from './types.ts';
import {
  type ChoiceSize,
  type RadioOrientation,
  type RadioVariant,
  radioGroupClass,
} from './variants.ts';
import './choice.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  orientation?: RadioOrientation;
  variant?: RadioVariant;
  size?: ChoiceSize;
  /** Convenience list; use children with `Radio` for custom layouts. */
  items?: readonly RadioOption[];
  loop?: boolean;
  children?: Snippet;
};

let {
  value = $bindable(''),
  onValueChange,
  name,
  required = false,
  disabled = false,
  readonly = false,
  orientation = 'vertical',
  variant = 'default',
  size = 'md',
  items,
  loop = true,
  class: className,
  children,
  ...rest
}: Props = $props();

const classes = $derived(
  radioGroupClass({
    orientation,
    variant,
    class: className,
  })
);
</script>

<RadioGroupPrimitive.Root
  bind:value
  {onValueChange}
  {name}
  {required}
  {disabled}
  {readonly}
  {orientation}
  {loop}
  class={classes}
  data-tx-choice="radio-group"
  data-variant={variant}
  {...rest}
>
  {#if items}
    {#each items as item (item.value)}
      <Radio
        value={item.value}
        label={item.label}
        description={item.description}
        disabled={item.disabled || disabled}
        {size}
        card={variant === 'card'}
      />
    {/each}
  {/if}
  {@render children?.()}
</RadioGroupPrimitive.Root>
