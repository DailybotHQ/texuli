import { defineExample } from '../registry.ts';

export const texuliSidebarExample = defineExample({
  id: 'texuli-sidebar',
  title: 'Sidebar and AppNav',
  description:
    'Collapsible app sidebar with sections and badges, plus AppNav mobile drawer. Fictional Harbor Notes navigation.',
  tags: ['texuli', 'sidebar', 'navigation', 'a11y', 'rtl', 'dark'],
  component: 'texuli/Sidebar',
  props: ['sections', 'collapsed', 'collapsible', 'variant', 'drawer'],
  load: () => import('./SidebarDemo.svelte'),
});
