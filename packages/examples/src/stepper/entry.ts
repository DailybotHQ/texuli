import { defineExample } from '../registry.ts';

export const texuliStepperExample = defineExample({
  id: 'texuli-stepper',
  title: 'Stepper and Wizard',
  description:
    'Horizontal and vertical steppers (including RTL), plus a multi-step wizard with validation. Fictional Harbor workspace copy only.',
  tags: ['texuli', 'stepper', 'wizard', 'form', 'a11y'],
  component: 'texuli/Stepper',
  props: ['steps', 'current', 'orientation', 'completed', 'canAdvance', 'validate'],
  load: () => import('./StepperDemo.svelte'),
});
