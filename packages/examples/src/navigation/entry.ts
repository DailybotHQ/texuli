import { defineExample } from '../registry.ts';

const component = 'texuli/Navigation';

export const navigationExamples = [
  defineExample({
    id: 'ui-navigation',
    title: 'Navigation',
    description:
      'Styled breadcrumb, navigation menu flyouts and pagination on the token contract. Fictional example.com links only.',
    tags: ['ui', 'navigation', 'breadcrumb', 'pagination'],
    component,
    props: ['items', 'page', 'value', 'size', 'variant'],
    load: () => import('./NavigationDefaultDemo.svelte'),
  }),
  defineExample({
    id: 'ui-navigation-variants',
    title: 'Navigation variants',
    description: 'Breadcrumb sizes and pagination outline/soft across sm, md and lg.',
    tags: ['ui', 'navigation', 'variant'],
    component,
    props: ['size', 'variant'],
    load: () => import('./NavigationVariantsDemo.svelte'),
  }),
  defineExample({
    id: 'ui-navigation-states',
    title: 'Navigation states',
    description: 'Collapsed breadcrumb, closed menu, blocked href and disabled pagination.',
    tags: ['ui', 'navigation', 'states'],
    component,
    props: ['maxItems', 'disabled'],
    load: () => import('./NavigationStatesDemo.svelte'),
  }),
  defineExample({
    id: 'ui-navigation-rtl',
    title: 'Navigation, right to left',
    description: 'Arabic labels for breadcrumb, menu and pagination in a right-to-left layout.',
    tags: ['ui', 'navigation', 'rtl', 'i18n'],
    component,
    load: () => import('./NavigationRtlDemo.svelte'),
  }),
  defineExample({
    id: 'ui-navigation-dark',
    title: 'Navigation on a dark surface',
    description: 'Navigation pieces on the dark theme using only token colors.',
    tags: ['ui', 'navigation', 'dark'],
    component,
    load: () => import('./NavigationDarkDemo.svelte'),
  }),
] as const;
