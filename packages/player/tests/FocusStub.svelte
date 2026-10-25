<script lang="ts">
import type { Snippet } from 'svelte';

let {
  label,
  tabindex,
  dialog = false,
  children,
}: { label?: string; tabindex?: number; dialog?: boolean; children?: Snippet } = $props();
</script>

{#if dialog}
  <div role="dialog" aria-modal="true" aria-label={label}>
    <button type="button">{label}</button>
  </div>
{:else}
  <button type="button" {tabindex}>{label}</button>
{/if}
{@render children?.()}
