<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import { sheetFooterClass } from './variants.ts';
import './sheet.css';

/** The actions row of a sheet (it stays visible while the body scrolls). */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  children?: Snippet;
  class?: ClassValue;
};
let { children, class: className, ref = $bindable(null), ...rest }: Props & RefProp = $props();
</script>

<div bind:this={ref} {...rest} class={sheetFooterClass({ class: className })} data-tx-sheet-footer="">
  {@render children?.()}
</div>
