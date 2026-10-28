<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { sheetFooterClass } from './variants.ts';
import './sheet.css';

/** The actions row of a sheet (it stays visible while the body scrolls). */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  children?: Snippet;
  class?: ClassValue;
};
let { children, class: className, ...rest }: Props = $props();
</script>

<div {...rest} class={sheetFooterClass({ class: className })} data-tx-sheet-footer="">
  {@render children?.()}
</div>
