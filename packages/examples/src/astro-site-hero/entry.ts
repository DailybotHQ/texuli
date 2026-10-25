import { defineExample } from '../registry.ts';

export const astroSiteHeroExample = defineExample({
  id: 'astro-site-hero',
  title: 'Astro content site hero',
  description:
    'A visual preview of an Astro static content layout with a responsive hero, feature section and light/dark token themes.',
  tags: ['astro', 'content', 'hero', 'responsive', 'light', 'dark'],
  component: 'astro/sections/Hero',
  props: ['title', 'description', 'theme'],
  load: () => import('./Demo.svelte'),
});
