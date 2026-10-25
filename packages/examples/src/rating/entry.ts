import { defineExample } from '../registry.ts';

export const texuliRatingExample = defineExample({
  id: 'texuli-rating',
  title: 'Rating',
  description:
    'Star rating input and display: whole and half stars, clearable, sizes, tones, read-only, disabled, ten stars, averages and RTL. Fictional Harbor Notes Cafe reviews.',
  tags: ['texuli', 'rating', 'radio', 'a11y'],
  component: 'texuli/Rating',
  props: [
    'value',
    'max',
    'allowHalf',
    'display',
    'clearable',
    'size',
    'tone',
    'readonly',
    'disabled',
    'showValue',
    'labels',
  ],
  load: () => import('./RatingDemo.svelte'),
});
