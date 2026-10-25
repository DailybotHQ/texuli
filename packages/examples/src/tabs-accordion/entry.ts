import { defineExample } from '../registry.ts';

export const texuliTabsAccordionExample = defineExample({
  id: 'texuli-tabs-accordion',
  title: 'Tabs, Accordion and Collapsible',
  description:
    'Styled tabs (line, pills, enclosed), bordered accordion and collapsible disclosure. Fictional Harbor Notes copy; RTL pills demo.',
  tags: ['texuli', 'tabs', 'accordion', 'collapsible', 'a11y'],
  component: 'texuli/Tabs',
  props: ['items', 'value', 'variant', 'type', 'label'],
  load: () => import('./TabsAccordionDemo.svelte'),
});
