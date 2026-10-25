<script lang="ts">
import type { Snippet } from 'svelte';

let {
  author,
  role,
  text,
  label,
  children,
}: { author?: string; role?: string; text?: string; label?: string; children?: Snippet } = $props();
</script>

<div data-chat-stub data-role={role} aria-label={label}>
  {#if author}<strong>{author}</strong>{/if}
  {#if text}<p>{text}</p>{/if}
  {@render children?.()}
</div>
