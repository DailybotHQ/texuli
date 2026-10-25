<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
};

let { children, ...rest }: Props = $props();
const context = getComboboxContext();
const visible = $derived(context.open && context.status === 'loading');
</script>

{#if visible}
  <div
    {...rest}
    role="status"
    aria-busy="true"
    data-tx-combobox-loading=""
    data-status="loading"
  >
    {#if children}
      {@render children()}
    {:else}
      Loading options
    {/if}
  </div>
{/if}
