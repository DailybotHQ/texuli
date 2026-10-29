<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getComboboxContext } from './context.ts';

let {
  children,
  ref = $bindable(null),
  ...rest
}: RefProp & Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet } = $props();
const context = getComboboxContext();
</script>

{#if context.multiple}
  <div bind:this={ref} {...rest} role="list" aria-label={rest['aria-label'] ?? 'Selected options'}>{@render children?.()}</div>
{/if}
