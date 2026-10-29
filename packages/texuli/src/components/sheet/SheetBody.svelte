<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import { sheetBodyClass } from './variants.ts';
import './sheet.css';

/** The scrolling region of a sheet, between the header and the footer. */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  children?: Snippet;
  class?: ClassValue;
};
let { children, class: className, ref = $bindable(null), ...rest }: Props & RefProp = $props();
</script>

<div bind:this={ref} {...rest} class={sheetBodyClass({ class: className })} data-tx-sheet-body="">
  {@render children?.()}
</div>
