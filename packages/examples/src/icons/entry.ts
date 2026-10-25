import { defineExample } from '../registry.ts';

export const texuliIconsExample = defineExample({
  id: 'texuli-icons',
  title: 'Icon system',
  description:
    'A small built-in icon set, size variants, decorative and labelled states, custom SVG compatibility, RTL and dark mode.',
  tags: ['texuli', 'icons', 'accessibility', 'rtl', 'dark'],
  component: 'texuli/Icon',
  props: ['icon', 'size', 'strokeWidth', 'label'],
  load: () => import('./IconsDemo.svelte'),
});
