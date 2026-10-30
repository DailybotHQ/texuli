import { defineExample } from '../registry.ts';

export const formsRegistrationExample = defineExample({
  id: 'forms-registration',
  title: 'Schema form: multi-step registration',
  description:
    'A three-step form painted from a closed schema: sections, a field that appears and becomes required from an earlier answer, a step that opens once a track is chosen, a cross-field date rule and an error summary. Fictional event.',
  tags: ['forms', 'schema', 'steps', 'validation', 'keyboard'],
  component: 'forms/SchemaForm',
  props: ['form', 'values', 'onSubmit', 'headingLevel'],
  load: () => import('./FormsRegistrationDemo.svelte'),
});

export const formsFieldsExample = defineExample({
  id: 'forms-fields',
  title: 'Schema form: every field type',
  description:
    'One page with every field type of the form schema (text, textarea, number, email, url, date, time, select, multiselect, checkbox, radio, switch, slider, file and tags), each a texuli control with its label, description and errors.',
  tags: ['forms', 'schema', 'fields'],
  component: 'forms/SchemaForm',
  props: ['form', 'values', 'labels'],
  load: () => import('./FormsFieldsDemo.svelte'),
});
