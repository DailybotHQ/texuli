<script lang="ts">
import type { StepperStep } from '../src/components/stepper/types.ts';
import Wizard from '../src/components/stepper/Wizard.svelte';

interface Props {
  steps: readonly StepperStep[];
  current?: number;
  canAdvance?: (index: number) => boolean;
  validate?: (index: number) => unknown;
  onFinish?: () => void | Promise<void>;
  onStepChange?: (index: number) => void;
  reviewMessage?: string;
  backLabel?: string;
  nextLabel?: string;
  finishLabel?: string;
}

let {
  steps,
  current = $bindable(0),
  canAdvance,
  validate,
  onFinish,
  onStepChange,
  reviewMessage,
  backLabel,
  nextLabel,
  finishLabel,
}: Props = $props();
</script>

<Wizard
  {steps}
  bind:current
  {canAdvance}
  {validate}
  {onFinish}
  {onStepChange}
  {reviewMessage}
  {backLabel}
  {nextLabel}
  {finishLabel}
>
  {#snippet content({ step, index })}
    <p data-harness-step={step.id}>Body for {step.label} ({index})</p>
  {/snippet}
</Wizard>
