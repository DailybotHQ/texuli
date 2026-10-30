<script lang="ts">
import type { Snippet } from 'svelte';

let { label, children }: { label?: string; children?: Snippet } = $props();
</script>

<!-- A static transcript: no live region and no composer (that is host chrome). -->
<section class="tx-chat-display" data-tx-chat-display aria-label={label?.trim() || 'Conversation'}>
  {@render children?.()}
</section>

<style>
  @layer tx.components {
    .tx-chat-display { display: flex; flex-direction: column; gap: var(--tx-space-3); min-inline-size: 0; margin-block: var(--tx-space-4); padding: var(--tx-space-4); border: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder); border-radius: var(--tx-shape-radius-xl); background: var(--tx-surface, Canvas); color: var(--tx-foreground, CanvasText); }
  }
</style>
