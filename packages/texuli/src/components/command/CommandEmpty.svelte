<script lang="ts">
import { Empty as PrimitiveEmpty } from '@texuli/primitives/command';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { commandEmptyClass } from './variants.ts';
import './command.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();

const classes = $derived(
  commandEmptyClass({
    class: className,
  })
);
</script>

<PrimitiveEmpty class={classes} data-tx-command-empty {...rest}>
  {#if children}
    {@render children()}
  {:else}
    No results found.
  {/if}
</PrimitiveEmpty>
