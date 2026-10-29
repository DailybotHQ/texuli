<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { sheetBodyClass } from './variants.ts';
import './sheet.css';

/** The scrolling region of a sheet, between the header and the footer. */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  children?: Snippet;
  class?: ClassValue;
};
let { children, class: className, ...rest }: Props = $props();
</script>

<div {...rest} class={sheetBodyClass({ class: className })} data-tx-sheet-body="">
  {@render children?.()}
</div>
