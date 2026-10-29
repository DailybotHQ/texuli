<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { visuallyHiddenClass } from './variants.ts';
import './separator-aspect.css';

type Props = HTMLAttributes<HTMLElement> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** Rendered element. Default `span`. */
  as?: 'span' | 'div' | 'p' | 'label';
  children?: Snippet;
  class?: ClassValue;
};

let { as = 'span', children, class: className, ref = $bindable(null), ...rest }: Props = $props();

const classes = $derived(
  visuallyHiddenClass({
    class: className,
  })
);
</script>

{#if as === 'div'}
  <div bind:this={ref} class={classes} data-tx-visually-hidden {...rest}>{@render children?.()}</div>
{:else if as === 'p'}
  <p bind:this={ref} class={classes} data-tx-visually-hidden {...rest}>{@render children?.()}</p>
{:else if as === 'label'}
  <label bind:this={ref} class={classes} data-tx-visually-hidden {...rest}>{@render children?.()}</label>
{:else}
  <span bind:this={ref} class={classes} data-tx-visually-hidden {...rest}>{@render children?.()}</span>
{/if}
