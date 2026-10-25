import { defineExample } from '../registry.ts';

const component = 'texuli/Popover';

export const popoverExamples = [
  defineExample({
    id: 'ui-popover',
    title: 'Popover',
    description:
      'Styled floating account menu with an arrow, header, list and close control. Fictional example.com copy.',
    tags: ['ui', 'popover', 'overlay'],
    component,
    props: ['open', 'side', 'align', 'variant', 'size', 'arrow'],
    load: () => import('./PopoverDefaultDemo.svelte'),
  }),
  defineExample({
    id: 'ui-popover-variants',
    title: 'Popover variants',
    description: 'Elevated, flat and size variants of the popover surface side by side.',
    tags: ['ui', 'popover', 'variant'],
    component,
    props: ['variant', 'size'],
    load: () => import('./PopoverVariantsDemo.svelte'),
  }),
  defineExample({
    id: 'ui-popover-states',
    title: 'Popover and HoverCard states',
    description: 'Closed popover, open without arrow, and an open hover card profile preview.',
    tags: ['ui', 'popover', 'hover-card', 'states'],
    component,
    props: ['open', 'arrow', 'openDelay'],
    load: () => import('./PopoverStatesDemo.svelte'),
  }),
  defineExample({
    id: 'ui-popover-rtl',
    title: 'Popover, right to left',
    description:
      'Arabic labels in a right-to-left layout with logical padding and arrow placement.',
    tags: ['ui', 'popover', 'rtl', 'i18n'],
    component,
    props: ['side', 'align'],
    load: () => import('./PopoverRtlDemo.svelte'),
  }),
  defineExample({
    id: 'ui-popover-dark',
    title: 'Popover on a dark surface',
    description: 'Popover and hover card on the dark theme using only token colors.',
    tags: ['ui', 'popover', 'dark'],
    component,
    load: () => import('./PopoverDarkDemo.svelte'),
  }),
] as const;
