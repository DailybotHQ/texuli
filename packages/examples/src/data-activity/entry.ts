import { defineExample } from '../registry.ts';

export const dataActivityExample = defineExample({
  id: 'data-activity',
  title: 'Activity feed',
  description:
    'Day-grouped activity with avatars, mention tokens, reactions, kind filters and load-more pagination on a fictional CRM timeline.',
  tags: ['data', 'activity', 'feed', 'keyboard', 'rtl'],
  component: 'data/activity',
  props: ['items', 'now', 'reactions', 'filter', 'pageSize', 'personaId'],
  load: () => import('./ActivityFeedDemo.svelte'),
});
