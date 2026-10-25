/** One step in a Stepper or Wizard. Labels are author-provided and must be localizable. */
export interface StepperStep {
  id: string;
  label: string;
  description?: string;
}

export type StepperOrientation = 'horizontal' | 'vertical';

export type StepperStepState = 'complete' | 'current' | 'upcoming';
