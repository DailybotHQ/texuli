import { defineExample } from '../registry.ts';

export const texuliBadgeExample = defineExample({
  id: 'texuli-badge',
  title: 'Badge, Tag and Chip',
  description:
    'Status badges in every tone, removable tags (including RTL), and a filter chip with pressed state. Fictional labels only.',
  tags: ['texuli', 'badge', 'tag', 'chip', 'a11y'],
  component: 'texuli/Badge',
  props: ['variant', 'label', 'selected', 'onRemove'],
  load: () => import('./BadgeDemo.svelte'),
});
