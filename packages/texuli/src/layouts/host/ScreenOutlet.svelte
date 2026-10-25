<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Stable screen node that layouts reparent via `mountScreen`. Keeping one DOM
 * node preserves local component state across layout switches.
 */
let {
  children,
  onready,
}: {
  children: Snippet;
  onready: (node: HTMLDivElement) => void;
} = $props();

let outlet = $state<HTMLDivElement | undefined>();

$effect(() => {
  if (outlet) onready(outlet);
});
</script>

<div bind:this={outlet} data-tx-layout-screen="">{@render children()}</div>
