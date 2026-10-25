<script lang="ts">
import { Button } from 'texuli/button';
import { Stepper, type StepperStep, Wizard } from 'texuli/stepper';

const steps: StepperStep[] = [
  { id: 'profile', label: 'Profile', description: 'Name and role' },
  { id: 'workspace', label: 'Workspace', description: 'Team settings' },
  { id: 'review', label: 'Review', description: 'Confirm details' },
];

let wizardCurrent = $state(0);
let name = $state('');
let finished = $state(false);

function canAdvance(index: number): boolean {
  if (index === 0) return name.trim().length >= 2;
  return true;
}

function validate(index: number): true | string {
  if (index === 0 && name.trim().length < 2) return 'Enter at least two characters.';
  return true;
}
</script>

<section data-example="texuli-stepper" aria-labelledby="stepper-demo-title">
  <h2 id="stepper-demo-title">Stepper and Wizard</h2>

  <h3>Horizontal (default)</h3>
  <Stepper steps={steps} current={1} label="Horizontal progress" />

  <h3>Vertical + RTL</h3>
  <div dir="rtl">
    <Stepper
      steps={steps}
      current={0}
      orientation="vertical"
      completed={['workspace']}
      label="Vertical progress"
    />
  </div>

  <h3>Wizard (multi-step form)</h3>
  {#if finished}
    <p role="status" data-wizard-finished>Onboarding complete for the fictional workspace.</p>
  {:else}
    <Wizard
      steps={steps}
      bind:current={wizardCurrent}
      canAdvance={canAdvance}
      validate={validate}
      onFinish={() => {
        finished = true;
      }}
      backLabel="Back"
      nextLabel="Continue"
      finishLabel="Finish setup"
    >
      {#snippet content({ step, index })}
        <div data-wizard-step={step.id}>
          <p>Step {index + 1}: {step.label}</p>
          {#if index === 0}
            <label>
              Display name
              <input
                type="text"
                name="displayName"
                autocomplete="nickname"
                bind:value={name}
                placeholder="Alex Harbor"
              />
            </label>
          {:else if index === 1}
            <p>Choose a fictional team size later. Continue when ready.</p>
          {:else}
            <p>Review: {name || '—'} joins the sample workspace.</p>
          {/if}
        </div>
      {/snippet}
      {#snippet secondaryActions()}
        <Button
          variant="ghost"
          type="button"
          onclick={() => {
            wizardCurrent = 0;
            name = '';
            finished = false;
          }}
        >
          Reset
        </Button>
      {/snippet}
    </Wizard>
  {/if}
</section>

<style>
  section {
    display: grid;
    gap: 1.5rem;
    padding: 1rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2,
  h3 {
    margin: 0;
  }
  label {
    display: grid;
    gap: 0.35rem;
    max-inline-size: 20rem;
  }
  input {
    padding-block: 0.4rem;
    padding-inline: 0.6rem;
    border: 1px solid var(--tx-border, currentColor);
    border-radius: var(--tx-radius-md, 0.375rem);
    background: var(--tx-surface, Canvas);
    color: inherit;
  }
</style>
