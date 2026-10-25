<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * API parity with other menu libraries. Menu content already shows in the
 * browser's top layer (or above the page), so it needs no portal; this
 * renders its children in place.
 */
let { children }: { children?: Snippet } = $props();
</script>

{@render children?.()}
