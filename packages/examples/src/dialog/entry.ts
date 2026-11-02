import { defineExample } from '../registry.ts';

const component = 'texuli/Dialog';

export const dialogExamples = [
  defineExample({
    id: 'ui-dialog',
    title: 'Dialog',
    description:
      'Styled modal with header, scrollable body and footer actions. Fictional Harbor Labs copy.',
    tags: ['ui', 'dialog', 'overlay', 'a11y'],
    component,
    props: ['open', 'title', 'description', 'size', 'footer'],
    load: () => import('./DialogDefaultDemo.svelte'),
  }),
  defineExample({
    id: 'ui-dialog-variants',
    title: 'Dialog sizes',
    description: 'sm, md and lg dialog widths side by side on the token contract.',
    tags: ['ui', 'dialog', 'variant'],
    component,
    props: ['size'],
    load: () => import('./DialogVariantsDemo.svelte'),
  }),
  defineExample({
    id: 'ui-dialog-states',
    title: 'Dialog and AlertDialog states',
    description: 'Closed dialog trigger beside an open destructive confirm pattern.',
    tags: ['ui', 'dialog', 'alert-dialog', 'states'],
    component,
    props: ['open', 'destructive', 'onConfirm'],
    load: () => import('./DialogStatesDemo.svelte'),
  }),
  defineExample({
    id: 'ui-dialog-rtl',
    title: 'Dialog, right to left',
    description:
      'A workspace settings dialog with Arabic labels in a right-to-left layout, shown open with logical padding.',
    tags: ['ui', 'dialog', 'rtl', 'i18n'],
    component,
    props: ['title', 'closeLabel'],
    load: () => import('./DialogRtlDemo.svelte'),
  }),
  defineExample({
    id: 'ui-dialog-dark',
    title: 'Dialog on a dark surface',
    description: 'Dialog and alert trigger on the dark theme using only token colors.',
    tags: ['ui', 'dialog', 'dark'],
    component,
    load: () => import('./DialogDarkDemo.svelte'),
  }),
] as const;
