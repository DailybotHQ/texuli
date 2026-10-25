<script lang="ts">
import { Item as PrimitiveItem } from '@texuli/primitives/combobox';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { comboboxItemClass } from './variants.ts';
import './combobox.css';

type Props = ComponentProps<typeof PrimitiveItem> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, disabled = false, label, value, ...rest }: Props = $props();

const classes = $derived(
  comboboxItemClass({
    class: className,
    disabled: Boolean(disabled),
  })
);
</script>

<PrimitiveItem class={classes} data-tx-combobox-item {value} {label} {disabled} {...rest}>
  <span class="tx-combobox-item__check" aria-hidden="true">
    <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
      <path
        d="M3.5 8.25 6.75 11.5 12.5 4.75"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </span>
  <span class="tx-combobox-item__label">
    {#if children}
      {@render children()}
    {:else}
      {label ?? value}
    {/if}
  </span>
</PrimitiveItem>
