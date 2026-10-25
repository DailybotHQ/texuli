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
    .tx-chat-display { display: flex; flex-direction: column; gap: 0.75rem; min-inline-size: 0; margin-block: 1rem; padding: 1rem; border: 1px solid var(--tx-border, ButtonBorder); border-radius: var(--tx-radius-lg, 0.75rem); background: var(--tx-surface, Canvas); color: var(--tx-foreground, CanvasText); }
  }
</style>
