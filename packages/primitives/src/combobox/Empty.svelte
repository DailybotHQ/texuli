<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
};

let { children, ...rest }: Props = $props();
const context = getComboboxContext();
const visible = $derived(context.open && context.status === 'empty');
</script>

{#if visible}
  <div
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
