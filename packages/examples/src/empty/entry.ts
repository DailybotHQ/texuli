import { defineExample } from '../registry.ts';

export const texuliEmptyExample = defineExample({
  id: 'texuli-empty',
  title: 'Empty and error states',
  description:
    'EmptyState with actions and sizes, RTL compact empty, and ErrorState with pending retry. Fictional Harbor Notes copy.',
  tags: ['texuli', 'empty', 'error', 'a11y'],
  component: 'texuli/EmptyState',
  props: ['title', 'description', 'size', 'onRetry', 'retryLabel'],
  load: () => import('./EmptyDemo.svelte'),
});
