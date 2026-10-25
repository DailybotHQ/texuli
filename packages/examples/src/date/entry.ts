import { defineExample } from '../registry.ts';

export const texuliDateExample = defineExample({
  id: 'texuli-date',
  title: 'Date pickers and calendar',
  description:
    'Styled Calendar, DatePicker and DateRangePicker with presets, on the owned APG primitives: sizes, required, invalid, disabled, bounds, RTL and dark.',
  tags: ['texuli', 'date', 'calendar', 'form', 'rtl', 'dark'],
  component: 'texuli/DatePicker',
  props: [
    'value',
    'label',
    'description',
    'error',
    'size',
    'disabled',
    'presets',
    'today',
    'minValue',
    'maxValue',
  ],
  load: () => import('./DateDemo.svelte'),
});
