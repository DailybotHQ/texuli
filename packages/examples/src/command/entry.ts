import { defineExample } from '../registry.ts';

const component = 'texuli/Command';

export const commandExamples = [
  defineExample({
    id: 'ui-command',
    title: 'Command palette',
    description:
      'Modal command palette with recent items, search groups and a ⌘K trigger. Fictional Harbor actions only.',
    tags: ['ui', 'command', 'a11y'],
    component,
    props: ['open', 'recentItems', 'search', 'size', 'variant'],
    load: () => import('./CommandDefaultDemo.svelte'),
  }),
  defineExample({
    id: 'ui-command-variants',
    title: 'Command sizes and variants',
    description: 'Inline command panels across sm/md/lg and outline/soft.',
    tags: ['ui', 'command', 'variant'],
    component,
    props: ['size', 'variant'],
    load: () => import('./CommandVariantsDemo.svelte'),
  }),
  defineExample({
    id: 'ui-command-states',
    title: 'Command states',
    description: 'Empty filter, disabled option and the ⌘K trigger chrome.',
    tags: ['ui', 'command', 'states'],
    component,
    props: ['disabled', 'value'],
    load: () => import('./CommandStatesDemo.svelte'),
  }),
  defineExample({
    id: 'ui-command-rtl',
    title: 'Command, right to left',
    description: 'Arabic labels for an inline command panel in a right-to-left layout.',
    tags: ['ui', 'command', 'rtl', 'i18n'],
    component,
    load: () => import('./CommandRtlDemo.svelte'),
  }),
  defineExample({
    id: 'ui-command-dark',
    title: 'Command on a dark surface',
    description: 'Command palette on the dark theme using only token colors.',
    tags: ['ui', 'command', 'dark'],
    component,
    load: () => import('./CommandDarkDemo.svelte'),
  }),
] as const;
