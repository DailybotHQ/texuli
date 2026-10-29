/**
 * Notification inbox state without a framework: read and unread, mark all,
 * the unread view and which items are new since the last look. Every helper
 * is pure and returns new arrays, so a store, a server or a test can share
 * them with the `NotificationInbox` view.
 */

/** One notification. Extra fields ride along untouched. */
export interface InboxNotification {
  id: string;
  /** Plain text (never markup). */
  title: string;
  body?: string;
  /** When it arrived: an ISO string, ms or a `Date`. */
  at: string | number | Date;
  read: boolean;
  /** Where it leads (passed through the URL policy before rendering). */
  href?: string;
}

/** Which notifications the inbox lists. */
export type InboxFilter = 'all' | 'unread';

export function unreadCount(items: readonly Pick<InboxNotification, 'read'>[]): number {
  let count = 0;
  for (const item of items) if (!item.read) count++;
  return count;
}

/** The items with `ids` set to `read` (others, and items already there, keep their identity). */
export function setRead<T extends InboxNotification>(
  items: readonly T[],
  ids: Iterable<string>,
  read: boolean
): T[] {
  const set = new Set(ids);
  return items.map((item) => (set.has(item.id) && item.read !== read ? { ...item, read } : item));
}

/** Every item read. */
export function markAllRead<T extends InboxNotification>(items: readonly T[]): T[] {
  return setRead(
    items,
    items.map((item) => item.id),
    true
  );
}

/** The items a filter lists, in order. */
export function filterInbox<T extends InboxNotification>(
  items: readonly T[],
  filter: InboxFilter
): T[] {
  return filter === 'unread' ? items.filter((item) => !item.read) : [...items];
}

/** Items whose id is not in `seen` (what arrived since the last render). */
export function newArrivals<T extends Pick<InboxNotification, 'id'>>(
  seen: ReadonlySet<string>,
  items: readonly T[]
): T[] {
  return items.filter((item) => !seen.has(item.id));
}
