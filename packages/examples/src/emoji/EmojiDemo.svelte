<script lang="ts">
import { Emoji, EmojiPicker, EmojiText } from 'texuli/emoji';

let selected = $state('');
let recentIds = $state<string[]>([]);
</script>

<div class="emoji-demo" data-tx-emoji-demo>
  <div class="emoji-demo__message">
    <strong>EmojiText</strong>
    <p><EmojiText text="A note for the team: :rocket: see you soon 👋" /></p>
  </div>
  <div class="emoji-demo__selected" aria-live="polite">
    {#if selected}
      <span>Selected:</span>
      <Emoji id={selected} />
    {:else}
      <span>Choose one to preview it.</span>
    {/if}
  </div>
  <EmojiPicker
    id="example-emoji-picker"
    recentIds={recentIds}
    onRecentIdsChange={(ids) => (recentIds = [...ids])}
    onSelect={(emoji) => (selected = emoji.id)}
  />
</div>

<style>
  .emoji-demo {
    display: grid;
    gap: var(--tx-space-4);
    max-inline-size: 34rem;
  }

  .emoji-demo__message,
  .emoji-demo__selected {
    border: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-shape-radius-md);
    padding: var(--tx-space-3);
  }

  .emoji-demo__message p {
    margin-block: var(--tx-space-2) 0;
  }

  .emoji-demo__selected {
    display: flex;
    align-items: center;
    gap: var(--tx-space-2);
  }
</style>
