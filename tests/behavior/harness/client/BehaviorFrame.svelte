<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * The page every scenario renders in: a focusable
 * control before and after the primitive (focus order, inert), an outside area
 * (outside pointer), and enough content to scroll (scroll lock).
 */
let { children }: { children: Snippet } = $props();
</script>

<div class="behavior-frame">
  <button type="button" data-behavior="before">Before</button>
  <div data-behavior="scenario">
    {@render children()}
  </div>
  <button type="button" data-behavior="after">After</button>
  <div class="behavior-outside" data-behavior="outside">Outside area</div>
  <div class="behavior-filler" aria-hidden="true"></div>
</div>

<style>
  .behavior-frame {
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }
  .behavior-outside {
    block-size: 6rem;
    border: 1px dashed currentColor;
  }
  .behavior-filler {
    block-size: 200vh;
  }
</style>
