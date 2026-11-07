import { defineExample } from '../registry.ts';

export const texuliListItemExample = defineExample({
  id: 'texuli-list-item',
  title: 'List item',
  description:
    'Rows of a role="list": leading avatar or icon, title and description, trailing meta and a trailing action, as links (URL policy), buttons or plain text. Fictional example.com only.',
  tags: ['texuli', 'list', 'list-item', 'a11y', 'rtl'],
  component: 'texuli/ListItem',
  props: ['title', 'description', 'meta', 'icon', 'leading', 'trailing', 'href', 'onSelect'],
  load: () => import('./ListItemDemo.svelte'),
});
