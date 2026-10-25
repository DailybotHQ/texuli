<script lang="ts">
import type { Snippet } from 'svelte';

let { children, onclick }: { children?: Snippet; onclick?: () => void } = $props();
let pressed = $state(false);
</script>

<button type="button" class="fixture-button" aria-pressed={pressed} onclick={() => {
  pressed = !pressed;
  onclick?.();
}}>{@render children?.()}</button>

<style>
  .fixture-button {
    padding-inline: 0.75rem;
    border-radius: 0.375rem;
  }
</style>
