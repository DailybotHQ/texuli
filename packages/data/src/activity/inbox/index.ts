/**
 * `@texuli/data/activity/inbox`: a notification inbox with unread state,
 * mark read and unread, mark all, an unread view, per-item actions and a
 * polite live region for new arrivals. The read state is the host's: apply
 * `onReadChange` with the pure helpers (`setRead`, `markAllRead`), which
 * `@texuli/data/activity/engine` also exports.
 */
export {
  filterInbox,
  type InboxFilter,
  type InboxNotification,
  markAllRead,
  newArrivals,
  setRead,
  unreadCount,
} from '../../engines/activity/inbox.ts';
export {
  DEFAULT_INBOX_LABELS,
  type NotificationInboxLabels,
  resolveInboxLabels,
} from './labels.ts';
export { default as NotificationInbox } from './NotificationInbox.svelte';
