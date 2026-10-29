<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { commandContext } from './context.ts';

type Props = RefProp & Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet };
let { children, ref = $bindable(null), ...rest }: Props = $props();
const context = commandContext.get();
</script>

{#if context.loading}
  <div bind:this={ref} {...rest} role="status" aria-live="polite" data-command-loading="">
    {@render children?.()}
  </div>
{/if}
