<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { commandContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet };
let { children, ...rest }: Props = $props();
const context = commandContext.get();
</script>

{#if context.visibleItems.length === 0 && !context.loading}
  <div {...rest} data-command-empty="">{@render children?.()}</div>
{/if}
