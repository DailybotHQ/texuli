<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value: string;
  label?: string;
  children?: Snippet;
};
let { value, label, children, ...rest }: Props = $props();
const context = getComboboxContext();
const text = $derived(label ?? context.items.find((item) => item.value === value)?.label ?? value);
</script>

{#if context.selected.includes(value)}
  <div {...rest} role="listitem" data-state="selected">
    {#if children}
      {@render children()}
    {:else}
      {text}
    {/if}
  </div>
{/if}
