import { defineExample } from '../registry.ts';

export const texuliFieldExample = defineExample({
  id: 'texuli-field',
  title: 'Field and Form',
  description:
    'Labeled fields with description and error states, horizontal RTL layout, and a form validate hook. Fictional Harbor workspace copy only.',
  tags: ['texuli', 'field', 'form', 'a11y', 'validation'],
  component: 'texuli/Field',
  props: ['label', 'description', 'error', 'required', 'orientation', 'onValidate'],
  load: () => import('./FieldDemo.svelte'),
});
