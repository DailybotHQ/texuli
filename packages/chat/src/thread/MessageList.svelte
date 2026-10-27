<script lang="ts">
import type { Snippet } from 'svelte';
import { tick } from 'svelte';
import { Avatar } from 'texuli/avatar';
import { type ClassValue, cx } from 'texuli/cx';
import { groupMessages } from './group-messages.ts';
import { DEFAULT_MESSAGE_LIST_LABELS, type MessageListLabels } from './labels.ts';
import MessageText from './MessageText.svelte';
import type { ChatMessage, ChatMessageStatus } from './types.ts';
import { MessageVirtualWindow, type VirtualWindow } from './virtual-window.ts';

interface Props {
  messages: ChatMessage[];
  currentUserId?: string;
  /** Optional renderer for attachments or application-owned rich content. */
  body?: Snippet<[ChatMessage]>;
  footer?: Snippet;
  emptyText?: string;
  locale?: string;
  label?: string;
  labels?: Partial<MessageListLabels>;
  /** Virtualization starts at this number of author groups. Set to Infinity to disable. */
  virtualizeAfter?: number;
  overscan?: number;
  class?: ClassValue;
}

let {
  messages,
  currentUserId,
  body,
  footer,
  emptyText = 'No messages yet. Say hello!',
  locale,
  label = 'Messages',
  labels: labelOverrides = {},
  virtualizeAfter = 100,
  overscan = 5,
  class: className,
}: Props = $props();

let viewport = $state<HTMLDivElement | null>(null);
let scrollTop = $state(0);
let viewportSize = $state(360);
let revision = $state(0);
let list = new MessageVirtualWindow(0);
let stickToBottom = true;
let previousCount = 0;
let previousFirstId: string | undefined;
let previousLastId: string | undefined;
let firstIdBeforeUpdate: string | undefined;
let scrollHeightBeforeUpdate = 0;
let scrollTopBeforeUpdate = 0;
let anchorBeforeUpdate: ScrollAnchor | null = null;
/** The virtual window as last rendered: row starts here match the DOM. */
let rendered: VirtualWindow | null = null;
let remeasureFrame = 0;

/** A rendered row and where it sat, used to keep it still while offsets change. */
interface ScrollAnchor {
  key: string;
  start: number;
  scrollTop: number;
}

const groups = $derived(groupMessages(messages));
const labels = $derived({ ...DEFAULT_MESSAGE_LIST_LABELS, ...labelOverrides });
const renderGroups = $derived.by(() =>
  groups.flatMap((group) => {
    const rows: Array<typeof group & { key: string; showHeader: boolean }> = [];
    for (let offset = 0; offset < group.messages.length; offset += 20) {
      rows.push({
        ...group,
        key: `${group.key}-${offset}`,
        messages: group.messages.slice(offset, offset + 20),
        dayStart: offset === 0 ? group.dayStart : null,
        showHeader: offset === 0,
      });
    }
    return rows;
  })
);
const rowKeys = $derived(renderGroups.map((row) => row.key));
const useVirtual = $derived(messages.length >= Math.max(1, virtualizeAfter));
const rows = $derived.by((): VirtualWindow => {
  revision;
  list.resize(renderGroups.length, rowKeys);
  if (useVirtual) {
    rendered = list.window(scrollTop, viewportSize, overscan);
    return rendered;
  }
  rendered = null;
  return {
    totalSize: 0,
    items: renderGroups.map((row, index) => ({
      index,
      key: row.key,
      start: 0,
      size: 0,
      measured: false,
    })),
  };
});

const statusText = $derived({
  sending: labels.sending,
  sent: labels.sent,
  delivered: labels.delivered,
  read: labels.read,
  failed: labels.failed,
});

function dateFor(value: ChatMessage['at']): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value: ChatMessage['at']): string {
  const date = dateFor(value);
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  }
}

function formatDay(value: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value);
  } catch {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value);
  }
}

function nearBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
}

function onScroll(event: Event): void {
  const element = event.currentTarget as HTMLDivElement;
  scrollTop = element.scrollTop;
  viewportSize = element.clientHeight || viewportSize;
  stickToBottom = nearBottom(element);
}

// The topmost rendered row in view, with the start it was rendered at. The
// model can be ahead of the DOM (a row measured, its re-render still waiting
// for a frame), so anchors come from the rendered window, never the model.
function captureAnchor(element: HTMLElement): ScrollAnchor | null {
  if (!rendered || rendered.items.length === 0) return null;
  const top = element.scrollTop;
  const canvasTop = (element.firstElementChild as HTMLElement | null)?.offsetTop ?? 0;
  const row =
    rendered.items.find((item) => canvasTop + item.start + item.size > top) ??
    rendered.items[rendered.items.length - 1];
  return row ? { key: row.key, start: row.start, scrollTop: top } : null;
}

// Moves the scroll position by however far the anchor row moved, so the
// reader keeps seeing the same message. False when the row no longer exists.
function restoreAnchor(element: HTMLElement, anchor: ScrollAnchor): boolean {
  const index = list.indexOfKey(anchor.key);
  if (index < 0) return false;
  element.scrollTop = anchor.scrollTop + (list.offsetOf(index) - anchor.start);
  scrollTop = element.scrollTop;
  return true;
}

// Rows measured late re-render once per frame. Rows above the anchor change
// the offsets below them, so the anchor is held in place across the re-render.
function scheduleRemeasure(): void {
  if (remeasureFrame) return;
  remeasureFrame = requestAnimationFrame(() => {
    remeasureFrame = 0;
    const element = viewport;
    const anchor = element && useVirtual && !stickToBottom ? captureAnchor(element) : null;
    revision += 1;
    if (element && anchor) void tick().then(() => restoreAnchor(element, anchor));
  });
}

$effect(() => () => {
  if (remeasureFrame) cancelAnimationFrame(remeasureFrame);
  remeasureFrame = 0;
});

function measureRow(node: HTMLElement, key: string) {
  let rowKey = key;
  const observer =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(([entry]) => {
          const height = entry?.borderBoxSize?.[0]?.blockSize ?? entry?.contentRect.height;
          if (height && list.measureKey(rowKey, height)) scheduleRemeasure();
        });
  observer?.observe(node);
  return {
    update(nextKey: string) {
      rowKey = nextKey;
    },
    destroy() {
      observer?.disconnect();
    },
  };
}

// Content that grows after a stick (rows measured late, fonts, a typing
// footer) keeps the list at the bottom while the reader is there.
$effect(() => {
  const element = viewport;
  if (!element || typeof ResizeObserver === 'undefined') return;
  const resize = new ResizeObserver(() => {
    if (stickToBottom) element.scrollTop = element.scrollHeight;
  });
  const observeChildren = () => {
    resize.disconnect();
    for (const child of element.children) resize.observe(child);
  };
  observeChildren();
  const children = new MutationObserver(observeChildren);
  children.observe(element, { childList: true });
  return () => {
    children.disconnect();
    resize.disconnect();
  };
});

$effect.pre(() => {
  void messages.length;
  firstIdBeforeUpdate = messages[0]?.id;
  if (viewport) {
    stickToBottom = nearBottom(viewport);
    scrollHeightBeforeUpdate = viewport.scrollHeight;
    scrollTopBeforeUpdate = viewport.scrollTop;
    anchorBeforeUpdate = captureAnchor(viewport);
  }
});

$effect(() => {
  const count = messages.length;
  const firstId = messages[0]?.id;
  const last = messages[count - 1];
  const prepended =
    previousCount > 0 && count > previousCount && firstIdBeforeUpdate !== previousFirstId;
  const ownNewMessage =
    count > previousCount &&
    last !== undefined &&
    last.id !== previousLastId &&
    last.author.id === currentUserId;
  const shouldStick = count > previousCount && (stickToBottom || ownNewMessage);
  previousCount = count;
  previousFirstId = firstId;
  previousLastId = last?.id;
  if (!viewport) return;
  const element = viewport;
  if (shouldStick) {
    void tick().then(() => {
      element.scrollTop = element.scrollHeight;
      scrollTop = element.scrollTop;
    });
  } else if (prepended) {
    // Virtual rows: keep the anchor row still, using model offsets that the
    // DOM has just rendered. Comparing scrollHeight before and after would mix
    // a stale DOM height with measurements that landed in between.
    const anchor = useVirtual ? anchorBeforeUpdate : null;
    void tick().then(() => {
      if (anchor && restoreAnchor(element, anchor)) return;
      element.scrollTop = scrollTopBeforeUpdate + (element.scrollHeight - scrollHeightBeforeUpdate);
      scrollTop = element.scrollTop;
    });
  }
});
</script>

{#snippet content(message: ChatMessage)}
  {#if body}
    {@render body(message)}
  {:else}
    <MessageText text={message.body} {currentUserId} {locale} />
  {/if}
{/snippet}

<!-- The focusable log provides keyboard scrolling and polite announcements for appended messages. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={viewport}
  class={cx('tx-chat-message-list', className)}
  data-tx-chat-message-list
  data-virtualized={useVirtual || undefined}
  role="log"
  aria-label={label}
  aria-live="polite"
  aria-relevant="additions text"
  tabindex="0"
  onscroll={onScroll}
>
  {#if messages.length === 0}
    <p class="tx-chat-message-list__empty">{emptyText}</p>
  {:else}
    <div class={cx('tx-chat-message-list__canvas', useVirtual && 'tx-chat-message-list__canvas--virtual')} style:block-size={useVirtual ? `${rows.totalSize}px` : undefined}>
      {#each rows.items as row (row.key)}
        {@const group = renderGroups[row.index]}
        {@const first = group?.messages[0]}
        {@const own = group !== undefined && currentUserId !== undefined && group.author.id === currentUserId}
        {#if group && first}
          <div
            class={cx(
              'tx-chat-message-group',
              useVirtual && 'tx-chat-message-group--virtual',
              own && 'tx-chat-message-group--own'
            )}
            data-message-group={group.key}
            use:measureRow={row.key}
            style:inset-block-start={useVirtual ? `${row.start}px` : undefined}
            style:block-size={useVirtual && row.measured ? `${row.size}px` : undefined}
          >
            {#if group.showHeader && group.dayStart}
              <div class="tx-chat-message-list__day" role="separator">
                <span>{formatDay(group.dayStart)}</span>
              </div>
            {/if}
            {#if !own && group.showHeader}
              <Avatar name={group.author.name} src={group.author.avatarUrl} size="sm" decorative class="tx-chat-message-group__avatar" />
            {:else if !own}
              <span class="tx-chat-message-group__avatar-spacer" aria-hidden="true"></span>
            {/if}
            <div class={cx('tx-chat-message-group__content', own && 'tx-chat-message-group__content--own')}>
              {#if group.showHeader}
                <p class="tx-chat-message-group__meta">
                  {#if !own}<span class="tx-chat-message-group__author">{group.author.name}</span>{:else}<span class="tx-chat-message-group__you">{labels.you}</span>{/if}
                  {#if dateFor(first.at)}<time datetime={dateFor(first.at)?.toISOString()}>{formatTime(first.at)}</time>{/if}
                </p>
              {/if}
              {#each group.messages as message (message.id)}
                {#if message.streaming}
                  <!-- Partial text is hidden from the live log so it is not read token by token;
                       the finished message replaces this node and is announced once. -->
                  <div class={cx('tx-chat-message', own && 'tx-chat-message--own', 'tx-chat-message--streaming')} data-streaming aria-busy="true">
                    <span class="tx-chat-message__sr">{labels.streaming}</span>
                    <span aria-hidden="true">{@render content(message)}</span><span class="tx-chat-message__caret" aria-hidden="true"></span>
                  </div>
                {:else}
                  <div class={cx('tx-chat-message', own && 'tx-chat-message--own', message.status === 'failed' && 'tx-chat-message--failed')}>
                    {@render content(message)}
                  </div>
                {/if}
                {#if !message.streaming && (message.status === 'failed' || (own && message.status && message === group.messages[group.messages.length - 1]))}
                  <p class={cx('tx-chat-message-group__status', message.status === 'failed' && 'tx-chat-message-group__status--failed')}>
                    {statusText[message.status]}
                  </p>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
  {@render footer?.()}
</div>

<style>
  @layer tx.components {
    .tx-chat-message-list {
      position: relative;
      display: flex;
      min-block-size: 0;
      flex: 1;
      flex-direction: column;
      overflow: auto;
      overscroll-behavior: contain;
      padding: 1rem;
      outline: none;
      color: var(--tx-foreground, CanvasText);
    }

    .tx-chat-message-list:focus-visible {
      outline: 2px solid var(--tx-ring, Highlight);
      outline-offset: -2px;
    }

    .tx-chat-message-list__canvas { display: flex; flex-direction: column; gap: 0.75rem; }
    .tx-chat-message-list__canvas--virtual { position: relative; display: block; flex: none; }
    .tx-chat-message-group--virtual { position: absolute; inset-inline: 0; }
    .tx-chat-message-group { display: flex; align-items: flex-start; gap: 0.625rem; min-inline-size: 0; }
    :global(.tx-chat-message-group__avatar .tx-avatar__surface[data-tone]) { color: CanvasText; }
    .tx-chat-message-group__avatar { margin-block-start: 1.25rem; flex: none; }
    .tx-chat-message-group__avatar-spacer { inline-size: 1.75rem; flex: none; }
    .tx-chat-message-group__content { display: flex; min-inline-size: 0; max-inline-size: min(85%, 42rem); flex-direction: column; align-items: flex-start; gap: 0.25rem; }
    .tx-chat-message-group__content--own { margin-inline-start: auto; align-items: flex-end; }
    .tx-chat-message-group__meta { display: flex; align-items: baseline; gap: 0.5rem; margin: 0; padding-inline: 0.25rem; color: var(--tx-muted-foreground, GrayText); font-size: 0.75rem; }
    .tx-chat-message-group__author { color: var(--tx-foreground, CanvasText); font-weight: 600; }
    .tx-chat-message-group__you { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .tx-chat-message { max-inline-size: 100%; overflow-wrap: anywhere; white-space: pre-wrap; border-radius: 1rem; border-end-start-radius: 0.25rem; background: var(--tx-muted, ButtonFace); padding: 0.5rem 0.875rem; }
    .tx-chat-message--own { border-radius: 1rem; border-end-end-radius: 0.25rem; background: var(--tx-primary, Highlight); color: var(--tx-primary-foreground, HighlightText); }
    .tx-chat-message--failed { outline: 2px solid var(--tx-destructive, Mark); }
    .tx-chat-message__sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .tx-chat-message__caret { display: inline-block; inline-size: 0.5em; block-size: 1em; margin-inline-start: 0.1em; vertical-align: text-bottom; background: currentColor; animation: tx-chat-caret 1s steps(1) infinite; }
    @keyframes tx-chat-caret { 50% { opacity: 0; } }
    .tx-chat-message :global(a) { color: inherit; text-decoration: underline; text-underline-offset: 0.15em; }
    .tx-chat-message-group__status { margin: 0; color: var(--tx-muted-foreground, GrayText); font-size: 0.7rem; }
    .tx-chat-message-group__status--failed { color: var(--tx-destructive, Mark); font-weight: 600; }
    .tx-chat-message-list__day { position: relative; display: flex; align-items: center; justify-content: center; margin-block: 0.35rem; color: var(--tx-muted-foreground, GrayText); font-size: 0.75rem; }
    .tx-chat-message-list__day::before { position: absolute; inset-inline: 0; block-size: 1px; background: var(--tx-border, ButtonBorder); content: ''; }
    .tx-chat-message-list__day span { position: relative; background: var(--tx-surface, Canvas); padding-inline: 0.5rem; }
    .tx-chat-message-list__empty { margin: auto; color: var(--tx-muted-foreground, GrayText); text-align: center; }

    @media (min-width: 640px) {
      .tx-chat-message-group__content { max-inline-size: min(70%, 42rem); }
    }
    @media (forced-colors: active) {
      .tx-chat-message { border: 1px solid CanvasText; }
      .tx-chat-message-list__day::before { background: CanvasText; }
    }
    @media (prefers-reduced-motion: reduce) { .tx-chat-message-list { scroll-behavior: auto; } .tx-chat-message__caret { animation: none; } }
  }
</style>
