<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from 'texuli/cx';
import Composer from '../composer/Composer.svelte';
import type { ComposerLabels } from '../composer/labels.ts';
import TypingIndicator from '../composer/TypingIndicator.svelte';
import type { MessageListLabels } from './labels.ts';
import MessageList from './MessageList.svelte';
import type { ChatMessage, ChatMessageActions, ChatReadingAnchor } from './types.ts';

interface OwnProps {
  messages: ChatMessage[];
  currentUserId?: string;
  typing?: string[];
  draft?: string;
  onSend?: (body: string) => unknown;
  sending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Labels for the built-in composer; `placeholder` wins for its own key. */
  composerLabels?: Partial<ComposerLabels>;
  /**
   * Host-owned composer chrome. It replaces the built-in composer and renders
   * outside the message log; message content can never supply it.
   */
  composer?: Snippet;
  body?: Snippet<[ChatMessage]>;
  header?: Snippet;
  emptyText?: string;
  locale?: string;
  labels?: Partial<MessageListLabels>;
  /** Accessible name for the message log; forwarded to the list. */
  label?: string;
  /** Virtualization threshold forwarded to the list; `Infinity` renders every row. */
  virtualizeAfter?: number;
  /** Rows rendered beyond the view, forwarded to the list. */
  overscan?: number;
  /** Per-message controls, forwarded to the list. */
  actions?: Snippet<[ChatMessage, ChatMessageActions]>;
  /** Inline edit save, forwarded to the list. */
  onEdit?: (message: ChatMessage, body: string) => unknown;
  /** An inline edit saved unchanged, forwarded to the list. */
  onEditUnchanged?: (message: ChatMessage) => void;
  /** The list's reading position (`bind:anchor`), forwarded to the list. */
  anchor?: ChatReadingAnchor | null;
  /** Reading position changes, forwarded to the list. */
  onAnchorChange?: (anchor: ChatReadingAnchor) => void;
  /** A reply is streaming: the built-in composer shows Stop (with `onStop`). */
  streaming?: boolean;
  onStop?: () => void;
  class?: ClassValue;
  /** The thread's root `section` (bindable). */
  ref?: HTMLElement | null;
}
/** Other attributes (`id`, `aria-*`, `data-*`, `style`, handlers) land on the root `section`. */
type Props = OwnProps & Omit<HTMLAttributes<HTMLElement>, keyof OwnProps | 'children'>;

let {
  messages,
  currentUserId,
  typing = [],
  draft = $bindable(''),
  onSend,
  sending = false,
  disabled = false,
  placeholder,
  composerLabels,
  composer,
  body,
  header,
  emptyText,
  locale,
  labels,
  label,
  virtualizeAfter,
  overscan,
  actions,
  onEdit,
  onEditUnchanged,
  anchor = $bindable(null),
  onAnchorChange,
  streaming = false,
  onStop,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
</script>

<section {...rest} bind:this={ref} class={cx('tx-chat-thread', className)} data-tx-chat-thread>
  {@render header?.()}
  <MessageList
    {messages}
    {currentUserId}
    {body}
    {emptyText}
    {locale}
    {labels}
    {label}
    {virtualizeAfter}
    {overscan}
    {actions}
    {onEdit}
    {onEditUnchanged}
    bind:anchor
    {onAnchorChange}
  >
    {#snippet footer()}
      <TypingIndicator names={typing} class="tx-chat-thread__typing" />
    {/snippet}
  </MessageList>
  {#if composer}
    <div class="tx-chat-thread__composer" data-tx-chat-composer="host">
      {@render composer()}
    </div>
  {:else if onSend}
    <div class="tx-chat-thread__composer" data-tx-chat-composer="built-in">
      <Composer
        bind:value={draft}
        onSubmit={onSend}
        {sending}
        {disabled}
        {streaming}
        {onStop}
        labels={placeholder ? { ...composerLabels, placeholder } : composerLabels}
      />
    </div>
  {/if}
</section>

<style>
  @layer tx.components {
    .tx-chat-thread { display: flex; min-block-size: 0; flex: 1; flex-direction: column; background: var(--tx-surface, Canvas); color: var(--tx-foreground, CanvasText); }
    .tx-chat-thread__composer { border-block-start: 1px solid var(--tx-border, ButtonBorder); padding: 0.75rem; padding-block-end: max(0.75rem, env(safe-area-inset-bottom)); }
    .tx-chat-thread__typing { margin-block-start: 0.75rem; }
  }
</style>
