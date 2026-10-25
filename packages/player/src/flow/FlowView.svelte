<script lang="ts">
import type { Snippet } from 'svelte';
import { getPlayerFlowAccess } from '../context.ts';

let { name, label, children }: { name: string; label?: string; children?: Snippet } = $props();
const access = getPlayerFlowAccess();
let active = $derived(access?.view() === name);
</script>

<!-- Only the current view paints; the others are not in the DOM at all. -->
{#if active}
  <section
    class="tx-player-flow-view"
    data-tx-player-flow-view={name}
    aria-label={label?.trim() || name}
    tabindex="-1"
  >
    {#if children}{@render children()}{/if}
  </section>
{/if}
