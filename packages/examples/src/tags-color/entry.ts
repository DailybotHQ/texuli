import { defineExample } from '../registry.ts';

export const texuliTagsColorExample = defineExample({
  id: 'texuli-tags-color',
  title: 'TagsInput and ColorPicker',
  description:
    'Styled tags field (RTL) and color pickers with swatches. Fictional Harbor Notes topics and brand colors.',
  tags: ['texuli', 'tags', 'color', 'a11y'],
  component: 'texuli/TagsInput',
  props: ['value', 'label', 'max', 'format', 'swatches'],
  load: () => import('./TagsColorDemo.svelte'),
});
