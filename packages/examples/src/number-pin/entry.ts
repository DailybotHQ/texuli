import { defineExample } from '../registry.ts';

export const texuliNumberPinExample = defineExample({
  id: 'texuli-number-pin',
  title: 'NumberField and PinInput',
  description:
    'Locale-aware number controls and one-time-code cells with sizes, disabled states, RTL and dark surfaces.',
  tags: ['texuli', 'number-field', 'pin-input', 'forms', 'a11y'],
  component: 'texuli/NumberField',
  props: ['size', 'value', 'locale', 'maxlength', 'disabled', 'dir', 'mask'],
  load: () => import('./NumberPinDemo.svelte'),
});
