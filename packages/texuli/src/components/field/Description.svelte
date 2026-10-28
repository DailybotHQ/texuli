<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { descriptionClass } from './variants.ts';
import './field.css';

type Props = HTMLAttributes<HTMLParagraphElement> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  class?: ClassValue;
};

let { class: className, children, ref = $bindable(null), ...rest }: Props = $props();

const classes = $derived(cx(descriptionClass(), className));
</script>

<p bind:this={ref} class={classes} data-tx-description="" {...rest}>{@render children?.()}</p>
