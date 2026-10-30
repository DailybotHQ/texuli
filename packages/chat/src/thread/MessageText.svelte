<script lang="ts">
import { parseMessageText } from './rich-text.ts';

let { text, currentUserId, locale }: { text: string; currentUserId?: string; locale?: string } =
  $props();

function formatMoment(iso: string): string {
  const date = new Date(iso);
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      date
    );
  } catch {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      date
    );
  }
}
</script>

<!-- Text nodes only: the inline subset never becomes HTML. -->
{#each parseMessageText(text) as part}
  {#if part.type === 'strong'}<strong>{part.value}</strong>
  {:else if part.type === 'em'}<em>{part.value}</em>
  {:else if part.type === 'code'}<code>{part.value}</code>
  {:else if part.type === 'link'}<a href={part.href}>{part.value}</a>
  {:else if part.type === 'mention'}<span class="tx-chat-mention" data-mention-id={part.id} data-self={part.id === currentUserId || undefined}>@{part.value}</span>
  {:else if part.type === 'date'}<time class="tx-chat-date" datetime={part.iso}>{formatMoment(part.iso)}</time>
  {:else if part.type === 'status'}<span class="tx-chat-status-chip" data-tone={part.tone}>{part.value}</span>
  {:else}{part.value}{/if}
{/each}

<style>
  @layer tx.components {
    .tx-chat-mention { border-radius: var(--tx-shape-radius-sm); background: color-mix(in srgb, currentColor 12%, transparent); padding-inline: 0.2em; font-weight: 600; }
    .tx-chat-mention[data-self] { background: var(--tx-warning, Mark); color: var(--tx-warning-foreground, MarkText); }
    .tx-chat-date { text-decoration: underline dotted; text-underline-offset: 0.2em; }
    .tx-chat-status-chip { display: inline-block; border: var(--tx-border-width-thin) solid currentColor; border-radius: var(--tx-shape-radius-full); padding: 0 0.5em; font-size: 0.8em; font-weight: 600; line-height: 1.5; vertical-align: baseline; }
    .tx-chat-status-chip[data-tone="info"] { color: var(--tx-info, LinkText); }
    .tx-chat-status-chip[data-tone="success"] { color: var(--tx-success, CanvasText); }
    .tx-chat-status-chip[data-tone="warning"] { color: var(--tx-warning, CanvasText); }
    .tx-chat-status-chip[data-tone="danger"] { color: var(--tx-destructive, Mark); }
    :global(.tx-chat-message--own) .tx-chat-status-chip { color: inherit; }
    a { color: inherit; text-decoration: underline; text-underline-offset: 0.15em; }
    code { border-radius: var(--tx-shape-radius-sm); background: var(--tx-surface, Canvas); color: var(--tx-foreground, CanvasText); padding-inline: 0.2em; font-family: var(--tx-font-mono, ui-monospace, monospace); }
  }
</style>
