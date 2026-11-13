<script lang="ts">
import { EmojiPicker } from 'texuli/emoji';

type SelectedEmoji = { id: string; unicode: string; shortcode: string };

let selection = $state<SelectedEmoji | undefined>();
let recentIds = $state<readonly string[]>([]);

function remember(ids: readonly string[]): void {
  recentIds = [...ids];
}

function select(emoji: SelectedEmoji): void {
  selection = emoji;
}
</script>

<div class="picker-lab-content">
  <EmojiPicker
    id="emojiparser-picker"
    label="Choose an emoji"
    pageSize={64}
    {recentIds}
    onRecentIdsChange={remember}
    onSelect={select}
  />
  <section class="selection" aria-label="Selected emoji" aria-live="polite">
    <h2>Selection</h2>
    {#if selection}
      <p data-selected-emoji>{selection.unicode} <code>{selection.shortcode}</code></p>
      <p>Stable catalog ID: <code>{selection.id}</code></p>
    {:else}
      <p data-selected-emoji>Choose an emoji to see its Unicode, shortcode and stable ID.</p>
    {/if}
    <p>Recent choices: {recentIds.length}</p>
  </section>
</div>

<style>
  .picker-lab-content {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: minmax(0, 1fr) minmax(13rem, 0.65fr);
    align-items: start;
  }

  .selection {
    min-inline-size: 0;
    border: 1px solid var(--tx-border, color-mix(in srgb, CanvasText 24%, Canvas));
    border-radius: 0.75rem;
    padding: 1rem;
    overflow-wrap: anywhere;
  }

  .selection h2,
  .selection p {
    margin-block: 0 0.75rem;
  }

  .selection p:last-child {
    margin-block-end: 0;
  }

  @media (max-width: 48rem) {
    .picker-lab-content {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
