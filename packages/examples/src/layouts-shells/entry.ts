import { defineExample } from '../registry.ts';

export const layoutsShellsExample = defineExample({
  id: 'layouts-shells',
  title: 'Responsive application shell',
  description:
    'A wide application column and an RTL shell with sidebar drawer, skip link, and notification corner using fictional Harbor Notes content.',
  tags: ['texuli', 'layouts', 'shell', 'rtl', 'responsive', 'a11y'],
  component: 'texuli/AppShell',
  props: ['sidebar', 'header', 'children', 'sidebarOpen', 'notifications'],
  load: () => import('./LayoutsShellsDemo.svelte'),
});
