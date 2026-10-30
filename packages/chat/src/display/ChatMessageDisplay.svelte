<script lang="ts">
import type { Snippet } from 'svelte';
import { Avatar } from 'texuli/avatar';
import MessageText from '../thread/MessageText.svelte';
import { CHAT_DISPLAY_ROLE_LABELS, type ChatDisplayRole } from './roles.ts';

let {
  author,
  role,
  at,
  text,
  children,
}: {
  author: string;
  role: ChatDisplayRole;
  at?: string;
  text?: string;
  children?: Snippet;
} = $props();

const headerId = $props.id();
let date = $derived.by(() => {
  if (typeof at !== 'string') return null;
  const value = new Date(at);
  return Number.isNaN(value.getTime()) ? null : value;
});
let time = $derived.by(() => {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      date
    );
  } catch {
    return date.toISOString();
  }
});
let roleLabel = $derived(CHAT_DISPLAY_ROLE_LABELS[role] ?? '');
</script>

<article
  class="tx-chat-display-message"
  data-role={role}
  data-tx-chat-display-message
  aria-labelledby={headerId}
>
  {#if role !== 'system'}
    <Avatar name={author} size="sm" decorative class="tx-chat-display-message__avatar" />
  {/if}
  <div class="tx-chat-display-message__content">
    <header class="tx-chat-display-message__meta" id={headerId}>
      <span class="tx-chat-display-message__author">{author}</span>
      {#if roleLabel}<span class="tx-chat-display-message__role">{roleLabel}</span>{/if}
      {#if date}<time datetime={date.toISOString()}>{time}</time>{/if}
    </header>
    {#if text}
      <p class="tx-chat-display-message__text"><MessageText {text} /></p>
    {/if}
    {#if children}
      <div class="tx-chat-display-message__body">{@render children()}</div>
    {/if}
  </div>
</article>

<style>
  @layer tx.components {
    .tx-chat-display-message { display: flex; align-items: flex-start; gap: calc(var(--tx-space-unit) * 2.5); min-inline-size: 0; }
    .tx-chat-display-message[data-role="user"] { flex-direction: row-reverse; }
    .tx-chat-display-message__content { display: flex; min-inline-size: 0; max-inline-size: min(100%, 42rem); flex-direction: column; gap: var(--tx-space-1); }
    .tx-chat-display-message[data-role="user"] .tx-chat-display-message__content { align-items: flex-end; }
    .tx-chat-display-message[data-role="system"] .tx-chat-display-message__content { margin-inline: auto; align-items: center; color: var(--tx-muted-foreground, GrayText); }
    .tx-chat-display-message__meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--tx-space-2); color: var(--tx-muted-foreground, GrayText); font-size: var(--tx-type-caption-size); }
    .tx-chat-display-message__author { color: var(--tx-foreground, CanvasText); font-weight: 600; }
    .tx-chat-display-message__role { border: var(--tx-border-width-thin) solid currentColor; border-radius: var(--tx-shape-radius-full); padding: 0 0.4em; }
    .tx-chat-display-message__text { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; border-radius: var(--tx-chat-bubble-radius, calc(var(--tx-shape-radius-lg) * 2)); border-end-start-radius: var(--tx-chat-bubble-tail-radius, var(--tx-shape-radius-sm)); background: var(--tx-muted, ButtonFace); padding: var(--tx-chat-bubble-padding-block, var(--tx-space-2)) var(--tx-chat-bubble-padding-inline, calc(var(--tx-space-unit) * 3.5)); }
    .tx-chat-display-message[data-role="user"] .tx-chat-display-message__text { border-radius: var(--tx-chat-bubble-radius, calc(var(--tx-shape-radius-lg) * 2)); border-end-end-radius: var(--tx-chat-bubble-tail-radius, var(--tx-shape-radius-sm)); background: var(--tx-primary, Highlight); color: var(--tx-primary-foreground, HighlightText); }
    .tx-chat-display-message[data-role="system"] .tx-chat-display-message__text { background: transparent; font-style: italic; }
    .tx-chat-display-message__body { min-inline-size: 0; }
    @media (forced-colors: active) { .tx-chat-display-message__text { border: var(--tx-border-width-thin) solid CanvasText; } }
  }
</style>
