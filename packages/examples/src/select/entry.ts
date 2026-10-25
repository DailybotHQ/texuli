import { defineExample } from '../registry.ts';

const component = 'texuli/Select';

export const selectExamples = [
  defineExample({
    id: 'ui-select',
    title: 'Select',
    description:
      'Styled single-select listbox with groups, option descriptions and a chevron trigger. Fictional plans only.',
    tags: ['ui', 'select', 'form'],
    component,
    props: ['items', 'value', 'open', 'size', 'variant', 'placeholder'],
    load: () => import('./SelectDefaultDemo.svelte'),
  }),
  defineExample({
    id: 'ui-select-variants',
    title: 'Select variants',
    description: 'Outline and soft triggers across sm, md and lg sizes.',
    tags: ['ui', 'select', 'variant'],
    component,
    props: ['size', 'variant'],
    load: () => import('./SelectVariantsDemo.svelte'),
  }),
  defineExample({
    id: 'ui-select-states',
    title: 'Select states',
    description: 'Placeholder, disabled trigger and open list with a disabled option.',
    tags: ['ui', 'select', 'states'],
    component,
    props: ['disabled', 'placeholder', 'open'],
    load: () => import('./SelectStatesDemo.svelte'),
  }),
  defineExample({
    id: 'ui-select-rtl',
    title: 'Select, right to left',
    description: 'Arabic labels in a right-to-left layout with logical padding.',
    tags: ['ui', 'select', 'rtl', 'i18n'],
    component,
    load: () => import('./SelectRtlDemo.svelte'),
  }),
  defineExample({
    id: 'ui-select-dark',
    title: 'Select on a dark surface',
    description: 'Soft variant select with groups and a separator on the dark theme.',
    tags: ['ui', 'select', 'dark'],
    component,
    load: () => import('./SelectDarkDemo.svelte'),
  }),
] as const;
