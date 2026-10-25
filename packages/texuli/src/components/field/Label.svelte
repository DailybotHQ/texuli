<script lang="ts">
import type { HTMLLabelAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { labelClass } from './variants.ts';
import './field.css';

type Props = HTMLLabelAttributes & {
  /** Visual required marker (set `required` on the control for semantics). */
  required?: boolean;
  size?: 'sm' | 'md';
  /** Visually hide while keeping the label for assistive tech. */
  srOnly?: boolean;
  class?: ClassValue;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  required = false,
  size = 'md',
  srOnly = false,
  class: className,
  children,
  ...rest
}: Props = $props();

const classes = $derived(cx(labelClass({ size }), srOnly && 'tx-label--sr', className));
</script>

<label bind:this={ref} class={classes} data-tx-label="" data-required={required ? '' : undefined} {...rest}>
  {@render children?.()}
  {#if required}<span class="tx-label__required" aria-hidden="true">*</span>{/if}
</label>
