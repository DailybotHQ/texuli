<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { Button } from '../button/index.ts';
import Stepper from './Stepper.svelte';
import type { StepperStep } from './types.ts';
import { wizardClass } from './variants.ts';
import './stepper.css';

type OwnProps = {
  steps: readonly StepperStep[];
  /** 0-based active step (bindable). */
  current?: number;
  /** Renders the body of the active step. */
  content: Snippet<[{ step: StepperStep; index: number }]>;
  /** Synchronous gate for the Next/Finish button. */
  canAdvance?: (index: number) => boolean;
  /**
   * Runs on Next/Finish. Return `false` or an error message to stay on the step.
   * May be async. Thrown errors become the alert message.
   */
  validate?: (index: number) => unknown;
  onFinish?: () => void | Promise<void>;
  onStepChange?: (index: number) => void;
  /** Localizable control labels. */
  backLabel?: string;
  nextLabel?: string;
  finishLabel?: string;
  /** Default message when `validate` returns `false`. */
  reviewMessage?: string;
  /** Default message when validate throws a non-Error. */
  failureMessage?: string;
  /** Extra footer content (e.g. Cancel) on the start side. */
  secondaryActions?: Snippet;
  class?: ClassValue;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

/** Extra attributes (`data-*`, `aria-*`, `id`, handlers…) land on the root element. */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'children'>;

let {
  steps,
  current = $bindable(0),
  content,
  canAdvance = () => true,
  validate,
  onFinish,
  onStepChange,
  backLabel = 'Back',
  nextLabel = 'Next',
  finishLabel = 'Finish',
  reviewMessage = 'Please review this step before continuing.',
  failureMessage = 'Something went wrong.',
  secondaryActions,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

function bindRef(node: HTMLElement): () => void {
  ref = node;
  return () => {
    if (ref === node) ref = null;
  };
}

let completed = $state(new Set<string>());
let busy = $state(false);
let error = $state<string | null>(null);
let panel = $state<HTMLElement | null>(null);

const step = $derived(steps[current]);
const isLast = $derived(current >= steps.length - 1);
const advanceAllowed = $derived(canAdvance(current));

function goTo(index: number): void {
  if (index < 0 || index >= steps.length || index === current) return;
  current = index;
  error = null;
  onStepChange?.(index);
  queueMicrotask(() => panel?.focus());
}

async function next(): Promise<void> {
  if (busy || !step || !advanceAllowed) return;
  busy = true;
  error = null;
  try {
    const result = await validate?.(current);
    if (result === false || typeof result === 'string') {
      error = typeof result === 'string' ? result : reviewMessage;
      return;
    }
    completed = new Set([...completed, step.id]);
    if (isLast) await onFinish?.();
    else goTo(current + 1);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : failureMessage;
  } finally {
    busy = false;
  }
}

function onStepperClick(index: number): void {
  if (index < current) goTo(index);
}
</script>

<div
  {...rest}
  {@attach bindRef}
  class={wizardClass({ class: className })}
  data-tx-wizard
>
  <Stepper
    {steps}
    {current}
    completed={completed}
    onStepClick={onStepperClick}
  />

  {#if step}
    <section
      bind:this={panel}
      tabindex="-1"
      class="tx-wizard__panel"
      aria-label={`Step ${current + 1} of ${steps.length}: ${step.label}`}
      data-tx-wizard-panel
    >
      {@render content({ step, index: current })}
    </section>
  {/if}

  {#if error}
    <p role="alert" class="tx-wizard__error" data-tx-wizard-error>{error}</p>
  {/if}

  <div class="tx-wizard__footer">
    <div class="tx-wizard__secondary">{@render secondaryActions?.()}</div>
    <div class="tx-wizard__actions">
      {#if current > 0}
        <Button variant="outline" disabled={busy} onclick={() => goTo(current - 1)}>
          <svg class="tx-wizard__chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 3 5 8l5 5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {backLabel}
        </Button>
      {/if}
      <Button loading={busy} disabled={!advanceAllowed} onclick={next}>
        {isLast ? finishLabel : nextLabel}
        {#if !isLast && !busy}
          <svg class="tx-wizard__chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="m6 3 5 5-5 5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {/if}
      </Button>
    </div>
  </div>
</div>
