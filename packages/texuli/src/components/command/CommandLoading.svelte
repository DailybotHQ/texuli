<script lang="ts">
import { Loading as PrimitiveLoading } from '@texuli/primitives/command';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { commandLoadingClass } from './variants.ts';
import './command.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();

const classes = $derived(
  commandLoadingClass({
    class: className,
  })
);
</script>

<PrimitiveLoading class={classes} data-tx-command-loading {...rest}>
  {#if children}
    {@render children()}
  {:else}
    Searching…
  {/if}
</PrimitiveLoading>
