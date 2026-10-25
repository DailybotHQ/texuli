import { defineExample } from '../registry.ts';

export const texuliFeedbackExample = defineExample({
  id: 'texuli-feedback',
  title: 'Skeleton, Spinner and Progress',
  description:
    'Loading placeholders, status spinners, and linear/circular progress (determinate and indeterminate) on the token contract. Fictional Harbor Notes copy.',
  tags: ['texuli', 'feedback', 'progress', 'a11y'],
  component: 'texuli/Progress',
  props: ['value', 'label', 'shape', 'tone', 'size', 'showValue', 'loadingLabel'],
  load: () => import('./FeedbackDemo.svelte'),
});
