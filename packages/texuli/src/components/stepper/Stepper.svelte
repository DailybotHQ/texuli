<script lang="ts">
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { StepperOrientation, StepperStep, StepperStepState } from './types.ts';
import { stepperClass } from './variants.ts';
import './stepper.css';

interface Props {
  steps: readonly StepperStep[];
  /** 0-based index of the active step. */
  current: number;
  /** Ids of completed steps; defaults to every step before `current`. */
  completed?: Iterable<string>;
  orientation?: StepperOrientation;
  /** Makes completed steps (and the current one) clickable for back-navigation. */
  onStepClick?: (index: number) => void;
  /** Accessible name for the progress navigation (localizable). */
  label?: string;
  class?: ClassValue;
}

let {
  steps,
  current,
  completed,
  orientation = 'horizontal',
  onStepClick,
  label = 'Progress',
  class: className,
}: Props = $props();

const done = $derived(
  completed
    ? new Set(completed)
    : new Set(steps.slice(0, Math.max(0, current)).map((step) => step.id))
);

function stateFor(index: number, id: string): StepperStepState {
  if (index === current) return 'current';
  if (done.has(id)) return 'complete';
  return 'upcoming';
}

function statusPhrase(state: StepperStepState): string {
  if (state === 'complete') return 'completed';
  if (state === 'current') return 'current step';
  return 'not started';
}
</script>

<nav aria-label={label} class={stepperClass({ orientation, class: className })} data-tx-stepper data-orientation={orientation}>
  <ol class="tx-stepper__list">
    {#each steps as step, index (step.id)}
      {@const state = stateFor(index, step.id)}
      {@const isLast = index === steps.length - 1}
      {@const clickable = onStepClick !== undefined && (state === 'complete' || state === 'current')}
      <li
        class="tx-stepper__item"
        data-state={state}
        aria-current={state === 'current' ? 'step' : undefined}
      >
        {#if !isLast}
          <span
            class="tx-stepper__connector"
            data-complete={state === 'complete' ? 'true' : undefined}
            aria-hidden="true"
          ></span>
        {/if}

        {#snippet stepBody()}
          <span class="tx-stepper__marker" data-state={state} aria-hidden="true">
            {#if state === 'complete'}
              <svg class="tx-stepper__check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3.5 8.5 6.5 11.5 12.5 4.5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            {:else}
              {index + 1}
            {/if}
          </span>
          <span class="tx-stepper__text">
            <span class="tx-stepper__label" data-active={state !== 'upcoming' ? 'true' : undefined}
              >{step.label}</span
            >
            {#if step.description}
              <span class="tx-stepper__description">{step.description}</span>
            {/if}
          </span>
          <span class="tx-stepper__sr">({statusPhrase(state)})</span>
        {/snippet}

        {#if clickable}
          <button
            type="button"
            class="tx-stepper__trigger"
            onclick={() => onStepClick?.(index)}
          >
            {@render stepBody()}
          </button>
        {:else}
          <div class="tx-stepper__body">
            {@render stepBody()}
          </div>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
