<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
} & RefProp;

let { children, ref = $bindable(null), ...rest }: Props = $props();
const context = getComboboxContext();
const visible = $derived(context.open && context.status === 'empty');
</script>

{#if visible}
  <div bind:this={ref}
    {...rest}
    role="status"
    data-tx-combobox-empty=""
    data-status="empty"
  >
    {#if children}
      {@render children()}
    {:else}
      No results
    {/if}
  </div>
{/if}
