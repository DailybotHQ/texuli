<script lang="ts">
import { getSelectContext } from './context.ts';

let {
  placeholder = '',
  children,
}: {
  placeholder?: string;
  children?: import('svelte').Snippet<[{ value: string; label: string | undefined }]>;
} = $props();

const context = getSelectContext();
const label = $derived(context.getItemLabel(context.value));
</script>

{#if children}
  {@render children({ value: context.value, label })}
{:else}
  {label || placeholder}
{/if}
