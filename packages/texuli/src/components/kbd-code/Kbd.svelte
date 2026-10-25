<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { kbdClass } from './variants.ts';
import './kbd-code.css';

type Props = HTMLAttributes<HTMLElement> & {
  /**
   * Plain-text key name, rendered as escaped text. A non-empty `label`
   * replaces `children` when both are given.
   */
  label?: string;
  class?: ClassValue;
  children?: import('svelte').Snippet;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let { ref = $bindable(null), label, class: className, children, ...rest }: Props = $props();

const classes = $derived(kbdClass({ class: className }));
const hasLabel = $derived(typeof label === 'string' && label.length > 0);
</script>

<kbd bind:this={ref} class={classes} data-tx-kbd {...rest}
  >{#if hasLabel}{label}{:else}{@render children?.()}{/if}</kbd
>
