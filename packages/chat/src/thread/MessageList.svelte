<script lang="ts">
import type { Snippet } from 'svelte';
import { tick, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { Avatar } from 'texuli/avatar';
import { Button } from 'texuli/button';
import { type ClassValue, chainHandlers, cx } from 'texuli/cx';
import { groupMessages } from './group-messages.ts';
import { DEFAULT_MESSAGE_LIST_LABELS, type MessageListLabels } from './labels.ts';
import MessageText from './MessageText.svelte';
import type {
  ChatMessage,
  ChatMessageActions,
  ChatMessageStatus,
  ChatReadingAnchor,
} from './types.ts';
import { MessageVirtualWindow, type VirtualWindow } from './virtual-window.ts';

interface OwnProps {
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
  /** Per-message controls (feedback, copy, regenerate, edit) under each finished message. */
  actions?: Snippet<[ChatMessage, ChatMessageActions]>;
  /** Saves an inline edit; return false or reject to keep the editor open. */
  onEdit?: (message: ChatMessage, body: string) => unknown;
  /**
   * Called when an inline edit is saved with the text unchanged (G85), so a
   * host can treat it as a resend. `onEdit` is not called; the editor closes
   * as before.
   */
  onEditUnchanged?: (message: ChatMessage) => void;
  /**
   * The reading position (`bind:anchor`): the list writes the first message
   * in view as the reader scrolls, and scrolls to an anchor the host sets
   * (on mount, or when it swaps conversations), across the virtual window.
   * `null` or unset opens at the latest message.
   */
  anchor?: ChatReadingAnchor | null;
  /** Called when the reading position changes (at most once per frame). */
  onAnchorChange?: (anchor: ChatReadingAnchor) => void;
  class?: ClassValue;
  /** The scrolling log element (bindable). */
  ref?: HTMLElement | null;
}
/**
 * Other attributes (`id`, `data-*`, `style`, handlers) land on the log
 * element; a caller `onscroll` runs first and the list's own scroll
 * bookkeeping always runs after it.
 */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'children'>;

const uid = $props.id();

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
  actions,
  onEdit,
  onEditUnchanged,
  anchor = $bindable(null),
  onAnchorChange,
  class: className,
  ref = $bindable(null),
  onscroll: callerScroll,
  ...rest
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
/** The reader is at the bottom; false shows the jump-to-latest control. */
let atBottom = $state(true);
/** Messages arrived while the reader was scrolled up. */
let unseen = $state(false);
let editingId = $state<string | null>(null);
let editDraft = $state('');
let editSaving = $state(false);
let editReturn: HTMLElement | null = null;

/** A rendered row and where it sat, used to keep it still while offsets change. */
interface ScrollAnchor {
  key: string;
  start: number;
  scrollTop: number;
}

$effect(() => {
  ref = viewport;
});

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
  setAtBottom(stickToBottom);
  scheduleReport();
}

// Reading position (G71). `anchorKey` is the anchor last reported or restored,
// so the list's own writes to `bind:anchor` never trigger a restore.
let anchorKey = '';
/** A host anchor waiting for its messages to render. */
let pendingRestore: ChatReadingAnchor | null = null;
let reportFrame = 0;

function keyOf(value: ChatReadingAnchor | null | undefined): string {
  return value ? `${value.messageId}\u0000${value.offset}\u0000${value.atLatest}` : '';
}

function messageNodes(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll<HTMLElement>('[data-message-id]'));
}

function captureReading(element: HTMLElement): ChatReadingAnchor | null {
  const top = element.getBoundingClientRect().top;
  const nodes = messageNodes(element);
  const node = nodes.find((item) => item.getBoundingClientRect().bottom > top) ?? nodes.at(-1);
  const messageId = node?.getAttribute('data-message-id');
  if (!node || !messageId) return null;
  return {
    messageId,
    offset: Math.round(node.getBoundingClientRect().top - top),
    atLatest: nearBottom(element),
  };
}

function report(): void {
  const element = viewport;
  if (!element || pendingRestore) return;
  const next = captureReading(element);
  if (!next || keyOf(next) === anchorKey) return;
  anchorKey = keyOf(next);
  anchor = next;
  onAnchorChange?.(next);
}

function scheduleReport(): void {
  if (reportFrame || (!onAnchorChange && anchor === null && !anchorKey)) return;
  if (typeof requestAnimationFrame !== 'function') {
    report();
    return;
  }
  reportFrame = requestAnimationFrame(() => {
    reportFrame = 0;
    report();
  });
}

$effect(() => () => {
  if (reportFrame) cancelAnimationFrame(reportFrame);
  reportFrame = 0;
});

/** Scrolls so the anchor message sits `offset` px below the viewport top. */
async function restoreReading(target: ChatReadingAnchor): Promise<void> {
  const element = viewport;
  if (!element) return;
  if (target.atLatest) {
    stickToBottom = true;
    await tick();
    toBottom(element);
    pendingRestore = null;
    return;
  }
  const index = renderGroups.findIndex((row) =>
    row.messages.some((message) => message.id === target.messageId)
  );
  if (index < 0) {
    // Not in this list: open at the latest message, as without an anchor.
    pendingRestore = null;
    stickToBottom = true;
    toBottom(element);
    return;
  }
  stickToBottom = false;
  if (useVirtual) {
    // Bring the row into the virtual window at its estimated offset first.
    element.scrollTop = list.offsetOf(index);
    scrollTop = element.scrollTop;
    await tick();
  }
  // Two passes: a row measured on first render moves the rows after it.
  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) await tick();
    const node = messageNodes(element).find(
      (item) => item.getAttribute('data-message-id') === target.messageId
    );
    if (!node) break;
    const delta =
      node.getBoundingClientRect().top - element.getBoundingClientRect().top - target.offset;
    if (Math.abs(delta) < 1) break;
    element.scrollTop += delta;
    scrollTop = element.scrollTop;
  }
  stickToBottom = nearBottom(element);
  setAtBottom(stickToBottom);
  unseen = false;
  pendingRestore = null;
}

// A host-set anchor (not one this list reported) is restored once its
// messages are rendered.
$effect.pre(() => {
  const target = anchor;
  const key = keyOf(target);
  if (key === anchorKey) return;
  anchorKey = key;
  if (!target) return;
  untrack(() => {
    pendingRestore = target;
    if (!target.atLatest) stickToBottom = false;
  });
});

$effect(() => {
  void messages;
  const target = pendingRestore;
  if (!target || !viewport) return;
  untrack(() => void restoreReading(target));
});

function setAtBottom(value: boolean): void {
  atBottom = value;
  if (value) unseen = false;
}

function toBottom(element: HTMLElement): void {
  element.scrollTop = element.scrollHeight;
  scrollTop = element.scrollTop;
  setAtBottom(true);
}

function jumpToLatest(): void {
  const element = viewport;
  if (!element) return;
  stickToBottom = true;
  toBottom(element);
  // The control leaves once the reader is at the bottom; focus stays in the log.
  element.focus();
}

function startEdit(message: ChatMessage): void {
  if (!onEdit || message.streaming) return;
  const active = document.activeElement;
  editReturn = active instanceof HTMLElement ? active : null;
  editDraft = message.body;
  editingId = message.id;
}

function endEdit(): void {
  editingId = null;
  const target = editReturn;
  editReturn = null;
  void tick().then(() => (target?.isConnected ? target : viewport)?.focus());
}

async function saveEdit(message: ChatMessage): Promise<void> {
  const next = editDraft.trim();
  if (editSaving || next === '') return;
  if (next === message.body) {
    endEdit();
    onEditUnchanged?.(message);
    return;
  }
  editSaving = true;
  try {
    if ((await onEdit?.(message, next)) !== false) endEdit();
  } catch {
    // A rejected save keeps the editor open with the draft.
  } finally {
    editSaving = false;
  }
}

function editKeydown(event: KeyboardEvent, message: ChatMessage): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    endEdit();
  } else if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.isComposing &&
    event.keyCode !== 229
  ) {
    event.preventDefault();
    void saveEdit(message);
  }
}

function focusEnd(node: HTMLTextAreaElement): void {
  node.focus();
  node.setSelectionRange(node.value.length, node.value.length);
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
  const previousCountBefore = previousCount;
  previousCount = count;
  previousFirstId = firstId;
  previousLastId = last?.id;
  if (!viewport || pendingRestore) return;
  const element = viewport;
  if (shouldStick) {
    void tick().then(() => toBottom(element));
  } else if (count > previousCountBefore && !prepended && previousCountBefore > 0) {
    unseen = true;
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

// A streamed reply grows without adding messages: follow it while the reader
// is at the bottom, and leave the view alone once they scroll up.
$effect(() => {
  const last = messages[messages.length - 1];
  if (!last?.streaming) return;
  void last.body;
  const element = viewport;
  if (!element || !stickToBottom) return;
  void tick().then(() => {
    if (stickToBottom) toBottom(element);
  });
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
  {...rest}
  bind:this={viewport}
  class={cx('tx-chat-message-list', className)}
  data-tx-chat-message-list
  data-virtualized={useVirtual || undefined}
  role="log"
  aria-label={label}
  aria-live="polite"
  aria-relevant="additions text"
  tabindex="0"
  onscroll={chainHandlers(callerScroll, onScroll)}
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
            <div class="tx-chat-message-group__row">
            {#if !own && group.showHeader}
              <Avatar name={group.author.name} src={group.author.avatarUrl} srcset={group.author.avatarSrcset} size="sm" decorative class="tx-chat-message-group__avatar" />
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
                {#if editingId === message.id && !message.streaming}
                  <form
                    class="tx-chat-message-edit"
                    data-tx-chat-edit
                    data-message-id={message.id}
                    aria-live="off"
                    onsubmit={(event) => {
                      event.preventDefault();
                      void saveEdit(message);
                    }}
                  >
                    <label class="tx-chat-message__sr" for={`${uid}-edit`}>{labels.editInput}</label>
                    <textarea
                      id={`${uid}-edit`}
                      class="tx-chat-message-edit__field"
                      rows="3"
                      value={editDraft}
                      readonly={editSaving}
                      use:focusEnd
                      oninput={(event) => (editDraft = event.currentTarget.value)}
                      onkeydown={(event) => editKeydown(event, message)}
                    ></textarea>
                    <div class="tx-chat-message-edit__actions">
                      <Button size="sm" variant="ghost" onclick={endEdit}>{labels.cancelEdit}</Button>
                      <Button type="submit" size="sm" disabled={editDraft.trim() === ''} loading={editSaving}>{labels.saveEdit}</Button>
                    </div>
                  </form>
                {:else if message.streaming}
                  <!-- Partial text is hidden from the live log so it is not read token by token;
                       the finished message replaces this node and is announced once. -->
                  <div class={cx('tx-chat-message', own && 'tx-chat-message--own', 'tx-chat-message--streaming')} data-message-id={message.id} data-streaming aria-busy="true">
                    <span class="tx-chat-message__sr">{labels.streaming}</span>
                    <span aria-hidden="true">{@render content(message)}</span><span class="tx-chat-message__caret" aria-hidden="true"></span>
                  </div>
                {:else}
                  <div class={cx('tx-chat-message', own && 'tx-chat-message--own', message.status === 'failed' && 'tx-chat-message--failed')} data-message-id={message.id}>
                    {@render content(message)}
                  </div>
                {/if}
                {#if !message.streaming && (message.status === 'failed' || (own && message.status && message === group.messages[group.messages.length - 1]))}
                  <p class={cx('tx-chat-message-group__status', message.status === 'failed' && 'tx-chat-message-group__status--failed')}>
                    {statusText[message.status]}
                  </p>
                {/if}
                {#if actions && !message.streaming}
                  <!-- Controls stay out of the live log's announcements. -->
                  <div class="tx-chat-message__actions" data-message-actions={message.id} aria-live="off">
                    {@render actions(message, { edit: () => startEdit(message), canEdit: onEdit !== undefined })}
                  </div>
                {/if}
              {/each}
            </div>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
  {@render footer?.()}
  {#if !atBottom && messages.length > 0}
    <div class="tx-chat-message-list__jump" aria-live="off">
      <Button size="sm" variant="secondary" onclick={jumpToLatest} data-tx-chat-jump>{labels.jumpToLatest}</Button>
    </div>
  {/if}
</div>
<span class="tx-chat-message__sr" role="status">{unseen && !atBottom ? labels.newBelow : ''}</span>

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
      padding: var(--tx-space-4);
      outline: none;
      color: var(--tx-foreground, CanvasText);
    }

    .tx-chat-message-list:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: -2px;
    }

    .tx-chat-message-list__canvas { display: flex; flex-direction: column; gap: var(--tx-space-3); }
    .tx-chat-message-list__canvas--virtual { position: relative; display: block; flex: none; }
    .tx-chat-message-group--virtual { position: absolute; inset-inline: 0; }
    .tx-chat-message-group { display: flex; flex-direction: column; min-inline-size: 0; }
    /* The day separator is its own full-width row; the avatar and bubbles share the row after it (G70). */
    .tx-chat-message-group__row { display: flex; align-items: flex-start; gap: calc(var(--tx-space-unit) * 2.5); min-inline-size: 0; }
    :global(.tx-chat-message-group__avatar .tx-avatar__surface[data-tone]) { color: CanvasText; }
    .tx-chat-message-group__avatar { margin-block-start: var(--tx-space-5); flex: none; }
    .tx-chat-message-group__avatar-spacer { inline-size: 1.75rem; flex: none; }
    .tx-chat-message-group__content { display: flex; min-inline-size: 0; max-inline-size: min(85%, 42rem); flex-direction: column; align-items: flex-start; gap: var(--tx-space-1); }
    .tx-chat-message-group__content--own { margin-inline-start: auto; align-items: flex-end; }
    .tx-chat-message-group__meta { display: flex; align-items: baseline; gap: var(--tx-space-2); margin: 0; padding-inline: var(--tx-space-1); color: var(--tx-muted-foreground, GrayText); font-size: var(--tx-type-caption-size); }
    .tx-chat-message-group__author { color: var(--tx-foreground, CanvasText); font-weight: 600; }
    .tx-chat-message-group__you { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .tx-chat-message { max-inline-size: 100%; overflow-wrap: anywhere; white-space: pre-wrap; border-radius: var(--tx-chat-bubble-radius, calc(var(--tx-shape-radius-lg) * 2)); border-end-start-radius: var(--tx-chat-bubble-tail-radius, var(--tx-shape-radius-sm)); background: var(--tx-muted, ButtonFace); padding: var(--tx-chat-bubble-padding-block, var(--tx-space-2)) var(--tx-chat-bubble-padding-inline, calc(var(--tx-space-unit) * 3.5)); }
    .tx-chat-message--own { border-radius: var(--tx-chat-bubble-radius, calc(var(--tx-shape-radius-lg) * 2)); border-end-end-radius: var(--tx-chat-bubble-tail-radius, var(--tx-shape-radius-sm)); background: var(--tx-primary, Highlight); color: var(--tx-primary-foreground, HighlightText); }
    .tx-chat-message--failed { outline: 2px solid var(--tx-destructive, Mark); }
    .tx-chat-message__sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .tx-chat-message__caret { display: inline-block; inline-size: 0.5em; block-size: 1em; margin-inline-start: 0.1em; vertical-align: text-bottom; background: currentColor; animation: tx-chat-caret 1s steps(1) infinite; }
    @keyframes tx-chat-caret { 50% { opacity: 0; } }
    .tx-chat-message :global(a) { color: inherit; text-decoration: underline; text-underline-offset: 0.15em; }
    .tx-chat-message-group__status { margin: 0; color: var(--tx-muted-foreground, GrayText); font-size: 0.7rem; }
    .tx-chat-message-group__status--failed { color: var(--tx-destructive, Mark); font-weight: 600; }
    .tx-chat-message-list__day { position: relative; display: flex; align-items: center; justify-content: center; margin-block: calc(var(--tx-space-unit) * 1.4); color: var(--tx-muted-foreground, GrayText); font-size: var(--tx-type-caption-size); }
    .tx-chat-message-list__day::before { position: absolute; inset-inline: 0; block-size: 1px; background: var(--tx-border, ButtonBorder); content: ''; }
    .tx-chat-message-list__day span { position: relative; background: var(--tx-surface, Canvas); padding-inline: var(--tx-space-2); }
    .tx-chat-message__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tx-space-1); }
    .tx-chat-message-edit { display: grid; inline-size: min(100%, 32rem); gap: var(--tx-space-2); }
    .tx-chat-message-edit__field { box-sizing: border-box; inline-size: 100%; margin: 0; border: var(--tx-border-width-thin) solid var(--tx-input, var(--tx-border, CanvasText)); border-radius: var(--tx-shape-radius-lg); background: var(--tx-surface, Canvas); color: var(--tx-foreground, CanvasText); padding: var(--tx-space-2) var(--tx-space-3); font: inherit; resize: vertical; }
    .tx-chat-message-edit__field:focus-visible { outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight); outline-offset: 1px; }
    .tx-chat-message-edit__actions { display: flex; justify-content: flex-end; gap: var(--tx-space-2); }
    .tx-chat-message-list__jump { position: sticky; inset-block-end: 0; display: flex; block-size: 0; flex: none; align-items: flex-end; justify-content: center; overflow: visible; }
    .tx-chat-message-list__empty { margin: auto; color: var(--tx-muted-foreground, GrayText); text-align: center; }

    @media (min-width: 640px) {
      .tx-chat-message-group__content { max-inline-size: min(70%, 42rem); }
    }
    @media (forced-colors: active) {
      .tx-chat-message { border: var(--tx-border-width-thin) solid CanvasText; }
      .tx-chat-message-list__day::before { background: CanvasText; }
    }
    @media (prefers-reduced-motion: reduce) { .tx-chat-message-list { scroll-behavior: auto; } .tx-chat-message__caret { animation: none; } }
  }
</style>
