<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { getComboboxContext } from './context.ts';

let {
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet } = $props();
const context = getComboboxContext();
</script>

{#if context.multiple}
  <div {...rest} role="list" aria-label={rest['aria-label'] ?? 'Selected options'}>{@render children?.()}</div>
{/if}
