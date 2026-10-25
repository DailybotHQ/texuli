import { defineExample } from '../registry.ts';

export const texuliChoiceExample = defineExample({
  id: 'texuli-choice',
  title: 'Checkbox, Radio and Switch',
  description:
    'Styled choice controls with labels, descriptions, indeterminate checkbox, card radios, sizes and RTL. Fictional Harbor Notes preferences.',
  tags: ['texuli', 'checkbox', 'radio', 'switch', 'a11y'],
  component: 'texuli/Checkbox',
  props: ['checked', 'label', 'description', 'indeterminate', 'variant', 'orientation'],
  load: () => import('./ChoiceDemo.svelte'),
});
