import { defineExample } from '../registry.ts';

export const texuliTimelineExample = defineExample({
  id: 'texuli-timeline',
  title: 'Timeline',
  description:
    'Vertical and horizontal timelines: every status and tone, links through the URL policy, composed items, right to left and dark. Fictional data only.',
  tags: ['texuli', 'timeline', 'a11y', 'rtl', 'dark'],
  component: 'texuli/Timeline',
  props: ['items', 'orientation', 'label', 'messages', 'hrefTrust'],
  load: () => import('./TimelineDemo.svelte'),
});
