<script lang="ts">
import { Trigger as PrimitiveTrigger } from '@texuli/primitives/combobox';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { comboboxTriggerClass } from './variants.ts';
import './combobox.css';

type Props = ComponentProps<typeof PrimitiveTrigger> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();

const classes = $derived(
  comboboxTriggerClass({
    class: className,
  })
);
</script>

<PrimitiveTrigger class={classes} data-tx-combobox-trigger {...rest}>
  {#if children}
    {@render children()}
  {:else}
    <svg
      class="tx-combobox-trigger__icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4.5 6.25 8 9.75l3.5-3.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  {/if}
</PrimitiveTrigger>
