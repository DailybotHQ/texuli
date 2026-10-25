import { variants } from '../../internal/variants.ts';
import type { StepperOrientation } from './types.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './stepper.css';

export const STEPPER_ORIENTATIONS = [
  'horizontal',
  'vertical',
] as const satisfies readonly StepperOrientation[];

export const stepperClass = variants({
  base: 'tx-stepper',
  variants: {
    orientation: {
      horizontal: 'tx-stepper--horizontal',
      vertical: 'tx-stepper--vertical',
    },
  },
  defaultVariants: { orientation: 'horizontal' },
});

export const wizardClass = variants({
  base: 'tx-wizard',
  variants: {},
  defaultVariants: {},
});
