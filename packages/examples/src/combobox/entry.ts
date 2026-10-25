import { defineExample } from '../registry.ts';

export const texuliComboboxExample = defineExample({
  id: 'texuli-combobox',
  title: 'Combobox and MultiSelect',
  description:
    'Styled combobox with async loading, empty and error chrome, multi-select chips. Fictional Harbor Notes people and tags.',
  tags: ['texuli', 'combobox', 'multiselect', 'a11y', 'rtl', 'dark'],
  component: 'texuli/Combobox',
  props: ['items', 'loadOptions', 'multiple', 'variant', 'size', 'disabled'],
  load: () => import('./ComboboxDemo.svelte'),
});
