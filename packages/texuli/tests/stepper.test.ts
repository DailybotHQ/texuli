import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Stepper from '../src/components/stepper/Stepper.svelte';
import type { StepperStep } from '../src/components/stepper/types.ts';
import { STEPPER_ORIENTATIONS, stepperClass } from '../src/components/stepper/variants.ts';
import WizardHarness from './WizardHarness.svelte';

afterEach(cleanup);

const STEPS: StepperStep[] = [
  { id: 'account', label: 'Account', description: 'Your details' },
  { id: 'plan', label: 'Plan' },
  { id: 'confirm', label: 'Confirm', description: 'Review' },
];

describe('stepperClass', () => {
  it('exposes horizontal and vertical orientations', () => {
    expect(STEPPER_ORIENTATIONS).toEqual(['horizontal', 'vertical']);
    expect(stepperClass({ orientation: 'vertical' })).toContain('tx-stepper--vertical');
    expect(stepperClass({ orientation: 'horizontal' })).toContain('tx-stepper--horizontal');
  });
});

describe('Stepper', () => {
  it('marks the current step and completes prior steps by default', () => {
    const view = render(Stepper, { props: { steps: STEPS, current: 1 } });
    const root = view.container.querySelector('[data-tx-stepper]');
    expect(root).toBeTruthy();
    expect(root?.getAttribute('data-orientation')).toBe('horizontal');
    const items = view.container.querySelectorAll('.tx-stepper__item');
    expect(items).toHaveLength(3);
    expect(items[0]?.getAttribute('data-state')).toBe('complete');
    expect(items[1]?.getAttribute('data-state')).toBe('current');
    expect(items[1]?.getAttribute('aria-current')).toBe('step');
    expect(items[2]?.getAttribute('data-state')).toBe('upcoming');
    expect(view.getByText('Plan')).toBeTruthy();
    expect(view.getByText('(current step)')).toBeTruthy();
  });

  it('renders vertical orientation and honors explicit completed ids', () => {
    const view = render(Stepper, {
      props: {
        steps: STEPS,
        current: 2,
        completed: ['account'],
        orientation: 'vertical',
        label: 'Onboarding',
      },
    });
    const root = view.container.querySelector('[data-tx-stepper]');
    expect(root?.getAttribute('data-orientation')).toBe('vertical');
    expect(view.getByLabelText('Onboarding')).toBeTruthy();
    const items = view.container.querySelectorAll('.tx-stepper__item');
    expect(items[0]?.getAttribute('data-state')).toBe('complete');
    expect(items[1]?.getAttribute('data-state')).toBe('upcoming');
    expect(items[2]?.getAttribute('data-state')).toBe('current');
  });

  it('invokes onStepClick for completed and current steps only', async () => {
    const onStepClick = vi.fn();
    const view = render(Stepper, {
      props: { steps: STEPS, current: 1, onStepClick },
    });
    const buttons = view.container.querySelectorAll('button.tx-stepper__trigger');
    expect(buttons.length).toBe(2);
    await fireEvent.click(buttons[0]!);
    expect(onStepClick).toHaveBeenCalledWith(0);
  });
});

describe('Wizard', () => {
  it('advances on Next, goes back, and finishes on the last step', async () => {
    const onFinish = vi.fn();
    const onStepChange = vi.fn();
    const view = render(WizardHarness, {
      props: {
        steps: STEPS,
        current: 0,
        onFinish,
        onStepChange,
      },
    });
    expect(view.container.querySelector('[data-harness-step="account"]')).toBeTruthy();
    await fireEvent.click(view.getByRole('button', { name: /Next/i }));
    await waitFor(() => expect(onStepChange).toHaveBeenCalledWith(1));
    expect(view.container.querySelector('[data-harness-step="plan"]')).toBeTruthy();

    await fireEvent.click(view.getByRole('button', { name: /Back/i }));
    await waitFor(() => expect(onStepChange).toHaveBeenCalledWith(0));

    // Jump to last via next twice
    await fireEvent.click(view.getByRole('button', { name: /Next/i }));
    await waitFor(() =>
      expect(view.container.querySelector('[data-harness-step="plan"]')).toBeTruthy()
    );
    await fireEvent.click(view.getByRole('button', { name: /Next/i }));
    await waitFor(() => expect(view.getByRole('button', { name: /Finish/i })).toBeTruthy());
    await fireEvent.click(view.getByRole('button', { name: /Finish/i }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  });

  it('stays when validate returns false and shows the review message', async () => {
    const view = render(WizardHarness, {
      props: {
        steps: STEPS,
        current: 0,
        validate: () => false,
        reviewMessage: 'Fill the fictional form first.',
      },
    });
    await fireEvent.click(view.getByRole('button', { name: /Next/i }));
    await waitFor(() => {
      expect(view.getByRole('alert').textContent).toContain('Fill the fictional form first.');
    });
    expect(view.queryByRole('button', { name: /Back/i })).toBeNull();
    expect(view.container.querySelector('[data-harness-step="account"]')).toBeTruthy();
  });

  it('disables Next when canAdvance is false', () => {
    const view = render(WizardHarness, {
      props: {
        steps: STEPS,
        current: 0,
        canAdvance: () => false,
      },
    });
    expect(view.getByRole('button', { name: /Next/i })).toHaveProperty('disabled', true);
  });

  it('surfaces validate string errors', async () => {
    const view = render(WizardHarness, {
      props: {
        steps: STEPS,
        current: 0,
        validate: async () => 'Name is required.',
      },
    });
    await fireEvent.click(view.getByRole('button', { name: /Next/i }));
    await waitFor(() => expect(view.getByRole('alert').textContent).toContain('Name is required.'));
  });
});
