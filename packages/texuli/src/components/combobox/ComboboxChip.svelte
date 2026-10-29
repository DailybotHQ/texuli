<script lang="ts">
import {
  getComboboxContext,
  Chip as PrimitiveChip,
  ChipRemove as PrimitiveChipRemove,
} from '@texuli/primitives/combobox';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { comboboxChipClass } from './variants.ts';
import './combobox.css';

type Props = ComponentProps<typeof PrimitiveChip> & {
  children?: Snippet;
  class?: ClassValue;
  /** Hide the remove control. Default false. */
  removable?: boolean;
};

let {
  children,
  class: className,
  value,
  label,
  removable = true,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const context = getComboboxContext();
const text = $derived(label ?? context.labelFor(value));

const classes = $derived(
  comboboxChipClass({
    class: className,
  })
);
</script>

<PrimitiveChip bind:ref class={classes} data-tx-combobox-chip {value} label={text} {...rest}>
  <span class="tx-combobox-chip__label">
    {#if children}
      {@render children()}
    {:else}
      {text}
    {/if}
  </span>
  {#if removable}
    <PrimitiveChipRemove class="tx-combobox-chip__remove" {value}>×</PrimitiveChipRemove>
  {/if}
</PrimitiveChip>
