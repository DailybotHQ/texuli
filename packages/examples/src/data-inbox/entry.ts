import { defineExample } from '../registry.ts';

export const dataInboxExample = defineExample({
  id: 'data-inbox',
  title: 'Notification inbox',
  description:
    'Unread state with a count, mark read and unread, mark all, an unread view that keeps items until you leave it, per-item actions and a polite announcement for new arrivals. Fictional workspace notifications.',
  tags: ['data', 'activity', 'notifications', 'live-region'],
  component: 'data/activity/inbox',
  props: ['items', 'now', 'filter', 'onReadChange', 'actions', 'hrefTrust'],
  load: () => import('./InboxDemo.svelte'),
});
