<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { commandContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet };
let { children, ...rest }: Props = $props();
const context = commandContext.get();
</script>

{#if context.loading}
  <div {...rest} role="status" aria-live="polite" data-command-loading="">
    {@render children?.()}
  </div>
{/if}
