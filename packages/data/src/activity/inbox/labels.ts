/** Every visible or announced string of the notification inbox. Pass translations to override. */
export interface NotificationInboxLabels {
  /** The inbox heading. */
  title: string;
  /** After the heading, for assistive technology (the badge shows the number). */
  unreadCount: (count: number) => string;
  /** Names the all / unread switch. */
  view: string;
  all: string;
  unread: string;
  markAllRead: string;
  /** Visible text of an item's read toggle. */
  markRead: string;
  markUnread: string;
  /** Accessible names of the toggle: they start with the visible text (WCAG 2.5.3). */
  markReadItem: (title: string) => string;
  markUnreadItem: (title: string) => string;
  /** Read before an unread item's title. */
  unreadItem: string;
  empty: string;
  emptyUnread: string;
  /** Announced (polite) when unread items arrive. */
  arrived: (count: number) => string;
}

export const DEFAULT_INBOX_LABELS: Readonly<NotificationInboxLabels> =
  /* @__PURE__ */ Object.freeze({
    title: 'Notifications',
    unreadCount: (count: number) => `, ${count} unread`,
    view: 'Show',
    all: 'All',
    unread: 'Unread',
    markAllRead: 'Mark all as read',
    markRead: 'Mark as read',
    markUnread: 'Mark as unread',
    markReadItem: (title: string) => `Mark as read: ${title}`,
    markUnreadItem: (title: string) => `Mark as unread: ${title}`,
    unreadItem: 'Unread: ',
    empty: 'No notifications.',
    emptyUnread: 'You are all caught up.',
    arrived: (count: number) => `${count} new ${count === 1 ? 'notification' : 'notifications'}.`,
  });

/** Merges overrides over the English defaults; values of the wrong type are ignored. */
export function resolveInboxLabels(
  overrides: Partial<NotificationInboxLabels> = {}
): NotificationInboxLabels {
  const labels = { ...DEFAULT_INBOX_LABELS } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    if (key in labels && typeof value === typeof labels[key]) labels[key] = value;
  }
  return labels as unknown as NotificationInboxLabels;
}
