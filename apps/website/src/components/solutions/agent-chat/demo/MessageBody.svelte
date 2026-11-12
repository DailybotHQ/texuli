<script lang="ts">
import { parseMessageText } from '@texuli/chat';
import type { Component } from 'svelte';

/** The message text, read by the chat codec (safe nodes only, no HTML). */
let { text }: { text: string } = $props();

// EmojiText (texuli/emoji) loads the first time a message holds an emoji; until then, and
// without emoji art, the text reads the same.
let EmojiText = $state<Component<{ text: string }> | null>(null);
$effect(() => {
  if (EmojiText || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(text)) return;
  void import('texuli/emoji').then((module) => {
    EmojiText = module.EmojiText as unknown as Component<{ text: string }>;
  });
});
</script>

{#each parseMessageText(text) as part}
  {#if part.type === 'strong'}<strong>{part.value}</strong>
  {:else if part.type === 'em'}<em>{part.value}</em>
  {:else if part.type === 'code'}<code>{part.value}</code>
  {:else if part.type === 'link'}<a href={part.href}>{part.value}</a>
  {:else if part.type === 'mention'}<span class="mention" data-mention-id={part.id}>@{part.value}</span>
  {:else if part.type === 'date'}<time datetime={part.iso}>{new Date(part.iso).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC</time>
  {:else if part.type === 'status'}<span class="chip" data-tone={part.tone}>{part.value}</span>
  {:else if EmojiText}<EmojiText text={part.value} />{:else}{part.value}{/if}
{/each}

<style>
  a { color: inherit; text-decoration: underline; text-underline-offset: 0.15em; }
  code { border-radius: var(--tx-shape-radius-sm); background: var(--tx-surface, Canvas); color: var(--tx-foreground, CanvasText); padding-inline: 0.2em; font-family: var(--tx-font-mono, ui-monospace, monospace); }
  .mention { border-radius: var(--tx-shape-radius-sm); background: color-mix(in srgb, currentColor 12%, transparent); padding-inline: 0.2em; font-weight: 600; }
  time { text-decoration: underline dotted; text-underline-offset: 0.2em; }
  .chip { display: inline-block; border: var(--tx-border-width-thin) solid currentColor; border-radius: var(--tx-shape-radius-full); padding-inline: 0.5em; font-size: var(--tx-type-label-size); font-weight: 600; }
</style>
