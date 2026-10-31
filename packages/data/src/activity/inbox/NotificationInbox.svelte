<script lang="ts" generics="T extends InboxNotification">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import { type Snippet, tick } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';
import { whenLabel } from '../../engines/activity/days.ts';
import {
  type InboxFilter,
  type InboxNotification,
  type InboxReadChangeContext,
  newArrivals,
  unreadCount,
} from '../../engines/activity/inbox.ts';
import { type NotificationInboxLabels, resolveInboxLabels } from './labels.ts';
import './inbox.css';

interface Props {
  /** Notifications, newest first. The host owns `read`: apply `onReadChange` (see `setRead`). */
  items: readonly T[];
  /** Runtime clock instant for the time labels. */
  now: string | number | Date;
  timeZone?: string;
  locale?: string;
  /** Which items are listed (`bind:filter`). */
  filter?: InboxFilter;
  onFilterChange?: (filter: InboxFilter) => void;
  /**
   * Read state changes: one item (`source: 'item'` for its toggle, `'open'`
   * when opening marks it read) or every unread one (`'all'`, unless
   * `onMarkAllRead` is given). Return a promise to show the control that
   * started the save as pending until it settles; a rejection is announced.
   * Any other return value is ignored (typed `unknown`, so handlers written
   * as expressions keep compiling).
   */
  onReadChange?: (ids: string[], read: boolean, context: InboxReadChangeContext) => unknown;
  /**
   * "Mark all as read", with the ids of the unread items listed now. When
   * given, it replaces `onReadChange` for that button, so a host whose own
   * mark-all covers rows outside `items` (paging, filters) can route it.
   * May return a promise, like `onReadChange`.
   */
  onMarkAllRead?: (ids: string[]) => unknown;
  /**
   * Read items offer "Mark unread". Default `true`; `false` hides that toggle
   * (unread items still offer "Mark read"), for hosts that persist only
   * mark-read.
   */
  allowMarkUnread?: boolean;
  /** An item marked unread (after `onReadChange`), for hosts that store it separately. */
  onMarkUnread?: (ids: string[]) => void;
  /** Opening an item: its title link (with `href`) or button. */
  onOpen?: (item: T) => void;
  /** Opening an unread item marks it read. Default `true`. */
  markReadOnOpen?: boolean;
  /** URL policy tier for `href`: `untrusted` (default) allows https, mailto and #fragments; `developer` allows app routes. */
  hrefTrust?: HrefTrust;
  /** Per-item actions (archive, snooze…), after the read toggle. */
  actions?: Snippet<[T]>;
  /** Custom body under the title (default: `body` as text). */
  body?: Snippet<[T]>;
  /** Level of the inbox heading (2–6, default 2). */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  labels?: Partial<NotificationInboxLabels>;
  class?: ClassValue;
}

let {
  items,
  now,
  timeZone,
  locale,
  filter = $bindable('all'),
  onFilterChange,
  onReadChange,
  onMarkAllRead,
  allowMarkUnread = true,
  onMarkUnread,
  onOpen,
  markReadOnOpen = true,
  hrefTrust = 'untrusted',
  actions,
  body,
  headingLevel = 2,
  labels,
  class: className,
}: Props = $props();

const uid = $props.id();
const text = $derived(resolveInboxLabels(labels));
const unread = $derived(unreadCount(items));
/**
 * Items read while the unread view is open stay listed until the view
 * changes, so the control in focus never disappears under the keyboard.
 */
let kept = $state(new Set<string>());
const shown = $derived(
  filter === 'unread' ? items.filter((item) => !item.read || kept.has(item.id)) : items
);

let announcement = $state('');
let seen: Set<string> | null = null;
$effect(() => {
  const fresh = seen ? newArrivals(seen, items) : [];
  seen = new Set(items.map((item) => item.id));
  const count = fresh.filter((item) => !item.read).length;
  if (count === 0) return;
  // Cleared first so a second batch of the same size is spoken again.
  const message = text.arrived(count);
  announcement = '';
  void tick().then(() => (announcement = message));
});

function setFilter(next: InboxFilter): void {
  if (next === filter) return;
  kept = new Set();
  filter = next;
  onFilterChange?.(next);
}

/** Controls with a save in flight: `all`, or `item:<id>` for a row's toggle. */
let pending = $state(new Set<string>());

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function announce(message: string): void {
  // Cleared first so the same message is spoken again.
  announcement = '';
  void tick().then(() => (announcement = message));
}

/** Track a host save: its control is pending until it settles; a rejection is announced. */
function track(result: unknown, control: string | null): void {
  if (!isThenable(result)) return;
  if (control) pending = new Set([...pending, control]);
  const done = () => {
    if (!control) return;
    const next = new Set(pending);
    next.delete(control);
    pending = next;
  };
  result.then(done, () => {
    done();
    announce(text.saveFailed);
  });
}

function setRead(ids: string[], read: boolean, source: InboxReadChangeContext['source']): void {
  if (ids.length === 0 || (!read && !allowMarkUnread)) return;
  const control = source === 'all' ? 'all' : source === 'item' ? `item:${ids[0]}` : null;
  if (control && pending.has(control)) return;
  if (filter === 'unread' && read) kept = new Set([...kept, ...ids]);
  let result: unknown;
  try {
    result =
      source === 'all' && onMarkAllRead
        ? onMarkAllRead(ids)
        : onReadChange?.(ids, read, { source });
  } catch {
    announce(text.saveFailed);
    return;
  }
  track(result, control);
  if (!read) onMarkUnread?.(ids);
}

function open(item: T): void {
  if (markReadOnOpen && !item.read) setRead([item.id], true, 'open');
  onOpen?.(item);
}

function when(item: T): { iso: string; label: string } {
  const ms = item.at instanceof Date ? item.at.getTime() : new Date(item.at).getTime();
  return Number.isFinite(ms)
    ? {
        iso: new Date(ms).toISOString(),
        label: whenLabel(ms, {
          now,
          ...(timeZone ? { timeZone } : {}),
          ...(locale ? { locale } : {}),
        }),
      }
    : { iso: '', label: '' };
}
</script>

<!--
  A pending control keeps focus: it is aria-disabled with its click ignored,
  never natively disabled (which would drop focus to <body>), and shows
  texuli's button spinner over its kept, hidden label.
-->
{#snippet label(value: string, busy: boolean)}
  {#if busy}
    <span class="tx-inbox__spinner" data-tx-inbox-spinner aria-hidden="true"></span>
    <span class="tx-inbox__label--hidden">{value}</span>
  {:else}
    {value}
  {/if}
{/snippet}

<section class={cx('tx-inbox', className)} aria-labelledby="{uid}-title" data-tx-inbox>
  <header class="tx-inbox__header">
    <svelte:element
      this={`h${Math.min(6, Math.max(2, Math.trunc(headingLevel) || 2))}`}
      id="{uid}-title"
      class="tx-inbox__title"
    >
      {text.title}
      {#if unread > 0}
        <span class="tx-inbox__count"><span aria-hidden="true">{unread}</span><span class="tx-inbox__sr-only">{text.unreadCount(unread)}</span></span>
      {/if}
    </svelte:element>
    <div class="tx-inbox__views" role="group" aria-label={text.view}>
      {#each ['all', 'unread'] as const as view (view)}
        <button
          type="button"
          class="tx-inbox__view"
          aria-pressed={filter === view}
          onclick={() => setFilter(view)}>{view === 'all' ? text.all : text.unread}</button
        >
      {/each}
    </div>
    <button
      type="button"
      class="tx-inbox__button"
      aria-disabled={unread === 0 || pending.has('all')}
      aria-busy={pending.has('all') || undefined}
      data-pending={pending.has('all') || undefined}
      onclick={() =>
        unread > 0 &&
        setRead(
          items.filter((item) => !item.read).map((item) => item.id),
          true,
          'all'
        )}
      >{@render label(text.markAllRead, pending.has('all'))}</button
    >
  </header>
  {#if shown.length === 0}
    <p class="tx-inbox__empty">{filter === 'unread' ? text.emptyUnread : text.empty}</p>
  {:else}
    <ul class="tx-inbox__list">
      {#each shown as item, index (item.id)}
        {@const href = safeHref(item.href, hrefTrust)}
        {@const time = when(item)}
        <li class="tx-inbox__item" data-unread={!item.read || undefined}>
          <article class="tx-inbox__article" aria-labelledby="{uid}-item-{index}">
            <span class="tx-inbox__dot" aria-hidden="true"></span>
            <div class="tx-inbox__content">
              <p class="tx-inbox__item-title" id="{uid}-item-{index}">
                {#if !item.read}<span class="tx-inbox__sr-only">{text.unreadItem}</span>{/if}
                {#if href}
                  <a class="tx-inbox__open" {href} onclick={() => open(item)}>{item.title}</a>
                {:else if onOpen}
                  <button type="button" class="tx-inbox__open" onclick={() => open(item)}>{item.title}</button>
                {:else}
                  {item.title}
                {/if}
              </p>
              {#if body}
                {@render body(item)}
              {:else if item.body}
                <p class="tx-inbox__body">{item.body}</p>
              {/if}
              {#if time.iso}<time class="tx-inbox__time" datetime={time.iso}>{time.label}</time>{/if}
            </div>
            <div class="tx-inbox__actions">
              {#if !item.read || allowMarkUnread}
                {@const busy = pending.has(`item:${item.id}`)}
                <button
                  type="button"
                  class="tx-inbox__button"
                  aria-label={item.read ? text.markUnreadItem(item.title) : text.markReadItem(item.title)}
                  aria-disabled={busy ? 'true' : undefined}
                  aria-busy={busy || undefined}
                  data-pending={busy || undefined}
                  onclick={() => setRead([item.id], !item.read, 'item')}
                  >{@render label(item.read ? text.markUnread : text.markRead, busy)}</button
                >
              {/if}
              {@render actions?.(item)}
            </div>
          </article>
        </li>
      {/each}
    </ul>
  {/if}
  <p class="tx-inbox__sr-only" role="status" aria-live="polite">{announcement}</p>
</section>
