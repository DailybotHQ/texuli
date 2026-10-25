<script lang="ts">
import type { Snippet } from 'svelte';
import { Wizard } from '../../components/stepper/index.ts';
import type { StepperStep } from '../../components/stepper/types.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { isNestedInMain } from '../host/nested-main.ts';
import './auth-settings.css';

/**
 * Onboarding wizard page frame: centered header + card that holds either a
 * `Wizard` (steps + content) or a LayoutHost screen outlet.
 */
type Props = {
  steps?: readonly StepperStep[];
  content?: Snippet<[{ step: StepperStep; index: number }]>;
  /** LayoutHost: mounts the stable routed screen inside the card. */
  mountScreen?: (target: HTMLElement) => void;
  current?: number;
  title?: string;
  description?: string;
  canAdvance?: (index: number) => boolean;
  validate?: (index: number) => unknown;
  onFinish?: () => void | Promise<void>;
  onStepChange?: (index: number) => void;
  backLabel?: string;
  nextLabel?: string;
  finishLabel?: string;
  secondaryActions?: Snippet;
  brand?: Snippet;
  class?: ClassValue;
};

let {
  steps,
  content,
  mountScreen,
  current = $bindable(0),
  title,
  description,
  canAdvance,
  validate,
  onFinish,
  onStepChange,
  backLabel,
  nextLabel,
  finishLabel,
  secondaryActions,
  brand,
  class: className,
}: Props = $props();

let screenTarget = $state<HTMLDivElement | undefined>();
let root = $state<HTMLElement | undefined>();
/** Inside another page <main> (docs live demos), render a region instead of a second main. */
let nested = $state(false);

$effect(() => {
  nested = isNestedInMain(root);
});
$effect(() => {
  if (mountScreen && screenTarget) mountScreen(screenTarget);
});
</script>

<svelte:element
  this={nested ? 'div' : 'main'}
  bind:this={root}
  class={cx('tx-wizard-layout', className)}
  data-tx-layout="wizard"
  data-tx-wizard-layout
  role={nested ? 'region' : undefined}
  aria-label={nested ? (title ?? 'Wizard') : undefined}
  tabindex={nested ? 0 : undefined}
>
  <div class="tx-wizard-layout__frame">
    <header class="tx-wizard-layout__header">
      {@render brand?.()}
      {#if title}
        <h1 class="tx-wizard-layout__title">{title}</h1>
      {/if}
      {#if description}
        <p class="tx-wizard-layout__description">{description}</p>
      {/if}
    </header>

    <section class="tx-wizard-layout__body">
      {#if steps && content}
        <Wizard
          {steps}
          bind:current
          {content}
          {canAdvance}
          {validate}
          {onFinish}
          {onStepChange}
          {backLabel}
          {nextLabel}
          {finishLabel}
          {secondaryActions}
        />
      {:else if mountScreen}
        <div bind:this={screenTarget} data-tx-layout-screen-target></div>
      {/if}
    </section>
  </div>
</svelte:element>
