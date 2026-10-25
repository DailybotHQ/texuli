<script lang="ts">
import type { Snippet } from 'svelte';

let { hero, footer, children }: { hero?: Snippet; footer?: Snippet; children?: Snippet } = $props();
</script>

<div data-slot-stub>
  <section data-region="hero">{@render hero?.()}</section>
  <section data-region="body">{@render children?.()}</section>
  <section data-region="footer">{@render footer?.()}</section>
</div>
