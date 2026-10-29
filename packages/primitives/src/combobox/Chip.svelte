<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value: string;
  label?: string;
  children?: Snippet;
} & RefProp;
let { value, label, children, ref = $bindable(null), ...rest }: Props = $props();
const context = getComboboxContext();
const text = $derived(label ?? context.items.find((item) => item.value === value)?.label ?? value);
</script>

{#if context.selected.includes(value)}
  <div bind:this={ref} {...rest} role="listitem" data-state="selected">
    {#if children}
      {@render children()}
    {:else}
      {text}
    {/if}
  </div>
{/if}
