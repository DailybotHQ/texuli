import { defineExample } from '../registry.ts';

export const texuliTypographyExample = defineExample({
  id: 'texuli-typography',
  title: 'Heading, Text, Prose and Box',
  description:
    'A locked-prototype page built from catalog components only: an app header Box with one border side, headings at sizes independent of their level, an eyebrow, a large tabular figure, muted and small text, long-form Prose and bordered panels. Fictional data only.',
  tags: ['texuli', 'typography', 'heading', 'text', 'prose', 'box', 'locked', 'a11y'],
  component: 'texuli/Heading',
  props: [
    'level',
    'size',
    'tone',
    'as',
    'weight',
    'transform',
    'tracking',
    'tabular',
    'padding',
    'radius',
    'border',
    'surface',
  ],
  load: () => import('./TypographyDemo.svelte'),
});
