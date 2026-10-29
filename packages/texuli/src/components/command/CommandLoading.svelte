<script lang="ts">
import { Loading as PrimitiveLoading } from '@texuli/primitives/command';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import { commandLoadingClass } from './variants.ts';
import './command.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ref = $bindable(null), ...rest }: Props & RefProp = $props();

const classes = $derived(
  commandLoadingClass({
    class: className,
  })
);
</script>

<PrimitiveLoading bind:ref class={classes} data-tx-command-loading {...rest}>
  {#if children}
    {@render children()}
  {:else}
    Searching…
  {/if}
</PrimitiveLoading>
