import { defineExample } from '../registry.ts';

export const texuliSliderExample = defineExample({
  id: 'texuli-slider',
  title: 'Slider',
  description:
    'Styled single and range sliders with sizes, marks, vertical orientation, RTL and dark. Fictional controls only.',
  tags: ['texuli', 'slider', 'form', 'rtl', 'dark'],
  component: 'texuli/Slider',
  props: ['value', 'type', 'min', 'max', 'step', 'orientation', 'marks', 'size'],
  load: () => import('./SliderDemo.svelte'),
});
