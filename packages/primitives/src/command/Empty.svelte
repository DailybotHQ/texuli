<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { commandContext } from './context.ts';

type Props = RefProp & Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet };
let { children, ref = $bindable(null), ...rest }: Props = $props();
const context = commandContext.get();
</script>

{#if context.visibleItems.length === 0 && !context.loading}
  <div bind:this={ref} {...rest} data-command-empty="">{@render children?.()}</div>
{/if}
