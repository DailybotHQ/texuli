import { defineExample } from '../registry.ts';

export const texuliSeparatorAspectExample = defineExample({
  id: 'texuli-separator-aspect',
  title: 'Separator, AspectRatio and VisuallyHidden',
  description:
    'Layout utilities: horizontal and vertical separators, aspect-ratio boxes, and screen-reader-only text. Fictional Harbor Notes copy.',
  tags: ['texuli', 'separator', 'aspect-ratio', 'a11y', 'rtl', 'dark'],
  component: 'texuli/Separator',
  props: ['orientation', 'decorative', 'variant', 'ratio', 'custom'],
  load: () => import('./SeparatorAspectDemo.svelte'),
});
