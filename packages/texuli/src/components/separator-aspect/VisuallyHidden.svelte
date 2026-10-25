<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { visuallyHiddenClass } from './variants.ts';
import './separator-aspect.css';

type Props = HTMLAttributes<HTMLElement> & {
  /** Rendered element. Default `span`. */
  as?: 'span' | 'div' | 'p' | 'label';
  children?: Snippet;
  class?: ClassValue;
};

let { as = 'span', children, class: className, ...rest }: Props = $props();

const classes = $derived(
  visuallyHiddenClass({
    class: className,
  })
);
</script>

{#if as === 'div'}
  <div class={classes} data-tx-visually-hidden {...rest}>{@render children?.()}</div>
{:else if as === 'p'}
  <p class={classes} data-tx-visually-hidden {...rest}>{@render children?.()}</p>
{:else if as === 'label'}
  <label class={classes} data-tx-visually-hidden {...rest}>{@render children?.()}</label>
{:else}
  <span class={classes} data-tx-visually-hidden {...rest}>{@render children?.()}</span>
{/if}
