<script lang="ts">
/** One line under each demo: the settings it plays at, and a link back to change them. */
import { settingsLabel } from './settings.svelte.ts';

let { outcome, name }: { outcome?: string; name?: string } = $props();
</script>

<p class="note" data-motion-note={name}>
  <span>{settingsLabel()}</span>
  {#if outcome !== undefined}
    <span class="note__outcome" data-motion-outcome={name}>{outcome}</span>
  {/if}
  <a href="#settings">Change the settings</a>
</p>

<style>
  .note {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.9rem;
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .note__outcome {
    padding: 0.1rem 0.5rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 999px;
    color: var(--tx-foreground, CanvasText);
    font-variant-numeric: tabular-nums;
  }
  .note a {
    color: var(--tx-link, LinkText);
  }
</style>
