<script lang="ts">
import type { Snippet } from 'svelte';

/** Thin host used only as the `mount()` target for portaled snippets. */
let { children }: { children?: Snippet } = $props();
</script>

{@render children?.()}
