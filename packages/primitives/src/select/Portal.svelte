<script lang="ts">
/** Portal is a no-op shell: Content uses the overlay engine's top-layer / portal. */
let { children }: { children?: import('svelte').Snippet } = $props();
</script>

{@render children?.()}
