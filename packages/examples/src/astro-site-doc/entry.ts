import { defineExample } from '../registry.ts';

export const astroSiteDocExample = defineExample({
  id: 'astro-site-doc',
  title: 'Astro content site doc',
  description:
    'A visual preview of a documentation page over the Astro content layout: compact hero, reading-width prose and a surface strip in light and dark token themes.',
  tags: ['astro', 'content', 'docs', 'responsive', 'light', 'dark'],
  component: 'astro/layouts/ContentLayout',
  props: ['title', 'description', 'theme', 'density'],
  load: () => import('./Demo.svelte'),
});
