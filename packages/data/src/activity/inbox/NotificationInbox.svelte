<script lang="ts" generics="T extends InboxNotification">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import { type Snippet, tick } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';
import { whenLabel } from '../../engines/activity/days.ts';
import {
  type InboxFilter,
  type InboxNotification,
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
  /** Read state changes: one item (toggle, open) or every unread one (mark all). */
  onReadChange?: (ids: string[], read: boolean) => void;
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

function setRead(ids: string[], read: boolean): void {
  if (ids.length === 0 || (!read && !allowMarkUnread)) return;
  if (filter === 'unread' && read) kept = new Set([...kept, ...ids]);
  onReadChange?.(ids, read);
  if (!read) onMarkUnread?.(ids);
}

function open(item: T): void {
  if (markReadOnOpen && !item.read) setRead([item.id], true);
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
      aria-disabled={unread === 0}
      onclick={() => unread > 0 && setRead(items.filter((item) => !item.read).map((item) => item.id), true)}
      >{text.markAllRead}</button
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
                <button
                  type="button"
                  class="tx-inbox__button"
                  aria-label={item.read ? text.markUnreadItem(item.title) : text.markReadItem(item.title)}
                  onclick={() => setRead([item.id], !item.read)}
                  >{item.read ? text.markUnread : text.markRead}</button
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
