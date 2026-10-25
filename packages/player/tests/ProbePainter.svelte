<script lang="ts">
import type { Snippet } from 'svelte';
import { probeLog } from './probe-log.ts';

let { children, ...rest }: { children?: Snippet; [key: string]: unknown } = $props();
// Record exactly what the player handed to a component, before it paints,
// on mount and on every later prop update.
$effect.pre(() => {
  const props = { ...rest };
  probeLog.push({ id: String(props.variant ?? 'component'), props });
});
</script>

<div data-probe>
  {#each Object.entries(rest) as [key, value] (key)}
    <span data-key={key}>{typeof value === 'string' ? value : JSON.stringify(value)}</span>
  {/each}
  {@render children?.()}
</div>
